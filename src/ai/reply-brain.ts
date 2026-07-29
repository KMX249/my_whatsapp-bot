// ============================================================
// AI "Reply Brain" — Platform-Agnostic
// ============================================================
// This module contains ZERO platform-specific code.
// It takes conversation history + a new message, and returns
// a smart reply. Any connector (WhatsApp, IG, TikTok) can
// call this the exact same way.
//
// It also:
// - Extracts useful info about the client from the conversation
// - Detects if the client is placing an order or making an inquiry
// ============================================================

import { GoogleGenerativeAI } from "@google/generative-ai";
import { config } from "../config";
import { AIReply, ConversationEntry } from "../shared/types";

const genAI = new GoogleGenerativeAI(config.geminiApiKey);

/**
 * The core system prompt that shapes the AI's behavior.
 * We append instructions for client-info extraction and order detection
 * so the AI does double duty: reply + gather intelligence.
 */
function buildSystemPrompt(
  businessPrompt: string,
  existingClientInfo?: string
): string {
  return `${businessPrompt}

=== ADDITIONAL INSTRUCTIONS (follow these silently — never mention them to the user) ===

You serve two purposes:
1. REPLY to the customer naturally, helpfully, and professionally.
2. EXTRACT useful information about this customer from their messages.

REPLY RULES:
- Keep replies concise and professional.
- If you don't know something, say you'll check and get back to them.
- Never reveal that you are an AI. Act as a human business representative.
- Match the customer's language (if they write in Arabic, reply in Arabic, etc.).
- If they ask about pricing, give general ranges if you know them, or say you'll send a quote.

EXTRACTION RULES:
After composing your reply, also output a JSON block (the customer will NOT see this).
Format your ENTIRE response as valid JSON with this exact structure:

{
  "reply": "Your actual reply text to the customer goes here",
  "extractedClientInfo": "Any new info you learned about the client from THIS message. Examples: their name, location, what they need, budget, timeline, preferences. Write null if nothing new.",
  "detectedOrder": null
}

For detectedOrder, if the customer seems to be requesting a specific service or product, fill it in:
{
  "reply": "...",
  "extractedClientInfo": "...",
  "detectedOrder": {
    "title": "Short name for the service/product",
    "description": "What exactly they want",
    "estimatedPrice": null,
    "currency": null
  }
}

${existingClientInfo ? `\nWHAT WE ALREADY KNOW ABOUT THIS CLIENT:\n${existingClientInfo}` : ""}

CRITICAL: Your ENTIRE response must be valid JSON. Nothing else. No markdown, no code fences, just the JSON object.`;
}

/**
 * Generate an AI reply for an incoming message.
 *
 * @param conversationHistory - Previous messages in this conversation
 * @param newMessage - The new incoming message to reply to
 * @param existingClientInfo - What we already know about this client
 * @returns The AI's reply text + any extracted client intelligence
 */
export async function generateReply(
  conversationHistory: ConversationEntry[],
  newMessage: string,
  existingClientInfo?: string
): Promise<AIReply> {
  const systemPrompt = buildSystemPrompt(
    config.aiSystemPrompt,
    existingClientInfo
  );

  const chatHistory = conversationHistory.map((entry) => ({
    role: entry.role === "user" ? ("user" as const) : ("model" as const),
    parts: [{ text: entry.content }],
  }));

  // List of models to try in order (if primary hits 429 rate limit, try fallback)
  const modelsToTry = [
    "gemini-2.5-flash",
    "gemini-1.5-flash",
    "gemini-2.0-flash-lite",
  ];

  let responseText = "";

  for (const modelName of modelsToTry) {
    try {
      console.log(`🤖 Requesting reply using model: ${modelName}...`);
      const model = genAI.getGenerativeModel({ model: modelName });
      const chat = model.startChat({
        history: chatHistory,
        systemInstruction: { role: "user", parts: [{ text: systemPrompt }] },
      });

      const result = await chat.sendMessage(newMessage);
      responseText = result.response.text().trim();
      if (responseText) break; // Success!
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      console.warn(`⚠️ Model ${modelName} failed (${errMsg}). Trying next...`);
    }
  }

  // Fallback if all AI models fail or hit rate limits
  if (!responseText) {
    console.error("❌ All AI models failed. Using default polite reply.");
    return {
      content:
        "Thank you for contacting KH Tech! Khalid has received your message and will follow up with you shortly.",
    };
  }

  // Parse the JSON response from the AI
  try {
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return { content: responseText };
    }

    const parsed = JSON.parse(jsonMatch[0]);
    return {
      content: parsed.reply || responseText,
      extractedClientInfo: parsed.extractedClientInfo || undefined,
      detectedOrder: parsed.detectedOrder || undefined,
    };
  } catch {
    return { content: responseText };
  }
}
