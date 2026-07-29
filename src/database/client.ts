// ============================================================
// Database Client — Shared Prisma instance (Prisma 7+)
// ============================================================
// Every part of the app imports the database client from here.
// This ensures we only have ONE connection to the database.
//
// Prisma 7 requires a "driver adapter" for direct database
// connections. We use @prisma/adapter-libsql for SQLite.
// ============================================================

import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";

// Point to the SQLite database file
const dbPath = path.join(__dirname, "..", "..", "prisma", "dev.db");

// Create the Prisma adapter with the SQLite connection config
const adapter = new PrismaLibSql({ url: `file:${dbPath}` });

// Create the Prisma client with the adapter
export const db = new PrismaClient({ adapter });

/**
 * Connect to the database. Call this once when the server starts.
 */
export async function connectDatabase(): Promise<void> {
  try {
    await db.$connect();
    console.log("✅ Database connected successfully");
  } catch (error) {
    console.error("❌ Failed to connect to database:", error);
    process.exit(1);
  }
}

/**
 * Disconnect from the database. Call this when the server shuts down.
 */
export async function disconnectDatabase(): Promise<void> {
  await db.$disconnect();
  console.log("📦 Database disconnected");
}
