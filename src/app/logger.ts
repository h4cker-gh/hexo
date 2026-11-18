import { randomUUID } from 'node:crypto';
import type { Logger, LoggerFactory, LogLevel } from '@core/logger/index.js';
import { LogLevel as Lvl } from '@core/logger/index.js';
import type { LogEntryDto, LogLevelName } from '@app/monitor/types.js';

/** Receives structured entries so the dashboard can stream logs. */
export type LogSink = (entry: LogEntryDto) => void;

/** Options accepted by ConsoleLoggerFactory. */
export interface ConsoleLoggerOptions {
  level?: LogLevel;
  sink?: LogSink;
}

/** Console logger implementation. */
export class ConsoleLogger implements Logger {
  private readonly level: LogLevel;
  private readonly name: string;
  private readonly sink: LogSink | undefined;

  constructor(name: string, level: LogLevel = Lvl.Info, sink?: LogSink) {
    this.name = name;
    this.level = level;
    this.sink = sink;
  }

  private shouldLog(level: LogLevel): boolean {
    const levels = [Lvl.Debug, Lvl.Info, Lvl.Warn, Lvl.Error, Lvl.Fatal];
    return levels.indexOf(level) >= levels.indexOf(this.level);
  }

  private format(level: LogLevel, message: string, context?: Record<string, unknown>): string {
    const ts = new Date().toISOString();
    const ctx = context ? ` ${JSON.stringify(context)}` : '';
    return `[${ts}] ${level} [${this.name}] ${message}${ctx}`;
  }

  private emit(level: LogLevel, message: string, context?: Record<string, unknown>): void {
    if (!this.sink) return;
    this.sink({
      id: randomUUID(),
      timestamp: new Date().toISOString(),
      level: level as LogLevelName,
      logger: this.name,
      message,
      ...(context ? { context } : {}),
    });
  }

  debug(message: string, context?: Record<string, unknown>): void {
    if (!this.shouldLog(Lvl.Debug)) return;
    console.debug(this.format(Lvl.Debug, message, context));
    this.emit(Lvl.Debug, message, context);
  }

  info(message: string, context?: Record<string, unknown>): void {
    if (!this.shouldLog(Lvl.Info)) return;
    console.info(this.format(Lvl.Info, message, context));
    this.emit(Lvl.Info, message, context);
  }

  warn(message: string, context?: Record<string, unknown>): void {
    if (!this.shouldLog(Lvl.Warn)) return;
    console.warn(this.format(Lvl.Warn, message, context));
    this.emit(Lvl.Warn, message, context);
  }

  error(message: string, context?: Record<string, unknown>): void {
    if (!this.shouldLog(Lvl.Error)) return;
    console.error(this.format(Lvl.Error, message, context));
    this.emit(Lvl.Error, message, context);
  }

  fatal(message: string, context?: Record<string, unknown>): void {
    if (!this.shouldLog(Lvl.Fatal)) return;
    console.error(this.format(Lvl.Fatal, message, context));
    this.emit(Lvl.Fatal, message, context);
  }
}

/** Factory that creates console loggers and forwards structured entries. */
export class ConsoleLoggerFactory implements LoggerFactory {
  constructor(private readonly options: ConsoleLoggerOptions = {}) {}

  create(name: string): Logger {
    return new ConsoleLogger(name, this.options.level ?? Lvl.Info, this.options.sink);
  }
}
