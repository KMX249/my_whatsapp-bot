// ============================================================
// Main Server — Entry Point
// ============================================================
// This is the starting point of the entire application.
// It sets up the web server and mounts platform connectors.
//
// To add a new platform later (e.g. Instagram), you just:
//   1. Create src/connectors/instagram/webhook.ts
//   2. Import it here
//   3. Mount it: app.use("/webhook/instagram", instagramRouter)
//   That's it — database and AI brain are already shared.
// ============================================================

import express from "express";
import { config } from "./config";
import { connectDatabase, disconnectDatabase } from "./database/client";
import { whatsappRouter } from "./connectors/whatsapp/webhook";

const app = express();

// Parse incoming JSON (Meta sends webhook data as JSON)
app.use(express.json());

// -----------------------------------------------------------
// Health check endpoint — useful for hosting platforms
// -----------------------------------------------------------
app.get("/", (_req, res) => {
  res.json({
    status: "running",
    service: "Auto-Reply Hub",
    version: "1.0.0",
    connectors: {
      whatsapp: "active",
      instagram: "coming soon",
      tiktok: "coming soon",
    },
  });
});

// -----------------------------------------------------------
// Mount platform connectors
// -----------------------------------------------------------
// Each platform gets its own URL path:
//   /webhook/whatsapp  — WhatsApp messages arrive here
//   /webhook/instagram — (future) Instagram messages
//   /webhook/tiktok    — (future) TikTok messages
// -----------------------------------------------------------
app.use("/webhook/whatsapp", whatsappRouter);

// -----------------------------------------------------------
// Start the server
// -----------------------------------------------------------
async function start(): Promise<void> {
  // Connect to database first
  await connectDatabase();

  app.listen(config.port, () => {
    console.log("");
    console.log("═══════════════════════════════════════════");
    console.log("  🚀 Auto-Reply Hub is running!");
    console.log(`  📡 Server:   http://localhost:${config.port}`);
    console.log(`  📱 WhatsApp: http://localhost:${config.port}/webhook/whatsapp`);
    console.log("═══════════════════════════════════════════");
    console.log("");
  });
}

// Graceful shutdown
process.on("SIGINT", async () => {
  console.log("\n🛑 Shutting down...");
  await disconnectDatabase();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  await disconnectDatabase();
  process.exit(0);
});

start().catch((error) => {
  console.error("💥 Failed to start server:", error);
  process.exit(1);
});
