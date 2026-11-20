/** Chatinfo command — shows group chat information. */

import type { CommandDefinition, CommandResult } from '@core/commands/types.js';
import type { UniversalContext } from '@core/context/types.js';
import { AccessLevel } from '@core/access/types.js';
import { createMessageBuilder } from '@shared/message/builder.js';

/** Parse flags from arguments, supporting stacked single-char flags like -dni. */
function parseChatinfoFlags(args: string[]): Set<string> {
  const flags = new Set<string>();
  for (const arg of args) {
    if (arg.startsWith('-')) {
      // Handle stacked flags like -dni
      for (const char of arg.slice(1)) {
        flags.add(char.toLowerCase());
      }
    }
  }
  return flags;
}

/** Handler for the chatinfo command. */
async function chatinfoHandler(context: UniversalContext, args: string[]): Promise<CommandResult> {
  const flags = parseChatinfoFlags(args);

  const chatId = context.channel.id;
  const chatType = context.channel.type || 'Unknown';
  const chatName = context.channel.name || 'Unknown';
  const chatDesc = (context.channel.metadata?.description as string | undefined) ?? 'N/A';

  // Build section based on requested flags
  const sections: string[] = [];

  // Show all by default, or only requested fields
  const showAll = flags.size === 0;
  if (showAll || flags.has('d')) sections.push(`Chat ID: ${chatId}`);
  if (showAll || flags.has('n')) sections.push(`Chat Name: ${chatName}`);
  if (showAll || flags.has('i')) sections.push(`Chat Type: ${chatType}`);
  if (showAll || flags.has('c')) sections.push(`Chat Description: ${chatDesc}`);

  // Always show chat info summary
  sections.push('');
  sections.push(`Group: ${chatName}`);
  sections.push(`Type: ${chatType}`);
  sections.push(`ID: ${chatId}`);

  const msg = createMessageBuilder()
    .withTheme('default')
    .title('💬 Hexo 💜')
    .section(sections.join('\n'))
    .build();

  return { type: 'text', content: msg.text };
}

/** Chatinfo command definition. */
export const chatinfoCommand: CommandDefinition = {
  name: 'chatinfo',
  aliases: ['groupinfo', 'ginfo', 'chatinformation'],
  description: 'Show current chat information',
  usage: 'chatinfo [-dni]',
  minArgs: 0,
  maxArgs: 1,
  accessLevel: AccessLevel.User,
  enabled: true,
  handler: chatinfoHandler,
};
