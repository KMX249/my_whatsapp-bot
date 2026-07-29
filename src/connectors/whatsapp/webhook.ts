// ============================================================
// WhatsApp Webhook Handler
// ============================================================
// This is the "ears" of the WhatsApp connector. It:
// 1. Verifies Meta's webhook subscription (GET request)
// 2. Receives incoming messages (POST request)
// 3. Saves them to the shared database
// 4. Calls the AI brain for a reply
// 5. Sends the reply back via WhatsApp
// 6. Saves the reply to the database
// 7. Updates client intelligence if the AI extracted new info
// ============================================================

import { Router, Request, Response } from "express";
import { config } from "../../config";
import { db } from "../../database/client";
import { generateReply } from "../../ai/reply-brain";
import { sendWhatsAppMessage, markMessageAsRead } from "./sender";
import { WhatsAppWebhookPayload } from "./types";
import { IncomingMessage, ConversationEntry } from "../../shared/types";

export const whatsappRouter = Router();

// -----------------------------------------------------------
// GET /webhook/whatsapp — Webhook Verification
// -----------------------------------------------------------
// When you set up the webhook in Meta's dashboard, Meta sends
// a GET request to verify you own this URL. We check the token
// matches what we set, and echo back the challenge.
// -----------------------------------------------------------
whatsappRouter.get("/", (req: Request, res: Response) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === config.whatsappVerifyToken) {
    console.log("✅ WhatsApp webhook verified successfully");
    res.status(200).send(challenge);
  } else {
    console.warn("❌ WhatsApp webhook verification failed — token mismatch");
    res.sendStatus(403);
  }
});

// -----------------------------------------------------------
// POST /webhook/whatsapp — Incoming Messages
// -----------------------------------------------------------
whatsappRouter.post("/", async (req: Request, res: Response) => {
  // IMPORTANT: Always respond 200 quickly. Meta will retry if we're slow.
  res.sendStatus(200);

  try {
    const payload = req.body as WhatsAppWebhookPayload;

    // Meta also sends status updates (delivered, read, etc.) — ignore those
    if (payload.object !== "whatsapp_business_account") return;

    for (const entry of payload.entry) {
      for (const change of entry.changes) {
        const value = change.value;

        // Skip if there are no messages (might be a status update)
        if (!value.messages || value.messages.length === 0) continue;

        for (const message of value.messages) {
          // For now, we only handle text messages
          if (message.type !== "text" || !message.text?.body) {
            console.log(`⏭️  Skipping non-text message (type: ${message.type})`);
            continue;
          }

          // Find the sender's name from the contacts array
          const senderName =
            value.contacts?.find((c) => c.wa_id === message.from)?.profile
              ?.name || undefined;

          // Normalize into our platform-agnostic format
          const incoming: IncomingMessage = {
            platform: "whatsapp",
            platformChatId: message.from, // For WhatsApp, chat ID = sender's phone
            platformMessageId: message.id,
            senderName,
            senderPlatformId: message.from,
            senderPhone: message.from,
            content: message.text.body,
            messageType: "text",
            timestamp: parseInt(message.timestamp) * 1000, // Convert to ms
          };

          // Process the message (database + AI + reply)
          await processIncomingMessage(incoming);

          // Mark as read (blue ticks)
          await markMessageAsRead(message.id);
        }
      }
    }
  } catch (error) {
    console.error("❌ Error processing WhatsApp webhook:", error);
  }
});

// -----------------------------------------------------------
// Core Processing Pipeline — Shared logic
// -----------------------------------------------------------
async function processIncomingMessage(
  incoming: IncomingMessage
): Promise<void> {
  console.log(
    `📨 New message from ${incoming.senderName || incoming.senderPlatformId}: "${incoming.content}"`
  );

  // 1. Find or create the contact
  const contact = await db.contact.upsert({
    where: {
      platform_platformId: {
        platform: incoming.platform,
        platformId: incoming.senderPlatformId,
      },
    },
    update: {
      name: incoming.senderName || undefined,
      phone: incoming.senderPhone || undefined,
    },
    create: {
      platform: incoming.platform,
      platformId: incoming.senderPlatformId,
      name: incoming.senderName,
      phone: incoming.senderPhone,
    },
  });

  // 2. Find or create the conversation
  const conversation = await db.conversation.upsert({
    where: {
      platform_platformChatId: {
        platform: incoming.platform,
        platformChatId: incoming.platformChatId,
      },
    },
    update: {
      status: "active",
    },
    create: {
      contactId: contact.id,
      platform: incoming.platform,
      platformChatId: incoming.platformChatId,
    },
  });

  // 3. Save the incoming message
  await db.message.create({
    data: {
      conversationId: conversation.id,
      role: "user",
      content: incoming.content,
      platformMessageId: incoming.platformMessageId,
      messageType: incoming.messageType,
    },
  });

  // 4. Load recent conversation history for AI context
  //    (last 20 messages — keeps token usage reasonable)
  const recentMessages = await db.message.findMany({
    where: { conversationId: conversation.id },
    orderBy: { createdAt: "asc" },
    take: 20,
  });

  const conversationHistory: ConversationEntry[] = recentMessages
    .slice(0, -1) // Exclude the message we just saved (we'll pass it separately)
    .map((msg) => ({
      role: msg.role as "user" | "assistant",
      content: msg.content,
    }));

  // 5. Call the AI brain
  const aiReply = await generateReply(
    conversationHistory,
    incoming.content,
    contact.chatGatheredInfo || undefined
  );

  console.log(`🤖 AI reply: "${aiReply.content}"`);

  // 6. Send the reply via WhatsApp
  await sendWhatsAppMessage(incoming.senderPlatformId, aiReply.content);

  // 7. Save the AI's reply to the database
  await db.message.create({
    data: {
      conversationId: conversation.id,
      role: "assistant",
      content: aiReply.content,
      messageType: "text",
    },
  });

  // 8. Update client intelligence if the AI extracted new info
  if (aiReply.extractedClientInfo) {
    const existingInfo = contact.chatGatheredInfo || "";
    const updatedInfo = existingInfo
      ? `${existingInfo}\n• ${aiReply.extractedClientInfo}`
      : `• ${aiReply.extractedClientInfo}`;

    await db.contact.update({
      where: { id: contact.id },
      data: { chatGatheredInfo: updatedInfo },
    });
    console.log(`🧠 Updated client intel: ${aiReply.extractedClientInfo}`);
  }

  // 9. Create an order record if the AI detected an inquiry
  if (aiReply.detectedOrder) {
    await db.order.create({
      data: {
        contactId: contact.id,
        conversationId: conversation.id,
        title: aiReply.detectedOrder.title,
        description: aiReply.detectedOrder.description,
        price: aiReply.detectedOrder.estimatedPrice,
        currency: aiReply.detectedOrder.currency,
        platform: incoming.platform,
        status: "inquiry",
      },
    });
    console.log(`📋 New order detected: ${aiReply.detectedOrder.title}`);
  }
}
