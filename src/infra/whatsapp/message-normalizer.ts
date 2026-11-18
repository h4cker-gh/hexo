/** Pure helpers for normalizing incoming and outgoing WhatsApp mentions. */

import type { GroupMetadata } from '@whiskeysockets/baileys';
import type { ContextMention } from '@core/context/types.js';
import { digitsFromJid, isLidJid, normalizeJid, WHATSAPP_USER_SUFFIX } from './types.js';

/** A group participant indexed for mention resolution. */
export interface ParticipantEntry {
  /** Raw participant identifier (LID or PN JID). */
  id: string;
  /** Canonical JID used when emitting mentions. */
  jid: string;
  /** Digits of the participant's LID, when known. */
  lid?: string;
  /** Digits of the participant's phone number, when known. */
  pn?: string;
  /** Human-readable display name. */
  name: string;
}

/** Lookup tables for group participants. */
export interface ParticipantIndex {
  byLid: Map<string, ParticipantEntry>;
  byPn: Map<string, ParticipantEntry>;
  byId: Map<string, ParticipantEntry>;
}

/** Extract digits from an optional JID. */
function digitsOf(value: string | undefined): string | null {
  return value ? digitsFromJid(value) : null;
}

/** Build a participant index from group metadata. */
export function buildParticipantIndex(metadata: GroupMetadata): ParticipantIndex {
  const byLid = new Map<string, ParticipantEntry>();
  const byPn = new Map<string, ParticipantEntry>();
  const byId = new Map<string, ParticipantEntry>();

  for (const participant of metadata.participants) {
    const lidSource = participant.lid ?? (isLidJid(participant.id) ? participant.id : undefined);
    const pnSource = participant.jid
      ?? (participant.id.endsWith(`@${WHATSAPP_USER_SUFFIX}`) ? participant.id : undefined);

    const lid = digitsOf(lidSource) ?? undefined;
    const pn = digitsOf(pnSource) ?? undefined;
    const canonical = normalizeJid(participant.jid ?? participant.id);
    const name = participant.name
      ?? participant.notify
      ?? participant.verifiedName
      ?? pn
      ?? lid
      ?? digitsFromJid(participant.id)
      ?? canonical;

    const entry: ParticipantEntry = {
      id: participant.id,
      jid: canonical,
      ...(lid ? { lid } : {}),
      ...(pn ? { pn } : {}),
      name,
    };

    if (lid && !byLid.has(lid)) byLid.set(lid, entry);
    if (pn && !byPn.has(pn)) byPn.set(pn, entry);
    const idDigits = digitsFromJid(participant.id);
    if (idDigits && !byId.has(idDigits)) byId.set(idDigits, entry);
  }

  return { byLid, byPn, byId };
}

/** Replace every `@<token>` occurrence with `@<name>`. */
function rewriteToken(text: string, token: string, name: string): string {
  const pattern = new RegExp(`@${token}(?![0-9])`, 'g');
  // Use a function so `$` in a participant name is not treated as a replacement pattern.
  return text.replace(pattern, () => `@${name}`);
}

/** Collect unique numeric mention tokens from JIDs and `@digits` text. */
function collectTokens(
  text: string,
  mentionedJids: readonly string[],
): { tokens: string[]; mentioned: Set<string> } {
  const tokens: string[] = [];
  const mentioned = new Set<string>();

  for (const jid of mentionedJids) {
    const token = digitsFromJid(jid);
    if (token && !mentioned.has(token)) {
      mentioned.add(token);
      tokens.push(token);
    }
  }

  for (const match of text.matchAll(/@(\d+)/g)) {
    const token = match[1];
    if (token && !tokens.includes(token)) {
      tokens.push(token);
    }
  }

  return { tokens, mentioned };
}

/**
 * Normalize incoming mentions.
 *
 * With a group participant index, tokens resolve by LID, then PN, then id.
 * Without one (DMs), only JIDs present in `mentionedJids` are resolved.
 */
export function normalizeIncomingMentions(params: {
  text: string;
  mentionedJids?: readonly string[];
  index?: ParticipantIndex;
}): { text: string; mentions: ContextMention[] } {
  const mentionedJids = params.mentionedJids ?? [];
  const { tokens, mentioned } = collectTokens(params.text, mentionedJids);
  const mentionsByJid = new Map<string, ContextMention>();
  let text = params.text;

  for (const token of tokens) {
    let mention: ContextMention | undefined;

    if (params.index) {
      const entry = params.index.byLid.get(token)
        ?? params.index.byPn.get(token)
        ?? params.index.byId.get(token);
      if (entry) {
        mention = {
          jid: entry.jid,
          name: entry.name,
          ...(entry.pn ? { phoneNumber: entry.pn } : {}),
        };
      }
    } else if (mentioned.has(token)) {
      const source = mentionedJids.find((jid) => digitsFromJid(jid) === token);
      if (source) {
        mention = { jid: normalizeJid(source), name: token };
      }
    }

    if (!mention) continue;

    if (!mentionsByJid.has(mention.jid)) {
      mentionsByJid.set(mention.jid, mention);
    }
    text = rewriteToken(text, token, mention.name);
  }

  return { text, mentions: Array.from(mentionsByJid.values()) };
}

/** Escape a string for use inside a regular expression. */
function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Rebuild WhatsApp tokens from resolved mentions.
 *
 * Every `@<name>` in the text becomes `@<phoneNumber ?? digits(jid)>`.
 * Mentions that do not appear in the text are still forwarded.
 */
export function attachOutgoingMentions(
  text: string,
  mentions: readonly ContextMention[],
): { text: string; mentionedJid: string[] } {
  let normalized = text;

  for (const mention of mentions) {
    if (!mention.name) continue;
    const token = mention.phoneNumber ?? digitsFromJid(mention.jid) ?? normalizeJid(mention.jid);
    const pattern = new RegExp(`@${escapeRegExp(mention.name)}(?![\\p{L}\\p{N}_])`, 'gu');
    normalized = normalized.replace(pattern, () => `@${token}`);
  }

  return { text: normalized, mentionedJid: mentions.map((mention) => mention.jid) };
}
