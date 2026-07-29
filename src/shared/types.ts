// ============================================================
// Shared Types — Used by all platform connectors
// ============================================================
// These types define the "common language" between the shared
// database, the AI brain, and every connector.
// No platform-specific code belongs here.
// ============================================================

/**
 * All supported platforms. Add new ones here as you grow.
 */
export type Platform = "whatsapp" | "instagram" | "tiktok" | "fiverr" | "mostaql" | "haraj";

/**
 * A normalized incoming message — every connector converts
 * its platform-specific format into this shape.
 */
export interface IncomingMessage {
  /** Which platform this came from */
  platform: Platform;
  /** The platform's native chat/thread ID */
  platformChatId: string;
  /** The platform's native message ID */
  platformMessageId: string;
  /** Sender's name (if available) */
  senderName?: string;
  /** Sender's platform-specific ID (phone for WhatsApp, user ID for IG, etc.) */
  senderPlatformId: string;
  /** Sender's phone number (if available) */
  senderPhone?: string;
  /** The actual message content */
  content: string;
  /** Type of message */
  messageType: "text" | "image" | "audio" | "video" | "document" | "other";
  /** Unix timestamp (milliseconds) */
  timestamp: number;
  /** Any extra platform-specific data */
  metadata?: Record<string, unknown>;
}

/**
 * What the AI brain returns after processing a message.
 */
export interface AIReply {
  /** The reply text to send back */
  content: string;
  /** Optional: info the AI extracted about the client from this message */
  extractedClientInfo?: string;
  /** Optional: if the AI detects an order/inquiry, capture it */
  detectedOrder?: {
    title: string;
    description?: string;
    estimatedPrice?: number;
    currency?: string;
  };
}

/**
 * Conversation history entry — fed to the AI brain for context.
 */
export interface ConversationEntry {
  role: "user" | "assistant";
  content: string;
}

/**
 * Order status flow.
 */
export type OrderStatus =
  | "inquiry"
  | "quoted"
  | "accepted"
  | "in_progress"
  | "delivered"
  | "completed"
  | "cancelled"
  | "disputed";
