/** Universal Context: normalized interaction representation. */

/** A mention resolved from an incoming message. */
export interface ContextMention {
  /** Platform user identifier (WhatsApp JID). */
  jid: string;
  /** Display name used in the normalized text, e.g. "clara". */
  name: string;
  /** Phone number digits, when available. Used to rebuild @tokens for sending. */
  phoneNumber?: string;
}

/** Represents a user in the universal context model. */
export interface ContextUser {
  /** Platform user identifier — e.g. WhatsApp JID, Instagram handle, etc. */
  id: string;
  /** Display name resolved from the platform (displayName, handle, etc.). */
  name?: string;
  metadata: Record<string, unknown>;
}

/** Represents a channel (group, DM, etc.) in the universal context model. */
export interface ContextChannel {
  /** Full channel JID (e.g. "120363000000000000@g.us"). */
  id: string;
  name?: string;
  type: string;
  /** Sender participant phone number digits, when known. */
  participantPN?: string;
  metadata: Record<string, unknown>;
}

/** Universal context that normalizes platform interactions. */
export interface UniversalContext {
  id: string;
  timestamp: Date;
  user: ContextUser;
  channel: ContextChannel;
  input: string;
  parsedArgs: string[];
  platform: string;
  raw?: unknown;
  variables: Map<string, unknown>;
  /** Resolved mentions found in the message text. */
  mentions: ContextMention[];
}
