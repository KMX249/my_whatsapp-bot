// ============================================================
// Database Client — Shared Prisma instance (Prisma 7+)
// ============================================================

import path from "node:path";
import fs from "node:fs";
import { PrismaClient } from "@prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";

// Ensure the prisma directory exists
const prismaDir = path.join(__dirname, "..", "..", "prisma");
if (!fs.existsSync(prismaDir)) {
  fs.mkdirSync(prismaDir, { recursive: true });
}

const dbPath = path.join(prismaDir, "dev.db");
const adapter = new PrismaLibSql({ url: `file:${dbPath}` });

export const db = new PrismaClient({ adapter });

/**
 * Connect to the database. Call this once when the server starts.
 */
export async function connectDatabase(): Promise<void> {
  try {
    await db.$connect();
    console.log("✅ Database connected successfully");
  } catch (error) {
    console.error("❌ Database connection error (non-fatal):", error);
  }
}

/**
 * Disconnect from the database.
 */
export async function disconnectDatabase(): Promise<void> {
  try {
    await db.$disconnect();
    console.log("📦 Database disconnected");
  } catch {
    // Ignore error on shutdown
  }
}
