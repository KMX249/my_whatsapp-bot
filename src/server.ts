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
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <title>Privacy Policy - KH Auto Reply Bot</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; padding: 40px; max-width: 800px; margin: 0 auto; color: #333; }
          h1 { color: #111; border-bottom: 2px solid #eee; padding-bottom: 10px; }
          h2 { margin-top: 24px; color: #222; }
        </style>
      </head>
      <body>
        <h1>Privacy Policy</h1>
        <p><strong>Effective Date:</strong> July 30, 2026</p>
        <p>This Privacy Policy describes how <strong>KH Auto Reply Bot</strong> ("we", "us", or "our") collects, uses, and protects information when you communicate with our business through WhatsApp.</p>

        <h2>1. Information We Collect</h2>
        <p>When you send a message to our WhatsApp business account, we process:</p>
        <ul>
          <li>Your WhatsApp phone number and profile display name.</li>
          <li>The contents of incoming messages and media attachments.</li>
          <li>Timestamp and message routing metadata provided by the Meta WhatsApp Cloud API.</li>
        </ul>

        <h2>2. How We Use Your Information</h2>
        <p>We use the collected information strictly for:</p>
        <ul>
          <li>Generating automated AI responses to answer your inquiries.</li>
          <li>Maintaining customer support conversation history.</li>
          <li>Helping our business team follow up with custom project quotes and service details.</li>
        </ul>

        <h2>3. Data Protection & Sharing</h2>
        <p>We do not sell, rent, or trade your personal information. Data is processed securely using industry-standard encryption provided by Meta and Google Cloud infrastructure.</p>

        <h2>4. User Rights & Contact</h2>
        <p>You may request deletion of your conversation history at any time by messaging "DELETE MY DATA" or by contacting our team.</p>
      </body>
    </html>
  `);
});

// Terms of service page for Meta verification
app.get("/terms", (_req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <title>Terms of Service - KH Auto Reply Bot</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; padding: 40px; max-width: 800px; margin: 0 auto; color: #333; }
          h1 { color: #111; border-bottom: 2px solid #eee; padding-bottom: 10px; }
          h2 { margin-top: 24px; color: #222; }
        </style>
      </head>
      <body>
        <h1>Terms of Service</h1>
        <p><strong>Effective Date:</strong> July 30, 2026</p>

        <h2>1. Acceptance of Terms</h2>
        <p>By sending messages to our WhatsApp business number, you agree to these Terms of Service.</p>

        <h2>2. Automated Response Service</h2>
        <p>Responses are provided using an AI assistant to assist with initial business inquiries. Official project scope and final binding quotes will be confirmed directly by Khalid / KH Tech.</p>

        <h2>3. Acceptable Use</h2>
        <p>Users agree not to send spam, abusive content, or malicious code through the messaging channel.</p>
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
