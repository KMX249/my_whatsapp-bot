// ============================================================
// Main Server — Entry Point
// ============================================================

import express from "express";
import { config } from "./config";
import { connectDatabase, disconnectDatabase } from "./database/client";
import { whatsappRouter } from "./connectors/whatsapp/webhook";

const app = express();

// Parse incoming JSON payloads
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// -----------------------------------------------------------
// Health check endpoint
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
// WhatsApp Webhook endpoint — handles both GET verification & POST messages
// -----------------------------------------------------------
app.get("/webhook/whatsapp", (req, res) => {
  const challenge = (req.query["hub.challenge"] ||
    (req.query.hub as Record<string, unknown>)?.challenge ||
    req.query.challenge ||
    "VERIFIED") as string;

  console.log("✅ Webhook GET request received, challenge:", challenge);
  res.status(200).send(challenge);
});

app.use("/webhook/whatsapp", whatsappRouter);

// -----------------------------------------------------------
// Start the server
// -----------------------------------------------------------
async function start(): Promise<void> {
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
