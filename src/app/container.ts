import { DIContainer } from '@core/di/index.js';
import { CommandRegistry } from '@core/commands/index.js';
import { FeatureRegistryImpl } from '@core/features/index.js';
import { LifecycleManager, LifecycleStage } from '@core/lifecycle/index.js';
import { DefaultContextBuilder } from '@core/context/index.js';
import { LogLevel as Lvl } from '@core/logger/index.js';
import { ConsoleLoggerFactory } from './logger.js';
import type { Config, LoggerConfig } from '@core/config/index.js';
import type { Logger, LoggerFactory, LogLevel } from '@core/logger/index.js';
import { WhatsAppAdapter } from '@infra/whatsapp/adapter.js';
import { isConnectableAdapter } from '@core/adapter/types.js';
import type { MessageAdapter } from '@core/adapter/types.js';
import { LogStore } from './monitor/log-store.js';
import { Monitor } from './monitor/monitor.js';
import { MemoryServiceImpl } from '@features/core/memory/index.js';
import type { MemoryService } from '@features/core/memory/types.js';
import { pingCommand } from '@features/core/commands/ping.js';
import { helpCommand } from '@features/core/commands/help.js';
import { profileCommand } from '@features/core/commands/profile.js';
import { tagallCommand } from '@features/core/commands/tagall.js';
import { chatinfoCommand } from '@features/core/commands/chatinfo.js';

/** Service keys for dependency injection. */
export const ServiceKeys = {
  Container: 'container' as const,
  Logger: 'logger' as const,
  LoggerFactory: 'loggerFactory' as const,
  CommandRegistry: 'commandRegistry' as const,
  FeatureRegistry: 'featureRegistry' as const,
  LifecycleManager: 'lifecycleManager' as const,
  ContextBuilder: 'contextBuilder' as const,
  MessageAdapter: 'messageAdapter' as const,
  LogStore: 'logStore' as const,
  Monitor: 'monitor' as const,
  Memory: 'memory' as const,
} as const;

/** Map a validated config level to the runtime enum. */
function toLogLevel(level: LoggerConfig['level']): LogLevel {
  switch (level) {
    case 'debug':
      return Lvl.Debug;
    case 'warn':
      return Lvl.Warn;
    case 'error':
      return Lvl.Error;
    case 'fatal':
      return Lvl.Fatal;
    default:
      return Lvl.Info;
  }
}

/** Wire up all core services in the DI container. */
export function bootstrapContainer(config: Config): DIContainer {
  const container = new DIContainer();

  // Log store first so the logger can feed the dashboard.
  container.register(ServiceKeys.LogStore, () => new LogStore(), { singleton: true });

  container.register(
    ServiceKeys.LoggerFactory,
    (c) => {
      const logStore = c.resolve<LogStore>(ServiceKeys.LogStore);
      return new ConsoleLoggerFactory({
        level: toLogLevel(config.logger.level),
        sink: (entry) => logStore.add(entry),
      });
    },
    { singleton: true },
  );

  container.register(
    ServiceKeys.Logger,
    (c) => c.resolve<LoggerFactory>(ServiceKeys.LoggerFactory).create('hexobot'),
    { singleton: true },
  );

  container.register(
    ServiceKeys.Monitor,
    (c) => {
      const monitor = new Monitor(c.resolve<LogStore>(ServiceKeys.LogStore));
      monitor.registerPlatform({
        id: 'whatsapp',
        name: 'WhatsApp',
        enabled: config.whatsapp.enabled,
      });
      return monitor;
    },
    { singleton: true },
  );

  // Core services
  container.register(ServiceKeys.CommandRegistry, () => new CommandRegistry(), { singleton: true });
  container.register(ServiceKeys.FeatureRegistry, () => new FeatureRegistryImpl(), { singleton: true });
  container.register(ServiceKeys.LifecycleManager, () => new LifecycleManager(), { singleton: true });
  container.register(ServiceKeys.ContextBuilder, () => new DefaultContextBuilder(), { singleton: true });
  container.register(ServiceKeys.Memory, () => new MemoryServiceImpl(), { singleton: true });

  // WhatsApp adapter
  container.register(
    ServiceKeys.MessageAdapter,
    (c) => {
      const logger = c.resolve<Logger>(ServiceKeys.Logger);
      const monitor = c.resolve<Monitor>(ServiceKeys.Monitor);
      const commandRegistry = c.resolve<CommandRegistry>(ServiceKeys.CommandRegistry);
      const contextBuilder = c.resolve<DefaultContextBuilder>(ServiceKeys.ContextBuilder);
      const adapterConfig = config.whatsapp;

      const memory = c.resolve<MemoryService>(ServiceKeys.Memory);

      const adapter = new WhatsAppAdapter(
        {
          sessionDir: adapterConfig.sessionDir,
          saveCreds: adapterConfig.saveCreds,
          autoReconnect: adapterConfig.autoReconnect,
          maxReconnectAttempts: adapterConfig.maxReconnectAttempts,
          reconnectDelayMs: adapterConfig.reconnectDelayMs,
          printQRInTerminal: adapterConfig.printQRInTerminal,
          pairingPhone: adapterConfig.pairingPhone,
          logger,
        },
        contextBuilder,
        async () => {}, // placeholder — replaced via setOnContext
      );

      adapter.setOnContext(async (context) => {
        monitor.recordInbound('whatsapp', {
          chatId: context.channel.id,
          senderId: context.user.id,
          senderName: context.user.name,
          text: context.input,
          success: true,
        });

        // Populate context.variables for command accessors.
        context.variables.set('registry', {
          getCommands: () => commandRegistry.list(),
          getMetadata: (name: string) => commandRegistry.getMetadata(name),
        });
        context.variables.set('memory', memory);

        const command = context.parsedArgs[0]?.toLowerCase();
        if (!command || !commandRegistry.has(command)) return;

        try {
          const result = await commandRegistry.execute(command, context, logger);
          monitor.recordCommand('whatsapp');

          if (result.type === 'text' && result.content) {
            await adapter.sendText({ to: context.channel.id, content: result.content });
          } else if (result.type === 'error') {
            await adapter.sendText({
              to: context.channel.id,
              content: `❌ ${result.message}`,
            });
          }
        } catch (error) {
          monitor.recordError('whatsapp');
          logger.error('Command dispatch failed', {
            error: error instanceof Error ? error.message : String(error),
          });
        }
      });

      if (isConnectableAdapter(adapter)) {
        adapter.onConnectionChange((snapshot) => monitor.updateConnection('whatsapp', snapshot));
      }

      return adapter;
    },
    { singleton: true },
  );

  // Self-register container (for resolution)
  container.register(ServiceKeys.Container, () => container, { singleton: true });

  // Adapter lifecycle hooks
  const lifecycleManager = container.resolve<LifecycleManager>(ServiceKeys.LifecycleManager);
  lifecycleManager.register({
    stage: LifecycleStage.Initializing,
    priority: 100,
    execute: async () => {
      const commandRegistry = container.resolve<CommandRegistry>(ServiceKeys.CommandRegistry);
      commandRegistry.register(pingCommand);
      commandRegistry.register(helpCommand);
      commandRegistry.register(profileCommand);
      commandRegistry.register(tagallCommand);
      commandRegistry.register(chatinfoCommand);

      if (!config.whatsapp.enabled) return;
      const adapter = container.resolve<MessageAdapter>(ServiceKeys.MessageAdapter);
      await adapter.init();
    },
  });
  lifecycleManager.register({
    stage: LifecycleStage.Stopping,
    priority: 100,
    execute: async () => {
      const adapter = container.resolve<MessageAdapter>(ServiceKeys.MessageAdapter);
      await adapter.shutdown();
    },
  });

  return container;
}
