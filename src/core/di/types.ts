/** Dependency injection types. */

/** Unique key type for service registration. */
export type ServiceKey = string | symbol;

/** Forward reference for DIContainer (circular with types). */
type DIContainer = import('./container.js').DIContainer;

/** Factory function that returns a service instance. */
export type ProviderFn<T = unknown> = (container: DIContainer) => T;

/** Configuration for a service registration. */
export interface RegistrationOptions {
  singleton?: boolean;
}
