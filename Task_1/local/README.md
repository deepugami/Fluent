# Hardhat-first project with gblend WASM helper

This project starts as a native Hardhat setup and integrates a Rust/WASM helper via gblend. Solidity sources live under `contracts/solidity` and gblend outputs are isolated to `out/`.

## Layout

- `contracts/solidity/BlendedDutchAuction.sol` — Dutch auction that calls the WASM power helper
- `contracts/wasm/power-calculator` — Rust crate compiled by gblend to WASM
- `out/PowerCalculator.wasm/` — gblend outputs (lib.wasm, interface.sol, abi.json, ...)
- `artifacts/` — Hardhat build artifacts

## Commands

Build WASM with gblend:

```bash
gblend build
```

Compile and deploy Solidity with Hardhat:

```bash
npx hardhat compile
npx hardhat run scripts/deployDutchAuction.js --network fluentTestnet
```

Quick test client:

```bash
node js-client/testDutchAuction.mjs
```

Hardhat is used for Solidity. Foundry config is restricted to `contracts/wasm` for gblend-only sources.
