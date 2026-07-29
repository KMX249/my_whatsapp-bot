// ============================================================
// Prisma Configuration — Prisma 7+ style
// ============================================================

import path from "node:path";
import { defineConfig } from "prisma/config";

const dbUrl = `file:${path.join(__dirname, "prisma", "dev.db")}`;

export default defineConfig({
  earlyAccess: true,
  datasource: {
    url: dbUrl,
  },
  migrate: {
    async url() {
      return dbUrl;
    },
  },
});
