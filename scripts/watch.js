#!/usr/bin/env node

/**
 * watch.js
 * Watches src/ and tokens/ for changes, triggers rebuild.
 */

const { execSync } = require('child_process');
const chokidar = require('chokidar');
const path = require('path');

const SRC = path.join(__dirname, '..', 'src');
const TOKENS = path.join(__dirname, '..', 'tokens');

let building = false;

function rebuild(changedFile) {
  if (building) return;
  building = true;

  const relative = path.relative(path.join(__dirname, '..'), changedFile);
  console.log(`\nChanged: ${relative}`);

  try {
    // If tokens changed, regenerate SCSS first
    if (changedFile.startsWith(TOKENS)) {
      console.log('Regenerating tokens...');
      execSync('npm run tokens', { cwd: path.join(__dirname, '..'), stdio: 'inherit' });
    }

    console.log('Building core...');
    execSync('npm run build:core', { cwd: path.join(__dirname, '..'), stdio: 'inherit' });
    console.log('Build complete.');
  } catch (err) {
    console.error('Build failed:', err.message);
  }

  building = false;
}

console.log('Watching for changes...');
console.log(`  src/    -> ${SRC}`);
console.log(`  tokens/ -> ${TOKENS}`);
console.log('');

const watcher = chokidar.watch([`${SRC}/**/*.scss`, `${TOKENS}/**/*.json`], {
  ignoreInitial: true,
  awaitWriteFinish: { stabilityThreshold: 300 },
});

watcher.on('change', rebuild);
watcher.on('add', rebuild);
