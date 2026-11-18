import type {
  ApiErrorBody,
  ConnectMethod,
  ConnectResponse,
  DisconnectResponse,
  HealthResponse,
  LogEntryDto,
  LogLevelName,
  MessageRecord,
  PlatformId,
  PlatformSummary,
  SendMessageRequest,
  SendMessageResponse,
} from '@/api/types';

/** Optional absolute origin. Empty string keeps requests same-origin (Vite proxy in dev). */
const RAW_BASE = import.meta.env.VITE_API_BASE ?? '';

export const API_BASE = RAW_BASE.replace(/\/+$/, '');

export function apiUrl(path: string): string {
  const suffix = path.startsWith('/') ? path : `/${path}`;
  return `${API_BASE}${suffix}`;
}

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

interface RequestOptions {
  method?: 'GET' | 'POST';
  body?: unknown;
  signal?: AbortSignal;
  timeoutMs?: number;
}

const DEFAULT_TIMEOUT_MS = 12_000;

function isApiErrorBody(value: unknown): value is ApiErrorBody {
  if (typeof value !== 'object' || value === null) return false;
  const error = (value as { error?: unknown }).error;
  if (typeof error !== 'object' || error === null) return false;
  const body = error as { code?: unknown; message?: unknown };
  return typeof body.code === 'string' && typeof body.message === 'string';
}

async function readErrorBody(response: Response): Promise<{ code?: string; message?: string }> {
  try {
    const body: unknown = await response.json();
    if (isApiErrorBody(body)) {
      return { code: body.error.code, message: body.error.message };
    }
  } catch {
    /* non-JSON error response — fall back to the status code */
  }
  return {};
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, signal, timeoutMs = DEFAULT_TIMEOUT_MS } = options;
  const controller = new AbortController();
  let timedOut = false;

  const onAbort = () => controller.abort();
  if (signal) {
    if (signal.aborted) controller.abort();
    else signal.addEventListener('abort', onAbort, { once: true });
  }

  const timer =
    timeoutMs > 0
      ? window.setTimeout(() => {
          timedOut = true;
          controller.abort();
        }, timeoutMs)
      : undefined;

  const headers: Record<string, string> = { Accept: 'application/json' };
  let payload: string | undefined;
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }

  try {
    const response = await fetch(apiUrl(path), {
      method,
      headers,
      body: payload,
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorBody = await readErrorBody(response);
      throw new ApiError(
        response.status,
        errorBody.code ?? 'http_error',
        errorBody.message ?? `Request failed with status ${response.status}.`,
      );
    }

    if (response.status === 204) return undefined as T;

    try {
      return (await response.json()) as T;
    } catch {
      throw new ApiError(
        response.status,
        'invalid_response',
        'The server returned an invalid JSON response.',
      );
    }
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (timedOut) {
      throw new ApiError(0, 'timeout', 'The request timed out. The HexoBot server may be offline.');
    }
    if (signal?.aborted) throw error;
    throw new ApiError(
      0,
      'network_error',
      'Cannot reach the HexoBot API. Check that the server is running on 127.0.0.1:3000.',
    );
  } finally {
    if (timer !== undefined) window.clearTimeout(timer);
    if (signal) signal.removeEventListener('abort', onAbort);
  }
}

export function getHealth(signal?: AbortSignal): Promise<HealthResponse> {
  return request<HealthResponse>('/api/health', { signal });
}

export function getPlatforms(signal?: AbortSignal): Promise<PlatformSummary[]> {
  return request<PlatformSummary[]>('/api/platforms', { signal });
}

export function getPlatform(platform: PlatformId, signal?: AbortSignal): Promise<PlatformSummary> {
  return request<PlatformSummary>(`/api/platforms/${platform}`, { signal });
}

export interface LogQuery {
  level?: LogLevelName;
  limit?: number;
}

export function getLogs(query: LogQuery = {}, signal?: AbortSignal): Promise<LogEntryDto[]> {
  const params = new URLSearchParams();
  if (query.level) params.set('level', query.level);
  if (query.limit !== undefined) params.set('limit', String(query.limit));
  const search = params.toString();
  return request<LogEntryDto[]>(`/api/logs${search ? `?${search}` : ''}`, { signal });
}

export interface MessageQuery {
  platform?: PlatformId;
  limit?: number;
}

export function getMessages(
  query: MessageQuery = {},
  signal?: AbortSignal,
): Promise<MessageRecord[]> {
  const params = new URLSearchParams();
  if (query.platform) params.set('platform', query.platform);
  if (query.limit !== undefined) params.set('limit', String(query.limit));
  const search = params.toString();
  return request<MessageRecord[]>(`/api/messages${search ? `?${search}` : ''}`, { signal });
}

export function connectWhatsApp(
  method: ConnectMethod,
  phoneNumber?: string,
): Promise<ConnectResponse> {
  const body = method === 'pairing-code' ? { method, phoneNumber } : { method };
  return request<ConnectResponse>('/api/platforms/whatsapp/connect', {
    method: 'POST',
    body,
  });
}

export function disconnectWhatsApp(logout = false): Promise<DisconnectResponse> {
  return request<DisconnectResponse>('/api/platforms/whatsapp/disconnect', {
    method: 'POST',
    body: { logout },
  });
}

export function sendMessage(payload: SendMessageRequest): Promise<SendMessageResponse> {
  return request<SendMessageResponse>('/api/platforms/whatsapp/send', {
    method: 'POST',
    body: payload,
  });
}
