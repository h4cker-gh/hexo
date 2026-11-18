import { HexoError } from '@shared/errors/index.js';
import type { CommandDefinition, CommandEntry, CommandMetadata, CommandResult } from './types.js';
import type { UniversalContext } from '@core/context/types.js';
import type { Logger } from '@core/logger/types.js';

/** Registry that manages command definitions and dispatches them. */
export class CommandRegistry {
  private readonly commands = new Map<string, CommandEntry>();
  private readonly aliases = new Map<string, string>();

  /** Register a command definition. */
  register(def: CommandDefinition): void {
    if (this.commands.has(def.name)) {
      throw new HexoError({
        code: 'DUPLICATE_COMMAND',
        message: `Command already registered: ${def.name}`,
      });
    }
    const entry: CommandEntry = { ...def };
    this.commands.set(def.name, entry);
    for (const alias of def.aliases) {
      if (this.commands.has(alias) || this.aliases.has(alias)) {
        throw new HexoError({
          code: 'DUPLICATE_ALIAS',
          message: `Alias already taken: ${alias}`,
        });
      }
      this.aliases.set(alias, def.name);
    }
  }

  /** Resolve a command by name or alias. */
  resolve(name: string): CommandEntry | undefined {
    if (this.commands.has(name)) return this.commands.get(name);
    const resolved = this.aliases.get(name);
    if (resolved) return this.commands.get(resolved);
    return undefined;
  }

  /** Check if a command exists. */
  has(name: string): boolean {
    return this.commands.has(name) || this.aliases.has(name);
  }

  /** Execute a command by name or alias. */
  async execute(name: string, context: UniversalContext, logger: Logger): Promise<CommandResult> {
    const entry = this.resolve(name);
    if (!entry) {
      return { type: 'error', message: `Unknown command: ${name}`, code: 'UNKNOWN_COMMAND' };
    }
    if (!entry.enabled) {
      return { type: 'error', message: 'Command is disabled', code: 'COMMAND_DISABLED' };
    }

    const args = context.parsedArgs;
    if (args.length < entry.minArgs) {
      return { type: 'error', message: `Usage: ${entry.usage}`, code: 'INSUFFICIENT_ARGS' };
    }
    if (args.length > entry.maxArgs) {
      return { type: 'error', message: `Too many arguments. Usage: ${entry.usage}`, code: 'TOO_MANY_ARGS' };
    }

    logger.debug(`Executing command "${entry.name}"`, { userId: context.user.id });
    try {
      return await entry.handler(context, args);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`Command "${entry.name}" failed`, { error: message, userId: context.user.id });
      return { type: 'error', message, code: 'COMMAND_ERROR' };
    }
  }

  /** List all registered command names. */
  list(): string[] {
    return Array.from(this.commands.keys());
  }

  /** Get metadata for a command. */
  getMetadata(name: string): CommandMetadata | undefined {
    const entry = this.resolve(name);
    return entry ? { name: entry.name, aliases: entry.aliases, description: entry.description, usage: entry.usage, minArgs: entry.minArgs, maxArgs: entry.maxArgs, accessLevel: entry.accessLevel, enabled: entry.enabled, config: entry.config } : undefined;
  }
}
