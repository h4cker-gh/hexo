import type { MessageRecord } from '@/api/types';

export interface ActivityBucket {
  /** Start of the minute bucket (epoch ms). */
  start: number;
  inbound: number;
  outbound: number;
}

const MINUTE_MS = 60_000;

/**
 * Build one bucket per minute for the trailing window ending at `now`.
 * Messages without a valid timestamp or outside the window are ignored.
 */
export function buildActivityBuckets(
  messages: readonly MessageRecord[],
  now: number,
  minutes: number,
): ActivityBucket[] {
  const currentBucket = Math.floor(now / MINUTE_MS) * MINUTE_MS;
  const firstBucket = currentBucket - (minutes - 1) * MINUTE_MS;
  const buckets: ActivityBucket[] = Array.from({ length: minutes }, (_, index) => ({
    start: firstBucket + index * MINUTE_MS,
    inbound: 0,
    outbound: 0,
  }));

  for (const message of messages) {
    const timestamp = Date.parse(message.timestamp);
    if (!Number.isFinite(timestamp) || timestamp < firstBucket || timestamp >= currentBucket + MINUTE_MS) {
      continue;
    }
    const index = Math.floor((timestamp - firstBucket) / MINUTE_MS);
    const bucket = buckets[index];
    if (!bucket) continue;
    if (message.direction === 'in') bucket.inbound += 1;
    else bucket.outbound += 1;
  }

  return buckets;
}
