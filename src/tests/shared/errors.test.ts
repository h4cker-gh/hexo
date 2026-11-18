import { describe, it, expect } from 'vitest';
import { HexoError } from '@shared/errors/base.js';

describe('HexoError', () => {
  it('should set code and message from options', () => {
    const err = new HexoError({ code: 'TEST_ERR', message: 'test message' });
    expect(err.code).toBe('TEST_ERR');
    expect(err.message).toBe('test message');
    expect(err.context).toEqual({});
  });

  it('should set context when provided', () => {
    const err = new HexoError({ code: 'TEST_ERR', message: 'msg', context: { key: 'val' } });
    expect(err.context).toEqual({ key: 'val' });
  });

  it('should set cause when provided', () => {
    const cause = new Error('original');
    const err = new HexoError({ code: 'TEST_ERR', message: 'msg', cause });
    expect(err.cause).toBe(cause);
  });

  it('should work with string constructor', () => {
    const err = new HexoError('simple error');
    expect(err.message).toBe('simple error');
    expect(err.code).toBe('UNKNOWN');
    expect(err.context).toEqual({});
  });

  it('should have correct prototype', () => {
    const err = new HexoError({ code: 'X', message: 'y' });
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(HexoError);
  });
});
