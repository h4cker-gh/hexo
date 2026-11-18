import { describe, it, expect } from 'vitest';
import { createApiServer } from '@app/api/server.js';
import { LogStore } from '@app/monitor/log-store.js';
import { Monitor } from '@app/monitor/monitor.js';
import type { ApiDeps } from '@app/api/types.js';
import type {
  ConnectMethod,
  ConnectOptions,
  ConnectionSnapshot,
  MessageResult,
  TextMessageParams,
} from '@core/adapter/types.js';
import { ConfigSchema } from '@core/config/schema.js';
import { buildTestLogger } from '../fixtures.js';

const config = ConfigSchema.parse({
  bot: { name: 'TestBot', prefix: '!', agent: 'test' },
  logger: { level: 'debug' },
  server: { enabled: true },
});

class FakeAdapter {
  readonly sent: TextMessageParams[] = [];
  readonly connectCalls: Array<{ method: ConnectMethod; phoneNumber?: string }> = [];
  private snapshot: ConnectionSnapshot = {
    status: 'disconnected',
    updatedAt: new Date().toISOString(),
  };
  private readonly listeners = new Set<(snapshot: ConnectionSnapshot) => void>();

  async connect(method: ConnectMethod, options?: ConnectOptions): Promise<void> {
    this.connectCalls.push({
      method,
      ...(options?.phoneNumber ? { phoneNumber: options.phoneNumber } : {}),
    });
    this.setSnapshot({ status: 'connecting' });
  }

  async disconnect(): Promise<void> {
    this.setSnapshot({ status: 'disconnected' });
  }

  getConnectionSnapshot(): ConnectionSnapshot {
    return { ...this.snapshot };
  }

  onConnectionChange(listener: (snapshot: ConnectionSnapshot) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  async sendText(params: TextMessageParams): Promise<MessageResult> {
    this.sent.push(params);
    return { id: 'sent-1', success: true };
  }

  private setSnapshot(next: Omit<ConnectionSnapshot, 'updatedAt'>): void {
    this.snapshot = { ...next, updatedAt: new Date().toISOString() };
    for (const listener of this.listeners) listener({ ...this.snapshot });
  }
}

async function createTestApp(): Promise<{
  app: Awaited<ReturnType<typeof createApiServer>>;
  adapter: FakeAdapter;
  monitor: Monitor;
  logStore: LogStore;
}> {
  const logStore = new LogStore();
  const monitor = new Monitor(logStore);
  monitor.registerPlatform({ id: 'whatsapp', name: 'WhatsApp', enabled: true });
  const adapter = new FakeAdapter();

  const deps: ApiDeps = {
    config,
    logger: buildTestLogger(),
    monitor,
    adapter,
    version: '0.1.0',
  };

  const app = await createApiServer(deps);
  return { app, adapter, monitor, logStore };
}

describe('Dashboard API', () => {
  it('serves health information', async () => {
    const { app } = await createTestApp();
    try {
      const response = await app.inject({ method: 'GET', url: '/api/health' });
      expect(response.statusCode).toBe(200);
      const body = response.json<{ ok: boolean; uptimeMs: number; version: string }>();
      expect(body.ok).toBe(true);
      expect(body.uptimeMs).toBeGreaterThanOrEqual(0);
      expect(body.version).toBe('0.1.0');
    } finally {
      await app.close();
    }
  });

  it('lists platforms and returns a single platform', async () => {
    const { app } = await createTestApp();
    try {
      const list = await app.inject({ method: 'GET', url: '/api/platforms' });
      expect(list.statusCode).toBe(200);
      const platforms = list.json<Array<{ id: string; status: string }>>();
      expect(platforms).toHaveLength(1);
      expect(platforms[0]?.id).toBe('whatsapp');
      expect(platforms[0]?.status).toBe('disconnected');

      const single = await app.inject({ method: 'GET', url: '/api/platforms/whatsapp' });
      expect(single.statusCode).toBe(200);
      expect(single.json<{ name: string }>().name).toBe('WhatsApp');
    } finally {
      await app.close();
    }
  });

  it('returns 404 for unknown platforms', async () => {
    const { app } = await createTestApp();
    try {
      const response = await app.inject({ method: 'GET', url: '/api/platforms/telegram' });
      expect(response.statusCode).toBe(404);
      const body = response.json<{ error: { code: string } }>();
      expect(body.error.code).toBe('UNKNOWN_PLATFORM');
    } finally {
      await app.close();
    }
  });

  it('validates pairing phone numbers', async () => {
    const { app, adapter } = await createTestApp();
    try {
      const invalid = await app.inject({
        method: 'POST',
        url: '/api/platforms/whatsapp/connect',
        payload: { method: 'pairing-code', phoneNumber: 'not-a-number' },
      });
      expect(invalid.statusCode).toBe(400);
      expect(invalid.json<{ error: { code: string } }>().error.code).toBe('INVALID_PHONE_NUMBER');
      expect(adapter.connectCalls).toHaveLength(0);

      const valid = await app.inject({
        method: 'POST',
        url: '/api/platforms/whatsapp/connect',
        payload: { method: 'pairing-code', phoneNumber: '5511999999999' },
      });
      expect(valid.statusCode).toBe(200);
      expect(valid.json<{ status: string }>().status).toBe('connecting');
      expect(adapter.connectCalls).toEqual([
        { method: 'pairing-code', phoneNumber: '5511999999999' },
      ]);
    } finally {
      await app.close();
    }
  });

  it('starts the QR connection flow', async () => {
    const { app, adapter } = await createTestApp();
    try {
      const response = await app.inject({
        method: 'POST',
        url: '/api/platforms/whatsapp/connect',
        payload: { method: 'qr' },
      });
      expect(response.statusCode).toBe(200);
      expect(response.json<{ status: string }>().status).toBe('connecting');
      expect(adapter.connectCalls).toEqual([{ method: 'qr' }]);
    } finally {
      await app.close();
    }
  });

  it('sends messages and records outbound activity', async () => {
    const { app, adapter, monitor } = await createTestApp();
    try {
      const response = await app.inject({
        method: 'POST',
        url: '/api/platforms/whatsapp/send',
        payload: {
          to: '5511999999999',
          content: 'hello @Clara',
          mentions: [
            { jid: '5511111111111@s.whatsapp.net', name: 'Clara', phoneNumber: '5511111111111' },
          ],
        },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json<{ id: string; success: boolean }>();
      expect(body).toEqual({ id: 'sent-1', success: true });
      expect(adapter.sent).toHaveLength(1);
      expect(adapter.sent[0]?.to).toBe('5511999999999@s.whatsapp.net');
      expect(adapter.sent[0]?.mentions).toEqual([
        { jid: '5511111111111@s.whatsapp.net', name: 'Clara', phoneNumber: '5511111111111' },
      ]);

      const messages = monitor.getMessages('whatsapp', 10);
      expect(messages).toHaveLength(1);
      expect(messages[0]?.direction).toBe('out');
      expect(monitor.getPlatform('whatsapp')?.stats.messagesSent).toBe(1);
    } finally {
      await app.close();
    }
  });

  it('rejects invalid recipients', async () => {
    const { app } = await createTestApp();
    try {
      const response = await app.inject({
        method: 'POST',
        url: '/api/platforms/whatsapp/send',
        payload: { to: 'not-a-jid', content: 'hello' },
      });
      expect(response.statusCode).toBe(400);
      expect(response.json<{ error: { code: string } }>().error.code).toBe('INVALID_TO');
    } finally {
      await app.close();
    }
  });

  it('serves logs and messages with filters', async () => {
    const { app, monitor, logStore } = await createTestApp();
    try {
      logStore.add({
        id: 'log-1',
        timestamp: new Date().toISOString(),
        level: 'info',
        logger: 'test',
        message: 'info line',
      });
      logStore.add({
        id: 'log-2',
        timestamp: new Date().toISOString(),
        level: 'error',
        logger: 'test',
        message: 'error line',
      });

      monitor.recordInbound('whatsapp', {
        chatId: 'chat-1',
        senderId: 'user-1',
        text: 'hello',
      });

      const logs = await app.inject({ method: 'GET', url: '/api/logs?level=warn&limit=5' });
      expect(logs.statusCode).toBe(200);
      const logEntries = logs.json<Array<{ id: string }>>();
      expect(logEntries.map((entry) => entry.id)).toEqual(['log-2']);

      const messages = await app.inject({
        method: 'GET',
        url: '/api/messages?platform=whatsapp&limit=5',
      });
      expect(messages.statusCode).toBe(200);
      expect(messages.json<Array<{ text: string }>>()).toHaveLength(1);
    } finally {
      await app.close();
    }
  });
});
