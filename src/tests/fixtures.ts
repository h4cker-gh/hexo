/** Test fixtures for building test objects. */

import type { UniversalContext, ContextUser, ContextChannel } from '@core/context/types.js';
import { DefaultContextBuilder } from '@core/context/builder.js';
import { AccessLevel } from '@core/access/types.js';
import type { CommandDefinition } from '@core/commands/types.js';

/** Create a minimal context user for testing. */
export function buildTestUser(overrides?: Partial<ContextUser>): ContextUser {
  return { id: 'test-user-001', name: 'Test User', metadata: {}, ...overrides };
}

/** Create a minimal context channel for testing. */
export function buildTestChannel(overrides?: Partial<ContextChannel>): ContextChannel {
  return { id: 'test-channel-001', name: 'Test Channel', type: 'dm', metadata: {}, ...overrides };
}

/** Create a universal context for testing. */
export function buildTestContext(
  overrides?: Partial<Omit<UniversalContext, 'user' | 'channel'>> & { user?: Partial<ContextUser>; channel?: Partial<ContextChannel> },
): UniversalContext {
  const builder = new DefaultContextBuilder();
  return builder.build(
    buildTestUser(overrides?.user),
    buildTestChannel(overrides?.channel),
    overrides?.input ?? '!test hello world',
    overrides?.parsedArgs ?? ['test', 'hello', 'world'],
    overrides?.platform ?? 'test',
    overrides?.raw,
  );
}

/** Create a command definition for testing. */
export function buildTestCommand(overrides?: Partial<CommandDefinition>): CommandDefinition {
  return {
    name: 'test-cmd',
    aliases: [],
    description: 'Test command',
    usage: '!test-cmd [arg...]',
    minArgs: 0,
    maxArgs: 10,
    accessLevel: AccessLevel.User,
    enabled: true,
    config: {},
    handler: async () => ({ type: 'text', content: 'ok' }),
    ...overrides,
  };
}

/** Create a logger that captures log entries for testing. */
export function buildTestLogger() {
  const entries: Array<{ level: string; message: string; context?: Record<string, unknown> }> = [];
  return {
    debug: (message: string, context?: Record<string, unknown>) => entries.push({ level: 'debug', message, context }),
    info: (message: string, context?: Record<string, unknown>) => entries.push({ level: 'info', message, context }),
    warn: (message: string, context?: Record<string, unknown>) => entries.push({ level: 'warn', message, context }),
    error: (message: string, context?: Record<string, unknown>) => entries.push({ level: 'error', message, context }),
    fatal: (message: string, context?: Record<string, unknown>) => entries.push({ level: 'fatal', message, context }),
    entries,
    getAtLevel: (level: string) => entries.filter(e => e.level === level),
    clear: () => { entries.length = 0; },
  };
}
