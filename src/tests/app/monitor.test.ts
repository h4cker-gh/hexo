import { describe, it, expect } from 'vitest';
import { LogStore } from '@app/monitor/log-store.js';
import { Monitor } from '@app/monitor/monitor.js';
import type { LogEntryDto, LogLevelName } from '@app/monitor/types.js';

function buildEntry(index: number, level: LogLevelName = 'info'): LogEntryDto {
  return {
    id: `entry-${index}`,
    timestamp: new Date(1_700_000_000_000 + index).toISOString(),
    level,
    logger: 'test',
    message: `message ${index}`,
  };
}

describe('LogStore', () => {
  it('retains only the newest 500 entries', () => {
    const store = new LogStore();
    for (let index = 0; index < 600; index += 1) {
      store.add(buildEntry(index));
    }

    expect(store.size()).toBe(500);
    const entries = store.query({ limit: 500 });
    expect(entries).toHaveLength(500);
    expect(entries[0]?.id).toBe('entry-599');
    expect(entries[499]?.id).toBe('entry-100');
  });

  it('filters by level and above, newest first', () => {
    const store = new LogStore();
    store.add(buildEntry(1, 'debug'));
    store.add(buildEntry(2, 'info'));
    store.add(buildEntry(3, 'warn'));
    store.add(buildEntry(4, 'error'));
    store.add(buildEntry(5, 'fatal'));

    const entries = store.query({ level: 'warn' });
    expect(entries.map((entry) => entry.level)).toEqual(['fatal', 'error', 'warn']);
  });

  it('notifies subscribers and unsubscribes', () => {
    const store = new LogStore();
    const seen: string[] = [];
    const unsubscribe = store.onEntry((entry) => seen.push(entry.id));

    store.add(buildEntry(1));
    unsubscribe();
    store.add(buildEntry(2));

    expect(seen).toEqual(['entry-1']);
  });
});

describe('Monitor', () => {
  function createMonitor(): Monitor {
    const monitor = new Monitor(new LogStore());
    monitor.registerPlatform({ id: 'whatsapp', name: 'WhatsApp', enabled: true });
    return monitor;
  }

  it('tracks connection state and counters', () => {
    const monitor = createMonitor();
    monitor.updateConnection('whatsapp', {
      status: 'connected',
      botJid: '5599999999999@s.whatsapp.net',
      updatedAt: new Date().toISOString(),
    });

    monitor.recordInbound('whatsapp', {
      chatId: '120363000000000000@g.us',
      senderId: '5511111111111@s.whatsapp.net',
      senderName: 'Clara',
      text: 'hello',
    });
    monitor.recordOutbound('whatsapp', {
      id: 'out-1',
      chatId: '120363000000000000@g.us',
      senderId: '5599999999999@s.whatsapp.net',
      text: 'hi',
      success: true,
    });
    monitor.recordOutbound('whatsapp', {
      id: 'out-2',
      chatId: '120363000000000000@g.us',
      senderId: '5599999999999@s.whatsapp.net',
      text: 'failed',
      success: false,
    });
    monitor.recordCommand('whatsapp');
    monitor.recordError('whatsapp');

    const summary = monitor.getPlatform('whatsapp');
    if (!summary) throw new Error('Expected WhatsApp summary');

    expect(summary.status).toBe('connected');
    expect(summary.botJid).toBe('5599999999999@s.whatsapp.net');
    expect(summary.stats.connected).toBe(true);
    expect(summary.stats.startedAt).not.toBeNull();
    expect(summary.stats.messagesReceived).toBe(1);
    expect(summary.stats.messagesSent).toBe(1);
    expect(summary.stats.commandsExecuted).toBe(1);
    expect(summary.stats.errors).toBe(1);
    expect(summary.stats.lastActivityAt).not.toBeNull();
    expect(monitor.getPlatformSummaries()).toHaveLength(1);
  });

  it('returns newest-first message history', () => {
    const monitor = createMonitor();
    monitor.recordInbound('whatsapp', {
      chatId: 'chat-1',
      senderId: 'user-1',
      text: 'first',
    });
    monitor.recordOutbound('whatsapp', {
      id: 'second',
      chatId: 'chat-1',
      senderId: 'bot',
      text: 'second',
    });

    const messages = monitor.getMessages('whatsapp', 10);
    expect(messages.map((record) => record.text)).toEqual(['second', 'first']);
  });

  it('broadcasts messages and stats to subscribers', () => {
    const monitor = createMonitor();
    let messageCount = 0;
    let statsCount = 0;

    const unsubscribeMessage = monitor.onMessage(() => {
      messageCount += 1;
    });
    const unsubscribeStats = monitor.onStats(() => {
      statsCount += 1;
    });

    monitor.recordInbound('whatsapp', {
      chatId: 'chat-1',
      senderId: 'user-1',
      text: 'hello',
    });

    unsubscribeMessage();
    unsubscribeStats();
    monitor.recordInbound('whatsapp', {
      chatId: 'chat-1',
      senderId: 'user-1',
      text: 'again',
    });

    expect(messageCount).toBe(1);
    expect(statsCount).toBe(1);
  });
});
