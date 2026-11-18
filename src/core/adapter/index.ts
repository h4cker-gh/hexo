/** Adapter contracts — platform-agnostic messaging interface. */

export {
  type MessageResult,
  type ConnectionStatus,
  type ConnectMethod,
  type ConnectionSnapshot,
  type ConnectOptions,
  type ConnectableAdapter,
  type TextMessageParams,
  type MediaMessageParams,
  type ReplyMessageParams,
  type PollMessageParams,
  type LocationMessageParams,
  type ContactMessageParams,
  type ContactInfo,
  type PollOption,
  type MessageAdapter,
  isConnectableAdapter,
} from './types.js';
