import type { LifecycleHook, LifecycleStage } from './types.js';

/** Manages lifecycle hooks and executes them in stage + priority order. */
export class LifecycleManager {
  private readonly hooks = new Map<LifecycleStage, LifecycleHook[]>();

  /** Register a lifecycle hook. */
  register(hook: LifecycleHook): void {
    const stageHooks = this.hooks.get(hook.stage) ?? [];
    stageHooks.push(hook);
    this.hooks.set(hook.stage, stageHooks);
  }

  /** Execute all hooks for a given stage. */
  async execute(stage: LifecycleStage, context: Record<string, unknown> = {}): Promise<void> {
    const stageHooks = this.hooks.get(stage) ?? [];
    stageHooks.sort((a, b) => a.priority - b.priority);
    for (const hook of stageHooks) {
      await hook.execute({ ...context, stage });
    }
  }

  /** Check if any hooks are registered for a stage. */
  hasHooks(stage: LifecycleStage): boolean {
    return (this.hooks.get(stage) ?? []).length > 0;
  }

  /** Get hook count for a stage. */
  getHookCount(stage: LifecycleStage): number {
    return (this.hooks.get(stage) ?? []).length;
  }
}
