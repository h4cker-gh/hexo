import type { ConnectionStatus } from '@/api/types';
import { statusMeta } from '@/lib/status';

export function StatusBadge({ status }: { status: ConnectionStatus }) {
  const meta = statusMeta(status);
  return (
    <span
      className={`status-badge status-badge--${meta.tone}`}
      aria-label={`Connection status: ${meta.label}`}
    >
      <span
        className={meta.pulse ? 'status-badge__dot status-badge__dot--pulse' : 'status-badge__dot'}
        aria-hidden="true"
      />
      {meta.label}
    </span>
  );
}

export function StreamBadge({
  state,
  attempts,
}: {
  state: 'connecting' | 'open' | 'reconnecting' | 'closed';
  attempts: number;
}) {
  const labels = {
    connecting: 'Connecting',
    open: 'Live',
    reconnecting: attempts > 1 ? `Reconnecting · try ${attempts}` : 'Reconnecting',
    closed: 'Offline',
  } as const;
  const tone =
    state === 'open'
      ? 'success'
      : state === 'reconnecting' || state === 'closed'
        ? 'danger'
        : 'warning';

  return (
    <span
      className={`stream-badge stream-badge--${tone}`}
      role="status"
      aria-live="polite"
      title={`Live update stream: ${labels[state]}`}
    >
      <span
        className={state === 'open' ? 'stream-badge__dot' : 'stream-badge__dot stream-badge__dot--pulse'}
        aria-hidden="true"
      />
      <span className="stream-badge__text">{labels[state]}</span>
    </span>
  );
}
