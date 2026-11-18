import { HexoError } from '@shared/errors/index.js';
import type { FeatureDefinition, FeatureRegistry } from './types.js';

/** Registry that manages feature definitions and checks their status. */
export class FeatureRegistryImpl implements FeatureRegistry {
  private readonly features = new Map<string, FeatureDefinition>();

  /** Register a feature definition. */
  register(def: FeatureDefinition): void {
    if (this.features.has(def.name)) {
      throw new HexoError({
        code: 'DUPLICATE_FEATURE',
        message: `Feature already registered: ${def.name}`,
      });
    }
    this.features.set(def.name, { ...def });
  }

  /** Check if a feature is enabled, including dependency check. */
  isEnabled(name: string): boolean {
    const def = this.features.get(name);
    if (!def) return false;
    if (!def.enabled) return false;
    // Check dependencies
    if (def.dependencies) {
      for (const dep of def.dependencies) {
        if (!this.isEnabled(dep)) return false;
      }
    }
    return true;
  }

  /** Get a feature definition by name. */
  getDefinition(name: string): FeatureDefinition | undefined {
    return this.features.get(name);
  }

  /** List all registered feature names. */
  list(): string[] {
    return Array.from(this.features.keys());
  }
}
