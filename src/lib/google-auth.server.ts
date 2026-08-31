import { getCookie, setCookie } from "@tanstack/react-start/server";
import { createHmac, randomUUID } from "node:crypto";
import { getCollections, type AppRole } from "./mongo";

const COOKIE_NAME = "sh_session";
const SESSION_DAYS = 30;
const ADMIN_EMAIL = "admin@college.edu";
const CALLBACK = "/api/auth/google/callback";

function secret() { return process.env["AUTH_SECRET"] || `sh:${process.env["MONGODB_URI"] ?? "dev-secret"}`; }
function sign(userId: string, admin: boolean) {
  const body = Buffer.from(JSON.stringify({ sub: userId, admin, exp: Date.now() + SESSION_DAYS * 864e5 })).toString("base64url");
  return `${body}.${createHmac("sha256", secret()).update(body).digest("base64url")}`;
}
function issueSession(userId: string, admin: boolean) { setCookie(COOKIE_NAME, sign(userId, admin), { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: SESSION_DAYS * 86400 }); }

export function googleAuthorizationUrl(origin: string) {
  const clientId = process.env["GOOGLE_CLIENT_ID"];
  if (!clientId) throw new Error("Google OAuth is not configured.");
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.search = new URLSearchParams({ client_id: clientId, redirect_uri: `${origin}${CALLBACK}`, response_type: "code", scope: "openid email profile", access_type: "offline", prompt: "select_account" }).toString();
  return url.toString();
}

export async function completeGoogleSignIn(requestUrl: string): Promise<Response> {
  const url = new URL(requestUrl); const code = url.searchParams.get("code");
  if (!code) return Response.redirect(new URL("/login?error=google_cancelled", url.origin), 302);
  const clientId = process.env["GOOGLE_CLIENT_ID"]; const clientSecret = process.env["GOOGLE_CLIENT_SECRET"];
  if (!clientId || !clientSecret) return Response.redirect(new URL("/login?error=google_unavailable", url.origin), 302);
  const token = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ code, client_id: clientId, client_secret: clientSecret, redirect_uri: `${url.origin}${CALLBACK}`, grant_type: "authorization_code" }) });
  if (!token.ok) return Response.redirect(new URL("/login?error=google_failed", url.origin), 302);
  const data = await token.json() as { access_token?: string }; if (!data.access_token) return Response.redirect(new URL("/login?error=google_failed", url.origin), 302);
  const profileResponse = await fetch("https://openidconnect.googleapis.com/v1/userinfo", { headers: { authorization: `Bearer ${data.access_token}` } });
  if (!profileResponse.ok) return Response.redirect(new URL("/login?error=google_failed", url.origin), 302);
  const profile = await profileResponse.json() as { sub?: string; email?: string; name?: string; email_verified?: boolean };
  if (!profile.email || profile.email_verified === false) return Response.redirect(new URL("/login?error=google_email_unverified", url.origin), 302);
  const { users } = await getCollections(); const email = profile.email.toLowerCase(); let user = await users.findOne({ email });
  if (!user) { const role: AppRole = email === ADMIN_EMAIL ? "admin" : "student"; user = { _id: randomUUID(), email, full_name: profile.name || email.split("@")[0], student_id: null, password_hash: `google:${profile.sub || randomUUID()}`, role, created_at: new Date() }; await users.insertOne(user); }
  issueSession(user._id, user.role === "admin"); return Response.redirect(new URL("/dashboard", url.origin), 302);
}
