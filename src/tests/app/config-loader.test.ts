import { afterEach, describe, it, expect } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadConfig } from '@app/config.js';

const directories: string[] = [];

afterEach(() => {
  for (const directory of directories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe('loadConfig', () => {
  it('parses nested sections, lists, and defaults', () => {
    const directory = mkdtempSync(join(tmpdir(), 'hexobot-config-'));
    directories.push(directory);
    const path = join(directory, 'config.yml');

    writeFileSync(
      path,
      [
        'bot:',
        '  name: TestBot',
        '  prefix: "!"',
        '  agent: test',
        '  adminJids: ["5511999999999@s.whatsapp.net"]',
        'logger:',
        '  level: debug',
        'server:',
        '  enabled: true',
        '  port: 3123',
        '  corsOrigins:',
        '    - http://localhost:5173',
        '    - http://127.0.0.1:5173',
        'whatsapp:',
        '  sessionDir: ./tmp-session',
        '  printQRInTerminal: true',
        'features:',
        '  ping:',
        '    enabled: true',
        '    config:',
        '      timeout: 5000',
      ].join('\n'),
    );

    const config = loadConfig(path);

    expect(config.bot.name).toBe('TestBot');
    expect(config.bot.adminJids).toEqual(['5511999999999@s.whatsapp.net']);
    expect(config.logger.level).toBe('debug');
    expect(config.server.port).toBe(3123);
    expect(config.server.corsOrigins).toEqual([
      'http://localhost:5173',
      'http://127.0.0.1:5173',
    ]);
    expect(config.whatsapp.sessionDir).toBe('./tmp-session');
    expect(config.whatsapp.printQRInTerminal).toBe(true);
    expect(config.whatsapp.autoReconnect).toBe(true);
    expect(config.features['ping']?.enabled).toBe(true);
  });
});
