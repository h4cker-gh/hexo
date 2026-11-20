/** Event transformer — converts Baileys events to UniversalContext. */

import type {
  ConnectionState,
  GroupMetadata,
  MessageUserReceiptUpdate,
  WAMessage,
  WAMessageKey,
  proto,
} from '@whiskeysockets/baileys';
import type { Logger } from '@core/logger/types.js';
import type { ContextBuilder } from '@core/context/builder.js';
import type {
  ContextChannel,
  ContextUser,
  UniversalContext,
} from '@core/context/types.js';
import {
  digitsFromJid,
  extractPhoneNumber,
  isGroupJid,
  normalizeJid,
  WHATSAPP_USER_SUFFIX,
} from './types.js';
import {
  buildParticipantIndex,
  normalizeIncomingMentions,
  type ParticipantEntry,
  type ParticipantIndex,
} from './message-normalizer.js';

/** Options for event transformation. */
export interface TransformOptions {
  /** Bot's own JID (used to identify own messages). */
  botJid: string;
  /** Builder to create UniversalContext. */
  contextBuilder: ContextBuilder;
  /** Logger instance. */
  logger: Logger;
  /** Optional group metadata cache. */
  groupMetadata?: Map<string, GroupMetadata>;
  /** Called when a group is not cached yet (maps to socket.groupMetadata). */
  groupMetadataProvider?: (groupId: string) => Promise<GroupMetadata>;
  /** Callback when a context is ready for processing. */
  onContext: (context: UniversalContext) => void | Promise<void>;
}

/** Result of sender resolution for an incoming message. */
export interface SenderResolution {
  /** Canonical sender JID (device suffix stripped). */
  jid: string;
  /** Whether the message originated from the bot itself. */
  own: boolean;
}

/** Pick the first non-empty value. */
function firstJid(...values: Array<string | undefined | null>): string | undefined {
  for (const value of values) {
    if (value) return value;
  }
  return undefined;
}

/** Treat a bare numeric value as a WhatsApp user JID. */
function asUserJid(value: string): string {
  if (value.includes('@')) return value;
  return /^\d+$/.test(value) ? `${value}@${WHATSAPP_USER_SUFFIX}` : value;
}

/** Extract a PN from a JID or from a bare numeric value. */
function phoneNumberFrom(value: string | undefined | null): string | null {
  if (!value) return null;
  if (!value.includes('@')) return /^\d+$/.test(value) ? value : null;
  return extractPhoneNumber(value);
}

/** Compare JIDs, tolerating device suffixes and differing PN spellings. */
function sameJid(left: string, right: string): boolean {
  const normalizedLeft = normalizeJid(left);
  const normalizedRight = normalizeJid(right);
  if (normalizedLeft === normalizedRight) return true;
  const leftPn = extractPhoneNumber(normalizedLeft);
  const rightPn = extractPhoneNumber(normalizedRight);
  return leftPn !== null && rightPn !== null && leftPn === rightPn;
}

/**
 * Resolve the sender JID for a message key.
 *
 * Group precedence: participantPn → participant → participantLid →
 * senderPn → senderLid. DM precedence: senderPn → senderLid → remoteJid.
 * Own messages always return the bot's phone-based JID.
 */
export function resolveSenderJid(
  key: WAMessageKey | undefined,
  remoteJid: string,
  isGroup: boolean,
  botJid: string,
): SenderResolution {
  if (key?.fromMe === true) {
    return { jid: botJid, own: true };
  }

  const candidate = isGroup
    ? firstJid(key?.participantPn, key?.participant, key?.participantLid, key?.senderPn, key?.senderLid)
    : firstJid(key?.senderPn, key?.senderLid, remoteJid);
  const resolved = normalizeJid(asUserJid(candidate ?? remoteJid));

  if (botJid && sameJid(resolved, botJid)) {
    return { jid: botJid, own: true };
  }

  return { jid: resolved, own: false };
}

/**
 * Transforms Baileys events into UniversalContext and dispatches them.
 *
 * Handles messages (text, media captions, mentions), group metadata, and
 * connection state changes. All messages are dispatched, including the bot's own.
 */
export class EventTransformer {
  private readonly groupMetadataCache: Map<string, GroupMetadata>;

  constructor(private readonly options: TransformOptions) {
    this.groupMetadataCache = options.groupMetadata ?? new Map<string, GroupMetadata>();
  }

  /** Update bot JID after credentials are available. */
  setBotJid(botJid: string): void {
    this.options.botJid = botJid;
  }

  // ─── Connection State ───────────────────────────────────────────────────

  /** Handle connection state changes. */
  handleConnectionState(state: ConnectionState): void {
    const { connection } = state;
    if (connection === 'close') {
      this.options.logger.warn('WhatsApp connection disconnected', { state: connection });
    } else if (connection === 'open') {
      this.options.logger.info('WhatsApp connection established', { state: connection });
    } else {
      this.options.logger.debug('WhatsApp connection state change', { state: connection });
    }
  }

  // ─── Messages ───────────────────────────────────────────────────────────

  /** Handle incoming messages. Own messages are logged at debug and skipped. */
  async handleMessages(messages: WAMessage[]): Promise<void> {
    for (const message of messages) {
      await this.processMessage(message);
    }
  }

  /** Handle a single message. */
  private async processMessage(message: WAMessage): Promise<void> {
    if (!message || this.isEphemeral(message)) {
      return;
    }

    const remoteJid = message.key?.remoteJid;
    if (!remoteJid) {
      this.options.logger.warn('Message missing remoteJid, skipping', { messageId: message.key?.id });
      return;
    }

    const isGroup = isGroupJid(remoteJid);
    const sender = resolveSenderJid(message.key, remoteJid, isGroup, this.options.botJid);

    const text = this.extractMessageText(message);
    if (!text || text.trim().length === 0) {
      this.options.logger.debug('Non-text message, skipping', { messageId: message.key?.id });
      return;
    }

    const metadata = isGroup ? await this.ensureGroupMetadata(remoteJid) : undefined;
    const index = metadata ? buildParticipantIndex(metadata) : undefined;
    const mentionedJids = this.extractMentionedJids(message);
    const normalized = normalizeIncomingMentions({
      text,
      mentionedJids,
      ...(index ? { index } : {}),
    });

    const participant = index ? this.lookupParticipant(index, sender.jid) : undefined;
    const senderPn = this.resolveSenderPn(sender.jid, message.key, participant);
    const name = firstJid(message.pushName, participant?.name);

    const user: ContextUser = {
      id: sender.jid,
      name,
      metadata: {},
    };

    const channel: ContextChannel = {
      id: remoteJid,
      name: metadata?.subject,
      type: isGroup ? 'group' : 'dm',
      participantPN: isGroup ? senderPn : undefined,
      metadata: metadata
        ? { memberCount: metadata.participants.length, owner: metadata.owner }
        : {},
    };

    const { input, parsedArgs } = this.parseInput(normalized.text);
    const context = this.options.contextBuilder.build(
      user,
      channel,
      input,
      parsedArgs,
      'whatsapp',
      message,
      normalized.mentions,
    );

    this.options.logger.info('Received message', {
      messageId: message.key?.id,
      chatId: channel.id,
      chatType: channel.type,
      sender: user.id,
      name: user.name,
      input,
      parsedArgs,
    });

    await this.options.onContext(context);
  }

  // ─── Group Metadata ─────────────────────────────────────────────────────

  /** Store full group metadata. */
  handleGroupMetadata(groupId: string, metadata: GroupMetadata): void {
    this.groupMetadataCache.set(groupId, metadata);
    this.options.logger.info('Group metadata updated', { groupId, name: metadata.subject });
  }

  /** Merge a partial group update into the cache. */
  handleGroupUpdate(groupId: string, update: Partial<GroupMetadata>): void {
    const existing = this.groupMetadataCache.get(groupId);
    if (existing) {
      this.groupMetadataCache.set(groupId, { ...existing, ...update });
    } else {
      this.options.logger.debug('Group update without cached metadata', { groupId });
    }
  }

  private async ensureGroupMetadata(groupId: string): Promise<GroupMetadata | undefined> {
    const cached = this.groupMetadataCache.get(groupId);
    if (cached) return cached;

    const provider = this.options.groupMetadataProvider;
    if (!provider) return undefined;

    try {
      const metadata = await provider(groupId);
      this.groupMetadataCache.set(groupId, metadata);
      return metadata;
    } catch (error) {
      this.options.logger.warn('Failed to fetch group metadata', {
        groupId,
        error: error instanceof Error ? error.message : String(error),
      });
      return undefined;
    }
  }

  private lookupParticipant(index: ParticipantIndex, senderJid: string): ParticipantEntry | undefined {
    const token = digitsFromJid(senderJid);
    if (!token) return undefined;
    return index.byLid.get(token) ?? index.byPn.get(token) ?? index.byId.get(token);
  }

  private resolveSenderPn(
    senderJid: string,
    key: WAMessageKey | undefined,
    participant: ParticipantEntry | undefined,
  ): string | undefined {
    const candidates = [
      senderJid,
      key?.participantPn,
      key?.senderPn,
      key?.participant,
      key?.participantLid,
      key?.senderLid,
      participant?.jid,
    ];
    for (const candidate of candidates) {
      if (!candidate) continue;
      const pn = phoneNumberFrom(candidate);
      if (pn) return pn;
    }
    return participant?.pn;
  }

  // ─── Receipts ───────────────────────────────────────────────────────────

  /** Handle message receipts (read, delivered). */
  handleReceipts(receipts: MessageUserReceiptUpdate[]): void {
    for (const update of receipts) {
      const receipt = update.receipt;
      this.options.logger.debug('Message receipt', {
        userJid: receipt.userJid,
        readTimestamp: receipt.readTimestamp,
        playedTimestamp: receipt.playedTimestamp,
      });
    }
  }

  // ─── Private Helpers ────────────────────────────────────────────────────

  private isEphemeral(message: WAMessage): boolean {
    return !message.message && !message.messageStubType;
  }

  private extractMentionedJids(message: WAMessage): string[] {
    const content = message.message;
    if (!content) return [];

    const carriers: Array<{ contextInfo?: proto.IContextInfo | null } | null | undefined> = [
      content.extendedTextMessage,
      content.imageMessage,
      content.videoMessage,
      content.audioMessage,
      content.documentMessage,
      content.documentWithCaptionMessage?.message?.documentMessage,
      content.stickerMessage,
      content.templateButtonReplyMessage,
      content.buttonsResponseMessage,
      content.listResponseMessage,
      content.interactiveResponseMessage,
    ];

    const jids: string[] = [];
    for (const carrier of carriers) {
      const mentioned = carrier?.contextInfo?.mentionedJid;
      if (mentioned) {
        for (const jid of mentioned) jids.push(jid);
      }
    }
    return Array.from(new Set(jids));
  }

  private extractMessageText(message: WAMessage): string | null {
    const text = message.message?.conversation;
    if (text) return text;

    const extendedText = message.message?.extendedTextMessage?.text;
    if (extendedText) return extendedText;

    if (message.message?.reactionMessage) {
      return null;
    }

    const mediaMessage = message.message?.imageMessage
      ?? message.message?.videoMessage
      ?? message.message?.documentMessage
      ?? message.message?.documentWithCaptionMessage;
    if (mediaMessage && 'caption' in mediaMessage && mediaMessage.caption) {
      return mediaMessage.caption;
    }

    const template = message.message?.templateMessage?.hydratedTemplate?.hydratedContentText;
    if (template) return template;

    return null;
  }

  private parseInput(text: string): { input: string; parsedArgs: string[] } {
    let input = text;
    const prefix = text.charAt(0);
    if (['!', '/', '#', '.'].includes(prefix)) {
      const firstSpace = text.indexOf(' ');
      input = firstSpace > 0 ? text.slice(firstSpace + 1) : '';
    }

    const parsedArgs = input.trim().split(/\s+/).filter(Boolean);
    return { input: input.trim(), parsedArgs };
  }
}
