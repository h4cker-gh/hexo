import { z } from 'zod';

// ─── Bot Config ────────────────────────────────────────────────────────────

export const BotConfigSchema = z.object({
  name: z.string().min(1).describe('Bot display name'),
  prefix: z.string().min(1).describe('Command prefix for the bot'),
  agent: z.string().min(1).describe('Agent identifier'),
  adminJids: z.array(z.string()).default([]).describe('Admin JID list'),
});

export type BotConfig = z.infer<typeof BotConfigSchema>;

// ─── Logger Config ─────────────────────────────────────────────────────────

export const LoggerConfigSchema = z.object({
  level: z.enum(['debug', 'info', 'warn', 'error', 'fatal']).default('info'),
  format: z.enum(['json', 'text']).default('text'),
});

export type LoggerConfig = z.infer<typeof LoggerConfigSchema>;

// ─── Feature Config ────────────────────────────────────────────────────────

export const FeatureConfigSchema = z.object({
  enabled: z.boolean().default(true),
  config: z.record(z.unknown()).default({}),
});

export type FeatureConfig = z.infer<typeof FeatureConfigSchema>;

// ─── WhatsApp Config ───────────────────────────────────────────────────────

export const WhatsAppConfigSchema = z.object({
  enabled: z.boolean().default(true),
  phoneJid: z.string().default(''),
  phoneNumber: z.string().default(''),
  pairingPhone: z.string().default('').describe('Phone number (E.164) for auto-pairing code instead of QR'),
  sessionDir: z.string().default('./session'),
  saveCreds: z.boolean().default(true),
  autoReconnect: z.boolean().default(true),
  maxReconnectAttempts: z.number().default(5),
  reconnectDelayMs: z.number().default(5000),
  printQRInTerminal: z.boolean().default(false),
  autoAcceptFriendRequests: z.boolean().default(false),
  autoAcceptGroupInvites: z.boolean().default(false),
});

export type WhatsAppConfig = z.infer<typeof WhatsAppConfigSchema>;

// ─── Server Config ─────────────────────────────────────────────────────────

export const ServerConfigSchema = z.object({
  enabled: z.boolean().default(true),
  host: z.string().default('127.0.0.1'),
  port: z.number().int().min(1).max(65535).default(3000),
  corsOrigins: z
    .array(z.string())
    .default(['http://localhost:5173', 'http://127.0.0.1:5173']),
});

export type ServerConfig = z.infer<typeof ServerConfigSchema>;

// ─── Full Config ───────────────────────────────────────────────────────────

export const ConfigSchema = z.object({
  bot: BotConfigSchema,
  logger: LoggerConfigSchema,
  whatsapp: WhatsAppConfigSchema.default({}),
  server: ServerConfigSchema.default({}),
  features: z.record(FeatureConfigSchema).default({}),
});

export type Config = z.infer<typeof ConfigSchema>;
