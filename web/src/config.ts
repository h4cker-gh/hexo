import type { PlatformId } from '@/api/types';

/** Branding that appears in the shell and document title. */
export const APP_NAME = 'HexoBot';
export const APP_TAGLINE = 'WhatsApp dashboard';

/** Only one platform exists in contract v1. */
export const PLATFORM_ID: PlatformId = 'whatsapp';
export const PLATFORM_LABEL = 'WhatsApp';

/** Navigation is hash-based; there is no router dependency. */
export const ROUTE_IDS = ['dashboard', 'send', 'connect'] as const;
export type Route = (typeof ROUTE_IDS)[number];

export interface TabConfig {
  id: Route;
  label: string;
  hash: string;
}

export const TABS: readonly TabConfig[] = [
  { id: 'dashboard', label: 'Dashboard', hash: '#/dashboard' },
  { id: 'send', label: 'Send message', hash: '#/send' },
  { id: 'connect', label: 'Connection', hash: '#/connect' },
];

export type Theme = 'dark' | 'light' | 'h4cker';

export interface ThemeConfig {
  id: Theme;
  label: string;
}

export const THEMES: readonly ThemeConfig[] = [
  { id: 'dark', label: 'Dark' },
  { id: 'light', label: 'Light' },
  { id: 'h4cker', label: 'H4cker' },
];

export const THEME_STORAGE_KEY = 'hexobot.theme';

/** Fetch sizes and list caps. API maxima are 500 logs / 200 messages. */
export const LIMITS = {
  messages: 50,
  maxMessages: 200,
  logs: 100,
  maxLogs: 500,
  sentHistory: 20,
  activityMinutes: 30,
} as const;

export function isRoute(value: string): value is Route {
  return (ROUTE_IDS as readonly string[]).includes(value);
}
