/** WhatsApp infrastructure — adapter, session, events, normalization, and types. */

export { WhatsAppAdapter, type WhatsAppAdapterConfig } from './adapter.js';
export { EventTransformer, resolveSenderJid, type SenderResolution, type TransformOptions } from './event-transformer.js';
export { SessionManager, type SessionConfig } from './session-manager.js';
export {
  buildParticipantIndex,
  normalizeIncomingMentions,
  attachOutgoingMentions,
  type ParticipantEntry,
  type ParticipantIndex,
} from './message-normalizer.js';
export {
  WHATSAPP_USER_SUFFIX,
  WHATSAPP_GROUP_SUFFIX,
  WHATSAPP_BROADCAST_SUFFIX,
  WHATSAPP_STATUS_SUFFIX,
  WHATSAPP_LID_SUFFIX,
  normalizeJid,
  digitsFromJid,
  makeUserJid,
  extractPhoneNumber,
  isUserJid,
  isGroupJid,
  isLidJid,
  parseJid,
} from './types.js';
