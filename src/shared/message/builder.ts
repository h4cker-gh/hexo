/** Typed message builder with theme-based formatting. */

import themes from '@shared/themes.json' assert { type: 'json' };
import type { ThemeConfig, Section } from './types.js';

// ─── Theme Loading ──────────────────────────────────────────────────────────

const loadedThemes = themes as Record<string, ThemeConfig>;

/** Default theme name. */
const DEFAULT_THEME = 'default';

/** Resolve a theme by name, falling back to defaults. */
function resolveTheme(name: string): ThemeConfig {
  return loadedThemes[name] ?? loadedThemes[DEFAULT_THEME]!;
}

/** Pad a string to a target width, centered or left-aligned. */
function padToWidth(text: string, width: number, align: 'left' | 'center' = 'left'): string {
  const pad = width - text.length;
  if (pad <= 0) return text;
  if (align === 'center') {
    const left = Math.floor(pad / 2);
    const right = pad - left;
    return ' '.repeat(left) + text + ' '.repeat(right);
  }
  return text + ' '.repeat(pad);
}

/** Wrap text into lines of a given width. */
function wrapText(text: string, width: number): string[] {
  const lines: string[] = [];
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) return lines;

  let current = '';

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length > width) {
      // Flush current line if exists
      if (current) {
        lines.push(current);
        current = word;
      } else if (word.length > width) {
        // Single word longer than width — split it
        let rest = word;
        while (rest.length > width) {
          lines.push(rest.slice(0, width));
          rest = rest.slice(width);
        }
        current = rest;
      } else {
        current = word;
      }
    } else {
      current = candidate;
    }
  }
  if (current) {
    lines.push(current);
  }
  return lines;
}

// ─── Public Types ───────────────────────────────────────────────────────────

/** Options for building a message. */
export interface BuildOptions {
  /** Theme name (e.g. 'default', 'minimal', 'retro'). */
  theme?: string;
}

/** Built message ready to send. */
export interface BuiltMessage {
  /** The formatted text. */
  text: string;
  /** Resolved theme name. */
  theme: string;
}

/** Public builder interface. */
export interface IMessageBuilder {
  /** Set theme name. */
  withTheme(name: string): IMessageBuilder;
  /** Set the title text/icon. */
  title(text: string): IMessageBuilder;
  /** Add a section of text content. */
  section(text: string, label?: string): IMessageBuilder;
  /** Add a single line of raw text. */
  text(line: string): IMessageBuilder;
  /** Set the footer text. */
  footer(text: string): IMessageBuilder;
  /** Build the final message string. */
  build(): BuiltMessage;
}

// ─── Builder Implementation ─────────────────────────────────────────────────

/** Fluent message builder using a theme config. */
export class MessageBuilder implements IMessageBuilder {
  private themeName = DEFAULT_THEME;
  private titleText = '';
  private sections: Section[] = [];
  private footerText = '';

  withTheme(name: string): this {
    this.themeName = name;
    return this;
  }

  title(text: string): this {
    this.titleText = text;
    return this;
  }

  section(text: string, label?: string): this {
    if (text.trim()) {
      this.sections.push({ label, text });
    }
    return this;
  }

  text(line: string): this {
    if (line.trim()) {
      this.sections.push({ text: line });
    }
    return this;
  }

  footer(text: string): this {
    this.footerText = text;
    return this;
  }

  build(): BuiltMessage {
    const theme = resolveTheme(this.themeName);
    const wrap = theme.wrap ?? 28;
    const parts: string[] = [];

    // ── Top border ──
    const top = (theme.title.top ?? '╭─') + '─'.repeat(wrap) + (theme.title.right ?? '─╮');
    parts.push(top);

    // ── Title line ──
    if (this.titleText) {
      const centerPad = Math.max(0, wrap - this.titleText.length);
      const centered = this.titleText + ' '.repeat(centerPad);
      const titlePrefix = theme.title.center ?? '';
      const line = `│${titlePrefix}${centered}│`;
      parts.push(line);
    }

    // ── Divider ──
    const divider = theme.divider ?? '├─────═ ✧ ═─────┤';
    const dividerPadded = divider.length <= wrap
      ? divider + ' '.repeat(wrap - divider.length)
      : divider.slice(0, wrap);
    parts.push(`│${dividerPadded}│`);

    // ── Sections ──
    const sectionPrefix = theme.section?.prefix ?? '│';
    const sectionPad = theme.section?.padding ?? ' ';

    for (const sec of this.sections) {
      if (sec.label) {
        const labelLine = `${sectionPrefix}${sectionPad}${sec.label}`;
        parts.push(padToWidth(labelLine, wrap, 'left'));
      }
      const textLines = wrapText(sec.text, wrap - 2);
      for (const line of textLines) {
        const content = `${sectionPrefix}${sectionPad}${line}`;
        parts.push(padToWidth(content, wrap, 'left'));
      }
    }

    // ── Footer ──
    if (this.footerText) {
      const footerLine = `${sectionPad}${this.footerText}`;
      parts.push(`${theme.footer.top ?? '╰'}${footerLine}${theme.footer.bottom ?? '╯'}`);
    } else {
      const footerLine = '─'.repeat(wrap);
      parts.push(`${theme.footer.top ?? '╰'}${footerLine}${theme.footer.bottom ?? '╯'}`);
    }

    return { text: parts.join('\n'), theme: this.themeName };
  }
}

/** Create a new message builder instance. */
export function createMessageBuilder(): IMessageBuilder {
  return new MessageBuilder();
}
