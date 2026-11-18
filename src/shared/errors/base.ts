/** Base error class with structured error codes and context. */

export type ErrorContext = Record<string, unknown>;

export interface HexoErrorOptions {
  code: string;
  message: string;
  context?: ErrorContext;
  cause?: Error;
}

export class HexoError extends Error {
  readonly code: string;
  readonly context: ErrorContext;

  constructor(options: HexoErrorOptions | string) {
    if (typeof options === 'string') {
      super(options);
      this.code = 'UNKNOWN';
      this.context = {};
    } else {
      super(options.message);
      this.code = options.code;
      this.context = options.context ?? {};
      if (options.cause) {
        this.cause = options.cause;
      }
    }
    Object.setPrototypeOf(this, HexoError.prototype);
  }
}
