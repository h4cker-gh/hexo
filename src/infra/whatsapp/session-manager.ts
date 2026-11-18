/** Session manager — thin wrapper around Baileys' multi-file auth state. */

import {
  type AuthenticationState,
  fetchLatestBaileysVersion,
  useMultiFileAuthState,
} from '@whiskeysockets/baileys';
import type { Logger } from '@core/logger/types.js';
import { rm } from 'node:fs/promises';

/** Configuration for session management. */
export interface SessionConfig {
  /** Directory to save session credentials and signal keys. */
  sessionDir: string;
  /** Whether credentials should be persisted on updates. Defaults to true. */
  saveCreds?: boolean;
  /** Logger instance. */
  logger: Logger;
}

/**
 * Persists Baileys credentials and signal keys through the official
 * `useMultiFileAuthState` implementation.
 */
export class SessionManager {
  private state: AuthenticationState | null = null;
  private saveCredsFn: (() => Promise<void>) | null = null;

  constructor(private readonly config: SessionConfig) {}

  /** Load (or create) the auth state from disk. Idempotent. */
  async init(): Promise<void> {
    if (this.state) return;
    const { state, saveCreds } = await useMultiFileAuthState(this.config.sessionDir);
    this.state = state;
    this.saveCredsFn = saveCreds;
    this.config.logger.debug('WhatsApp session state loaded', {
      sessionDir: this.config.sessionDir,
      registered: state.creds.registered,
    });
  }

  /** Get the loaded auth state. Throws when called before init(). */
  getState(): AuthenticationState {
    if (!this.state) {
      throw new Error('SessionManager.init() must be called before getState()');
    }
    return this.state;
  }

  /** Persist credentials (and keys, handled by Baileys' key store). */
  async saveCreds(): Promise<void> {
    if (this.config.saveCreds === false) return;
    if (!this.saveCredsFn) return;
    await this.saveCredsFn();
  }

  /** Whether the stored credentials belong to a registered account. */
  isRegistered(): boolean {
    return this.state?.creds.registered === true;
  }

  /** Delete the session directory and reset in-memory state. */
  async clear(): Promise<void> {
    await rm(this.config.sessionDir, { recursive: true, force: true });
    this.state = null;
    this.saveCredsFn = null;
    this.config.logger.info('WhatsApp session cleared', { sessionDir: this.config.sessionDir });
  }

  /** Get the Baileys version to use. */
  static getBaileysVersion() {
    return fetchLatestBaileysVersion();
  }
}
