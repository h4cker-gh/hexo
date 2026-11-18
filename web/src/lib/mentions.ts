import type { ContextMention } from '@/api/types';

export interface Recipient {
  /** Value to send to the API: a full JID or normalized digits. */
  to: string;
  /** Human-friendly preview of what the backend will address. */
  preview: string;
  valid: boolean;
}

/**
 * Accept a full JID or a phone number. Phone numbers are stripped to digits and
 * must look like a dialable number (8–15 digits, E.164 without "+").
 */
export function normalizeRecipient(raw: string): Recipient {
  const value = raw.trim();
  if (!value) return { to: '', preview: '', valid: false };

  if (value.includes('@')) {
    const valid = /^[^\s@]+@[^\s@]+$/.test(value);
    return { to: value, preview: value, valid };
  }

  const digits = value.replace(/\D/g, '');
  const valid = digits.length >= 8 && digits.length <= 15;
  return {
    to: digits,
    preview: digits ? `${digits}@s.whatsapp.net` : '',
    valid,
  };
}

export interface ParsedMentions {
  mentions: ContextMention[];
  invalid: string[];
}

/**
 * Parse a comma/newline separated mention list.
 * A bare number becomes `<digits>@s.whatsapp.net` with name/phoneNumber = digits.
 * A full JID is kept as-is with name = jid (per the dashboard brief).
 */
export function parseMentions(raw: string): ParsedMentions {
  const tokens = raw
    .split(/[,\n]/)
    .map((token) => token.trim().replace(/^@/, ''))
    .filter(Boolean);

  const mentions: ContextMention[] = [];
  const invalid: string[] = [];
  const seen = new Set<string>();

  for (const token of tokens) {
    if (token.includes('@')) {
      const valid = /^[^\s@]+@[^\s@]+$/.test(token);
      if (!valid) {
        invalid.push(token);
        continue;
      }
      if (seen.has(token)) continue;
      seen.add(token);
      mentions.push({ jid: token, name: token });
      continue;
    }

    const digits = token.replace(/\D/g, '');
    if (digits.length < 8 || digits.length > 15) {
      invalid.push(token);
      continue;
    }
    const jid = `${digits}@s.whatsapp.net`;
    if (seen.has(jid)) continue;
    seen.add(jid);
    mentions.push({ jid, name: digits, phoneNumber: digits });
  }

  return { mentions, invalid };
}
