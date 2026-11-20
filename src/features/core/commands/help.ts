/** Help command — lists all commands or shows details for a specific one. */

import type { CommandDefinition, CommandResult } from '@core/commands/types.js';
import type { UniversalContext } from '@core/context/types.js';
import { AccessLevel } from '@core/access/types.js';

/** Registry accessor injected at runtime. */
interface HelpContext {
  getCommands(): string[];
  getMetadata(name: string): CommandDefinition | undefined;
}

/** Handler for the help command. */
async function helpHandler(context: UniversalContext, args: string[]): Promise<CommandResult> {
  const helpCtx = context.variables.get('registry') as HelpContext | undefined;
  if (!helpCtx) {
    return { type: 'error', message: 'Command registry not available.', code: 'NO_REGISTRY' };
  }

  const commandName = args[0]?.toLowerCase();

  if (!commandName) {
    // List all commands
    const commands = helpCtx.getCommands();
    const lines: string[] = ['Available commands:'];
    for (const name of commands) {
      const meta = helpCtx.getMetadata(name);
      if (meta) {
        lines.push(`  \`${meta.name}\` — ${meta.description}`);
      }
    }
    lines.push('');
    lines.push('Use \`help <command>\` for details.');
    return { type: 'text', content: lines.join('\n') };
  }

  const meta = helpCtx.getMetadata(commandName);
  if (!meta) {
    return { type: 'error', message: `Unknown command: ${commandName}`, code: 'UNKNOWN_COMMAND' };
  }

  const parts: string[] = [
    `\`help\` — Shows this help message.`,
    ``,
    `\`${meta.name}\` — ${meta.description}`,
    ``,
    `Usage: \`${meta.usage}\``,
  ];

  if (meta.aliases.length > 0) {
    parts.push(`Aliases: \`${meta.aliases.join('`, `')}\``);
  }

  return { type: 'text', content: parts.join('\n') };
}

/** Help command definition. */
export const helpCommand: CommandDefinition = {
  name: 'help',
  aliases: ['h', 'commands', 'menu'],
  description: 'Show available commands and help',
  usage: 'help [command]',
  minArgs: 0,
  maxArgs: 1,
  accessLevel: AccessLevel.User,
  enabled: true,
  handler: helpHandler,
};
