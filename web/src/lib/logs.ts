import type { LogLevelName } from '@/api/types';

export const LOG_LEVELS: readonly LogLevelName[] = ['debug', 'info', 'warn', 'error', 'fatal'];

export const LOG_LEVEL_RANK: Record<LogLevelName, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
  fatal: 50,
};

export const LOG_LEVEL_LABELS: Record<LogLevelName, string> = {
  debug: 'Debug',
  info: 'Info',
  warn: 'Warn',
  error: 'Error',
  fatal: 'Fatal',
};

export function isLogLevel(value: string): value is LogLevelName {
  return (LOG_LEVELS as readonly string[]).includes(value);
}
