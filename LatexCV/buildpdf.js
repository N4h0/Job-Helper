#!/usr/bin/env node
// buildPdf.js
// Simple script to compile the main CV LaTeX file into PDF, suppressing locale and latexmk noise

import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
// Paths
const mainTex = join(__dirname, 'cv.tex');
const errorLog = join(__dirname, 'builderrors.txt');

// Ensure cv.tex exists
if (!fs.existsSync(mainTex)) {
  const msg = `❌ cv.tex not found at ${mainTex}`;
  fs.writeFileSync(errorLog, msg, 'utf-8');
  console.error(msg);
  process.exit(1);
}

try {
  console.log('🔨 Building cv.pdf with latexmk...');
  // Run latexmk quietly, suppressing outputs
  execSync('latexmk -pdf -silent cv.tex', {
    cwd: __dirname,
    env: { ...process.env, LC_ALL: 'C', LANG: 'C' },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  console.log('✅ Successfully built cv.pdf');
} catch (error) {
  // Write error details to builderrors.txt, overwriting any existing file
  const errOutput = (error.stderr ? error.stderr.toString() : error.message);
  fs.writeFileSync(errorLog, errOutput, 'utf-8');
  console.error(`❌ LaTeX build failed: see ${errorLog} for details`);
  process.exit(error.status || 1);
}
