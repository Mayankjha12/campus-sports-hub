import { MongoClient, type Db, type Collection } from "mongodb";

/**
 * MongoDB connection + one-time setup (indexes + facility seed).
 *
 * This module is server-only. It is imported exclusively from TanStack Start
 * server functions and server middleware, so the connection string never
 * reaches the browser bundle.
 */

const MONGODB_URI = process.env["MONGODB_URI"];
const MONGODB_DB_NAME = process.env["MONGODB_DB_NAME"] || "campus_sports_hub";

if (!MONGODB_URI) {
  throw new Error("Missing MONGODB_URI environment variable.");
}

// Reuse the client across hot reloads (dev) and warm serverless invocations (prod).
const globalForMongo = globalThis as unknown as {
  _mongoClientPromise?: Promise<MongoClient>;
  _mongoSetupPromise?: Promise<void>;
};

function client(): Promise<MongoClient> {
  if (!globalForMongo._mongoClientPromise) {
    const c = new MongoClient(MONGODB_URI!, { maxPoolSize: 10, retryWrites: true });
    globalForMongo._mongoClientPromise = c.connect();
  }
  return globalForMongo._mongoClientPromise;
}

// ---------- Document types ----------

export type AppRole = "student" | "admin";
export type FacilityStatus = "open" | "closed" | "maintenance";
export type BookingStatus = "confirmed" | "cancelled" | "completed";

export interface UserDoc {
  _id: string;
  email: string;
  full_name: string;
  student_id: string | null;
  password_hash: string;
  role: AppRole;
  created_at: Date;
}

export interface FacilityDoc {
  _id: string;
  name: string;
  sport: string;
  location: string;
  capacity: number;
  equipment: string[];
  description: string;
  image_key: string;
  open_hour: number;
  close_hour: number;
  status: FacilityStatus;
  created_at: Date;
}

export interface BookingDoc {
  _id: string;
  reference: string;
  user_id: string;
  facility_id: string;
  booking_date: string;
  start_time: string;
  end_time: string;
  status: BookingStatus;
  created_at: Date;
}

export interface WaitlistDoc {
  _id: string;
  user_id: string;
  facility_id: string;
  booking_date: string;
  start_time: string;
  end_time: string;
  status: string;
  created_at: Date;
}

export interface NotificationDoc {
  _id: string;
  user_id: string;
  title: string;
  body: string;
  kind: string;
  read: boolean;
  created_at: Date;
}

export interface DemoBookingDoc {
  _id: string;
  run_id: string;
  facility_id: string;
  booking_date: string;
  start_time: string;
  actor: string;
  created_at: Date;
}

export interface Collections {
  users: Collection<UserDoc>;
  facilities: Collection<FacilityDoc>;
  bookings: Collection<BookingDoc>;
  waitlist: Collection<WaitlistDoc>;
  notifications: Collection<NotificationDoc>;
  demo_bookings: Collection<DemoBookingDoc>;
}

async function database(): Promise<Db> {
  const c = await client();
  return c.db(MONGODB_DB_NAME);
}

// ---------- One-time setup: indexes + seed ----------

const SEED_FACILITIES: Omit<FacilityDoc, "_id" | "created_at">[] = [
  { name: "Badminton Court 1", sport: "Badminton", location: "Indoor Sports Complex, Block A", capacity: 4, equipment: ["Rackets", "Shuttlecocks", "Net"], description: "Wooden-floor indoor court with tournament-grade lighting and synthetic mat overlay. Preferred court for inter-department matches.", image_key: "badminton", open_hour: 6, close_hour: 22, status: "open" },
  { name: "Badminton Court 2", sport: "Badminton", location: "Indoor Sports Complex, Block A", capacity: 4, equipment: ["Rackets", "Shuttlecocks", "Net"], description: "Second indoor badminton court, ideal for casual doubles and evening practice sessions.", image_key: "badminton", open_hour: 6, close_hour: 22, status: "open" },
  { name: "Tennis Court 1", sport: "Tennis", location: "North Campus Lawns", capacity: 4, equipment: ["Rackets", "Tennis balls", "Ball machine"], description: "Synthetic hard court with floodlights for night play, adjacent to the athletics track.", image_key: "tennis", open_hour: 6, close_hour: 21, status: "open" },
  { name: "Basketball Court", sport: "Basketball", location: "Central Quad, near Library", capacity: 10, equipment: ["Basketballs", "Bibs", "Scoreboard"], description: "Full-size outdoor acrylic court with two practice hoops and covered spectator seating.", image_key: "basketball", open_hour: 6, close_hour: 22, status: "open" },
  { name: "Football Ground", sport: "Football", location: "South Campus Sports Field", capacity: 22, equipment: ["Footballs", "Goal nets", "Training cones", "Bibs"], description: "Natural turf 11-a-side ground maintained by the campus grounds team, with changing rooms nearby.", image_key: "football", open_hour: 6, close_hour: 20, status: "open" },
  { name: "Cricket Ground", sport: "Cricket", location: "South Campus Sports Field", capacity: 22, equipment: ["Cricket balls", "Bats", "Pads", "Stumps", "Bowling machine"], description: "Turf wicket with practice nets on the eastern edge and an electronic scoreboard.", image_key: "cricket", open_hour: 6, close_hour: 19, status: "maintenance" },
  { name: "Gymnasium", sport: "Gymnasium", location: "Student Wellness Centre, Block C", capacity: 30, equipment: ["Free weights", "Treadmills", "Rowing machines", "Spin bikes"], description: "Air-conditioned strength and cardio gym with certified trainers on duty during evening hours.", image_key: "gym", open_hour: 5, close_hour: 23, status: "open" },
];

async function runSetup(): Promise<void> {
  const db = await database();

  await db.collection<UserDoc>("users").createIndex({ email: 1 }, { unique: true });

  // The concurrency guarantee: a partial unique index on
  // (facility_id, booking_date, start_time) WHERE status = 'confirmed' means
  // out of N simultaneous inserts exactly one commits; the rest fail with
  // duplicate-key error 11000, mirroring the original Postgres partial index.
  await db.collection<BookingDoc>("bookings").createIndex(
    { facility_id: 1, booking_date: 1, start_time: 1 },
    { unique: true, partialFilterExpression: { status: "confirmed" } },
  );
  await db.collection<BookingDoc>("bookings").createIndex({ user_id: 1, booking_date: -1 });
  await db.collection<BookingDoc>("bookings").createIndex({ facility_id: 1, booking_date: 1 });

  await db.collection<WaitlistDoc>("waitlist").createIndex(
    { user_id: 1, facility_id: 1, booking_date: 1, start_time: 1 },
    { unique: true },
  );

  await db.collection<NotificationDoc>("notifications").createIndex({ user_id: 1, created_at: -1 });

  await db.collection<DemoBookingDoc>("demo_bookings").createIndex(
    { run_id: 1, facility_id: 1, booking_date: 1, start_time: 1 },
    { unique: true },
  );

  const facilities = db.collection<FacilityDoc>("facilities");
  const count = await facilities.countDocuments();
  if (count === 0) {
    const now = new Date();
    await facilities.insertMany(
      SEED_FACILITIES.map((f) => ({ ...f, _id: crypto.randomUUID(), created_at: now })),
    );
  }
}

/** Idempotent, run-once-per-process setup guard. */
function ensureSetup(): Promise<void> {
  if (!globalForMongo._mongoSetupPromise) {
    globalForMongo._mongoSetupPromise = runSetup().catch((err) => {
      globalForMongo._mongoSetupPromise = undefined;
      throw err;
    });
  }
  return globalForMongo._mongoSetupPromise;
}

/**
 * Entry point for every server function: guarantees indexes + seed exist,
 * then returns typed collection handles.
 */
export async function getCollections(): Promise<Collections> {
  await ensureSetup();
  const db = await database();
  return {
    users: db.collection<UserDoc>("users"),
    facilities: db.collection<FacilityDoc>("facilities"),
    bookings: db.collection<BookingDoc>("bookings"),
    waitlist: db.collection<WaitlistDoc>("waitlist"),
    notifications: db.collection<NotificationDoc>("notifications"),
    demo_bookings: db.collection<DemoBookingDoc>("demo_bookings"),
  };
}

/** True when a write failed due to a unique-index violation. */
export function isDuplicateKeyError(err: unknown): boolean {
  return typeof err === "object" && err !== null && (err as { code?: number }).code === 11000;
}
