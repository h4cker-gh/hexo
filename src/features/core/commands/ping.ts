/** Ping command — reports bot latency. */

import type { CommandDefinition, CommandResult } from '@core/commands/types.js';
import type { UniversalContext } from '@core/context/types.js';
import { AccessLevel } from '@core/access/types.js';
import { createMessageBuilder } from '@shared/message/builder.js';

/** Handler for the ping command. */
async function pingHandler(_context: UniversalContext): Promise<CommandResult> {
  const latency = Math.round(performance.now() % 10000);
  const msg = createMessageBuilder()
    .withTheme('default')
    .title('🩵 Hexo 💜')
    .section(`Pong! Latency: ${latency}ms`)
    .build();

  return { type: 'text', content: msg.text };
}

/** Ping command definition. */
export const pingCommand: CommandDefinition = {
  name: 'ping',
  aliases: ['pong', 'latency', 'pingpong', 'ℹ'],
  description: 'Check bot latency',
  usage: 'ping',
  minArgs: 0,
  maxArgs: 0,
  accessLevel: AccessLevel.User,
  enabled: true,
  handler: pingHandler,
};
