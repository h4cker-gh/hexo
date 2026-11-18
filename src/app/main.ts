/** Application entrypoint: config, container, bot lifecycle, HTTP API. */

import type { FastifyInstance } from 'fastify';
import { isConnectableAdapter } from '@core/adapter/types.js';
import type { MessageAdapter } from '@core/adapter/types.js';
import type { Logger } from '@core/logger/index.js';
import { bootstrapContainer, ServiceKeys } from './container.js';
import { loadConfig } from './config.js';
import { HexoBot } from './bot.js';
import { startApiServer } from './api/server.js';
import type { DashboardAdapter } from './api/types.js';
import type { Monitor } from './monitor/monitor.js';

/** Boot the bot and the dashboard API. */
async function main(): Promise<void> {
  const config = loadConfig();
  const container = bootstrapContainer(config);
  const bot = new HexoBot(config, container);

  await bot.init();
  await bot.start();

  const logger = container.resolve<Logger>(ServiceKeys.Logger);
  let server: FastifyInstance | undefined;

  if (config.server.enabled) {
    const monitor = container.resolve<Monitor>(ServiceKeys.Monitor);
    let adapter: DashboardAdapter | undefined;
    if (config.whatsapp.enabled) {
      const messageAdapter = container.resolve<MessageAdapter>(ServiceKeys.MessageAdapter);
      adapter = isConnectableAdapter(messageAdapter) ? messageAdapter : undefined;
    }

    server = await startApiServer({
      config,
      logger,
      monitor,
      adapter,
      version: process.env.npm_package_version ?? '0.1.0',
    });
    logger.info(`Dashboard API listening on http://${config.server.host}:${config.server.port}`);
  }

  let shuttingDown = false;
  const shutdown = async (signal: string): Promise<void> => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info(`Received ${signal}, shutting down`);

    if (server) {
      try {
        await server.close();
      } catch (error) {
        logger.error('Failed to close API server', {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    try {
      await bot.stop();
    } catch (error) {
      logger.error('Failed to stop bot', {
        error: error instanceof Error ? error.message : String(error),
      });
    }

    logger.info('Shutdown complete');
    process.exit(0);
  };

  process.on('SIGINT', () => {
    void shutdown('SIGINT');
  });
  process.on('SIGTERM', () => {
    void shutdown('SIGTERM');
  });
}

main().catch((error: unknown) => {
  console.error('Fatal startup error', error);
  process.exitCode = 1;
});
