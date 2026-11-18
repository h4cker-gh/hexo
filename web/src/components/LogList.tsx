import { memo, useEffect, useId, useMemo, useRef, useState } from 'react';

import type { LogEntryDto, LogLevelName } from '@/api/types';
import { EmptyState } from '@/components/EmptyState';
import { SectionCard } from '@/components/SectionCard';
import { formatClock, formatDateTime } from '@/lib/format';
import { isLogLevel, LOG_LEVEL_LABELS, LOG_LEVEL_RANK, LOG_LEVELS } from '@/lib/logs';

interface LogListProps {
  logs: LogEntryDto[];
  paused: boolean;
  pendingCount: number;
  onTogglePause: () => void;
  onClear: () => void;
}

function contextJson(context: Record<string, unknown> | undefined): string | null {
  if (!context || Object.keys(context).length === 0) return null;
  try {
    return JSON.stringify(context, null, 2);
  } catch {
    return null;
  }
}

export const LogList = memo(function LogList({
  logs,
  paused,
  pendingCount,
  onTogglePause,
  onClear,
}: LogListProps) {
  const [level, setLevel] = useState<LogLevelName>('debug');
  const [autoScroll, setAutoScroll] = useState(true);
  const listRef = useRef<HTMLDivElement>(null);
  const levelId = useId();
  const scrollId = useId();

  const filtered = useMemo(
    () => logs.filter((entry) => LOG_LEVEL_RANK[entry.level] >= LOG_LEVEL_RANK[level]),
    [logs, level],
  );
  const ordered = useMemo(() => [...filtered].reverse(), [filtered]);

  useEffect(() => {
    const element = listRef.current;
    if (!element || !autoScroll) return;
    element.scrollTop = element.scrollHeight;
  }, [ordered, autoScroll]);

  return (
    <SectionCard
      title="Live logs"
      subtitle="Newest entries at the bottom"
      className="logs-card"
      bodyClassName="logs-body"
      actions={
        <span className={paused ? 'live-chip live-chip--paused' : 'live-chip'}>
          <span className="live-chip__dot" aria-hidden="true" />
          {paused ? `Paused${pendingCount > 0 ? ` · ${pendingCount}` : ''}` : 'Streaming'}
        </span>
      }
    >
      <div className="logs-toolbar">
        <label className="field field--inline" htmlFor={levelId}>
          <span className="field__label field__label--sm">Level</span>
          <select
            id={levelId}
            className="select select--sm"
            value={level}
            onChange={(event) => {
              const value = event.target.value;
              if (isLogLevel(value)) setLevel(value);
            }}
          >
            {LOG_LEVELS.map((item) => (
              <option key={item} value={item}>
                {LOG_LEVEL_LABELS[item]}+
              </option>
            ))}
          </select>
        </label>

        <div className="logs-toolbar__group">
          <button
            type="button"
            className={paused ? 'btn btn--sm btn--primary' : 'btn btn--sm btn--ghost'}
            aria-pressed={paused}
            onClick={onTogglePause}
            title={paused ? 'Resume live logs; buffered entries are merged' : 'Pause live log updates'}
          >
            {paused ? 'Resume' : 'Pause'}
          </button>
          <button
            type="button"
            className="btn btn--sm btn--ghost"
            onClick={onClear}
            disabled={logs.length === 0}
          >
            Clear
          </button>
        </div>

        <label className="checkbox" htmlFor={scrollId}>
          <input
            id={scrollId}
            type="checkbox"
            checked={autoScroll}
            onChange={(event) => setAutoScroll(event.target.checked)}
          />
          <span>Auto-scroll</span>
        </label>
      </div>

      <div className="logs-count">
        {filtered.length} of {logs.length} entries
        {paused && pendingCount > 0 ? ` · ${pendingCount} buffered while paused` : ''}
      </div>

      <div className="log-scroll" ref={listRef}>
        {ordered.length === 0 ? (
          <EmptyState
            title={logs.length === 0 ? 'No logs yet' : 'No logs at this level'}
            description={
              logs.length === 0
                ? 'Server logs stream here over SSE. New activity will appear automatically.'
                : 'Lower the minimum level to see more entries, or clear the filter.'
            }
          />
        ) : (
          <ul className="log-list" aria-label="Live log entries">
            {ordered.map((entry) => {
              const detail = contextJson(entry.context);
              return (
                <li key={entry.id} className={`log log--${entry.level}`}>
                  <time className="log__time" dateTime={entry.timestamp} title={formatDateTime(entry.timestamp)}>
                    {formatClock(entry.timestamp)}
                  </time>
                  <span className={`log__level log__level--${entry.level}`}>
                    {LOG_LEVEL_LABELS[entry.level]}
                  </span>
                  <div className="log__body">
                    <p className="log__line">
                      {entry.logger ? <span className="log__logger">{entry.logger}</span> : null}
                      <span className="log__message">{entry.message}</span>
                    </p>
                    {detail ? (
                      <details className="log__details">
                        <summary>Context</summary>
                        <pre className="log__context">{detail}</pre>
                      </details>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <p className="logs-hint">Clear only affects this browser; server logs are unchanged.</p>
    </SectionCard>
  );
});
