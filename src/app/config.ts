import { readFileSync } from 'node:fs';
import { existsSync } from 'node:fs';
import { ConfigSchema, type Config, type BotConfig, type LoggerConfig } from '@core/config/index.js';

/** Resolve config file path from environment or default. */
function resolveConfigPath(): string {
  return process.env.HEXOBOT_CONFIG_PATH ?? 'hexobot.config.yml';
}

/** Parsed YAML container during loading. */
type YamlContainer = Record<string, unknown> | unknown[];

/** Indentation-aware YAML section frame. */
interface YamlFrame {
  indent: number;
  container: YamlContainer;
}

/** A meaningful config line with its indentation. */
interface YamlLine {
  indent: number;
  text: string;
}

/** Read the next non-empty, non-comment line. */
function findNextMeaningful(lines: string[], start: number): YamlLine | null {
  for (let index = start; index < lines.length; index += 1) {
    const raw = lines[index] ?? '';
    const text = raw.trim();
    if (!text || text.startsWith('#')) continue;
    return { indent: raw.length - raw.trimStart().length, text };
  }
  return null;
}

/** Simple indentation-based YAML parser (maps, lists, scalars). */
function parseSimpleYaml(content: string): Record<string, unknown> {
  const root: Record<string, unknown> = {};
  const frames: YamlFrame[] = [{ indent: -1, container: root }];
  const lines = content.split('\n');

  for (let index = 0; index < lines.length; index += 1) {
    const raw = lines[index] ?? '';
    const text = raw.trim();
    if (!text || text.startsWith('#')) continue;

    const indent = raw.length - raw.trimStart().length;
    while (frames.length > 1 && indent <= (frames[frames.length - 1]?.indent ?? -1)) {
      frames.pop();
    }
    const frame = frames[frames.length - 1];
    if (!frame) continue;

    if (text.startsWith('- ')) {
      if (Array.isArray(frame.container)) {
        frame.container.push(parseValue(text.slice(2).trim()));
      }
      continue;
    }

    const match = text.match(/^([\w.-]+):(.*)$/);
    if (!match || Array.isArray(frame.container)) continue;

    const key = match[1];
    if (!key) continue;
    const rest = (match[2] ?? '').trim();
    const container = frame.container;

    if (rest === '') {
      const next = findNextMeaningful(lines, index + 1);
      const isList = next !== null && next.indent > indent && next.text.startsWith('- ');
      if (isList) {
        const list: unknown[] = [];
        container[key] = list;
        frames.push({ indent, container: list });
      } else {
        const child: Record<string, unknown> = {};
        container[key] = child;
        frames.push({ indent, container: child });
      }
      continue;
    }

    container[key] = parseValue(rest);
  }

  return root;
}

/** Parse a scalar or inline value from YAML-like syntax. */
function parseValue(value: string): unknown {
  const trimmed = value.trim();
  if (trimmed === '{}') return {};
  if (trimmed === '[]') return [];
  // Remove quotes
  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    return trimmed.slice(1, -1);
  }
  // Boolean
  if (trimmed === 'true') return true;
  if (trimmed === 'false') return false;
  if (trimmed === 'null' || trimmed === '~') return null;
  // Number
  if (/^-?\d+$/.test(trimmed)) return Number(trimmed);
  // Array inline [a, b, c]
  if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
    const body = trimmed.slice(1, -1).trim();
    if (!body) return [];
    return body.split(',').map((item) => parseValue(item.trim()));
  }
  return trimmed;
}

/** Load and validate configuration from YAML or JSON file. */
export function loadConfig(path?: string): Config {
  const filePath = path ?? resolveConfigPath();
  if (!existsSync(filePath)) {
    throw new Error(`Config file not found: ${filePath}`);
  }

  const content = readFileSync(filePath, 'utf-8');
  let parsed: Record<string, unknown>;

  if (filePath.endsWith('.json')) {
    parsed = JSON.parse(content);
  } else {
    parsed = parseSimpleYaml(content);
  }

  const result = ConfigSchema.safeParse(parsed);
  if (!result.success) {
    const errors = result.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join('; ');
    throw new Error(`Config validation failed: ${errors}`);
  }

  return result.data;
}

/** Get bot config section (convenience). */
export function loadBotConfig(path?: string): BotConfig {
  const full = loadConfig(path);
  return full.bot;
}

/** Get logger config section (convenience). */
export function loadLoggerConfig(path?: string): LoggerConfig {
  const full = loadConfig(path);
  return full.logger;
}
