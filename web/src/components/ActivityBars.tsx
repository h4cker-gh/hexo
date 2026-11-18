import { useMemo } from 'react';

import type { MessageRecord } from '@/api/types';
import { LIMITS } from '@/config';
import { buildActivityBuckets } from '@/lib/activity';
import { formatMinute } from '@/lib/format';

interface ActivityBarsProps {
  messages: MessageRecord[];
  now: number;
}

export function ActivityBars({ messages, now }: ActivityBarsProps) {
  const minute = Math.floor(now / 60_000) * 60_000;
  const buckets = useMemo(
    () => buildActivityBuckets(messages, minute, LIMITS.activityMinutes),
    [messages, minute],
  );

  const totals = useMemo(
    () =>
      buckets.reduce(
        (acc, bucket) => ({
          inbound: acc.inbound + bucket.inbound,
          outbound: acc.outbound + bucket.outbound,
        }),
        { inbound: 0, outbound: 0 },
      ),
    [buckets],
  );

  const peak = useMemo(
    () => buckets.reduce((max, bucket) => Math.max(max, bucket.inbound + bucket.outbound), 0),
    [buckets],
  );
  const scale = Math.max(1, peak);
  const first = buckets[0]?.start ?? minute;

  return (
    <div className="activity">
      <div className="legend">
        <span className="legend__item">
          <span className="legend__swatch legend__swatch--in" aria-hidden="true" />
          {totals.inbound} received
        </span>
        <span className="legend__item">
          <span className="legend__swatch legend__swatch--out" aria-hidden="true" />
          {totals.outbound} sent
        </span>
        <span className="legend__item legend__item--muted">Peak {peak}/min</span>
      </div>

      <div
        className="activity__chart"
        role="img"
        aria-label={`Message activity for the last ${LIMITS.activityMinutes} minutes: ${totals.inbound} received, ${totals.outbound} sent.`}
      >
        {buckets.map((bucket) => {
          const total = bucket.inbound + bucket.outbound;
          const inboundHeight =
            bucket.inbound === 0 ? 0 : Math.max(5, (bucket.inbound / scale) * 100);
          const outboundHeight =
            bucket.outbound === 0 ? 0 : Math.max(5, (bucket.outbound / scale) * 100);
          const label = `${formatMinute(bucket.start)} · ${bucket.inbound} received, ${bucket.outbound} sent`;
          return (
            <div className="activity__col" key={bucket.start} title={label}>
              <span
                className="activity__bar activity__bar--out"
                style={{ height: total === 0 ? '0%' : `${outboundHeight}%` }}
              />
              <span
                className="activity__bar activity__bar--in"
                style={{ height: total === 0 ? '0%' : `${inboundHeight}%` }}
              />
            </div>
          );
        })}
      </div>

      <div className="activity__axis" aria-hidden="true">
        <span>{formatMinute(first)}</span>
        <span>now</span>
      </div>

      {peak === 0 ? (
        <p className="activity__empty">No message traffic in the last {LIMITS.activityMinutes} minutes.</p>
      ) : null}
    </div>
  );
}
