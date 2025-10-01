# Hardhat-first project with gblend WASM helper

This repo shows how to add gblend + a Rust/WASM to an existing Hardhat (HH) project, using a Dutch Auction as the example.

## Branches

- `starting-point`: native Hardhat-only project
- `blended-final` (this branch): integrated state with gblend WASM and a Solidity wrapper calling it.

Reviewers: start with `starting-point`, then compare with `blended-final` to see exactly what was added.

## Structure (HH-first)

- Solidity sources: `contracts/solidity`
- WASM crate: `contracts/wasm/power-calculator`
- Foundry/gblend config: `foundry.toml` points to `contracts/wasm` only (no Solidity here)
- HH artifacts: `artifacts/`
- gblend outputs: `out/PowerCalculator.wasm/` (contains `lib.wasm`, `interface.sol`, etc.)
- Solidity wrapper: `contracts/solidity/BlendedDutchAuction.sol` imports the generated interface

## Generated interface wiring

- After `gblend build`, the wrapper imports:
  - `import { IPowerCalculator } from "../../out/PowerCalculator.wasm/interface.sol";`
- If you prefer a flatter import, an optional script `scripts/copyWasmInterface.js` can copy the file to `out/IPowerCalculator.sol`. Keep it simple—no extra tooling is required.

## Quick Start (copy/paste)

```bash
# a) Build WASM and generate interface
gblend build

# b) Deploy WASM (use explicit file path; avoid passing a directory)
gblend deploy --private-key "$PRIVATE_KEY" --rpc "$RPC_URL" --chain-id 20994 ./out/PowerCalculator.wasm/lib.wasm

# c) Put the resulting WASM address into .env
# WASM_ADDRESS=0x...

# d) Compute and set START_BLOCK/END_BLOCK using current chain block
node scripts/computeBlocks.js
# Copy START_BLOCK and END_BLOCK values from output into your .env

# e) Compile Solidity
npx hardhat compile

# f) Deploy the Solidity wrapper on Fluent Testnet
npx hardhat run scripts/deployDutchAuction.js --network fluentTestnet

# g) Verify by calling currentPrice() using the provided Node script
node js-client/testDutchAuction.mjs
```

## Troubleshooting

- gblend CLI flag mismatch: use `--rpc`, not `--rpc-url` (and pass the wasm file, not the directory)
- Passing a directory to `gblend deploy`: always pass the file `./out/PowerCalculator.wasm/lib.wasm`
- Auction deploying with past START/END blocks shows 0 price: compute fresh blocks with `scripts/computeBlocks.js`
- Minor integer rounding differences between JS and WASM: expect slight rounding differences when comparing off-chain calculations

Hardhat is used for Solidity. Foundry/gblend are restricted to `contracts/wasm` for the WASM.
