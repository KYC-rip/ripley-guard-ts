import { defineConfig } from 'tsup';

export default defineConfig({
  entry: [
    'src/express.ts',
    'src/hono.ts'
  ],
  format: ['cjs', 'esm'],
  dts: true,
  splitting: true,
  sourcemap: false,
  clean: true,
  minify: true
});