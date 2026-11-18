import type { ConnectionStatus } from '@/api/types';

export type StatusTone = 'neutral' | 'info' | 'warning' | 'success' | 'danger';

interface StatusMeta {
  label: string;
  tone: StatusTone;
  hint: string;
  pulse: boolean;
}

export const STATUS_META: Record<ConnectionStatus, StatusMeta> = {
  disconnected: {
    label: 'Disconnected',
    tone: 'neutral',
    hint: 'WhatsApp is not linked to this bot yet.',
    pulse: false,
  },
  connecting: {
    label: 'Connecting',
    tone: 'warning',
    hint: 'Opening a WhatsApp session…',
    pulse: true,
  },
  qr: {
    label: 'QR ready',
    tone: 'info',
    hint: 'Scan the QR code with WhatsApp to link this device.',
    pulse: true,
  },
  pairing: {
    label: 'Pairing',
    tone: 'info',
    hint: 'Enter the pairing code on your phone to link this device.',
    pulse: true,
  },
  connected: {
    label: 'Connected',
    tone: 'success',
    hint: 'Messages are flowing through WhatsApp.',
    pulse: false,
  },
  error: {
    label: 'Error',
    tone: 'danger',
    hint: 'The WhatsApp session hit an error.',
    pulse: false,
  },
};

export function statusMeta(status: ConnectionStatus): StatusMeta {
  return STATUS_META[status];
}
