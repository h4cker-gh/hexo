import { describe, it, expect } from 'vitest';
import type { GroupMetadata, WAMessage, WAMessageKey } from '@whiskeysockets/baileys';
import { EventTransformer, resolveSenderJid } from '@infra/whatsapp/event-transformer.js';
import {
  attachOutgoingMentions,
  buildParticipantIndex,
  normalizeIncomingMentions,
} from '@infra/whatsapp/message-normalizer.js';
import { DefaultContextBuilder } from '@core/context/builder.js';
import type { UniversalContext } from '@core/context/types.js';
import { buildTestLogger } from '../fixtures.js';

const GROUP_JID = '120363000000000000@g.us';
const BOT_JID = '5599999999999@s.whatsapp.net';

function buildGroupMetadata(): GroupMetadata {
  return {
    id: GROUP_JID,
    addressingMode: 'pn',
    owner: undefined,
    subject: 'Test group',
    participants: [
      {
        id: '111@lid',
        lid: '111@lid',
        jid: '5511111111111@s.whatsapp.net',
        notify: 'Clara',
      },
      {
        id: '222@s.whatsapp.net',
        jid: '5522222222222@s.whatsapp.net',
        name: 'Bob',
      },
    ],
  };
}

describe('resolveSenderJid', () => {
  it('prefers participantPn for group messages', () => {
    const key: WAMessageKey = {
      remoteJid: GROUP_JID,
      participantPn: '5511111111111:3@s.whatsapp.net',
      participant: '111@lid',
      senderPn: '5588888888888@s.whatsapp.net',
    };

    const result = resolveSenderJid(key, GROUP_JID, true, BOT_JID);
    expect(result).toEqual({ jid: '5511111111111@s.whatsapp.net', own: false });
  });

  it('falls back to participant for group messages', () => {
    const key: WAMessageKey = { remoteJid: GROUP_JID, participant: '111@lid' };
    expect(resolveSenderJid(key, GROUP_JID, true, BOT_JID)).toEqual({
      jid: '111@lid',
      own: false,
    });
  });

  it('prefers senderPn for DMs and strips device suffixes', () => {
    const key: WAMessageKey = {
      remoteJid: '111@lid',
      senderPn: '5511111111111:4@s.whatsapp.net',
      senderLid: '111@lid',
    };

    expect(resolveSenderJid(key, '111@lid', false, BOT_JID)).toEqual({
      jid: '5511111111111@s.whatsapp.net',
      own: false,
    });
  });

  it('falls back to remoteJid for DMs', () => {
    const key: WAMessageKey = { remoteJid: '111@lid' };
    expect(resolveSenderJid(key, '111@lid', false, BOT_JID)).toEqual({
      jid: '111@lid',
      own: false,
    });
  });

  it('uses the bot JID for fromMe messages', () => {
    const key: WAMessageKey = {
      remoteJid: GROUP_JID,
      fromMe: true,
      participant: '111@lid',
      senderLid: '333@lid',
      senderPn: '5577777777777@s.whatsapp.net',
    };

    expect(resolveSenderJid(key, GROUP_JID, true, BOT_JID)).toEqual({
      jid: BOT_JID,
      own: true,
    });
  });

  it('treats messages from the bot JID as own', () => {
    const key: WAMessageKey = {
      remoteJid: BOT_JID,
      senderPn: '5599999999999:2@s.whatsapp.net',
    };

    const result = resolveSenderJid(key, BOT_JID, false, BOT_JID);
    expect(result.own).toBe(true);
    expect(result.jid).toBe(BOT_JID);
  });

  it('converts bare numeric PNs to user JIDs', () => {
    const dmKey: WAMessageKey = { remoteJid: '111@lid', senderPn: '5511111111111' };
    expect(resolveSenderJid(dmKey, '111@lid', false, BOT_JID)).toEqual({
      jid: '5511111111111@s.whatsapp.net',
      own: false,
    });

    const groupKey: WAMessageKey = { remoteJid: GROUP_JID, participantPn: '5511111111111' };
    expect(resolveSenderJid(groupKey, GROUP_JID, true, BOT_JID)).toEqual({
      jid: '5511111111111@s.whatsapp.net',
      own: false,
    });
  });
});

describe('normalizeIncomingMentions', () => {
  it('resolves LID then PN and rewrites text', () => {
    const index = buildParticipantIndex(buildGroupMetadata());
    const result = normalizeIncomingMentions({
      text: 'hi @111 and @5522222222222',
      mentionedJids: ['111@lid'],
      index,
    });

    expect(result.text).toBe('hi @Clara and @Bob');
    expect(result.mentions).toEqual([
      {
        jid: '5511111111111@s.whatsapp.net',
        name: 'Clara',
        phoneNumber: '5511111111111',
      },
      {
        jid: '5522222222222@s.whatsapp.net',
        name: 'Bob',
        phoneNumber: '5522222222222',
      },
    ]);
  });

  it('leaves unresolved tokens untouched', () => {
    const index = buildParticipantIndex(buildGroupMetadata());
    const result = normalizeIncomingMentions({
      text: 'hello @999',
      mentionedJids: [],
      index,
    });

    expect(result.text).toBe('hello @999');
    expect(result.mentions).toEqual([]);
  });

  it('maps DM mentioned JIDs without group metadata', () => {
    const result = normalizeIncomingMentions({
      text: 'hello @123',
      mentionedJids: ['123:4@s.whatsapp.net'],
    });

    expect(result.mentions).toEqual([
      { jid: '123@s.whatsapp.net', name: '123' },
    ]);
  });

  it('only resolves DM tokens present in mentionedJid', () => {
    const result = normalizeIncomingMentions({
      text: 'hello @123 and @456',
      mentionedJids: ['123@s.whatsapp.net'],
    });

    expect(result.mentions).toHaveLength(1);
    expect(result.mentions[0]?.jid).toBe('123@s.whatsapp.net');
  });
});

describe('attachOutgoingMentions', () => {
  it('rebuilds tokens from phoneNumber or JID digits', () => {
    const result = attachOutgoingMentions('hey @Clara and @Bob', [
      { jid: '5511111111111@s.whatsapp.net', name: 'Clara', phoneNumber: '5511111111111' },
      { jid: '5522222222222:9@s.whatsapp.net', name: 'Bob' },
    ]);

    expect(result.text).toBe('hey @5511111111111 and @5522222222222');
    expect(result.mentionedJid).toEqual([
      '5511111111111@s.whatsapp.net',
      '5522222222222:9@s.whatsapp.net',
    ]);
  });

  it('forwards mentions even when text does not contain names', () => {
    const result = attachOutgoingMentions('hello', [
      { jid: '5511111111111@s.whatsapp.net', name: 'Clara' },
    ]);

    expect(result.text).toBe('hello');
    expect(result.mentionedJid).toEqual(['5511111111111@s.whatsapp.net']);
  });
});

describe('EventTransformer identity', () => {
  it('builds group context from the chat id and resolved sender', async () => {
    const received: UniversalContext[] = [];
    const logger = buildTestLogger();
    const transformer = new EventTransformer({
      botJid: BOT_JID,
      contextBuilder: new DefaultContextBuilder(),
      logger,
      groupMetadataProvider: async () => buildGroupMetadata(),
      onContext: (context) => {
        received.push(context);
      },
    });

    const message: WAMessage = {
      key: {
        remoteJid: GROUP_JID,
        id: 'msg-1',
        participantPn: '5511111111111@s.whatsapp.net',
        participant: '111@lid',
      },
      message: {
        extendedTextMessage: {
          text: 'hello @111',
          contextInfo: { mentionedJid: ['111@lid'] },
        },
      },
      pushName: 'Clara Push',
    };

    await transformer.handleMessages([message]);

    expect(received).toHaveLength(1);
    const context = received[0];
    if (!context) throw new Error('Expected context to be dispatched');

    expect(context.channel.id).toBe(GROUP_JID);
    expect(context.channel.type).toBe('group');
    expect(context.channel.name).toBe('Test group');
    expect(context.user.id).toBe('5511111111111@s.whatsapp.net');
    expect(context.channel.participantPN).toBe('5511111111111');
    expect(context.user.name).toBe('Clara Push');
    expect(context.input).toBe('hello @Clara');
    expect(context.mentions).toEqual([
      {
        jid: '5511111111111@s.whatsapp.net',
        name: 'Clara',
        phoneNumber: '5511111111111',
      },
    ]);
  });

  it('processes own messages and logs at info', async () => {
    const received: UniversalContext[] = [];
    const logger = buildTestLogger();
    const transformer = new EventTransformer({
      botJid: BOT_JID,
      contextBuilder: new DefaultContextBuilder(),
      logger,
      onContext: (context) => {
        received.push(context);
      },
    });

    const message: WAMessage = {
      key: {
        remoteJid: '111@lid',
        id: 'msg-own',
        fromMe: true,
        participant: '111@lid',
      },
      message: { conversation: 'my own message' },
    };

    await transformer.handleMessages([message]);

    // Bot always processes own messages (group echo, self-reminder, etc.)
    expect(received).toHaveLength(1);
    expect(received[0]?.user.id).toBe(BOT_JID);
    expect(logger.getAtLevel('info').some((entry) => entry.message === 'Received message')).toBe(true);
  });

  it('keeps dispatching when group metadata lookup fails', async () => {
    const received: UniversalContext[] = [];
    const logger = buildTestLogger();
    const transformer = new EventTransformer({
      botJid: BOT_JID,
      contextBuilder: new DefaultContextBuilder(),
      logger,
      groupMetadataProvider: async () => {
        throw new Error('metadata unavailable');
      },
      onContext: (context) => {
        received.push(context);
      },
    });

    const message: WAMessage = {
      key: {
        remoteJid: GROUP_JID,
        id: 'msg-2',
        participantPn: '5511111111111@s.whatsapp.net',
      },
      message: { conversation: 'hello' },
    };

    await transformer.handleMessages([message]);

    expect(received).toHaveLength(1);
    expect(received[0]?.channel.type).toBe('group');
    expect(logger.getAtLevel('warn').some((entry) => entry.message === 'Failed to fetch group metadata')).toBe(true);
  });
});
