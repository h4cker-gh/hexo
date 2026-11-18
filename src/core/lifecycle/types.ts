/** Lifecycle stages and hook types. */

/** Defined lifecycle stages in execution order. */
export enum LifecycleStage {
  Initializing = 'initializing',
  Initialized = 'initialized',
  Starting = 'starting',
  Started = 'started',
  Stopping = 'stopping',
  Stopped = 'stopped',
}

/** A hook that runs at a specific lifecycle stage. */
export interface LifecycleHook {
  stage: LifecycleStage;
  priority: number;
  execute(context: Record<string, unknown>): Promise<void>;
}
