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
// Direct GET verification route for Meta WhatsApp Webhook
// -----------------------------------------------------------
app.get("/webhook/whatsapp", (req, res) => {
  const hubObj = (req.query.hub as Record<string, unknown>) || {};
  const challenge = (req.query["hub.challenge"] ||
    hubObj.challenge ||
    req.query.challenge ||
    "VERIFIED") as string;

  console.log("✅ Webhook verified — challenge:", challenge);
  res.status(200).send(challenge);
});

// -----------------------------------------------------------
// Mount platform connectors
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
