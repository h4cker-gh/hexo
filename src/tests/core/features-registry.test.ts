import { describe, it, expect, beforeEach } from 'vitest';
import { FeatureRegistryImpl } from '@core/features/registry.js';
import { HexoError } from '@shared/errors/base.js';

describe('FeatureRegistryImpl', () => {
  let registry: FeatureRegistryImpl;

  beforeEach(() => {
    registry = new FeatureRegistryImpl();
  });

  it('should register and check enabled feature', () => {
    registry.register({ name: 'ping', description: 'Ping command', enabled: true });
    expect(registry.isEnabled('ping')).toBe(true);
  });

  it('should return false for disabled feature', () => {
    registry.register({ name: 'ping', description: 'Ping command', enabled: false });
    expect(registry.isEnabled('ping')).toBe(false);
  });

  it('should return false for unregistered feature', () => {
    expect(registry.isEnabled('unknown')).toBe(false);
  });

  it('should throw on duplicate registration', () => {
    registry.register({ name: 'ping', description: 'Ping command', enabled: true });
    expect(() => registry.register({ name: 'ping', description: 'Ping v2', enabled: true })).toThrow(HexoError);
  });

  it('should check dependencies', () => {
    registry.register({ name: 'core', description: 'Core', enabled: true });
    registry.register({ name: 'ping', description: 'Ping', enabled: true, dependencies: ['core'] });
    expect(registry.isEnabled('ping')).toBe(true);
  });

  it('should return false when dependency is disabled', () => {
    registry.register({ name: 'core', description: 'Core', enabled: false });
    registry.register({ name: 'ping', description: 'Ping', enabled: true, dependencies: ['core'] });
    expect(registry.isEnabled('ping')).toBe(false);
  });

  it('should list registered features', () => {
    registry.register({ name: 'a', description: 'A', enabled: true });
    registry.register({ name: 'b', description: 'B', enabled: true });
    expect(registry.list()).toEqual(['a', 'b']);
  });

  it('should get feature definition', () => {
    const def = { name: 'ping', description: 'Ping', enabled: true, config: { max: 5 } };
    registry.register(def);
    const found = registry.getDefinition('ping');
    expect(found).toEqual(def);
  });
});
