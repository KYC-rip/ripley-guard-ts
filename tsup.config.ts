import { defineConfig } from 'tsup';

export default defineConfig({
  entry: [
    'src/index.ts',
    'src/core.ts',
    'src/http/express.ts',
    'src/http/hono.ts',
    'src/ws/relay.ts',
    'src/ws/adapter.ts',
    'src/ws/nostr.ts'
  ],
  format: ['cjs', 'esm'],
  dts: true,
  splitting: true,
  sourcemap: false,
  clean: true,
  minify: true
});