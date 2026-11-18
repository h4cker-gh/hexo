/** Universal Context: normalized interaction representation. */

/** A mention resolved from an incoming message. */
export interface ContextMention {
  /** Platform user identifier. */
  id: string;
  /** Display name used in the normalized text, e.g. "clara". */
  name: string;
}

/** Represents a user in the universal context model. */
export interface ContextUser {
  id: string;
  displayName?: string;
  metadata: Record<string, unknown>;
}

/** Represents a channel (group, DM, etc.) in the universal context model. */
export interface ContextChannel {
  id: string;
  name?: string;
  type: string;
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
