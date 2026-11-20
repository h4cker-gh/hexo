/** Tagall command — mentions all group participants. */

import type { CommandDefinition, CommandResult } from '@core/commands/types.js';
import type { UniversalContext } from '@core/context/types.js';
import { AccessLevel } from '@core/access/types.js';
import { createMessageBuilder } from '@shared/message/builder.js';
import { isGroupJid } from '@infra/whatsapp/types.js';

/** Parse flag arguments like --show-mentions / -s. */
function parseTagallFlags(args: string[]): { showMentions: boolean } {
  let showMentions = false;
  for (const arg of args) {
    const normalized = arg.toLowerCase();
    if (normalized === '--show-mentions' || normalized === '-s') {
      showMentions = true;
    }
  }
  return { showMentions };
}

/** Handler for the tagall command. */
async function tagallHandler(context: UniversalContext, args: string[]): Promise<CommandResult> {
  if (!isGroupJid(context.channel.id)) {
    return { type: 'error', message: 'This command can only be used in group chats.', code: 'GROUP_ONLY' };
  }

  const { showMentions } = parseTagallFlags(args);
  const mentions = context.mentions;

  let section: string;
  if (showMentions && mentions.length > 0) {
    // Expand @tags from mentions
    const tokens = mentions.map((m) => `@${m.phoneNumber ?? m.jid}`).join(' ');
    section = `Total: ${mentions.length} participants\n\n${tokens}\n\nEveryone has been mentioned!`;
  } else {
    section = `Total: ${mentions.length} participants`;
  }

  const msg = createMessageBuilder()
    .withTheme('default')
    .title('📢 Hexo 💜')
    .section(section)
    .build();

  return { type: 'text', content: msg.text };
}

/** Tagall command definition. */
export const tagallCommand: CommandDefinition = {
  name: 'tagall',
  aliases: ['everyone', 'all'],
  description: 'Mention all group participants',
  usage: 'tagall [--show-mentions|-s]',
  minArgs: 0,
  maxArgs: 1,
  accessLevel: AccessLevel.Moderator,
  enabled: true,
  handler: tagallHandler,
};
