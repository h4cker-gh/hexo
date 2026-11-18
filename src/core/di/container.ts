import { HexoError } from '@shared/errors/index.js';
import type { ServiceKey, ProviderFn, RegistrationOptions } from './types.js';

/** Lightweight in-memory dependency injection container. */
export class DIContainer {
  private readonly registry = new Map<ServiceKey, { factory: ProviderFn; singleton: boolean; instance?: unknown }>();

  /** Register a service factory. */
  register<T>(key: ServiceKey, factory: ProviderFn<T>, options?: RegistrationOptions): void {
    if (this.registry.has(key)) {
      throw new HexoError({ code: 'DUPLICATE_REGISTRATION', message: `Service already registered: ${String(key)}` });
    }
    this.registry.set(key, { factory, singleton: options?.singleton ?? false });
  }

  /** Resolve a registered service. */
  resolve<T>(key: ServiceKey): T {
    const entry = this.registry.get(key);
    if (!entry) {
      throw new HexoError({ code: 'UNRESOLVED_SERVICE', message: `No service registered for: ${String(key)}` });
    }
    if (entry.singleton) {
      if (entry.instance === undefined) {
        entry.instance = entry.factory(this);
      }
      return entry.instance as T;
    }
    return entry.factory(this) as T;
  }

  /** Check if a service is registered. */
  has(key: ServiceKey): boolean {
    return this.registry.has(key);
  }

  /** Clear all registrations and instances. */
  clear(): void {
    this.registry.clear();
  }
}
