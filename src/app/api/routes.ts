/** REST and SSE routes for the dashboard API. */

import type { FastifyInstance, FastifyReply } from 'fastify';
import type { ContextMention } from '@core/context/types.js';
import { isPlatformId } from '@app/monitor/types.js';
import type { LogLevelName, PlatformId } from '@app/monitor/types.js';
import type {
  ApiDeps,
  ApiErrorBody,
  HealthResponse,
  SendMessageResponse,
} from './types.js';

const DEFAULT_LOG_LIMIT = 100;
const MAX_LOG_LIMIT = 500;
const DEFAULT_MESSAGE_LIMIT = 50;
const MAX_MESSAGE_LIMIT = 200;
const HEARTBEAT_MS = 15_000;

/** Build the standard error envelope. */
export function apiError(code: string, message: string): ApiErrorBody {
  return { error: { code, message } };
}

/** Send a JSON error response. */
function sendError(
  reply: FastifyReply,
  status: number,
  code: string,
  message: string,
): FastifyReply {
  return reply.status(status).send(apiError(code, message));
}

/** Safe view of an untyped JSON body. */
function asRecord(value: unknown): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

/** Read a string field from a record. */
function readString(record: Record<string, unknown>, key: string): string | undefined {
  const value = record[key];
  return typeof value === 'string' ? value : undefined;
}

/** Parse a positive integer limit into a clamped range. */
function parseLimit(value: string | undefined, fallback: number, max: number): number | null {
  if (value === undefined) return fallback;
  if (!/^\d+$/.test(value)) return null;
  return Math.min(Math.max(Number.parseInt(value, 10), 1), max);
}

/** Runtime guard for log level names. */
function isLogLevelName(value: string): value is LogLevelName {
  return value === 'debug'
    || value === 'info'
    || value === 'warn'
    || value === 'error'
    || value === 'fatal';
}

/** Normalize a recipient JID, converting bare digits to a PN JID. */
function normalizeRecipient(to: string): string | null {
  if (to.includes('@')) return to;
  if (/^\d+$/.test(to)) return `${to}@s.whatsapp.net`;
  return null;
}

/** Validate and parse the mentions field of a send request. */
function parseMentions(value: unknown): ContextMention[] | null {
  if (value === undefined) return [];
  if (!Array.isArray(value)) return null;

  const mentions: ContextMention[] = [];
  for (const item of value) {
    const record = asRecord(item);
    const jid = readString(record, 'jid');
    const name = readString(record, 'name');
    const phoneNumber = readString(record, 'phoneNumber');
    if (!jid || !name) return null;
    mentions.push({
      jid,
      name,
      ...(phoneNumber ? { phoneNumber } : {}),
    });
  }
  return mentions;
}

/** Resolve a platform path param, or null when unknown. */
function resolvePlatform(value: string): PlatformId | null {
  return isPlatformId(value) ? value : null;
}

/** Register all dashboard REST and SSE endpoints. */
export async function registerApiRoutes(app: FastifyInstance, deps: ApiDeps): Promise<void> {
  const startedAt = Date.now();

  app.get('/api/health', async (): Promise<HealthResponse> => ({
    ok: true,
    uptimeMs: Date.now() - startedAt,
    version: deps.version,
  }));

  app.get('/api/platforms', async () => deps.monitor.getPlatformSummaries());

  app.get<{ Params: { platform: string } }>(
    '/api/platforms/:platform',
    async (request, reply) => {
      const platform = resolvePlatform(request.params.platform);
      if (!platform) {
        return sendError(reply, 404, 'UNKNOWN_PLATFORM', `Unknown platform: ${request.params.platform}`);
      }
      const summary = deps.monitor.getPlatform(platform);
      if (!summary) {
        return sendError(reply, 404, 'UNKNOWN_PLATFORM', `Unknown platform: ${platform}`);
      }
      return summary;
    },
  );

  app.get<{ Querystring: { level?: string; limit?: string } }>(
    '/api/logs',
    async (request, reply) => {
      const { level, limit } = request.query;
      if (level !== undefined && !isLogLevelName(level)) {
        return sendError(reply, 400, 'INVALID_LEVEL', `Invalid log level: ${level}`);
      }
      const parsedLimit = parseLimit(limit, DEFAULT_LOG_LIMIT, MAX_LOG_LIMIT);
      if (parsedLimit === null) {
        return sendError(reply, 400, 'INVALID_LIMIT', 'limit must be a positive integer');
      }
      return deps.monitor.getLogs({
        ...(level ? { level } : {}),
        limit: parsedLimit,
      });
    },
  );

  app.get<{ Querystring: { platform?: string; limit?: string } }>(
    '/api/messages',
    async (request, reply) => {
      const { platform: platformParam, limit } = request.query;
      let platform: PlatformId | undefined;
      if (platformParam !== undefined) {
        const resolved = resolvePlatform(platformParam);
        if (!resolved) {
          return sendError(reply, 404, 'UNKNOWN_PLATFORM', `Unknown platform: ${platformParam}`);
        }
        platform = resolved;
      }
      const parsedLimit = parseLimit(limit, DEFAULT_MESSAGE_LIMIT, MAX_MESSAGE_LIMIT);
      if (parsedLimit === null) {
        return sendError(reply, 400, 'INVALID_LIMIT', 'limit must be a positive integer');
      }
      return deps.monitor.getMessages(platform, parsedLimit);
    },
  );

  app.post<{ Params: { platform: string }; Body: unknown }>(
    '/api/platforms/:platform/connect',
    async (request, reply) => {
      const platform = resolvePlatform(request.params.platform);
      if (!platform) {
        return sendError(reply, 404, 'UNKNOWN_PLATFORM', `Unknown platform: ${request.params.platform}`);
      }

      const body = asRecord(request.body);
      const method = readString(body, 'method');
      if (method !== 'qr' && method !== 'pairing-code') {
        return sendError(reply, 400, 'INVALID_METHOD', 'method must be "qr" or "pairing-code"');
      }

      const phoneNumber = readString(body, 'phoneNumber');
      if (method === 'pairing-code' && (!phoneNumber || !/^\d+$/.test(phoneNumber))) {
        return sendError(
          reply,
          400,
          'INVALID_PHONE_NUMBER',
          'phoneNumber must contain digits only',
        );
      }

      const adapter = deps.adapter;
      if (!adapter) {
        return sendError(reply, 500, 'ADAPTER_UNAVAILABLE', 'WhatsApp adapter is not available');
      }

      if (adapter.getConnectionSnapshot().status === 'connected') {
        return { status: 'connected' };
      }

      try {
        await adapter.connect(
          method,
          method === 'pairing-code' && phoneNumber ? { phoneNumber } : undefined,
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to connect';
        deps.logger.error('WhatsApp connect request failed', { error: message });
        return sendError(reply, 500, 'CONNECT_FAILED', message);
      }

      const status = adapter.getConnectionSnapshot().status;
      return { status: status === 'connected' ? 'connected' : 'connecting' };
    },
  );

  app.post<{ Params: { platform: string }; Body: unknown }>(
    '/api/platforms/:platform/disconnect',
    async (request, reply) => {
      const platform = resolvePlatform(request.params.platform);
      if (!platform) {
        return sendError(reply, 404, 'UNKNOWN_PLATFORM', `Unknown platform: ${request.params.platform}`);
      }

      const body = asRecord(request.body);
      const logoutValue = body['logout'];
      if (logoutValue !== undefined && typeof logoutValue !== 'boolean') {
        return sendError(reply, 400, 'INVALID_BODY', 'logout must be a boolean');
      }

      const adapter = deps.adapter;
      if (!adapter) {
        return sendError(reply, 500, 'ADAPTER_UNAVAILABLE', 'WhatsApp adapter is not available');
      }

      try {
        await adapter.disconnect({ logout: logoutValue === true });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to disconnect';
        deps.logger.error('WhatsApp disconnect request failed', { error: message });
        return sendError(reply, 500, 'DISCONNECT_FAILED', message);
      }

      return { ok: true };
    },
  );

  app.post<{ Params: { platform: string }; Body: unknown }>(
    '/api/platforms/:platform/send',
    async (request, reply) => {
      const platform = resolvePlatform(request.params.platform);
      if (!platform) {
        return sendError(reply, 404, 'UNKNOWN_PLATFORM', `Unknown platform: ${request.params.platform}`);
      }

      const body = asRecord(request.body);
      const to = readString(body, 'to')?.trim();
      if (!to) {
        return sendError(reply, 400, 'INVALID_TO', 'to is required');
      }
      const normalizedTo = normalizeRecipient(to);
      if (!normalizedTo) {
        return sendError(reply, 400, 'INVALID_TO', 'to must be a JID or digits only');
      }

      const content = readString(body, 'content');
      if (content === undefined) {
        return sendError(reply, 400, 'INVALID_CONTENT', 'content must be a string');
      }

      const mentions = parseMentions(body['mentions']);
      if (mentions === null) {
        return sendError(reply, 400, 'INVALID_MENTIONS', 'mentions must be an array of mentions');
      }

      const adapter = deps.adapter;
      if (!adapter) {
        return sendError(reply, 500, 'ADAPTER_UNAVAILABLE', 'WhatsApp adapter is not available');
      }

      const result = await adapter.sendText({ to: normalizedTo, content, mentions });
      const senderId = adapter.getConnectionSnapshot().botJid ?? '';

      deps.monitor.recordOutbound('whatsapp', {
        id: result.id,
        chatId: normalizedTo,
        senderId,
        text: content,
        success: result.success,
      });

      const response: SendMessageResponse = {
        id: result.id,
        success: result.success,
        ...(result.error ? { error: result.error } : {}),
      };
      return response;
    },
  );

  app.get('/api/events', (request, reply) => {
    const allowedOrigins = deps.config.server.corsOrigins;
    const requestOrigin = request.headers.origin;
    const corsOrigin = requestOrigin && allowedOrigins.includes(requestOrigin)
      ? requestOrigin
      : allowedOrigins[0] ?? '*';

    reply.hijack();
    const response = reply.raw;
    response.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'Access-Control-Allow-Origin': corsOrigin,
      'X-Accel-Buffering': 'no',
    });

    let closed = false;
    const send = (event: string, data: unknown): void => {
      if (closed || response.writableEnded) return;
      response.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    };

    send('snapshot', deps.monitor.getPlatformSummaries());

    const unsubscribes = [
      deps.monitor.onConnection((event) => send('connection', event)),
      deps.monitor.onStats((stats) => send('stats', stats)),
      deps.monitor.onLog((entry) => send('log', entry)),
      deps.monitor.onMessage((record) => send('message', record)),
    ];
    const heartbeat = setInterval(() => send('ping', { t: Date.now() }), HEARTBEAT_MS);

    const cleanup = (): void => {
      if (closed) return;
      closed = true;
      clearInterval(heartbeat);
      for (const unsubscribe of unsubscribes) unsubscribe();
      if (!response.writableEnded) response.end();
    };

    response.on('close', cleanup);
    response.on('error', cleanup);
  });
}
