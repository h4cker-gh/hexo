import type { Logger } from '@core/logger/index.js';
import type { DIContainer } from '@core/di/index.js';
import { LifecycleManager } from '@core/lifecycle/manager.js';
import { LifecycleStage } from '@core/lifecycle/types.js';
import { ServiceKeys } from './container.js';
import type { Config } from '@core/config/index.js';

/** Lifecycle status of the bot. */
export enum BotStatus {
  Stopped = 'stopped',
  Initializing = 'initializing',
  Initialized = 'initialized',
  Starting = 'starting',
  Running = 'running',
  Stopping = 'stopping',
}

/** Main bot class that manages lifecycle and service access. */
export class HexoBot {
  private status: BotStatus = BotStatus.Stopped;
  private readonly container: DIContainer;
  private readonly config: Config;

  constructor(config: Config, container: DIContainer) {
    this.config = config;
    this.container = container;
  }

  /** Get the DI container. */
  get containerRef(): DIContainer {
    return this.container;
  }

  /** Get the logger instance. */
  get logger(): Logger {
    return this.container.resolve(ServiceKeys.Logger);
  }

  /** Get the message adapter (if registered). */
  get messageAdapter() {
    try {
      return this.container.resolve(ServiceKeys.MessageAdapter);
    } catch {
      return undefined;
    }
  }

  /** Get the current status. */
  get statusRef(): BotStatus {
    return this.status;
  }

  /** Get bot config. */
  get configRef(): Config {
    return this.config;
  }

  /** Initialize the bot: load config, setup services, run Initializing hooks. */
  async init(): Promise<void> {
    this.status = BotStatus.Initializing;
    const logger = this.logger;
    logger.info(`Initializing bot "${this.config.bot.name}"`);
    await (this.container.resolve(ServiceKeys.LifecycleManager) as LifecycleManager).execute(LifecycleStage.Initializing);
    this.status = BotStatus.Initialized;
    logger.info(`Bot "${this.config.bot.name}" initialized`);
  }

  /** Start the bot: run Starting hooks, then mark as started. */
  async start(): Promise<void> {
    if (this.status !== BotStatus.Initialized) {
      throw new Error('Bot must be initialized before starting');
    }
    this.status = BotStatus.Starting;
    const logger = this.logger;
    logger.info(`Starting bot "${this.config.bot.name}"`);
    await (this.container.resolve(ServiceKeys.LifecycleManager) as LifecycleManager).execute(LifecycleStage.Starting);
    this.status = BotStatus.Running;
    logger.info(`Bot "${this.config.bot.name}" started`);
  }

  /** Stop the bot: run Stopping hooks, cleanup, then mark as stopped. */
  async stop(): Promise<void> {
    if (this.status === BotStatus.Stopped) return;
    this.status = BotStatus.Stopping;
    const logger = this.logger;
    logger.info(`Stopping bot "${this.config.bot.name}"`);
    await (this.container.resolve(ServiceKeys.LifecycleManager) as LifecycleManager).execute(LifecycleStage.Stopping);
    this.status = BotStatus.Stopped;
    logger.info(`Bot "${this.config.bot.name}" stopped`);
  }

  /** Run the full lifecycle: init → start → await stop signal → stop. */
  async run(): Promise<void> {
    await this.init();
    await this.start();
    // In the future, this would listen for platform connection events
    // For now, just keep running until explicitly stopped
  }
}
