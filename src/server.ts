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

// Privacy policy page for Meta verification
app.get("/privacy", (_req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
      <head><title>Privacy Policy - KH Auto Reply Bot</title></head>
      <body style="font-family: sans-serif; padding: 40px; max-width: 800px; margin: 0 auto;">
        <h1>Privacy Policy for KH Auto Reply Bot</h1>
        <p>Last updated: July 2026</p>
        <p>KH Auto Reply Bot uses the WhatsApp Cloud API to process incoming customer messages and provide automated AI assistance.</p>
        <h2>Data Collection & Usage</h2>
        <p>We process incoming message text strictly to generate automated responses and store conversation history to improve service quality. We do not sell or share personal data with third parties.</p>
        <h2>Contact Us</h2>
        <p>If you have any questions about this Privacy Policy, please contact us via email.</p>
      </body>
    </html>
  `);
});

// Health check endpoint
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
