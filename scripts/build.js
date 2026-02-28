#!/usr/bin/env node

/**
 * build.js
 * Compiles individual SCSS modules to separate CSS files.
 *
 * Output structure mirrors src/ in dist/:
 *   src/foundations/typography/ -> dist/foundations/typography.css
 *   src/tokens/               -> dist/tokens/primitives.css
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const SRC = path.join(__dirname, '..', 'src');
const DIST = path.join(__dirname, '..', 'dist');

const modules = [
  // Tokens
  { entry: 'tokens/_primitive.scss', output: 'tokens/primitives.css' },
  { entry: 'tokens/_semantic.scss', output: 'tokens/semantic.css' },

  // Foundations
  { entry: 'foundations/typography/_index.scss', output: 'foundations/typography.css' },
  { entry: 'foundations/colors/_index.scss', output: 'foundations/colors.css' },
  { entry: 'foundations/spacing/_index.scss', output: 'foundations/spacing.css' },
  { entry: 'foundations/layout/_index.scss', output: 'foundations/layout.css' },
  { entry: 'foundations/elevation/_index.scss', output: 'foundations/elevation.css' },
  { entry: 'foundations/borders/_index.scss', output: 'foundations/borders.css' },
  { entry: 'foundations/motion/_index.scss', output: 'foundations/motion.css' },

  // Components
  { entry: 'components/button/_index.scss', output: 'components/button.css' },
  { entry: 'components/card/_index.scss', output: 'components/card.css' },
  { entry: 'components/input/_index.scss', output: 'components/input.css' },
  { entry: 'components/modal/_index.scss', output: 'components/modal.css' },
  { entry: 'components/badge/_index.scss', output: 'components/badge.css' },
  { entry: 'components/radio/_index.scss', output: 'components/radio.css' },
  { entry: 'components/toggle/_index.scss', output: 'components/toggle.css' },
  { entry: 'components/tag/_index.scss', output: 'components/tag.css' },

  // Extensions
  { entry: 'extensions/inbox/_index.scss', output: 'extensions/inbox.css' },
  { entry: 'extensions/ai/_index.scss', output: 'extensions/ai.css' },
  { entry: 'extensions/notifications/_index.scss', output: 'extensions/notifications.css' },
  { entry: 'extensions/indicators/_index.scss', output: 'extensions/indicators.css' },

  // Themes
  { entry: 'themes/_theme-dark.scss', output: 'themes/dark.css' },

  // Utilities
  { entry: 'utilities/_index.scss', output: 'utilities.css' },
];

console.log('Building individual modules...\n');

let built = 0;
let skipped = 0;

for (const mod of modules) {
  const entryPath = path.join(SRC, mod.entry);
  const outputPath = path.join(DIST, mod.output);

  if (!fs.existsSync(entryPath)) {
    console.log(`  SKIP: ${mod.entry} (not found)`);
    skipped++;
    continue;
  }

  // Ensure output directory exists
  const outputDir = path.dirname(outputPath);
  fs.mkdirSync(outputDir, { recursive: true });

  try {
    execSync(`sass "${entryPath}" "${outputPath}" --style=expanded --no-source-map`, {
      stdio: 'pipe',
    });
    console.log(`  OK: ${mod.output}`);
    built++;
  } catch (err) {
    console.log(`  FAIL: ${mod.output} — ${err.stderr?.toString().trim() || err.message}`);
  }
}

// Generate combined token file
const primPath = path.join(DIST, 'tokens', 'primitives.css');
const semPath = path.join(DIST, 'tokens', 'semantic.css');
const allTokensPath = path.join(DIST, 'tokens', 'all-tokens.css');

if (fs.existsSync(primPath) && fs.existsSync(semPath)) {
  const combined = fs.readFileSync(primPath, 'utf8') + '\n' + fs.readFileSync(semPath, 'utf8');
  fs.writeFileSync(allTokensPath, combined);
  console.log(`  OK: tokens/all-tokens.css (combined)`);
}

// Generate combined extensions file
const extDir = path.join(DIST, 'extensions');
if (fs.existsSync(extDir)) {
  const extFiles = fs.readdirSync(extDir).filter(f => f.endsWith('.css') && f !== 'all-extensions.css');
  if (extFiles.length > 0) {
    const combined = extFiles.map(f => fs.readFileSync(path.join(extDir, f), 'utf8')).join('\n');
    fs.writeFileSync(path.join(extDir, 'all-extensions.css'), combined);
    console.log(`  OK: extensions/all-extensions.css (combined)`);
  }
}

console.log(`\nDone. Built: ${built}, Skipped: ${skipped}`);
