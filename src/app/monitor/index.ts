/** Dashboard monitoring — bounded logs, stats, and platform state. */

export { LogStore } from './log-store.js';
export { PlatformStatsTracker } from './stats.js';
export { Monitor } from './monitor.js';
export {
  isPlatformId,
  type PlatformId,
  type ConnectionStatus,
  type ConnectMethod,
  type ConnectionSnapshot,
  type ConnectionEvent,
  type LogLevelName,
  type LogEntryDto,
  type LogQuery,
  type PlatformStats,
  type PlatformSummary,
  type MessageRecord,
  type MessageInput,
  type OutboundMessageInput,
  type PlatformRegistration,
} from './types.js';
