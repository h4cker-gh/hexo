function toDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

const clockFormatter = new Intl.DateTimeFormat(undefined, {
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
});

const minuteFormatter = new Intl.DateTimeFormat(undefined, {
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

const dateTimeFormatter = new Intl.DateTimeFormat(undefined, {
  month: 'short',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

const numberFormatter = new Intl.NumberFormat();

export function formatClock(value: string | null | undefined): string {
  const date = toDate(value);
  return date ? clockFormatter.format(date) : '—';
}

export function formatMinute(timestamp: number): string {
  return minuteFormatter.format(new Date(timestamp));
}

export function formatDateTime(value: string | null | undefined): string {
  const date = toDate(value);
  return date ? dateTimeFormatter.format(date) : '—';
}

export function formatRelative(value: string | null | undefined, now: number): string {
  const date = toDate(value);
  if (!date) return '—';
  const diff = Math.max(0, now - date.getTime());
  const seconds = Math.floor(diff / 1000);
  if (seconds < 5) return 'just now';
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return dateTimeFormatter.format(date);
}

/** Live uptime as HH:MM:SS, prefixed with days when relevant. */
export function formatDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return '—';
  const totalSeconds = Math.floor(ms / 1000);
  const days = Math.floor(totalSeconds / 86_400);
  const hours = Math.floor((totalSeconds % 86_400) / 3_600);
  const minutes = Math.floor((totalSeconds % 3_600) / 60);
  const seconds = totalSeconds % 60;
  const pad = (value: number) => String(value).padStart(2, '0');
  const clock = `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
  return days > 0 ? `${days}d ${clock}` : clock;
}

/** Uptime in ms for a connected platform, else null. */
export function uptimeMs(startedAt: string | null | undefined, now: number): number | null {
  const date = toDate(startedAt);
  if (!date) return null;
  return Math.max(0, now - date.getTime());
}

export function formatNumber(value: number): string {
  return numberFormatter.format(value);
}

/** Pairing codes are 8 alphanumerics; render them as XXXX-XXXX. */
export function formatPairingCode(code: string): string {
  const clean = code.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
  return clean.length === 8 ? `${clean.slice(0, 4)}-${clean.slice(4)}` : clean;
}

/** Strip the WhatsApp domain for compact display. */
export function shortJid(jid: string): string {
  return jid.replace(/@s\.whatsapp\.net$/i, '').replace(/@g\.us$/i, '').replace(/@lid$/i, '');
}
