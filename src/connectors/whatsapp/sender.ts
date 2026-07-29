// ============================================================
// WhatsApp Sender — Sends replies via Meta Cloud API
// ============================================================

import axios from "axios";
import { config } from "../../config";

const WHATSAPP_API_URL = "https://graph.facebook.com/v21.0";

/**
 * Send a text message to a WhatsApp user.
 *
 * @param to - The recipient's phone number (with country code, no +)
 * @param text - The message text to send
 */
export async function sendWhatsAppMessage(
  to: string,
  text: string
): Promise<void> {
  const url = `${WHATSAPP_API_URL}/${config.whatsappPhoneNumberId}/messages`;

  try {
    await axios.post(
      url,
      {
        messaging_product: "whatsapp",
        to: to,
        type: "text",
        text: { body: text },
      },
      {
        headers: {
          Authorization: `Bearer ${config.whatsappAccessToken}`,
          "Content-Type": "application/json",
        },
      }
    );
    console.log(`✅ Reply sent to ${to}`);
  } catch (error: unknown) {
    if (axios.isAxiosError(error)) {
      console.error(
        "❌ Failed to send WhatsApp message:",
        error.response?.data || error.message
      );
    } else {
      console.error("❌ Failed to send WhatsApp message:", error);
    }
    throw error;
  }
}

/**
 * Mark a message as "read" (blue ticks) on WhatsApp.
 * This tells the sender you've seen their message.
 */
export async function markMessageAsRead(messageId: string): Promise<void> {
  const url = `${WHATSAPP_API_URL}/${config.whatsappPhoneNumberId}/messages`;

  try {
    await axios.post(
      url,
      {
        messaging_product: "whatsapp",
        status: "read",
        message_id: messageId,
      },
      {
        headers: {
          Authorization: `Bearer ${config.whatsappAccessToken}`,
          "Content-Type": "application/json",
        },
      }
    );
  } catch {
    // Non-critical — don't throw if marking read fails
    console.warn("⚠️  Could not mark message as read:", messageId);
  }
}
