/** WhatsApp-specific types and JID helpers. */

/** WhatsApp JID suffix for individual users. */
export const WHATSAPP_USER_SUFFIX = 's.whatsapp.net' as const;

/** WhatsApp JID suffix for groups. */
export const WHATSAPP_GROUP_SUFFIX = 'g.us' as const;

/** WhatsApp JID suffix for broadcast lists. */
export const WHATSAPP_BROADCAST_SUFFIX = 'broadcast' as const;

/** WhatsApp JID suffix for status/channel. */
export const WHATSAPP_STATUS_SUFFIX = 'status' as const;

/** WhatsApp JID suffix for LID-addressed users. */
export const WHATSAPP_LID_SUFFIX = 'lid' as const;

/**
 * Strip a device suffix from a JID.
 *
 * `123:4@s.whatsapp.net` becomes `123@s.whatsapp.net`.
 */
export function normalizeJid(jid: string): string {
  const at = jid.indexOf('@');
  if (at < 0) {
    const colon = jid.indexOf(':');
    return colon < 0 ? jid : jid.slice(0, colon);
  }
  const user = jid.slice(0, at);
  const colon = user.indexOf(':');
  const normalizedUser = colon < 0 ? user : user.slice(0, colon);
  return `${normalizedUser}${jid.slice(at)}`;
}

/** Return the digits before the `@` of a JID, or null when absent. */
export function digitsFromJid(jid: string): string | null {
  const normalized = normalizeJid(jid);
  const at = normalized.indexOf('@');
  const user = at < 0 ? normalized : normalized.slice(0, at);
  return /^\d+$/.test(user) ? user : null;
}

/** WhatsApp user JID format: `<number>@s.whatsapp.net`. */
export function makeUserJid(phoneNumber: string): string {
  return `${phoneNumber.trim()}@${WHATSAPP_USER_SUFFIX}`;
}

/** Extract phone number (digits) from a WhatsApp user JID. */
export function extractPhoneNumber(jid: string): string | null {
  const normalized = normalizeJid(jid);
  const [number, suffix] = normalized.split('@');
  if (suffix !== WHATSAPP_USER_SUFFIX || !number || !/^\d+$/.test(number)) {
    return null;
  }
  return number;
}

/** Check if a JID represents a WhatsApp user. */
export function isUserJid(jid: string): boolean {
  return normalizeJid(jid).endsWith(`@${WHATSAPP_USER_SUFFIX}`);
}

/** Check if a JID represents a WhatsApp group. */
export function isGroupJid(jid: string): boolean {
  return jid.includes(`@${WHATSAPP_GROUP_SUFFIX}`);
}

/** Check if a JID is LID-addressed. */
export function isLidJid(jid: string): boolean {
  return normalizeJid(jid).endsWith(`@${WHATSAPP_LID_SUFFIX}`);
}

/** Parse a JID into its components. */
export function parseJid(jid: string): {
  id: string;
  suffix: string | undefined;
  isUser: boolean;
  isGroup: boolean;
} {
  const normalized = normalizeJid(jid);
  const [id, suffix] = normalized.split('@');
  return {
    id: id ?? normalized,
    suffix,
    isUser: suffix === WHATSAPP_USER_SUFFIX,
    isGroup: suffix === WHATSAPP_GROUP_SUFFIX,
  };
}
