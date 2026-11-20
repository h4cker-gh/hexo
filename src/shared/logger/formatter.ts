/** Colored, structured log formatter for debug-mode output. */

// ─── ANSI Color Codes ───────────────────────────────────────────────────────

const Colors = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  underline: '\x1b[4m',
  // Level colors
  debug: '\x1b[36m',    // cyan
  info: '\x1b[32m',     // green
  warn: '\x1b[33m',     // yellow
  error: '\x1b[31m',    // red
  fatal: '\x1b[35m',    // magenta (bold red)
  // UI colors
  bracket: '\x1b[90m',  // dim gray
  name: '\x1b[37m',     // white
  value: '\x1b[38;5;135m', // purple-ish
  separator: '\x1b[38;5;241m', // dark gray
  contextKey: '\x1b[38;5;111m', // light green
  contextValue: '\x1b[38;5;223m', // light yellow
  contextString: '\x1b[38;5;213m', // orange
} as const;

// ─── Constants ──────────────────────────────────────────────────────────────

const LEVEL_COLORS: Record<string, string> = {
  debug: Colors.debug,
  info: Colors.info,
  warn: Colors.warn,
  error: Colors.error,
  fatal: Colors.fatal,
};

const SEPARATOR = '│';
const BRACKET = '╭';
const BRACKET_B = '╰';

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Wrap a string in a color, reset afterwards. */
function color(text: string, code: string): string {
  return `${code}${text}${Colors.reset}`;
}

/** Short timestamp: HH:MM:SS.mmm */
function shortTimestamp(date: Date): string {
  const h = String(date.getHours()).padStart(2, '0');
  const m = String(date.getMinutes()).padStart(2, '0');
  const s = String(date.getSeconds()).padStart(2, '0');
  const ms = String(date.getMilliseconds()).padStart(3, '0');
  return `${h}:${m}:${s}.${ms}`;
}

/** Format a context value for display. */
function formatValue(value: unknown): string {
  if (value === null || value === undefined) return color(String(value), Colors.dim);
  if (typeof value === 'string') return color(value, Colors.contextString);
  if (typeof value === 'number' || typeof value === 'bigint') return color(String(value), Colors.contextValue);
  if (typeof value === 'boolean') return color(String(value), Colors.contextValue);
  if (value instanceof Error) return color(value.message, Colors.error);
  if (value instanceof Date) return color(value.toISOString(), Colors.contextString);
  if (Array.isArray(value)) return color(JSON.stringify(value), Colors.contextString);
  if (typeof value === 'object') {
    try {
      return color(JSON.stringify(value), Colors.contextString);
    } catch {
      return color('[unserializable]', Colors.dim);
    }
  }
  return String(value);
}

// ─── Main Formatter ─────────────────────────────────────────────────────────

/** Format a structured log entry for the console. */
export function formatLogEntry(
  level: string,
  message: string,
  context?: Record<string, unknown>,
  loggerName = '',
): string {
  const now = new Date();
  const ts = shortTimestamp(now);
  const colorCode = LEVEL_COLORS[level] ?? Colors.reset;
  const levelStr = color(level.toUpperCase().padEnd(7), colorCode);
  const nameStr = color(loggerName, Colors.name);
  const timeStr = color(`[${ts}]`, Colors.bracket);

  // Top line: ┌[time] LEVEL [name] ── message
  const topLine = `${BRACKET} ${timeStr} ${levelStr} ${color(nameStr, Colors.bold)} ${color('─', Colors.separator)} ${message}`;

  // Context block
  if (!context || Object.keys(context).length === 0) {
    return topLine;
  }

  const ctxLines = Object.entries(context).map(([key, val]) => {
    const keyColored = color(key, Colors.contextKey);
    const valFormatted = formatValue(val);
    return `   ${SEPARATOR} ${color(keyColored, Colors.dim)} ${valFormatted}`;
  });

  const botLine = `${BRACKET_B}────────────────────────────────────────────────────────────${Colors.reset}`;
  return `${topLine}\n${ctxLines.join('\n')}\n${botLine}`;
}
