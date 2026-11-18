import { useEffect, useRef, useState } from 'react';

import { apiUrl } from '@/api/client';
import type {
  ConnectionEvent,
  ConnectionStatus,
  LogEntryDto,
  MessageRecord,
  PingEvent,
  PlatformId,
  PlatformStats,
  PlatformSummary,
} from '@/api/types';

export type StreamState = 'connecting' | 'open' | 'reconnecting' | 'closed';

export interface EventStreamHandlers {
  onSnapshot?: (platforms: PlatformSummary[]) => void;
  onConnection?: (event: ConnectionEvent) => void;
  onStats?: (stats: PlatformStats) => void;
  onLog?: (entry: LogEntryDto) => void;
  onMessage?: (message: MessageRecord) => void;
  onPing?: (event: PingEvent) => void;
  /** Fired after a dropped stream is re-established (not on first open). */
  onReconnect?: () => void;
}

export interface EventStreamStatus {
  state: StreamState;
  attempts: number;
}

const EVENTS_URL = apiUrl('/api/events');
const BASE_RETRY_MS = 1_000;
const MAX_RETRY_MS = 30_000;

const CONNECTION_STATUSES: readonly ConnectionStatus[] = [
  'disconnected',
  'connecting',
  'qr',
  'pairing',
  'connected',
  'error',
];

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isConnectionStatus(value: unknown): value is ConnectionStatus {
  return typeof value === 'string' && (CONNECTION_STATUSES as readonly string[]).includes(value);
}

function parseData(event: Event): unknown {
  if (!(event instanceof MessageEvent)) return null;
  if (typeof event.data !== 'string' || event.data.length === 0) return null;
  try {
    return JSON.parse(event.data) as unknown;
  } catch {
    return null;
  }
}

function toConnectionEvent(value: unknown): ConnectionEvent | null {
  if (!isObject(value)) return null;
  if (value['platform'] !== 'whatsapp') return null;
  const status = value['status'];
  if (!isConnectionStatus(status)) return null;

  const event: ConnectionEvent = {
    platform: value['platform'] as PlatformId,
    status,
    updatedAt: typeof value['updatedAt'] === 'string' ? value['updatedAt'] : new Date().toISOString(),
  };
  if (typeof value['qr'] === 'string') event.qr = value['qr'];
  if (typeof value['pairingCode'] === 'string') event.pairingCode = value['pairingCode'];
  if (typeof value['error'] === 'string') event.error = value['error'];
  if (typeof value['botJid'] === 'string') event.botJid = value['botJid'];
  return event;
}

function isPlatformStats(value: unknown): value is PlatformStats {
  if (!isObject(value)) return false;
  return (
    value['platform'] === 'whatsapp' &&
    typeof value['messagesReceived'] === 'number' &&
    typeof value['messagesSent'] === 'number' &&
    typeof value['commandsExecuted'] === 'number' &&
    typeof value['errors'] === 'number'
  );
}

function isPlatformSummary(value: unknown): value is PlatformSummary {
  if (!isObject(value)) return false;
  const stats = value['stats'];
  return (
    value['id'] === 'whatsapp' &&
    typeof value['name'] === 'string' &&
    typeof value['enabled'] === 'boolean' &&
    isConnectionStatus(value['status']) &&
    isPlatformStats(stats) &&
    typeof stats.connected === 'boolean' &&
    (typeof stats.startedAt === 'string' || stats.startedAt === null) &&
    (typeof stats.lastActivityAt === 'string' || stats.lastActivityAt === null)
  );
}

function isLogEntry(value: unknown): value is LogEntryDto {
  if (!isObject(value)) return false;
  return (
    typeof value['id'] === 'string' &&
    typeof value['timestamp'] === 'string' &&
    typeof value['level'] === 'string' &&
    typeof value['message'] === 'string'
  );
}

function isMessageRecord(value: unknown): value is MessageRecord {
  if (!isObject(value)) return false;
  return (
    typeof value['id'] === 'string' &&
    typeof value['timestamp'] === 'string' &&
    (value['direction'] === 'in' || value['direction'] === 'out') &&
    typeof value['chatId'] === 'string' &&
    typeof value['senderId'] === 'string' &&
    typeof value['text'] === 'string' &&
    typeof value['success'] === 'boolean'
  );
}

/**
 * Subscribe to `/api/events`. EventSource's native retry is disabled in favour
 * of capped exponential backoff with jitter. Handler identity does not
 * reconnect the stream; the latest handlers are read through a ref.
 */
export function useEventStream(
  handlers: EventStreamHandlers,
  enabled = true,
): EventStreamStatus {
  const [state, setState] = useState<StreamState>(enabled ? 'connecting' : 'closed');
  const [attempts, setAttempts] = useState(0);

  const handlersRef = useRef(handlers);
  useEffect(() => {
    handlersRef.current = handlers;
  }, [handlers]);

  useEffect(() => {
    if (!enabled) {
      setState('closed');
      return;
    }

    let disposed = false;
    let source: EventSource | null = null;
    let retryTimer: number | undefined;
    let attempt = 0;
    let openedBefore = false;

    const connect = () => {
      if (disposed) return;
      setState(openedBefore ? 'reconnecting' : 'connecting');

      const events = new EventSource(EVENTS_URL);
      source = events;

      const onNamed = (name: string, handle: (data: unknown) => void) => {
        events.addEventListener(name, (event) => {
          const data = parseData(event);
          if (data !== null) handle(data);
        });
      };

      events.addEventListener('open', () => {
        if (disposed) return;
        attempt = 0;
        setAttempts(0);
        setState('open');
        if (openedBefore) handlersRef.current.onReconnect?.();
        openedBefore = true;
      });

      onNamed('snapshot', (data) => {
        if (!Array.isArray(data) || !data.every(isPlatformSummary)) return;
        handlersRef.current.onSnapshot?.(data);
      });

      onNamed('connection', (data) => {
        const event = toConnectionEvent(data);
        if (event) handlersRef.current.onConnection?.(event);
      });

      onNamed('stats', (data) => {
        if (isPlatformStats(data)) handlersRef.current.onStats?.(data);
      });

      onNamed('log', (data) => {
        if (isLogEntry(data)) handlersRef.current.onLog?.(data);
      });

      onNamed('message', (data) => {
        if (isMessageRecord(data)) handlersRef.current.onMessage?.(data);
      });

      onNamed('ping', (data) => {
        if (isObject(data) && typeof data['t'] === 'number') {
          handlersRef.current.onPing?.({ t: data['t'] });
        }
      });

      events.addEventListener('error', () => {
        if (disposed) return;
        events.close();
        if (source === events) source = null;
        attempt += 1;
        setAttempts(attempt);
        setState('reconnecting');
        const delay =
          Math.min(MAX_RETRY_MS, BASE_RETRY_MS * 2 ** (attempt - 1)) + Math.floor(Math.random() * 250);
        retryTimer = window.setTimeout(connect, delay);
      });
    };

    connect();

    return () => {
      disposed = true;
      if (retryTimer !== undefined) window.clearTimeout(retryTimer);
      source?.close();
      source = null;
    };
  }, [enabled]);

  return { state, attempts };
}
