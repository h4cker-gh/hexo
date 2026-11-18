import { describe, it, expect, beforeEach } from 'vitest';
import { LifecycleManager, LifecycleStage } from '@core/lifecycle/index.js';

describe('LifecycleManager', () => {
  let manager: LifecycleManager;

  beforeEach(() => {
    manager = new LifecycleManager();
  });

  it('should register and execute hooks in priority order', async () => {
    const order: string[] = [];
    manager.register({ stage: LifecycleStage.Initializing, priority: 10, execute: async () => { order.push('b'); } });
    manager.register({ stage: LifecycleStage.Initializing, priority: 1, execute: async () => { order.push('a'); } });
    manager.register({ stage: LifecycleStage.Initializing, priority: 5, execute: async () => { order.push('c'); } });

    await manager.execute(LifecycleStage.Initializing);
    expect(order).toEqual(['a', 'c', 'b']);
  });

  it('should execute hooks with context', async () => {
    let captured: Record<string, unknown> = {};
    manager.register({
      stage: LifecycleStage.Starting,
      priority: 0,
      execute: async (ctx) => { captured = ctx; },
    });

    await manager.execute(LifecycleStage.Starting, { key: 'value' });
    expect(captured.key).toBe('value');
  });

  it('should return false when no hooks registered', () => {
    expect(manager.hasHooks(LifecycleStage.Started)).toBe(false);
  });

  it('should return hook count', () => {
    manager.register({ stage: LifecycleStage.Stopping, priority: 0, execute: async () => {} });
    expect(manager.getHookCount(LifecycleStage.Stopping)).toBe(1);
    expect(manager.getHookCount(LifecycleStage.Started)).toBe(0);
  });

  it('should not throw when executing with no hooks', async () => {
    await expect(manager.execute(LifecycleStage.Stopped)).resolves.toBeUndefined();
  });
});
