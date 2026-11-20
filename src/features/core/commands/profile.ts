/** Profile command — shows the user's bot profile information. */

import type { CommandDefinition, CommandResult } from '@core/commands/types.js';
import type { UniversalContext } from '@core/context/types.js';
import { AccessLevel } from '@core/access/types.js';
import { createMessageBuilder } from '@shared/message/builder.js';

/** Handler for the profile command. */
async function profileHandler(context: UniversalContext): Promise<CommandResult> {
  const parts: string[] = [
    `User ID: ${context.user.id}`,
    `User Name: ${context.user.name || 'Unknown'}`,
    `Platform: ${context.platform}`,
  ];

  if (context.channel.name) {
    parts.push(`Chat Name: ${context.channel.name}`);
  }
  if (context.channel.type) {
    parts.push(`Chat Type: ${context.channel.type}`);
  }

  const msg = createMessageBuilder()
    .withTheme('default')
    .title('👤 Hexo 💜')
    .section(parts.join('\n'))
    .build();

  return { type: 'text', content: msg.text };
}

/** Profile command definition. */
export const profileCommand: CommandDefinition = {
  name: 'profile',
  aliases: ['me', 'userinfo', 'whoami'],
  description: 'Show your bot profile information',
  usage: 'profile',
  minArgs: 0,
  maxArgs: 0,
  accessLevel: AccessLevel.User,
  enabled: true,
  handler: profileHandler,
};
