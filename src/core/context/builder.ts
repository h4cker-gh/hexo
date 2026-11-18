/** Context builder for constructing UniversalContext instances. */

import type { UniversalContext, ContextUser, ContextChannel, ContextMention } from './types.js';

/** Builder for constructing UniversalContext objects. */
export interface ContextBuilder {
  build(
    user: ContextUser,
    channel: ContextChannel,
    input: string,
    parsedArgs: string[],
    platform: string,
    raw?: unknown,
    mentions?: ContextMention[],
  ): UniversalContext;
}

/** Default context builder implementation. */
export class DefaultContextBuilder implements ContextBuilder {
  build(
    user: ContextUser,
    channel: ContextChannel,
    input: string,
    parsedArgs: string[],
    platform: string,
    raw?: unknown,
    mentions: ContextMention[] = [],
  ): UniversalContext {
    return {
      id: crypto.randomUUID(),
      timestamp: new Date(),
      user,
      channel,
      input,
      parsedArgs,
      platform,
      raw,
      variables: new Map(),
      mentions,
    };
  }
}
