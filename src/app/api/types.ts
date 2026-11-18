/** HTTP API DTOs and dependency contracts. */

import type {
  ConnectableAdapter,
  MessageResult,
  TextMessageParams,
} from '@core/adapter/types.js';
import type { Config } from '@core/config/index.js';
import type { ContextMention } from '@core/context/types.js';
import type { Logger } from '@core/logger/types.js';
import type { Monitor } from '@app/monitor/monitor.js';
import type {
  LogEntryDto,
  LogLevelName,
  MessageRecord,
  PlatformId,
  PlatformStats,
  PlatformSummary,
} from '@app/monitor/types.js';

export type {
  LogEntryDto,
  LogLevelName,
  MessageRecord,
  PlatformId,
  PlatformStats,
  PlatformSummary,
};

/** Request body for POST /api/platforms/:platform/send. */
export interface SendMessageRequest {
  /** JID or phone number (digits). Groups must use a full @g.us JID. */
  to: string;
  content: string;
  mentions?: ContextMention[];
}

/** Response body for send operations. */
export interface SendMessageResponse {
  id: string;
  success: boolean;
  error?: string;
}

/** Standard error envelope. */
export interface ApiErrorBody {
  error: { code: string; message: string };
}

/** Health check payload. */
export interface HealthResponse {
  ok: boolean;
  uptimeMs: number;
  version: string;
}

/** The subset of the messaging adapter the dashboard needs. */
export interface DashboardAdapter extends ConnectableAdapter {
  sendText(params: TextMessageParams): Promise<MessageResult>;
}

/** Dependencies injected into the Fastify server. */
export interface ApiDeps {
  config: Config;
  logger: Logger;
  monitor: Monitor;
  adapter?: DashboardAdapter;
  version: string;
}
