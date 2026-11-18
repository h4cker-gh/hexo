/** Environment reader — typed, validated access to process.env. */

// ─── Schema Definition ──────────────────────────────────────────────────────

/** Required environment variable names. */
export const REQUIRED_ENV_KEYS = [
  'WHATSAPP_PHONE_NUMBER',
  'HEXOBOT_SESSION_DIR',
  'BOT_NAME',
  'BOT_PREFIX',
] as const;

/** Optional environment variable names with defaults. */
export const OPTIONAL_ENV_KEYS = [
  'HEXOBOT_ADMIN_JIDS',
  'HEXOBOT_LOG_LEVEL',
  'SESSION_SAVE_INTERVAL_MS',
  'MAX_RECONNECT_ATTEMPTS',
  'RECONNECT_DELAY_MS',
] as const;

/** All known environment variable names. */
export const ALL_ENV_KEYS = [...REQUIRED_ENV_KEYS, ...OPTIONAL_ENV_KEYS] as const;

/** Type of parsed environment variables. */
export interface EnvSchema {
  // Required
  WHATSAPP_PHONE_NUMBER: string;
  HEXOBOT_SESSION_DIR: string;
  BOT_NAME: string;
  BOT_PREFIX: string;
  // Optional
  HEXOBOT_ADMIN_JIDS: string;
  HEXOBOT_LOG_LEVEL: string;
  SESSION_SAVE_INTERVAL_MS: string;
  MAX_RECONNECT_ATTEMPTS: string;
  RECONNECT_DELAY_MS: string;
}

// ─── Validation Result ──────────────────────────────────────────────────────

/** Result of environment validation. */
export interface EnvValidationResult {
  success: boolean;
  missing: string[];
  unknown: string[];
}

// ─── EnvReader ─────────────────────────────────────────────────────────────

/**
 * Typed, validated environment variable reader.
 *
 * Validates that required vars are present and unknown vars are flagged.
 * Provides typed accessors with defaults for optional variables.
 */
export class EnvReader {
  private readonly _env: EnvSchema;
  private readonly missing: string[];
  private readonly unknown: string[];

  constructor() {
    const allKnown = new Set(ALL_ENV_KEYS);
    const unknown: string[] = [];

    // Collect unknown vars
    for (const key of Object.keys(process.env)) {
      if (!allKnown.has(key as keyof EnvSchema)) {
        unknown.push(key);
      }
    }

    // Validate required vars
    const missing: string[] = [];
    for (const key of REQUIRED_ENV_KEYS) {
      const value = process.env[key];
      if (!value || value.trim() === '') {
        missing.push(key);
      }
    }

    // Build typed env object
    this._env = {} as EnvSchema;
    for (const key of REQUIRED_ENV_KEYS) {
      this._env[key] = process.env[key]!;
    }
    for (const key of OPTIONAL_ENV_KEYS) {
      this._env[key] = process.env[key] ?? '';
    }

    this.missing = missing;
    this.unknown = unknown;
  }

  /** Check if all required environment variables are present. */
  isValid(): boolean {
    return this.missing.length === 0;
  }

  /** Get missing required variables. */
  getMissing(): string[] {
    return [...this.missing];
  }

  /** Get unknown variables not in the schema. */
  getUnknown(): string[] {
    return [...this.unknown];
  }

  /** Validate and throw if required vars are missing. */
  assertValid(): void {
    if (!this.isValid()) {
      throw new Error(
        `Missing required environment variables: ${this.missing.join(', ')}\n` +
        `Known optional variables (not set): ${OPTIONAL_ENV_KEYS.filter(k => !process.env[k] || process.env[k]!.trim() === '').join(', ')}\n` +
        `Unknown variables in environment: ${this.unknown.length > 0 ? this.unknown.join(', ') : 'none'}`,
      );
    }
  }

  // ─── Required Accessors ────────────────────────────────────────────────

  /** WhatsApp phone number (E.164 format, e.g. "1234567890"). */
  getWhatsAppPhoneNumber(): string {
    return this._env.WHATSAPP_PHONE_NUMBER.trim();
  }

  /** Directory for saving WhatsApp session data. */
  getSessionDir(): string {
    return this._env.HEXOBOT_SESSION_DIR.trim();
  }

  /** Bot display name. */
  getBotName(): string {
    return this._env.BOT_NAME.trim();
  }

  /** Command prefix for the bot. */
  getBotPrefix(): string {
    return this._env.BOT_PREFIX.trim();
  }

  // ─── Optional Accessors (with defaults) ────────────────────────────────

  /** Comma-separated admin JIDs. Defaults to empty string. */
  getAdminJids(): string {
    return this._env.HEXOBOT_ADMIN_JIDS.trim();
  }

  /** Admin JIDs parsed as an array. Defaults to []. */
  getAdminJidArray(): string[] {
    const raw = this.getAdminJids();
    return raw ? raw.split(',').map(j => j.trim()).filter(Boolean) : [];
  }

  /** Log level. Defaults to "info". */
  getLogLevel(): string {
    const level = this._env.HEXOBOT_LOG_LEVEL.trim().toLowerCase();
    if (['debug', 'info', 'warn', 'error', 'fatal'].includes(level)) return level;
    return 'info';
  }

  /** Session save interval in ms. Defaults to 60000 (1 minute). */
  getSessionSaveIntervalMs(): number {
    const raw = parseInt(this._env.SESSION_SAVE_INTERVAL_MS, 10);
    return isNaN(raw) || raw <= 0 ? 60_000 : raw;
  }

  /** Max reconnect attempts. Defaults to 5. */
  getMaxReconnectAttempts(): number {
    const raw = parseInt(this._env.MAX_RECONNECT_ATTEMPTS, 10);
    return isNaN(raw) || raw <= 0 ? 5 : raw;
  }

  /** Reconnect delay in ms. Defaults to 5000 (5 seconds). */
  getReconnectDelayMs(): number {
    const raw = parseInt(this._env.RECONNECT_DELAY_MS, 10);
    return isNaN(raw) || raw <= 0 ? 5_000 : raw;
  }
}
