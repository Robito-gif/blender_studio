const esbuild = require('esbuild');
const isProduction = process.argv.includes('--production');
const isWatch = process.argv.includes('--watch');

async function run() {
  const extensionBuild = {
    entryPoints: ['src/extension.ts'],
    bundle: true,
    outfile: 'dist/extension.js',
    external: ['vscode'],
    format: 'cjs',
    platform: 'node',
    target: 'node18',
    minify: isProduction,
    sourcemap: !isProduction,
    logLevel: 'info',
  };

  const webviewBuild = {
    entryPoints: ['src/webview/editor.ts'],
    bundle: true,
    outfile: 'dist/editor.js',
    format: 'iife',
    platform: 'browser',
    target: 'es2020',
    minify: isProduction,
    sourcemap: !isProduction,
    logLevel: 'info',
  };

  if (isWatch) {
    const extCtx = await esbuild.context(extensionBuild);
    const wvCtx = await esbuild.context(webviewBuild);
    await Promise.all([extCtx.watch(), wvCtx.watch()]);
  } else {
    await Promise.all([
      esbuild.build(extensionBuild),
      esbuild.build(webviewBuild),
    ]);
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
