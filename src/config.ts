// ============================================================
// Configuration — Safe environment variable loader
// ============================================================

import dotenv from "dotenv";
dotenv.config();

function getEnv(name: string, fallback: string = ""): string {
  const value = process.env[name];
  if (!value) {
    console.warn(`⚠️ Warning: Environment variable ${name} is not set.`);
    return fallback;
  }
  return value;
}

export const config = {
  /** Server port (default 3000) */
  port: parseInt(process.env.PORT || "3000", 10),

  /** WhatsApp verification token */
  whatsappVerifyToken: getEnv(
    "WHATSAPP_VERIFY_TOKEN",
    "auto_reply_hub_secret_verify_token_2026"
  ),

  /** WhatsApp access token */
  whatsappAccessToken: getEnv("WHATSAPP_ACCESS_TOKEN"),

  /** WhatsApp phone number ID */
  whatsappPhoneNumberId: getEnv("WHATSAPP_PHONE_NUMBER_ID"),

  /** Google Gemini API key */
  geminiApiKey: getEnv("GEMINI_API_KEY"),

  /** System prompt */
  aiSystemPrompt:
    process.env.AI_SYSTEM_PROMPT ||
    "You are a helpful business assistant. Reply professionally and concisely.",
};
