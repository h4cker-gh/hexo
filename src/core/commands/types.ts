/** Command types and interfaces. */

import type { UniversalContext } from '@core/context/types.js';
import type { AccessLevel } from '@core/access/types.js';

/** Structured result returned by a command handler. */
export type CommandResult =
  | { type: 'text'; content: string }
  | { type: 'rich'; content: Record<string, unknown> }
  | { type: 'error'; message: string; code: string }
  | { type: 'redirect'; target: string };

/** Metadata describing a command. */
export interface CommandMetadata {
  name: string;
  aliases: string[];
  description: string;
  usage: string;
  minArgs: number;
  maxArgs: number;
  accessLevel: AccessLevel;
  enabled: boolean;
  config?: Record<string, unknown>;
}

/** Command handler function signature. */
export type CommandHandler = (context: UniversalContext, args: string[]) => Promise<CommandResult>;

/** Full command definition. */
export interface CommandDefinition extends CommandMetadata {
  handler: CommandHandler;
}

/** Internal registry entry (definition + handler). */
export interface CommandEntry extends CommandDefinition {}
