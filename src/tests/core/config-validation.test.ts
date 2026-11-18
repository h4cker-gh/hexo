import { describe, it, expect } from 'vitest';
import { ConfigSchema, BotConfigSchema } from '@core/config/schema.js';

describe('ConfigSchema', () => {
  it('should validate a complete config', () => {
    const result = ConfigSchema.safeParse({
      bot: { name: 'TestBot', prefix: '!', agent: 'test-agent', adminJids: ['123@s.whatsapp.net'] },
      logger: { level: 'info', format: 'text' },
      whatsapp: {
        enabled: true,
        phoneNumber: '1234567890',
        sessionDir: './session',
        saveCreds: true,
        autoReconnect: true,
        maxReconnectAttempts: 5,
        reconnectDelayMs: 5000,
      },
      features: {},
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.bot.name).toBe('TestBot');
      expect(result.data.bot.prefix).toBe('!');
      expect(result.data.whatsapp.phoneNumber).toBe('1234567890');
      expect(result.data.whatsapp.sessionDir).toBe('./session');
    }
  });

  it('should use defaults when optional fields omitted', () => {
    const result = ConfigSchema.safeParse({
      bot: { name: 'Bot', prefix: '!', agent: 'agent' },
      logger: { level: 'debug' },
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.bot.adminJids).toEqual([]);
      expect(result.data.logger.format).toBe('text');
      expect(result.data.features).toEqual({});
      // WhatsApp defaults
      expect(result.data.whatsapp.enabled).toBe(true);
      expect(result.data.whatsapp.sessionDir).toBe('./session');
      expect(result.data.whatsapp.saveCreds).toBe(true);
      expect(result.data.whatsapp.autoReconnect).toBe(true);
      expect(result.data.whatsapp.maxReconnectAttempts).toBe(5);
      expect(result.data.whatsapp.reconnectDelayMs).toBe(5000);
    }
  });

  it('should reject invalid bot name', () => {
    const result = ConfigSchema.safeParse({
      bot: { name: '', prefix: '!', agent: 'agent' },
    });
    expect(result.success).toBe(false);
  });

  it('should reject invalid logger level', () => {
    const result = ConfigSchema.safeParse({
      bot: { name: 'Bot', prefix: '!', agent: 'agent' },
      logger: { level: 'trace' },
    });
    expect(result.success).toBe(false);
  });

  it('should validate feature config with dependencies', () => {
    const result = ConfigSchema.safeParse({
      bot: { name: 'Bot', prefix: '!', agent: 'agent' },
      logger: { level: 'info' },
      features: {
        ping: { enabled: true, config: { timeout: 5000 } },
        help: { enabled: false },
      },
    });
    expect(result.success).toBe(true);
  });

  it('should validate WhatsApp config with all options', () => {
    const result = ConfigSchema.safeParse({
      bot: { name: 'Bot', prefix: '!', agent: 'agent' },
      logger: { level: 'info' },
      whatsapp: {
        enabled: false,
        phoneJid: '1234567890@s.whatsapp.net',
        phoneNumber: '1234567890',
        sessionDir: './custom-session',
        saveCreds: false,
        autoReconnect: false,
        maxReconnectAttempts: 10,
        reconnectDelayMs: 10000,
        autoAcceptFriendRequests: true,
        autoAcceptGroupInvites: true,
      },
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.whatsapp.enabled).toBe(false);
      expect(result.data.whatsapp.autoAcceptFriendRequests).toBe(true);
    }
  });
});

describe('BotConfigSchema', () => {
  it('should require all fields', () => {
    const result = BotConfigSchema.safeParse({ name: 'Bot' });
    expect(result.success).toBe(false);
  });

  it('should allow prefix with special characters', () => {
    const result = BotConfigSchema.safeParse({ name: 'Bot', prefix: '/', agent: 'a' });
    expect(result.success).toBe(true);
  });
});
