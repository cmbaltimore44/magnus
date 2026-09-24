import * as esbuild from 'esbuild';

// Bundles only Magnus's own source (JSX -> JS); every npm package stays an
// external import resolved from node_modules at runtime.
const options = {
  entryPoints: ['src/cli.jsx'],
  outfile: 'dist/cli.js',
  bundle: true,
  packages: 'external',
  platform: 'node',
  format: 'esm',
  target: 'node20',
  jsx: 'automatic',
  sourcemap: 'linked',
  logLevel: 'info',
};

if (process.argv.includes('--watch')) {
  const ctx = await esbuild.context(options);
  await ctx.watch();
} else {
  await esbuild.build(options);
}
