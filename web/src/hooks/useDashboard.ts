import { useCallback, useEffect, useRef, useState } from 'react';

import { getLogs, getMessages, getPlatform, getPlatforms } from '@/api/client';
import type {
  ConnectionEvent,
  LogEntryDto,
  MessageRecord,
  PlatformId,
  PlatformStats,
  PlatformSummary,
} from '@/api/types';
import { LIMITS, PLATFORM_ID } from '@/config';
import { useEventStream, type EventStreamStatus } from '@/hooks/useEventStream';
import { errorMessage, isAbortError } from '@/lib/errors';
import { mergeById } from '@/lib/merge';

export interface SentMessageInput {
  id?: string;
  to: string;
  content: string;
  success: boolean;
  error?: string;
}

export interface SentMessage {
  id: string;
  to: string;
  content: string;
  sentAt: string;
  success: boolean;
  error?: string;
}

export interface DashboardStore {
  platforms: PlatformSummary[];
  whatsapp: PlatformSummary | undefined;
  messages: MessageRecord[];
  logs: LogEntryDto[];
  sent: SentMessage[];
  loading: boolean;
  error: string | null;
  stream: EventStreamStatus;
  paused: boolean;
  pendingLogCount: number;
  refresh: () => Promise<void>;
  refreshPlatform: (platform: PlatformId) => Promise<void>;
  togglePause: () => void;
  clearLogs: () => void;
  recordSent: (entry: SentMessageInput) => void;
}

function replacePlatform(list: PlatformSummary[], next: PlatformSummary): PlatformSummary[] {
  return list.some((item) => item.id === next.id)
    ? list.map((item) => (item.id === next.id ? next : item))
    : [...list, next];
}

function applyConnection(platform: PlatformSummary, event: ConnectionEvent): PlatformSummary {
  return {
    ...platform,
    status: event.status,
    qr: event.status === 'qr' ? (event.qr ?? platform.qr) : undefined,
    pairingCode:
      event.status === 'pairing' ? (event.pairingCode ?? platform.pairingCode) : undefined,
    error:
      event.status === 'error'
        ? (event.error ?? 'WhatsApp reported a connection error.')
        : undefined,
    botJid: event.botJid ?? platform.botJid,
  };
}

/**
 * Owns platforms/messages/logs for the whole app, merges SSE events, and
 * re-fetches the REST snapshot after a stream reconnect.
 */
export function useDashboard(): DashboardStore {
  const [platforms, setPlatforms] = useState<PlatformSummary[]>([]);
  const [messages, setMessages] = useState<MessageRecord[]>([]);
  const [logs, setLogs] = useState<LogEntryDto[]>([]);
  const [sent, setSent] = useState<SentMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [booted, setBooted] = useState(false);
  const [paused, setPaused] = useState(false);
  const [pendingLogCount, setPendingLogCount] = useState(0);

  const pausedRef = useRef(false);
  const bufferedLogsRef = useRef<LogEntryDto[]>([]);
  const platformVersionRef = useRef(0);
  const inFlightPlatformsRef = useRef<Set<PlatformId>>(new Set());
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const load = useCallback(async (signal: AbortSignal, spinner: boolean) => {
    if (spinner) setLoading(true);
    const [platformsResult, messagesResult, logsResult] = await Promise.allSettled([
      getPlatforms(signal),
      getMessages({ platform: PLATFORM_ID, limit: LIMITS.messages }, signal),
      getLogs({ limit: LIMITS.logs }, signal),
    ]);

    if (signal.aborted) return;

    if (platformsResult.status === 'fulfilled') {
      platformVersionRef.current += 1;
      setPlatforms(platformsResult.value);
      setError(null);
    } else if (!isAbortError(platformsResult.reason)) {
      setError(errorMessage(platformsResult.reason));
    }

    if (messagesResult.status === 'fulfilled') {
      setMessages((current) =>
        mergeById(messagesResult.value, current, LIMITS.maxMessages),
      );
    }
    if (logsResult.status === 'fulfilled') {
      setLogs((current) => mergeById(logsResult.value, current, LIMITS.maxLogs));
    }

    if (spinner) setLoading(false);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;

    void (async () => {
      await load(controller.signal, true);
      if (active) setBooted(true);
    })();

    return () => {
      active = false;
      controller.abort();
    };
  }, [load]);

  const refresh = useCallback(async () => {
    await load(new AbortController().signal, true);
  }, [load]);

  const refreshPlatform = useCallback(async (platform: PlatformId) => {
    if (inFlightPlatformsRef.current.has(platform)) return;
    inFlightPlatformsRef.current.add(platform);
    const version = platformVersionRef.current;

    try {
      const next = await getPlatform(platform);
      if (!mountedRef.current) return;
      // Skip stale responses if an SSE event updated the platform mid-flight.
      if (platformVersionRef.current === version) {
        platformVersionRef.current += 1;
        setPlatforms((current) => replacePlatform(current, next));
      }
    } catch (caught) {
      if (!isAbortError(caught)) {
        /* best effort: SSE remains the source of truth */
      }
    } finally {
      inFlightPlatformsRef.current.delete(platform);
    }
  }, []);

  const onSnapshot = useCallback((next: PlatformSummary[]) => {
    platformVersionRef.current += 1;
    setPlatforms(next);
    setError(null);
  }, []);

  const onConnection = useCallback(
    (event: ConnectionEvent) => {
      platformVersionRef.current += 1;
      setPlatforms((current) =>
        current.map((platform) =>
          platform.id === event.platform ? applyConnection(platform, event) : platform,
        ),
      );
      void refreshPlatform(event.platform);
    },
    [refreshPlatform],
  );

  const onStats = useCallback((stats: PlatformStats) => {
    platformVersionRef.current += 1;
    setPlatforms((current) =>
      current.map((platform) => (platform.id === stats.platform ? { ...platform, stats } : platform)),
    );
  }, []);

  const onLog = useCallback((entry: LogEntryDto) => {
    if (pausedRef.current) {
      bufferedLogsRef.current = mergeById([entry], bufferedLogsRef.current, LIMITS.maxLogs);
      setPendingLogCount(bufferedLogsRef.current.length);
      return;
    }
    setLogs((current) => mergeById([entry], current, LIMITS.maxLogs));
  }, []);

  const onMessage = useCallback((message: MessageRecord) => {
    setMessages((current) => mergeById([message], current, LIMITS.maxMessages));
  }, []);

  const onReconnect = useCallback(() => {
    void load(new AbortController().signal, false);
  }, [load]);

  const stream = useEventStream(
    { onSnapshot, onConnection, onStats, onLog, onMessage, onReconnect },
    booted,
  );

  const togglePause = useCallback(() => {
    if (pausedRef.current) {
      pausedRef.current = false;
      setPaused(false);
      const buffered = bufferedLogsRef.current;
      bufferedLogsRef.current = [];
      setPendingLogCount(0);
      if (buffered.length > 0) {
        setLogs((current) => mergeById(buffered, current, LIMITS.maxLogs));
      }
    } else {
      pausedRef.current = true;
      setPaused(true);
    }
  }, []);

  const clearLogs = useCallback(() => {
    bufferedLogsRef.current = [];
    setPendingLogCount(0);
    setLogs([]);
  }, []);

  const recordSent = useCallback((entry: SentMessageInput) => {
    const record: SentMessage = {
      id: entry.id ?? `local-${Date.now()}`,
      to: entry.to,
      content: entry.content,
      sentAt: new Date().toISOString(),
      success: entry.success,
      ...(entry.error ? { error: entry.error } : {}),
    };
    setSent((current) => [record, ...current].slice(0, LIMITS.sentHistory));
  }, []);

  return {
    platforms,
    whatsapp: platforms.find((platform) => platform.id === PLATFORM_ID),
    messages,
    logs,
    sent,
    loading,
    error,
    stream,
    paused,
    pendingLogCount,
    refresh,
    refreshPlatform,
    togglePause,
    clearLogs,
    recordSent,
  };
}
