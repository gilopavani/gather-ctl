import { build, context } from 'esbuild';
import fs from 'node:fs';

const banner = fs.readFileSync('src/header.txt', 'utf8');

const opts = {
  entryPoints: ['src/main.js'],
  bundle: true,
  outfile: 'dist/gather-ctl.user.js',
  banner: { js: banner },
  format: 'iife',
  target: 'es2022',
  loader: { '.css': 'text', '.html': 'text' },
  legalComments: 'none',
  logLevel: 'info',
};

if (process.argv.includes('--watch')) {
  const ctx = await context(opts);
  await ctx.watch();
  console.log('[build] watching src/...');
} else {
  await build(opts);
  console.log('[build] dist/gather-ctl.user.js');
}
