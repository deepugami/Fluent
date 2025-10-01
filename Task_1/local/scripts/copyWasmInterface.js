// Copies the gblend-generated interface to a stable import path if needed.
// With our layout, Hardhat imports ../../out/PowerCalculator.wasm/interface.sol directly.
// This script is optional; it shows how you could flatten the path if desired.

const fs = require('fs');
const path = require('path');

const src = path.join(__dirname, '..', 'out', 'PowerCalculator.wasm', 'interface.sol');
const destDir = path.join(__dirname, '..', 'out');
const dest = path.join(destDir, 'IPowerCalculator.sol');

if (!fs.existsSync(src)) {
  console.error('Missing interface at', src, '\nRun `gblend build` first.');
  process.exit(1);
}

if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });

fs.copyFileSync(src, dest);
console.log('Copied interface to', dest);
