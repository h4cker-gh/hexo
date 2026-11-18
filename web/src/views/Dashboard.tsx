import type { PlatformStats } from '@/api/types';
import { ActivityBars } from '@/components/ActivityBars';
import { ChatIcon, PlugIcon, SendIcon, CheckIcon } from '@/components/Icons';
import { LogList } from '@/components/LogList';
import { MessageTable } from '@/components/MessageTable';
import { SectionCard } from '@/components/SectionCard';
import { StatCard } from '@/components/StatCard';
import { StatusBadge } from '@/components/StatusBadge';
import { EmptyState } from '@/components/EmptyState';
import { useNow } from '@/hooks/useNow';
import type { DashboardStore } from '@/hooks/useDashboard';
import type { Route } from '@/config';
import { formatDateTime, formatDuration, formatRelative, uptimeMs } from '@/lib/format';
import { statusMeta } from '@/lib/status';

const EMPTY_STATS: PlatformStats = {
  platform: 'whatsapp',
  connected: false,
  messagesReceived: 0,
  messagesSent: 0,
  commandsExecuted: 0,
  errors: 0,
  startedAt: null,
  lastActivityAt: null,
};

interface DashboardProps {
  store: DashboardStore;
  onNavigate: (route: Route) => void;
}

function DashboardSkeleton() {
  return (
    <div className="dash-layout" aria-busy="true">
      <span className="visually-hidden">Loading dashboard</span>
      <div className="dash-main">
        <div className="skeleton skeleton--hero" />
        <div className="stat-grid">
          {Array.from({ length: 4 }, (_, index) => (
            <div className="skeleton skeleton--stat" key={index} />
          ))}
        </div>
        <div className="skeleton skeleton--panel" />
        <div className="skeleton skeleton--panel" />
      </div>
      <div className="dash-side">
        <div className="skeleton skeleton--logs" />
      </div>
    </div>
  );
}

export function Dashboard({ store, onNavigate }: DashboardProps) {
  const now = useNow(1000);
  const platform = store.whatsapp;
  const stats = platform?.stats ?? EMPTY_STATS;
  const status = platform?.status ?? 'disconnected';
  const meta = statusMeta(status);
  const connectedSince = stats.connected ? stats.startedAt : null;
  const uptime = connectedSince ? uptimeMs(connectedSince, now) : null;
  const lastActivity = stats.lastActivityAt ?? store.messages[0]?.timestamp ?? null;

  if (store.loading && store.platforms.length === 0) return <DashboardSkeleton />;

  if (store.error && store.platforms.length === 0) {
    return (
      <div className="card state-card">
        <EmptyState
          icon={<PlugIcon size={28} />}
          title="Can’t reach the HexoBot API"
          description={store.error}
          action={
            <button type="button" className="btn btn--primary" onClick={() => void store.refresh()}>
              Retry connection
            </button>
          }
        />
      </div>
    );
  }

  return (
    <div className="view">
      <div className="view-head">
        <div>
          <h2 className="view-title">Overview</h2>
          <p className="view-subtitle">
            Live WhatsApp connection, message traffic, and server logs.
          </p>
        </div>
      </div>

      {store.error ? (
        <div className="alert alert--error" role="alert">
          <div className="alert__body">
            <strong>Live data may be stale</strong>
            <span>{store.error}</span>
          </div>
          <button type="button" className="btn btn--sm btn--ghost" onClick={() => void store.refresh()}>
            Retry
          </button>
        </div>
      ) : null}

      <div className="dash-layout">
        <div className="dash-main">
          <section className="card platform-card" aria-labelledby="platform-heading">
            <div className="platform-card__top">
              <div className="platform-card__identity">
                <span className="platform-card__icon" aria-hidden="true">
                  <ChatIcon size={22} />
                </span>
                <div>
                  <h3 className="platform-card__name" id="platform-heading">
                    {platform?.name ?? 'WhatsApp'}
                  </h3>
                  <p className="platform-card__hint">{meta.hint}</p>
                </div>
              </div>
              <StatusBadge status={status} />
            </div>

            {platform?.error ? (
              <p className="platform-card__error" role="alert">
                {platform.error}
              </p>
            ) : null}

            <dl className="meta-grid">
              <div className="meta">
                <dt className="meta__label">Bot JID</dt>
                <dd className="meta__value mono">
                  {platform?.botJid ?? (status === 'connected' ? '—' : 'Not linked')}
                </dd>
              </div>
              <div className="meta">
                <dt className="meta__label">Connected since</dt>
                <dd className="meta__value">{formatDateTime(connectedSince)}</dd>
              </div>
              <div className="meta">
                <dt className="meta__label">Uptime</dt>
                <dd className="meta__value mono">{uptime === null ? '—' : formatDuration(uptime)}</dd>
              </div>
              <div className="meta">
                <dt className="meta__label">Last activity</dt>
                <dd className="meta__value">{lastActivity ? formatRelative(lastActivity, now) : '—'}</dd>
              </div>
            </dl>

            <div className="platform-card__actions">
              <button
                type="button"
                className="btn btn--secondary"
                onClick={() => onNavigate('connect')}
              >
                <PlugIcon size={16} />
                Manage connection
              </button>
              <button
                type="button"
                className="btn btn--ghost"
                onClick={() => onNavigate('send')}
                disabled={status !== 'connected'}
              >
                <SendIcon size={16} />
                Send a message
              </button>
            </div>
          </section>

          <div className="stat-grid">
            <StatCard
              label="Received"
              value={stats.messagesReceived}
              hint="Inbound messages"
              tone="in"
            />
            <StatCard label="Sent" value={stats.messagesSent} hint="Outbound messages" tone="out" />
            <StatCard
              label="Commands"
              value={stats.commandsExecuted}
              hint="Commands executed"
              tone="command"
            />
            <StatCard label="Errors" value={stats.errors} hint="Recorded failures" tone="error" />
          </div>

          <SectionCard
            title="Activity"
            subtitle="Messages per minute · last 30 minutes"
            actions={
              <span className="card-note">
                <ChatIcon size={14} />
                Live
              </span>
            }
          >
            <ActivityBars messages={store.messages} now={now} />
          </SectionCard>

          <SectionCard
            title="Recent messages"
            subtitle="Newest first · up to 200 retained in this session"
            actions={<span className="count-badge">{store.messages.length}</span>}
          >
            <MessageTable messages={store.messages} />
          </SectionCard>
        </div>

        <aside className="dash-side" aria-label="Server logs">
          <LogList
            logs={store.logs}
            paused={store.paused}
            pendingCount={store.pendingLogCount}
            onTogglePause={store.togglePause}
            onClear={store.clearLogs}
          />
        </aside>
      </div>

      <div className="dash-footnote">
        <span>
          <CheckIcon size={14} /> Snapshot re-fetched on every SSE reconnect
        </span>
        <span>API base: {import.meta.env.VITE_API_BASE || 'same origin / Vite proxy'}</span>
      </div>
    </div>
  );
}
