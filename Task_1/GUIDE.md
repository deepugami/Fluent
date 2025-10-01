## Beginner’s Guide: Start with a native Hardhat project, then add gblend (Rust/WASM) for a Dutch Auction helper

This guide assumes you already have a standard Hardhat project and want to add gblend support while minimizing disruption to your existing HH workflow. You will:

- Build a Rust/WASM helper using gblend
- Deploy the WASM helper to Fluent Testnet
- Import the generated Solidity interface (`IPowerCalculator`) in a Solidity contract
- Keep Hardhat as the primary tool to compile/deploy Solidity
- Interact from a small Node script

The focus is on Hardhat + gblend usage, not on writing Rust or Solidity from scratch.

---

### What you’ll build

We’ll upgrade a Dutch auction to use a non-linear price curve powered by a Rust/WASM helper. The Rust contract exposes `power(uint256 base, uint256 exponent)`. gblend generates a Solidity interface (`IPowerCalculator`) that we call from a Solidity auction contract (`BlendedDutchAuction`) to compute:

price = START_PRICE * (remainingBlocks^EXPONENT) / (totalBlocks^EXPONENT)

For background on the auction mechanics, see Dutch Auction on Solidity by Example: https://solidity-by-example.org/app/dutch-auction/

---

<<<<<<< HEAD
### Branch roles
- `starting-point`: Baseline Hardhat-only starting state for the migration (pre-gblend, pre-WASM). Use this to begin the guide’s steps.
- `blended-final`: Final state after integrating gblend + Rust/WASM and adding the Dutch auction wrapper, deploy script, and JS client. This reflects the completed guide.
=======
### Branches for migration

This repository provides two branches to follow the migration path:

- `starting-point`: Native Hardhat-only project (single Solidity contract and deploy script). No Foundry or gblend references yet.
- `blended-final`: Final state after integrating gblend and the Rust/WASM helper. Hardhat remains the primary tool for Solidity.
>>>>>>> 66ff7fa (chore: stage working blended-final state before branching)

How to check out locally:

```bash
git fetch origin
git checkout starting-point
# ... follow the guide to migrate ...
git checkout blended-final
```

---

## Prerequisites

- Node.js LTS + npm
- Hardhat in your project (we’ll install the necessary deps below)
- Rust toolchain (via rustup)
- Foundry (forge, cast)
- gblend CLI
- RPC URL for Fluent Testnet
- Docker Desktop running in background

Make sure you have a private key with testnet funds. Keep secrets in a local `.env` file.

Example `.env`:

```bash
RPC_URL=https://rpc.testnet.fluent.xyz
PRIVATE_KEY=0xYOUR_PRIVATE_KEY
# Set after deploying WASM
WASM_ADDRESS=0x...
# Optional Dutch auction params
START_PRICE_WEI=100000000000000000   # 0.1 ETH
DURATION_BLOCKS=2000                  # ~6-7 hours depending on block time
EXPONENT=2                            # 2 = quadratic decay
```

## Network Parameters
- Network Name: Fluent Testnet
- HTTPS RPC URL: https://rpc.testnet.fluent.xyz/
- Chain ID: 20994
- Symbol: ETH
- Explorer: https://testnet.fluentscan.xyz/
- Faucet: https://testnet.gblend.xyz/

---

## 1) Install Hardhat dependencies (in your existing project)

From your project root (where this repo’s `local` directory lives):

```bash
cd local
npm install --save-dev hardhat @nomiclabs/hardhat-ethers ethers dotenv
```

Create or update `local/hardhat.config.js` (CommonJS). We keep a HH-first layout:

- Solidity sources: `local/contracts/solidity`
- Hardhat artifacts: `local/artifacts`
- gblend outputs: `local/out` (isolated)

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
    sources: './contracts/solidity',
    artifacts: './artifacts',
    tests: './test'
  }
};
```

#### Folder layout rationale and tested setup

- Use `contracts/solidity` for Hardhat sources and keep gblend in `contracts/wasm`. Hardhat writes to `artifacts/`, gblend/Foundry write to `out/`. Keeping these separate avoids tool conflicts and keeps imports predictable (`../../out/PowerCalculator.wasm/interface.sol`).
- This guide has been validated with HH-first:
  - Hardhat: `paths.sources=contracts/solidity`, `paths.artifacts=artifacts`
  - Foundry (optional): `src=contracts/wasm`, `out=out`

---

## 2) Build the Rust/WASM with gblend

Run the build from `local` (the gblend project is already set up here):

```bash
cd local
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
- The interface name (`IPowerCalculator`) is the contract name you’ll need when deploying the WASM (for the path-based method below).

---

## 3) Deploy the WASM contract (Fluent Testnet)

Recommended (package-name) method:

```bash
cd local
gblend create PowerCalculator.wasm \
  --rpc-url "$RPC_URL" \
  --private-key "$PRIVATE_KEY" \
  --broadcast \
  --wasm
```

Alternative (explicit path + interface name):

```bash
cd local
gblend create out/PowerCalculator.wasm/lib.wasm:IPowerCalculator \
  --rpc-url "$RPC_URL" \
  --private-key "$PRIVATE_KEY" \
  --broadcast \
  --wasm
```

- If you hit `error: stream did not contain valid UTF-8`, use the package-name method shown above. This avoids tools trying to parse the raw `.wasm` as Solidity.
- Save the deployed address (e.g., in `local/deployed-addresses-wasm.txt`) and set `WASM_ADDRESS` in your `.env` to that value.

---

## 4) Add a Dutch auction that calls the WASM power helper

We use a minimal auction contract at `local/contracts/solidity/BlendedDutchAuction.sol` that imports the gblend-generated interface and calls the WASM helper for the non-linear curve.

Key imports and naming (lint-friendly):

```solidity
import { IPowerCalculator } from "../../out/PowerCalculator.wasm/interface.sol"; // named import

// immutables use SCREAMING_SNAKE_CASE
address payable public immutable SELLER;
uint256 public immutable START_PRICE;
uint256 public immutable START_BLOCK;
uint256 public immutable END_BLOCK;
uint256 public immutable EXPONENT;
IPowerCalculator public immutable POWER_CALCULATOR;
```

The contract computes:

- `remainingBlocks = END_BLOCK - block.number`
- `totalBlocks = END_BLOCK - START_BLOCK`
- `currentPrice = START_PRICE * (remainingBlocks^EXPONENT) / (totalBlocks^EXPONENT)`

Note: `currentPrice()` is not marked `view` because the generated interface method is non-view.

---

## 5) Deploy the Dutch auction with Hardhat

Use the provided script `local/scripts/deployDutchAuction.js`:

```bash
cd local
npx hardhat compile
npx hardhat run scripts/deployDutchAuction.js --network fluentTestnet
```

The deployed address is written to `local/deployed-addresses-solidity.txt`.

Environment overrides supported by the script:

- `START_PRICE_WEI` (default: `0.1 ETH`)
- `DURATION_BLOCKS` (default: `2000`)
- `EXPONENT` (default: `2`)

Common gotcha: ensure `PRIVATE_KEY` is a full 66-character hex string (`0x` + 64 hex chars), or Hardhat will error `Invalid account: private key too short`.

---

## 6) Call the auction from Node

Use the provided ESM script `local/js-client/testDutchAuction.mjs` to read the artifact and interact. Make sure the artifact path matches Hardhat’s configured sources directory (`contracts/solidity`).

```bash
cd local
node js-client/testDutchAuction.mjs
```

Expected output: a positive `currentPrice`. Optionally a `buy` transaction if the price is > 0.

Ethers version note:
- This repo pins `ethers@5`. If you use `ethers@6` in your environment, return types differ (no `BigNumber`). Either keep `ethers@5` (recommended for this guide) or adapt your client code for v6 (use `bigint` and `toString()` where needed).

---

## Quick command reference (copy/paste)

```bash
# 0) Set secrets locally
# Create .env with RPC_URL, PRIVATE_KEY (and later WASM_ADDRESS)

# 1) Install project deps
cd local
npm install

# 2) Build the WASM using gblend
cd local
gblend build

# 3) Deploy WASM (recommended: package-name method)
cd local
gblend create PowerCalculator.wasm \
  --rpc-url "$RPC_URL" \
  --private-key "$PRIVATE_KEY" \
  --broadcast \
  --wasm

# Alternative (explicit path + interface name)
# gblend create out/PowerCalculator.wasm/lib.wasm:IPowerCalculator --rpc-url "$RPC_URL" --private-key "$PRIVATE_KEY" --broadcast --wasm

# 4) Compile + deploy the Dutch auction
cd local
npx hardhat compile
npx hardhat run scripts/deployDutchAuction.js --network fluentTestnet

# 5) Call from Node
cd local
node js-client/testDutchAuction.mjs
```

---

## Where things end up

- gblend build artifacts: `local/out/PowerCalculator.wasm/` (includes `lib.wasm`, `interface.sol`, `abi.json`)
- Solidity contract: `local/contracts/solidity/BlendedDutchAuction.sol`
- Hardhat artifacts: `local/artifacts/`
- Addresses:
  - WASM: record it yourself (e.g., `local/deployed-addresses-wasm.txt`)
  - Solidity: `local/deployed-addresses-solidity.txt`

---

## Troubleshooting

- Incorrect `gblend create` source format or `.wasm` parsing errors
  - Symptom: `error: stream did not contain valid UTF-8`
  - Fix: Use the package-name method: `gblend create PowerCalculator.wasm ... --wasm`.

- Interface path confusion
  - Symptom: Treating `out/interface.sol` as a file.
  - Fix: `out/interface.sol` is a directory with metadata. The Solidity interface file you import is `out/PowerCalculator.wasm/interface.sol`.

- Forge lint: unaliased import
  - Symptom: `note[unaliased-plain-import]`
  - Fix: use named import: `import { IPowerCalculator } from "../out/PowerCalculator.wasm/interface.sol";`

- Forge lint: immutables casing
  - Symptom: `note[screaming-snake-case-immutable]`
  - Fix: rename immutables to SCREAMING_SNAKE_CASE and update usages.

- Hardhat ESM vs CommonJS mismatches
  - Symptoms: `require is not defined in ES module scope`, `No Hardhat config file found`, or `ERR_PACKAGE_PATH_NOT_EXPORTED`.
  - Fix: Prefer CommonJS for Hardhat setup (use `hardhat.config.js` with `require(...)`). Avoid setting `"type": "module"` in `package.json` when starting out.

- Ethers v5 vs v6 differences
  - Symptom: `TypeError: priceNow.gt is not a function` (when using v6)
  - Fix: stick to `ethers@5` for this guide, or adapt to v6 using `bigint` and string conversions.

---

## You’re done

You now have a Hardhat project that calls a Rust/WASM helper on Fluent Testnet via gblend’s generated interface, applied to a Dutch auction price curve. This flow has been verified end-to-end: WASM deployed with gblend, Solidity wrapper deployed with Hardhat, and interaction from Node. From here, you can swap in your own Rust logic, regenerate with `gblend build`, and repeat the deploy + call steps.
