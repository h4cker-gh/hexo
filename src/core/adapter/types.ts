/** Adapter contracts — platform-agnostic messaging interface. */

import type { ContextMention } from '@core/context/types.js';

// ─── Results ────────────────────────────────────────────────────────────────

/** Result of a send operation. */
export interface MessageResult {
  /** Unique ID assigned by the platform. */
  id: string;
  /** Whether the message was sent successfully. */
  success: boolean;
  /** Platform-specific error message (if failed). */
  error?: string;
}

// ─── Connection ─────────────────────────────────────────────────────────────

/** Connection lifecycle status exposed to the dashboard. */
export type ConnectionStatus =
  | 'disconnected'
  | 'connecting'
  | 'qr'
  | 'pairing'
  | 'connected'
  | 'error';

/** How a user wants to authenticate. */
export type ConnectMethod = 'qr' | 'pairing-code';

/** Point-in-time connection state. Always immutable from the caller's view. */
export interface ConnectionSnapshot {
  status: ConnectionStatus;
  /** Raw QR payload when status === 'qr'. */
  qr?: string;
  /** Pairing code when status === 'pairing'. */
  pairingCode?: string;
  error?: string;
  /** Bot's own JID once connected. */
  botJid?: string;
  /** ISO timestamp of the last change. */
  updatedAt: string;
}

/** Extra options for connect(). */
export interface ConnectOptions {
  /** E.164 digits, required for the pairing-code flow. */
  phoneNumber?: string;
}

/** Lifecycle operations implemented by adapters that can authenticate. */
export interface ConnectableAdapter {
  connect(method: ConnectMethod, options?: ConnectOptions): Promise<void>;
  disconnect(options?: { logout?: boolean }): Promise<void>;
  getConnectionSnapshot(): ConnectionSnapshot;
  onConnectionChange(listener: (snapshot: ConnectionSnapshot) => void): () => void;
}

// ─── Text Message ───────────────────────────────────────────────────────────

/** Parameters for sending a plain text message. */
export interface TextMessageParams {
  /** Destination JID (e.g. "1234567890@s.whatsapp.net" or group JID). */
  to: string;
  /** Message text content. */
  content: string;
  /** Resolved mentions; the adapter rebuilds platform tokens. */
  mentions?: ContextMention[];
}

// ─── Reply Message ──────────────────────────────────────────────────────────

/** Parameters for sending a quoted/reply message. */
export interface ReplyMessageParams {
  /** Destination JID. */
  to: string;
  /** Message text content. */
  content: string;
  /** ID of the message being replied to (platform-specific). */
  replyTo: string;
  /** Resolved mentions; the adapter rebuilds platform tokens. */
  mentions?: ContextMention[];
}

// ─── Media Message ──────────────────────────────────────────────────────────

/** Parameters for sending media (image, video, audio, sticker, document). */
export interface MediaMessageParams {
  /** Destination JID. */
  to: string;
  /** Media as Buffer (file bytes) or URL string. */
  media: Buffer | string;
  /** MIME type of the media (e.g. "image/jpeg", "video/mp4"). */
  mimeType: string;
  /** Filename hint for documents. */
  filename?: string;
  /** Optional caption text. */
  caption?: string;
}

// ─── Poll Message ───────────────────────────────────────────────────────────

/** A single option in a poll. */
export interface PollOption {
  /** Option label text. */
  label: string;
}

/** Parameters for sending a poll/votation message. */
export interface PollMessageParams {
  /** Destination JID. */
  to: string;
  /** Poll question/title. */
  name: string;
  /** Available options. */
  options: PollOption[];
  /** Maximum number of votes per user (0 = unlimited). */
  maxVotes?: number;
}

// ─── Location Message ───────────────────────────────────────────────────────

/** Parameters for sending a location. */
export interface LocationMessageParams {
  /** Destination JID. */
  to: string;
  /** Latitude (-90 to 90). */
  latitude: number;
  /** Longitude (-180 to 180). */
  longitude: number;
  /** Optional address/name label. */
  name?: string;
}

// ─── Contact Message ────────────────────────────────────────────────────────

/** A single contact card. */
export interface ContactInfo {
  /** Phone number in E.164 format. */
  phoneNumber: string;
  /** Display name of the contact. */
  name?: string;
}

/** Parameters for sending a contact card. */
export interface ContactMessageParams {
  /** Destination JID. */
  to: string;
  /** Contact(s) to share. */
  contacts: ContactInfo[];
}

// ─── Adapter Interface ──────────────────────────────────────────────────────

/**
 * Platform-agnostic messaging adapter interface.
 *
 * All platform adapters (WhatsApp, Discord, Instagram, etc.) must implement
 * this interface. Core code only interacts through this contract.
 */
export interface MessageAdapter {
  /**
   * Send a plain text message.
   */
  sendText(params: TextMessageParams): Promise<MessageResult>;

  /**
   * Send a quoted/reply message.
   */
  reply(params: ReplyMessageParams): Promise<MessageResult>;

  /**
   * Send an image media message.
   */
  sendImage(params: MediaMessageParams): Promise<MessageResult>;

  /**
   * Send a video/media message.
   */
  sendVideo(params: MediaMessageParams): Promise<MessageResult>;

  /**
   * Send an audio message (voice note or music).
   */
  sendAudio(params: MediaMessageParams): Promise<MessageResult>;

  /**
   * Send a sticker message.
   */
  sendSticker(params: MediaMessageParams): Promise<MessageResult>;

  /**
   * Send a document/file message.
   */
  sendDocument(params: MediaMessageParams): Promise<MessageResult>;

  /**
   * Send a poll/votation message.
   */
  sendPoll(params: PollMessageParams): Promise<MessageResult>;

  /**
   * Send a location message.
   */
  sendLocation(params: LocationMessageParams): Promise<MessageResult>;

  /**
   * Send a contact card.
   */
  sendContact(params: ContactMessageParams): Promise<MessageResult>;

  // ─── Lifecycle ─────────────────────────────────────────────────────────

  /**
   * Initialize the adapter (connect, authenticate, etc.).
   */
  init(): Promise<void>;

  /**
   * Cleanly shut down the adapter.
   */
  shutdown(): Promise<void>;

  /**
   * Whether the adapter is currently connected.
   */
  isConnected(): boolean;
}

/** Type guard for adapters that expose the connectable contract. */
export function isConnectableAdapter(
  adapter: MessageAdapter,
): adapter is MessageAdapter & ConnectableAdapter {
  const candidate = adapter as Partial<ConnectableAdapter>;
  return (
    typeof candidate.connect === 'function'
    && typeof candidate.disconnect === 'function'
    && typeof candidate.getConnectionSnapshot === 'function'
    && typeof candidate.onConnectionChange === 'function'
  );
}
