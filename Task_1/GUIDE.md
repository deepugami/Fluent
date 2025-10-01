## Beginner’s Guide: Blend a Hardhat project with a Rust/WASM contract using gblend

This guide shows how to take an existing Hardhat (Solidity) project and make it “blended” by integrating a Rust/WASM contract compiled with gblend. You will:

- Build a Rust/WASM contract using gblend
- Deploy the WASM contract to Fluent Testnet
- Import the generated Solidity interface in a wrapper contract
## Hardhat-only starting point

This branch contains a minimal Hardhat project to deploy and test a simple Dutch auction. There are no WASM, Foundry, or gblend references here. Use this as a clean baseline.

### What’s included

- Contract: `local/contracts/solidity/DutchAuction.sol`
- Script: `local/scripts/deployDutchAuction.js`
- Config: `local/hardhat.config.js`
- Env template: `local/.env.example`

### Prerequisites

- Node.js LTS + npm
- RPC URL for Fluent Testnet
- Private key with testnet funds (do not commit secrets)

### Setup

1) Install deps (from `local/`):

```bash
npm install
```

2) Configure your `.env` (copy from `.env.example`):

```bash
RPC_URL=https://rpc.testnet.fluent.xyz
PRIVATE_KEY=0xYOUR_PRIVATE_KEY
START_PRICE_WEI=100000000000000000
DURATION_BLOCKS=2000
```

3) Compile and deploy:

```bash
npx hardhat compile
npx hardhat run scripts/deployDutchAuction.js --network fluentTestnet
```

The address will be logged; you can save it for later interaction.

### Notes

- This branch intentionally avoids any WASM-related files or steps.
- For the integrated version that adds a non-linear price curve via a Rust/WASM helper and gblend, see the `blended-final` branch.
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
