/** Types for the message builder and theme system. */

// ─── Theme Config ───────────────────────────────────────────────────────────

/** A single theme definition loaded from themes.json. */
export interface ThemeConfig {
  /** Maximum characters per content line (before wrapping). */
  wrap: number;

  /** Title block configuration. */
  title: TitleConfig;

  /** Divider line between title and content. */
  divider: string;

  /** Section line prefix and spacing. */
  section: SectionConfig;

  /** Footer block configuration. */
  footer: FooterConfig;

  /** Color hints (used by non-terminal renderers). */
  color: ColorConfig;
}

/** Title block tokens. */
export interface TitleConfig {
  /** Top-left corner text. */
  top: string;
  /** Top-right corner text. */
  right: string;
  /** Prefix before title icon (inside the box). */
  center: string;
  /** The title icon / bot name shown in the title line. */
  icon: string;
  /** Suffix after title icon. */
  bottom: string;
  /** Extra text appended after title. */
  afterTitle: string;
}

/** Divider configuration. */
export interface DividerConfig {
  /** The full divider string. */
  value: string;
}

/** Section (content line) configuration. */
export interface SectionConfig {
  /** Character prefix for each content line. */
  prefix: string;
  /** Space between prefix and content. */
  padding: string;
}

/** Footer block configuration. */
export interface FooterConfig {
  /** Bottom-left corner text. */
  top: string;
  /** Bottom-right corner text. */
  bottom: string;
}

/** Color hints for non-terminal renderers. */
export interface ColorConfig {
  /** Top border color (hex). */
  top: string;
  /** Divider color (hex). */
  divider: string;
  /** Content text color (hex). */
  content: string;
  /** Footer border color (hex). */
  footer: string;
  /** Accent / highlight color (hex). */
  accent: string;
}

// ─── Section ────────────────────────────────────────────────────────────────

/** A single content section with optional label. */
export interface Section {
  /** Optional label (e.g. "Ping", "Status"). */
  label?: string;
  /** Content text to wrap. */
  text: string;
}

// ─── Full Message Theme (for runtime use) ───────────────────────────────────

/** Runtime-merged theme with all defaults applied. */
export interface MessageTheme {
  wrap: number;
  title: TitleConfig;
  divider: string;
  section: SectionConfig;
  footer: FooterConfig;
  color: ColorConfig;
}
