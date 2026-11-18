import { describe, it, expect, beforeEach } from 'vitest';
import { CommandRegistry } from '@core/commands/registry.js';
import { buildTestContext, buildTestCommand, buildTestLogger } from '../fixtures.js';
import { HexoError } from '@shared/errors/base.js';

describe('CommandRegistry', () => {
  let registry: CommandRegistry;

  beforeEach(() => {
    registry = new CommandRegistry();
  });

  it('should register and resolve a command', () => {
    const cmd = buildTestCommand({ name: 'ping', aliases: ['p'] });
    registry.register(cmd);
    expect(registry.has('ping')).toBe(true);
    expect(registry.has('p')).toBe(true);
    expect(registry.resolve('ping')).toBeDefined();
    expect(registry.resolve('p')).toBeDefined();
  });

  it('should throw on duplicate command name', () => {
    registry.register(buildTestCommand({ name: 'ping' }));
    expect(() => registry.register(buildTestCommand({ name: 'ping' }))).toThrow(HexoError);
  });

  it('should throw on duplicate alias', () => {
    registry.register(buildTestCommand({ name: 'ping', aliases: ['p'] }));
    expect(() => registry.register(buildTestCommand({ name: 'pong', aliases: ['p'] }))).toThrow(HexoError);
  });

  it('should return undefined for unknown command', () => {
    expect(registry.resolve('unknown')).toBeUndefined();
  });

  it('should list registered commands', () => {
    registry.register(buildTestCommand({ name: 'ping' }));
    registry.register(buildTestCommand({ name: 'pong' }));
    expect(registry.list()).toEqual(['ping', 'pong']);
  });

  it('should execute a command handler', async () => {
    let called = false;
    registry.register(buildTestCommand({
      name: 'echo',
      handler: async () => { called = true; return { type: 'text', content: 'hello' }; },
    }));
    const result = await registry.execute('echo', buildTestContext(), buildTestLogger());
    expect(called).toBe(true);
    expect(result).toEqual({ type: 'text', content: 'hello' });
  });

  it('should return error for unknown command', async () => {
    const result = await registry.execute('nope', buildTestContext(), buildTestLogger());
    expect(result.type).toBe('error');
    expect((result as { code?: string }).code).toBe('UNKNOWN_COMMAND');
  });

  it('should return error for disabled command', async () => {
    registry.register(buildTestCommand({ name: 'off', enabled: false }));
    const result = await registry.execute('off', buildTestContext(), buildTestLogger());
    expect(result.type).toBe('error');
  });

  it('should return error for insufficient args', async () => {
    registry.register(buildTestCommand({ name: 'greet', minArgs: 1 }));
    const ctx = buildTestContext({ parsedArgs: [] });
    const result = await registry.execute('greet', ctx, buildTestLogger());
    expect(result.type).toBe('error');
  });

  it('should return error for too many args', async () => {
    registry.register(buildTestCommand({ name: 'greet', maxArgs: 1 }));
    const ctx = buildTestContext({ parsedArgs: ['a', 'b'] });
    const result = await registry.execute('greet', ctx, buildTestLogger());
    expect(result.type).toBe('error');
  });
});
