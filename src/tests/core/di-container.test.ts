import { describe, it, expect, beforeEach } from 'vitest';
import { DIContainer } from '@core/di/container.js';
import { HexoError } from '@shared/errors/base.js';

describe('DIContainer', () => {
  let container: DIContainer;

  beforeEach(() => {
    container = new DIContainer();
  });

  it('should resolve a transient service', () => {
    container.register('counter', () => ({ value: 0 }));
    const a = container.resolve<{ value: number }>('counter');
    const b = container.resolve<{ value: number }>('counter');
    expect(a.value).toBe(0);
    expect(b.value).toBe(0);
    expect(a).not.toBe(b);
  });

  it('should resolve a singleton service', () => {
    container.register('counter', () => ({ value: 0 }), { singleton: true });
    const a = container.resolve<{ value: number }>('counter');
    const b = container.resolve<{ value: number }>('counter');
    expect(a).toBe(b);
  });

  it('should throw on unresolved service', () => {
    expect(() => container.resolve('nonexistent')).toThrow(HexoError);
  });

  it('should throw on duplicate registration', () => {
    container.register('counter', () => ({ value: 0 }));
    expect(() => container.register('counter', () => ({ value: 0 }))).toThrow(HexoError);
  });

  it('should check if a service is registered', () => {
    container.register('counter', () => ({ value: 0 }));
    expect(container.has('counter')).toBe(true);
    expect(container.has('missing')).toBe(false);
  });

  it('should clear all registrations', () => {
    container.register('counter', () => ({ value: 0 }), { singleton: true });
    container.resolve('counter');
    container.clear();
    expect(container.has('counter')).toBe(false);
    expect(() => container.resolve('counter')).toThrow(HexoError);
  });
});
