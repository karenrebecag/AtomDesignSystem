#!/usr/bin/env node

/**
 * tokens-to-scss.js
 * Converts JSON design tokens to SCSS custom properties.
 *
 * Input:  tokens/global/*.json, tokens/semantic/*.json
 * Output: src/tokens/_primitive.scss, src/tokens/_semantic.scss
 */

const fs = require('fs');
const path = require('path');

const TOKENS_DIR = path.join(__dirname, '..', 'tokens');
const OUTPUT_DIR = path.join(__dirname, '..', 'src', 'tokens');
const PREFIX = 'atom';

// Flatten nested JSON to CSS variable format
function flattenTokens(obj, parentKey = '') {
  const result = {};
  for (const [key, value] of Object.entries(obj)) {
    const newKey = parentKey ? `${parentKey}-${key}` : key;
    if (value && typeof value === 'object' && 'value' in value) {
      result[newKey] = value.value;
    } else if (value && typeof value === 'object') {
      Object.assign(result, flattenTokens(value, newKey));
    }
  }
  return result;
}

// Generate CSS custom properties
function generatePrimitives() {
  const files = ['colors.json', 'typography.json', 'spacing.json'];
  let output = `// ============================================\n`;
  output += `// Tier 1: Primitive Tokens (auto-generated)\n`;
  output += `// DO NOT EDIT — run: npm run tokens\n`;
  output += `// ============================================\n\n`;
  output += `:root {\n`;

  for (const file of files) {
    const filePath = path.join(TOKENS_DIR, 'global', file);
    if (!fs.existsSync(filePath)) continue;

    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    const category = path.basename(file, '.json');
    const tokens = flattenTokens(data);

    output += `  // ${category}\n`;
    for (const [key, value] of Object.entries(tokens)) {
      if (key.startsWith('$')) continue; // skip $description
      const varName = `--${PREFIX}-${key}`;
      output += `  ${varName}: ${value};\n`;
    }
    output += `\n`;
  }

  output += `}\n`;

  fs.writeFileSync(path.join(OUTPUT_DIR, '_primitive.scss'), output);
  console.log('  Generated: src/tokens/_primitive.scss');
}

// Generate semantic tokens
function generateSemantics() {
  const filePath = path.join(TOKENS_DIR, 'semantic', 'colors.json');
  if (!fs.existsSync(filePath)) {
    console.log('  Skipped: semantic/colors.json (not found)');
    return;
  }

  const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  let output = `// ============================================\n`;
  output += `// Tier 2: Semantic Tokens (auto-generated)\n`;
  output += `// DO NOT EDIT — run: npm run tokens\n`;
  output += `// ============================================\n\n`;

  // Light theme (default)
  if (data.light) {
    output += `:root {\n`;
    const tokens = flattenTokens(data.light);
    for (const [key, value] of Object.entries(tokens)) {
      if (key.startsWith('$')) continue;
      const varName = `--${PREFIX}-${key}`;
      // Convert token references {color.zinc.900} to var(--atom-color-zinc-900)
      const cssValue = value.replace(/\{([^}]+)\}/g, (_, ref) => {
        return `var(--${PREFIX}-${ref.replace(/\./g, '-')})`;
      });
      output += `  ${varName}: ${cssValue};\n`;
    }
    output += `}\n\n`;
  }

  fs.writeFileSync(path.join(OUTPUT_DIR, '_semantic.scss'), output);
  console.log('  Generated: src/tokens/_semantic.scss');
}

console.log('Generating SCSS tokens from JSON...');
generatePrimitives();
generateSemantics();
console.log('Done.');
