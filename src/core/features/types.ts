/** Feature definition and registry types. */

/** A feature that can be enabled/disabled with its own configuration. */
export interface FeatureDefinition {
  name: string;
  description: string;
  enabled: boolean;
  config?: Record<string, unknown>;
  dependencies?: string[];
}

/** Registry for managing feature definitions. */
export interface FeatureRegistry {
  register(def: FeatureDefinition): void;
  isEnabled(name: string): boolean;
  getDefinition(name: string): FeatureDefinition | undefined;
  list(): string[];
}
