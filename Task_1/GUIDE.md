## Hardhat-first + gblend (WASM) for Dutch Auction

This guide shows how to take an existing Hardhat (HH) project and cleanly add a Rust/WASM helper using gblend. We keep HH as the primary tool; gblend is isolated to the WASM crate and its generated interface.

### Branches

- `starting-point`: HH-only baseline with a plain `DutchAuction.sol`, a HH deploy script, and a basic test. No Foundry/gblend files and no `contracts/wasm` or `out/`.
- `blended-final`: Integrated state that adds the Rust/WASM helper via gblend and a Solidity wrapper (`BlendedDutchAuction.sol`) that imports the gblend-generated interface.
---

### What you’ll build

We’ll upgrade a Dutch auction to use a non-linear price curve powered by a Rust/WASM helper. The Rust contract exposes `power(uint256 base, uint256 exponent)`. gblend generates a Solidity interface (`IPowerCalculator`) that we call from a Solidity auction contract (`BlendedDutchAuction`) to compute:

price = START_PRICE * (remainingBlocks^EXPONENT) / (totalBlocks^EXPONENT)

For background on auction mechanics, see Dutch Auction on Solidity by Example: https://solidity-by-example.org/app/dutch-auction/

---

### Structure (HH-first)

- Solidity sources in `local/contracts/solidity`
- WASM crate at `local/contracts/wasm/power-calculator`
- Foundry/gblend configured to use ONLY `contracts/wasm` (see `local/foundry.toml`)
- Hardhat artifacts in `local/artifacts/`
- gblend build outputs in `local/out/PowerCalculator.wasm/` (e.g., `lib.wasm`, `interface.sol`)
- Wrapper `local/contracts/solidity/BlendedDutchAuction.sol` imports:
  - `import { IPowerCalculator } from "../../out/PowerCalculator.wasm/interface.sol";`

Optional: `local/scripts/copyWasmInterface.js` can copy the interface to `out/IPowerCalculator.sol` if you want a flatter import path.

### Quick Start (copy/paste)

```bash
# a) Build Rust/WASM and generate the Solidity interface
cd local
gblend build

# b) Deploy the WASM contract (pass the .wasm file, not the directory)
gblend deploy --private-key "$PRIVATE_KEY" --rpc "$RPC_URL" --chain-id 20994 ./out/PowerCalculator.wasm/lib.wasm

# c) Put the resulting WASM address into .env
# WASM_ADDRESS=0x...

# d) Compute and set START_BLOCK/END_BLOCK off the current chain block
node scripts/computeBlocks.js
# Copy START_BLOCK and END_BLOCK from the output into your .env

# e) Compile Solidity
npx hardhat compile

# f) Deploy the Solidity wrapper on Fluent Testnet
npx hardhat run scripts/deployDutchAuction.js --network fluentTestnet

# g) Verify by calling currentPrice() using the provided Node script
node js-client/testDutchAuction.mjs
```

### .env hygiene

Use `local/.env.example` as a template. Key vars:

- `RPC_URL`, `PRIVATE_KEY`, `WASM_ADDRESS`, `SOL_ADDRESS` (optional)
- `START_BLOCK`, `END_BLOCK` (use `scripts/computeBlocks.js` to populate these initially)

`.env` is already in `.gitignore`.

### Troubleshooting (real issues we hit)

- gblend CLI flags: use `--rpc`, not `--rpc-url` (and pass the wasm file, not the folder).
- Passing a directory to deploy: always pass `./out/PowerCalculator.wasm/lib.wasm`.
- Auction with past START/END blocks shows 0 price: recompute with `scripts/computeBlocks.js`.
- Minor integer rounding differences (JS vs WASM): expect small rounding differences in off-chain comparisons.

That’s it. HH remains your primary flow for Solidity, and gblend stays confined to the WASM helper and the generated interface.
