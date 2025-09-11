## Beginner’s Guide: Blend a Hardhat project with a Rust/WASM contract using gblend

This guide shows how to take an existing Hardhat (Solidity) project and make it “blended” by integrating a Rust/WASM contract compiled with gblend. You will:

- Build a Rust/WASM contract using gblend
- Deploy the WASM contract to Fluent Testnet
- Import the generated Solidity interface in a wrapper contract
- Deploy the Solidity wrapper with Hardhat
- Call the wrapper from a simple Node script

The focus is on Hardhat + gblend usage, not on writing the Rust or Solidity logic itself.

---

### What you’ll build

We’ll use a simple example: a Rust/WASM contract that exposes `power(uint256 base, uint256 exponent)`. gblend generates a Solidity interface for it (e.g. `IPowerCalculator`) that we can import into a Solidity wrapper. Then we deploy and call it end-to-end.

---

## Prerequisites

- Node.js LTS + npm
- Hardhat in your project (we’ll install the necessary deps below)
- Rust toolchain (via rustup)
- Foundry (forge, cast)
- gblend CLI
- RPC URL for Fluent Testnet

Make sure you have a private key with testnet funds. Keep secrets in a local `.env` file.

Example `.env` (do not commit):

```bash
RPC_URL=https://rpc.testnet.fluent.xyz
PRIVATE_KEY=0xYOUR_PRIVATE_KEY
# Set after deploying WASM
WASM_ADDRESS=0x...
```

---

## 1) Install Hardhat dependencies (in your existing project)

From your project root:

```bash
npm install --save-dev hardhat @nomiclabs/hardhat-ethers ethers dotenv
```

Create or update `hardhat.config.js` (CommonJS is the simplest path):

```js
require('dotenv').config();
require('@nomiclabs/hardhat-ethers');

const RPC_URL = process.env.RPC_URL || 'https://rpc.testnet.fluent.xyz';
const PRIVATE_KEY = process.env.PRIVATE_KEY || '';

module.exports = {
  solidity: '0.8.19',
  networks: {
    fluentTestnet: {
      url: RPC_URL,
      chainId: 20994,
      accounts: PRIVATE_KEY ? [PRIVATE_KEY] : []
    }
  },
  paths: {
    sources: './contracts',
    artifacts: './artifacts',
    tests: './test'
  }
};
```

---

## 2) Build the Rust/WASM with gblend

Run the build from your project root (where your gblend project is initialized):

```bash
gblend build
```

You should see outputs like:

```
out/
  PowerCalculator.wasm/
    lib.wasm
    interface.sol
    abi.json
    metadata.json
  interface.sol/
    IPowerCalculator.json
```

- `out/PowerCalculator.wasm/interface.sol` is a Solidity interface file containing `interface IPowerCalculator { ... }`.
- The interface name (`IPowerCalculator`) is the contract name you’ll need when deploying the WASM.

---

## 3) Deploy the WASM contract (Fluent Testnet)

Deploy with gblend. The key is to use `<path>:<contractname>` where `contractname` is the interface name inside `interface.sol` (e.g. `IPowerCalculator`).

```bash
gblend create out/PowerCalculator.wasm/lib.wasm:IPowerCalculator \
  --rpc-url "$RPC_URL" \
  --private-key "$PRIVATE_KEY" \
  --broadcast \
  --wasm
```

Save the deployed address, e.g. into `deployed-addresses-wasm.txt`, and set `WASM_ADDRESS` in your `.env` to that value.

---

## 4) Add a Solidity wrapper that calls WASM

Create `contracts/BlendedCaller.sol`:

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "../out/PowerCalculator.wasm/interface.sol";

contract BlendedCaller {
    IPowerCalculator public immutable powerCalculator;

    constructor(address _powerCalculator) {
        powerCalculator = IPowerCalculator(_powerCalculator);
    }

    function calcPower(uint256 base, uint256 exp) external returns (uint256) {
        return powerCalculator.power(base, exp);
    }
}
```

Notes:

- The import path points to the `interface.sol` that gblend generated.
- We pass the deployed WASM contract address to the constructor.

---

## 5) Deploy the Solidity wrapper with Hardhat

Create `scripts/deployBlended.js`:

```js
require('dotenv').config();
const fs = require('fs');
const { ethers } = require('hardhat');

async function main() {
  const wasmAddress = process.env.WASM_ADDRESS;
  if (!wasmAddress) throw new Error('WASM_ADDRESS missing in .env');

  console.log('Using WASM contract address:', wasmAddress);
  const BlendedCaller = await ethers.getContractFactory('BlendedCaller');
  const blended = await BlendedCaller.deploy(wasmAddress);
  await blended.deployed();
  console.log('BlendedCaller deployed to:', blended.address);

  fs.writeFileSync('deployed-addresses-solidity.txt', blended.address + '\n');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

Compile and deploy:

```bash
npx hardhat compile
npx hardhat run scripts/deployBlended.js --network fluentTestnet
```

The deployed wrapper address is written to `deployed-addresses-solidity.txt`.

---

## 6) Call the wrapper from Node

Create `js-client/testCall.mjs` (ESM) that reads the compiled artifact via `fs`:

```js
import 'dotenv/config';
import fs from 'fs';
import { ethers } from 'ethers';

const artifactPath = new URL('../artifacts/contracts/BlendedCaller.sol/BlendedCaller.json', import.meta.url);
const artifactJson = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));

async function main() {
  const rpc = process.env.RPC_URL;
  const pk = process.env.PRIVATE_KEY;
  if (!rpc || !pk) throw new Error('.env must contain RPC_URL and PRIVATE_KEY');

  const provider = new ethers.providers.JsonRpcProvider(rpc);
  const wallet = new ethers.Wallet(pk, provider);

  const solAddr = fs.readFileSync('deployed-addresses-solidity.txt', 'utf8').trim();
  console.log('Using Solidity contract:', solAddr);

  const contract = new ethers.Contract(solAddr, artifactJson.abi, wallet);

  try {
    const r = await contract.callStatic.calcPower(2, 8);
    console.log('callStatic calcPower(2,8) =>', r.toString());
  } catch (e) {
    console.log('callStatic failed (function may be non-view). Sending tx...');
  }

  const tx = await contract.calcPower(2, 8);
  console.log('tx hash:', tx.hash);
  const receipt = await tx.wait();
  console.log('tx mined in block', receipt.blockNumber);
}

main().catch((e) => {
  console.error('Unhandled error:', e);
  process.exit(1);
});
```

Run it:

```bash
node js-client/testCall.mjs
```

You should see a `256` result for `power(2, 8)` and a mined transaction.

---

## Quick command reference (copy/paste)

```bash
# 0) Set secrets locally
# Create .env with RPC_URL, PRIVATE_KEY (and later WASM_ADDRESS)

# 1) Install project deps
npm install

# 2) Build the WASM using gblend
gblend build

# 3) Deploy WASM (use the correct interface name from interface.sol)
gblend create out/PowerCalculator.wasm/lib.wasm:IPowerCalculator \
  --rpc-url "$RPC_URL" \
  --private-key "$PRIVATE_KEY" \
  --broadcast \
  --wasm

# 4) Compile + deploy the Solidity wrapper
npx hardhat compile
npx hardhat run scripts/deployBlended.js --network fluentTestnet

# 5) Call from Node
node js-client/testCall.mjs
```

---

## Where things end up

- gblend build artifacts: `out/PowerCalculator.wasm/` (includes `lib.wasm`, `interface.sol`, `abi.json`)
- Solidity wrapper: `contracts/BlendedCaller.sol`
- Hardhat artifacts: `artifacts/`
- Addresses:
  - WASM: record it yourself (e.g., `deployed-addresses-wasm.txt`)
  - Solidity wrapper: `deployed-addresses-solidity.txt`

---

## Troubleshooting (key gotchas and quick fixes)

- Incorrect `gblend create` source format
  - Symptom: `error: contract source info format must be '<path>:<contractname>'`
  - Fix: Use `out/PowerCalculator.wasm/lib.wasm:IPowerCalculator` (replace the interface name as found in `interface.sol`).

- Interface path confusion
  - Symptom: Treating `out/interface.sol` as a file.
  - Fix: `out/interface.sol` is a directory with metadata. The Solidity interface file you import is `out/PowerCalculator.wasm/interface.sol`.

- Hardhat ESM vs CommonJS mismatches
  - Symptoms: `require is not defined in ES module scope`, `No Hardhat config file found`, or `ERR_PACKAGE_PATH_NOT_EXPORTED`.
  - Fix: Prefer CommonJS for Hardhat setup (use `hardhat.config.js` with `require(...)`). Avoid setting `"type": "module"` in `package.json` when starting out.

- Importing JSON with ESM
  - Symptom: Using `import ... from '...json' assert { type: 'json' }` fails on your Node setup.
  - Fix: Read JSON via `fs.readFileSync` + `JSON.parse` instead of import assertions.

- Node `--input-type=module`
  - Symptom: `--input-type can only be used with string input`.
  - Fix: Just run `node js-client/testCall.mjs` without that flag.

---

## You’re done

You now have a Hardhat project that calls into a Rust/WASM contract deployed on Fluent Testnet via gblend’s generated interface. From here, you can swap in your own Rust logic, regenerate with `gblend build`, and repeat the deploy + wrapper steps.
