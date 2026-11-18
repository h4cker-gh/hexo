import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';

/** Read all .ts files recursively in a directory. */
function readAllTsFiles(dir: string): string[] {
  const files: string[] = [];
  function walk(current: string) {
    const entries = fs.readdirSync(current, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name === '.git') continue;
        walk(full);
      } else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.d.ts')) {
        files.push(full);
      }
    }
  }
  walk(dir);
  return files;
}

describe('Architectural Rules', () => {
  const srcRoot = path.resolve(__dirname, '../../src');
  const allFiles = readAllTsFiles(srcRoot);

  /** Collect all source code from the given directory tree. */
  function collectCode(dir: string): string {
    return readAllTsFiles(dir).map(f => fs.readFileSync(f, 'utf-8')).join('\n');
  }

  describe('Module boundaries', () => {
    it('core must not import from infra', () => {
      const coreSrc = collectCode(path.join(srcRoot, 'core'));
      const violations = coreSrc.match(/from\s+['"]@infra\//g) || [];
      expect(violations).toHaveLength(0);
    });

    it('core must not import from features (app-level)', () => {
      const coreSrc = collectCode(path.join(srcRoot, 'core'));
      const violations = coreSrc.match(/from\s+['"]@features\//g) || [];
      expect(violations).toHaveLength(0);
    });

    it('core must not import from app', () => {
      const coreSrc = collectCode(path.join(srcRoot, 'core'));
      const violations = coreSrc.match(/from\s+['"]@app\//g) || [];
      expect(violations).toHaveLength(0);
    });

    it('shared must not import from core, infra, features, or app', () => {
      const sharedSrc = collectCode(path.join(srcRoot, 'shared'));
      const forbidden = ['@core/', '@infra/', '@features/', '@app/'];
      for (const pattern of forbidden) {
        const violations = sharedSrc.match(new RegExp(`from\\s+['"]${pattern}`)) || [];
        expect(violations, `shared must not import from ${pattern}`).toHaveLength(0);
      }
    });
  });

  describe('Coding standards', () => {
    it('must not use `any` type', () => {
      const allCode = collectCode(srcRoot);
      // Match `: any`, `= any`, `as any`, `<any>`, but not inside comments or strings
      const lines = allCode.split('\n');
      const violations: string[] = [];
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]?.trim() ?? '';
        if (line.startsWith('//') || line.startsWith('*') || line.startsWith('/*')) continue;
        // Skip lines that define the 'any' detection regex itself (false positive)
        if (line.includes('\\\\ban\\\\') || line.includes('if (/') || line.includes('.test(cleaned)')) continue;
        // Remove string literals and template literals to avoid false positives
        const cleaned = line.replace(/'[^']*'/g, '').replace(/"[^"]*"/g, '').replace(/`[^`]*`/g, '');
        if (/\ban\b|: any\b|:any\b|<any\b|\{ any\b|\[any\b|as any\b|\(any\b|any\b\s*\)/.test(cleaned)) {
          violations.push(`Line ${i + 1}: ${line.trim()}`);
        }
      }
      expect(violations, `No \`any\` type allowed. Violations:\n${violations.join('\n')}`).toHaveLength(0);
    });

    it('core must not have hardcoded command prefixes', () => {
      const coreSrc = collectCode(path.join(srcRoot, 'core'));
      // Check for common hardcoded prefix patterns in command-related code
      const prefixPatterns = [
        /['"]\/['"]/,    // "/" prefix
        /['"]@['"]/,     // "@" prefix
        /['"]#!['"]/,    // "#!" prefix
        /['"]\$['"]/,    // "$" prefix
      ];
      for (const pattern of prefixPatterns) {
        // Exclude string literals that are clearly not prefix definitions
        const matches = coreSrc.match(pattern);
        if (matches) {
          // Check if it's in a config/schema context (allowed) or in implementation code (not allowed)
          const ctx = coreSrc.substring(
            Math.max(0, coreSrc.indexOf(matches[0]) - 100),
            coreSrc.indexOf(matches[0]) + matches[0].length + 100
          );
          expect(ctx.toLowerCase().includes('schema') || ctx.toLowerCase().includes('config') || ctx.toLowerCase().includes('zod'),
            `Hardcoded prefix "${matches[0]}" found in core implementation: ${ctx.trim().substring(0, 80)}`).toBe(false);
        }
      }
    });
  });

  describe('TypeScript quality', () => {
    it('all source files should be readable', () => {
      const errors: string[] = [];
      for (const file of allFiles) {
        try {
          fs.readFileSync(file, 'utf-8');
        } catch {
          errors.push(file);
        }
      }
      expect(errors, `Failed to read files: ${errors.join(', ')}`).toHaveLength(0);
    });

    it('all barrel exports should re-export from concrete files', () => {
      const barrelFiles = allFiles.filter(f => f.endsWith('/index.ts'));
      for (const file of barrelFiles) {
        const content = fs.readFileSync(file, 'utf-8');
        const exports = content.match(/from\s+['"]\.\/([^'"]+)['"]/g) || [];
        for (const exp of exports) {
          const match = exp.match(/from\s+['"]\.\/([^'"]+)['"]/);
          if (match) {
            let resolvedPath = path.join(path.dirname(file), match[1]!);
            // Barrel exports use .js extensions but files are .ts
            if (!fs.existsSync(resolvedPath)) {
              resolvedPath = resolvedPath.replace(/\.js$/, '.ts');
            }
            expect(fs.existsSync(resolvedPath), `Barrel ${file} exports from non-existent file: ${resolvedPath}`).toBe(true);
          }
        }
      }
    });
  });
});
