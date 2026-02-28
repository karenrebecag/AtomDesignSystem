#!/usr/bin/env node

/**
 * tokens-to-scss.js
 * Converts DTCG W3C 2025.10 design tokens to SCSS custom properties.
 *
 * Supports:
 *   - $value / $type / $description (DTCG format)
 *   - dimension objects: { value: 8, unit: "px" } → "8px"
 *   - duration objects:  { value: 150, unit: "ms" } → "150ms"
 *   - cubicBezier arrays: [0.4, 0, 1, 1] → "cubic-bezier(0.4, 0, 1, 1)"
 *   - shadow composites: { offsetX, offsetY, blur, spread, color } → CSS shadow
 *   - color hex strings: pass through
 *   - fontFamily strings: pass through
 *   - fontWeight numbers: pass through
 *   - Token references: {color.zinc.900} → var(--atom-color-zinc-900)
 *
 * Input:  tokens/global/*.tokens.json, tokens/semantic/*.tokens.json
 * Output: src/tokens/_primitive.scss, src/tokens/_semantic.scss
 */

const fs = require('fs');
const path = require('path');

const TOKENS_DIR = path.join(__dirname, '..', 'tokens');
const OUTPUT_DIR = path.join(__dirname, '..', 'src', 'tokens');
const PREFIX = 'atom';

// ── Value Conversion ──────────────────────────────────────

/**
 * Extract the token value (DTCG $value or legacy value).
 */
function extractValue(token) {
  if (token.$value !== undefined) return token.$value;
  if (token.value !== undefined) return token.value;
  return null;
}

/**
 * Convert a dimension object to CSS string.
 * { value: 8, unit: "px" } → "8px"
 */
function dimensionToCss(dim) {
  if (typeof dim === 'string') return dim;
  if (dim && typeof dim === 'object' && dim.value !== undefined && dim.unit) {
    return `${dim.value}${dim.unit}`;
  }
  return String(dim);
}

/**
 * Convert a cubicBezier array to CSS.
 * [0.4, 0, 1, 1] → "cubic-bezier(0.4, 0, 1, 1)"
 */
function cubicBezierToCss(arr) {
  if (Array.isArray(arr) && arr.length === 4) {
    return `cubic-bezier(${arr.join(', ')})`;
  }
  return String(arr);
}

/**
 * Convert a single shadow object to CSS.
 * { offsetX, offsetY, blur, spread, color } → "0px 1px 2px 0px rgba(...)"
 */
function singleShadowToCss(s) {
  const ox = dimensionToCss(s.offsetX);
  const oy = dimensionToCss(s.offsetY);
  const bl = dimensionToCss(s.blur);
  const sp = dimensionToCss(s.spread);
  return `${ox} ${oy} ${bl} ${sp} ${s.color}`;
}

/**
 * Convert a shadow value (single or array) to CSS.
 */
function shadowToCss(val) {
  if (Array.isArray(val)) {
    return val.map(singleShadowToCss).join(', ');
  }
  return singleShadowToCss(val);
}

/**
 * Convert any DTCG token value to a CSS string based on resolved type.
 */
function valueToCss(val, type) {
  if (val === null || val === undefined) return null;

  // String or number — pass through
  if (typeof val === 'string') return val;
  if (typeof val === 'number') return String(val);

  // Array — could be cubicBezier or shadow array
  if (Array.isArray(val)) {
    if (type === 'cubicBezier') return cubicBezierToCss(val);
    if (type === 'shadow') return shadowToCss(val);
    return String(val);
  }

  // Object — could be dimension, duration, or shadow
  if (typeof val === 'object') {
    if (val.value !== undefined && val.unit !== undefined) {
      return dimensionToCss(val); // dimension or duration
    }
    if (val.offsetX !== undefined) {
      return singleShadowToCss(val); // single shadow
    }
    return JSON.stringify(val);
  }

  return String(val);
}

// ── Token Flattening ──────────────────────────────────────

/**
 * Recursively flatten a token tree into { key: cssValue } pairs.
 * Resolves $type inheritance from parent groups.
 */
function flattenTokens(obj, parentKey = '', parentType = null) {
  const result = {};

  for (const [key, value] of Object.entries(obj)) {
    // Skip DTCG metadata
    if (key.startsWith('$')) continue;

    const newKey = parentKey ? `${parentKey}-${key}` : key;

    // Determine type (local $type overrides parent)
    const localType = (value && value.$type) || parentType;

    // Check if this is a token (has $value or legacy value)
    const tokenValue = typeof value === 'object' ? extractValue(value) : null;

    if (tokenValue !== null) {
      const css = valueToCss(tokenValue, localType);
      if (css !== null) {
        result[newKey] = css;
      }
    } else if (value && typeof value === 'object') {
      // It's a group — recurse
      Object.assign(result, flattenTokens(value, newKey, localType));
    }
  }

  return result;
}

// ── Reference Resolution ──────────────────────────────────

/**
 * Convert token references {path.to.token} to var(--atom-path-to-token).
 */
function resolveReferences(cssValue) {
  if (typeof cssValue !== 'string') return cssValue;
  return cssValue.replace(/\{([^}]+)\}/g, (_, ref) => {
    return `var(--${PREFIX}-${ref.replace(/\./g, '-')})`;
  });
}

// ── Generators ────────────────────────────────────────────

function generatePrimitives() {
  const files = [
    'colors.tokens.json',
    'typography.tokens.json',
    'spacing.tokens.json',
    'borders.tokens.json',
    'shadows.tokens.json',
    'motion.tokens.json',
    'breakpoints.tokens.json',
  ];

  let output = `// ============================================\n`;
  output += `// Tier 1: Primitive Tokens (auto-generated)\n`;
  output += `// DO NOT EDIT — run: npm run tokens\n`;
  output += `// Source: DTCG W3C 2025.10 format\n`;
  output += `// ============================================\n\n`;
  output += `:root {\n`;

  for (const file of files) {
    const filePath = path.join(TOKENS_DIR, 'global', file);
    if (!fs.existsSync(filePath)) continue;

    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    const category = file.replace('.tokens.json', '');
    const tokens = flattenTokens(data);

    if (Object.keys(tokens).length === 0) continue;

    output += `  // ${category}\n`;
    for (const [key, value] of Object.entries(tokens)) {
      const varName = `--${PREFIX}-${key}`;
      output += `  ${varName}: ${value};\n`;
    }
    output += `\n`;
  }

  output += `}\n`;

  fs.writeFileSync(path.join(OUTPUT_DIR, '_primitive.scss'), output);
  console.log('  Generated: src/tokens/_primitive.scss');
}

function generateSemantics() {
  // ── Light theme (default) ──
  const lightPath = path.join(TOKENS_DIR, 'semantic', 'colors.tokens.json');
  let output = `// ============================================\n`;
  output += `// Tier 2: Semantic Tokens (auto-generated)\n`;
  output += `// DO NOT EDIT — run: npm run tokens\n`;
  output += `// Source: DTCG W3C 2025.10 format\n`;
  output += `// ============================================\n\n`;

  if (fs.existsSync(lightPath)) {
    const data = JSON.parse(fs.readFileSync(lightPath, 'utf8'));

    if (data.light) {
      output += `:root {\n`;
      const tokens = flattenTokens(data.light);
      for (const [key, value] of Object.entries(tokens)) {
        const varName = `--${PREFIX}-${key}`;
        const cssValue = resolveReferences(value);
        output += `  ${varName}: ${cssValue};\n`;
      }
      output += `}\n\n`;
    }
  }

  // ── Dark theme ──
  const darkPath = path.join(TOKENS_DIR, 'semantic', 'colors.dark.tokens.json');
  if (fs.existsSync(darkPath)) {
    const data = JSON.parse(fs.readFileSync(darkPath, 'utf8'));

    if (data.dark) {
      output += `[data-theme='dark'],\n.atom-theme-dark {\n`;
      const tokens = flattenTokens(data.dark);
      for (const [key, value] of Object.entries(tokens)) {
        const varName = `--${PREFIX}-${key}`;
        const cssValue = resolveReferences(value);
        output += `  ${varName}: ${cssValue};\n`;
      }
      output += `}\n\n`;
    }
  }

  fs.writeFileSync(path.join(OUTPUT_DIR, '_semantic.scss'), output);
  console.log('  Generated: src/tokens/_semantic.scss');
}

// ── Main ──────────────────────────────────────────────────

console.log('Generating SCSS tokens from DTCG JSON...');
generatePrimitives();
generateSemantics();
console.log('Done.');
