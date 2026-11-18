import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/app/index.ts', 'src/app/main.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  sourcemap: true,
  clean: true,
  outDir: 'dist/app',
  tsconfig: './tsconfig.json',
  external: [
    '@whiskeysockets/baileys',
    'fastify',
    '@fastify/cors',
    '@fastify/static',
  ],
});
