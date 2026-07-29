// ============================================================
// Configuration — Loads and validates environment variables
// ============================================================

import dotenv from "dotenv";
dotenv.config();

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `❌ Missing required environment variable: ${name}\n` +
        `   Copy .env.example to .env and fill in your values.`
    );
  }
  return value;
}

export const config = {
  /** Server port (default 3000) */
  port: parseInt(process.env.PORT || "3000", 10),

  /** WhatsApp webhook verification token — you make this up, just match it in Meta dashboard */
  whatsappVerifyToken: requireEnv("WHATSAPP_VERIFY_TOKEN"),

  /** WhatsApp permanent access token from Meta dashboard */
  whatsappAccessToken: requireEnv("WHATSAPP_ACCESS_TOKEN"),

  /** WhatsApp phone number ID from Meta dashboard */
  whatsappPhoneNumberId: requireEnv("WHATSAPP_PHONE_NUMBER_ID"),

  /** Google Gemini API key */
  geminiApiKey: requireEnv("GEMINI_API_KEY"),

  /** System prompt that tells the AI who you are and how to behave */
  aiSystemPrompt:
    process.env.AI_SYSTEM_PROMPT ||
    "You are a helpful business assistant. Reply professionally and concisely.",
};
