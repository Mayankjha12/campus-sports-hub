import { createServerFn, createMiddleware } from "@tanstack/react-start";
import { getCookie, setCookie, deleteCookie } from "@tanstack/react-start/server";
import { randomBytes, scryptSync, timingSafeEqual, createHmac } from "node:crypto";
import { z } from "zod";

import { getCollections, type AppRole } from "./mongo";

/**
 * Cookie-based auth backed by MongoDB, replacing Supabase Auth.
 *
 * - Passwords are hashed with scrypt (Node builtin) as `salt:hash`.
 * - Sessions are a compact HMAC-signed token stored in an httpOnly cookie.
 * - `requireAuth` is a server function middleware that verifies the cookie and
 *   injects `{ userId, isAdmin }` into the handler context.
 */

const COOKIE_NAME = "sh_session";
const SESSION_DAYS = 30;
const ADMIN_EMAIL = "admin@college.edu";

// A stable secret. Prefer AUTH_SECRET; otherwise derive one from the Mongo URI
// (which contains a password) so tokens stay valid across restarts without
// asking the user for another env var.
function secret(): string {
  return process.env["AUTH_SECRET"] || `sh:${process.env["MONGODB_URI"] ?? "dev-secret"}`;
}

function b64url(input: Buffer | string): string {
  return Buffer.from(input).toString("base64url");
}

// ---------- password hashing ----------

function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, 64);
  return `${salt.toString("hex")}:${hash.toString("hex")}`;
}

function verifyPassword(password: string, stored: string): boolean {
  const [saltHex, hashHex] = stored.split(":");
  if (!saltHex || !hashHex) return false;
  const hash = scryptSync(password, Buffer.from(saltHex, "hex"), 64);
  const expected = Buffer.from(hashHex, "hex");
  return hash.length === expected.length && timingSafeEqual(hash, expected);
}

// ---------- session token ----------

interface SessionPayload {
  sub: string;
  admin: boolean;
  exp: number;
}

function sign(payload: SessionPayload): string {
  const body = b64url(JSON.stringify(payload));
  const sig = createHmac("sha256", secret()).update(body).digest("base64url");
  return `${body}.${sig}`;
}

function verify(token: string | undefined): SessionPayload | null {
  if (!token) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const expected = createHmac("sha256", secret()).update(body).digest("base64url");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString()) as SessionPayload;
    if (typeof payload.exp !== "number" || payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

function issueSession(userId: string, isAdmin: boolean): void {
  const token = sign({ sub: userId, admin: isAdmin, exp: Date.now() + SESSION_DAYS * 864e5 });
  setCookie(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env["NODE_ENV"] === "production",
    path: "/",
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  });
}

function currentSession(): SessionPayload | null {
  return verify(getCookie(COOKIE_NAME));
}

// ---------- middleware ----------

/** Requires a valid session cookie; injects userId + isAdmin into context. */
export const requireAuth = createMiddleware({ type: "function" }).server(async ({ next }) => {
  const session = currentSession();
  if (!session) {
    throw new Error("Unauthorized: please sign in.");
  }
  return next({ context: { userId: session.sub, isAdmin: session.admin } });
});

// ---------- public shapes ----------

export interface AuthUser {
  id: string;
  full_name: string;
  email: string;
  student_id: string | null;
  isAdmin: boolean;
}

const signUpSchema = z.object({
  fullName: z.string().trim().min(1).max(120),
  studentId: z.string().trim().max(60).optional().default(""),
  email: z.string().trim().email().max(160),
  password: z.string().min(6).max(200),
});

const signInSchema = z.object({
  email: z.string().trim().email().max(160),
  password: z.string().min(1).max(200),
});

// ---------- server functions ----------

export const signUpFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => signUpSchema.parse(data))
  .handler(async ({ data }): Promise<{ ok: true; user: AuthUser } | { ok: false; message: string }> => {
    const { users } = await getCollections();
    const email = data.email.toLowerCase();
    const role: AppRole = email === ADMIN_EMAIL ? "admin" : "student";

    const user = {
      _id: crypto.randomUUID(),
      email,
      full_name: data.fullName || email.split("@")[0] || email,
      student_id: data.studentId ? data.studentId : null,
      password_hash: hashPassword(data.password),
      role,
      created_at: new Date(),
    };

    try {
      await users.insertOne(user);
    } catch (err) {
      if (typeof err === "object" && err !== null && (err as { code?: number }).code === 11000) {
        return { ok: false, message: "An account with this email already exists. Try signing in." };
      }
      return { ok: false, message: "Could not create the account. Please try again." };
    }

    issueSession(user._id, role === "admin");
    return {
      ok: true,
      user: { id: user._id, full_name: user.full_name, email: user.email, student_id: user.student_id, isAdmin: role === "admin" },
    };
  });

export const signInFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => signInSchema.parse(data))
  .handler(async ({ data }): Promise<{ ok: true; user: AuthUser } | { ok: false; message: string }> => {
    const { users } = await getCollections();
    const email = data.email.toLowerCase();
    const user = await users.findOne({ email });
    if (!user || !verifyPassword(data.password, user.password_hash)) {
      return { ok: false, message: "Incorrect email or password." };
    }
    const isAdmin = user.role === "admin";
    issueSession(user._id, isAdmin);
    return {
      ok: true,
      user: { id: user._id, full_name: user.full_name, email: user.email, student_id: user.student_id, isAdmin },
    };
  });

export const signOutFn = createServerFn({ method: "POST" }).handler(async () => {
  deleteCookie(COOKIE_NAME, { path: "/" });
  return { ok: true as const };
});

export const getMeFn = createServerFn({ method: "GET" }).handler(async (): Promise<AuthUser | null> => {
  const session = currentSession();
  if (!session) return null;
  const { users } = await getCollections();
  const user = await users.findOne({ _id: session.sub });
  if (!user) return null;
  return {
    id: user._id,
    full_name: user.full_name,
    email: user.email,
    student_id: user.student_id,
    isAdmin: user.role === "admin",
  };
});

