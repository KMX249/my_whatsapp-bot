// ============================================================
// WhatsApp Webhook Handler
// ============================================================

import { Router, Request, Response } from "express";
import { db } from "../../database/client";
import { generateReply } from "../../ai/reply-brain";
import { sendWhatsAppMessage, markMessageAsRead } from "./sender";
import { WhatsAppWebhookPayload } from "./types";
import { IncomingMessage, ConversationEntry } from "../../shared/types";

export const whatsappRouter = Router();

// -----------------------------------------------------------
// GET /webhook/whatsapp — Webhook Verification
// -----------------------------------------------------------
// Meta sends a GET request to verify the webhook URL.
// We echo back the hub.challenge string Meta sends us.
// -----------------------------------------------------------
whatsappRouter.get("/", (req: Request, res: Response) => {
  const hubObj = (req.query.hub as Record<string, unknown>) || {};
  const challenge = (req.query["hub.challenge"] ||
    hubObj.challenge ||
    req.query.challenge ||
    "VERIFIED") as string;

  console.log("✅ Meta Webhook verification request received, returning challenge:", challenge);
  res.status(200).send(challenge);
});

// -----------------------------------------------------------
// POST /webhook/whatsapp — Incoming Messages
// -----------------------------------------------------------
whatsappRouter.post("/", async (req: Request, res: Response) => {
  // Always respond 200 quickly so Meta knows we received it
  res.sendStatus(200);

  try {
    const payload = req.body as WhatsAppWebhookPayload;

    if (payload.object !== "whatsapp_business_account") return;

    for (const entry of payload.entry) {
      for (const change of entry.changes) {
        const value = change.value;

        if (!value.messages || value.messages.length === 0) continue;

        for (const message of value.messages) {
          if (message.type !== "text" || !message.text?.body) {
            console.log(`⏭️  Skipping non-text message (type: ${message.type})`);
            continue;
          }

          const senderName =
            value.contacts?.find((c) => c.wa_id === message.from)?.profile
              ?.name || undefined;

          const incoming: IncomingMessage = {
            platform: "whatsapp",
            platformChatId: message.from,
            platformMessageId: message.id,
            senderName,
            senderPlatformId: message.from,
            senderPhone: message.from,
            content: message.text.body,
            messageType: "text",
            timestamp: parseInt(message.timestamp) * 1000,
          };

          await processIncomingMessage(incoming);
          await markMessageAsRead(message.id);
        }
      }
    }
  } catch (error) {
    console.error("❌ Error processing WhatsApp webhook:", error);
  }
});

// -----------------------------------------------------------
// Core Processing Pipeline
// -----------------------------------------------------------
async function processIncomingMessage(
  incoming: IncomingMessage
): Promise<void> {
  console.log(
    `📨 New message from ${incoming.senderName || incoming.senderPlatformId}: "${incoming.content}"`
  );

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

  await db.message.create({
    data: {
      conversationId: conversation.id,
      role: "user",
      content: incoming.content,
      platformMessageId: incoming.platformMessageId,
      messageType: incoming.messageType,
    },
  });

  const recentMessages = await db.message.findMany({
    where: { conversationId: conversation.id },
    orderBy: { createdAt: "asc" },
    take: 20,
  });

  const conversationHistory: ConversationEntry[] = recentMessages
    .slice(0, -1)
    .map((msg: { role: string; content: string }) => ({
      role: msg.role as "user" | "assistant",
      content: msg.content,
    }));

  const aiReply = await generateReply(
    conversationHistory,
    incoming.content,
    contact.chatGatheredInfo || undefined
  );

  console.log(`🤖 AI reply: "${aiReply.content}"`);

  await sendWhatsAppMessage(incoming.senderPlatformId, aiReply.content);

  await db.message.create({
    data: {
      conversationId: conversation.id,
      role: "assistant",
      content: aiReply.content,
      messageType: "text",
    },
  });

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
