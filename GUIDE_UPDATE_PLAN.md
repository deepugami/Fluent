### Objective

Create a clearer, more compelling migration guide that shows how to go from a Hardhat-only repo to Hardhat + gblend + Fluentbase (Rust) using a realistic example (Dutch auction). Provide a reference repo with two branches: a base starting point and a final version.

### Deliverables

- **Reference repo** with two branches:
  - **base**: Hardhat-only, vanilla Dutch auction (linear `getPrice`).
  - **final**: Adds Foundry + gblend + Fluentbase Rust crate; `getPrice` becomes non-linear via Rust.
- **Updated guide** (either replace `GUIDE.md` or add `MIGRATION_GUIDE.md`) that:
  - Links to both branches and explains diffs.
  - Focuses on using Hardhat with gblend, while pointing to external resources for Dutch auction theory.
  - Uses a unified folder and build artifacts layout across Hardhat and Foundry.

### Repo layout (unified)

- **Pick one source dir and one artifacts dir for both toolchains**:
  - Sources: `src/`
  - Artifacts: `out/`
- Keep Foundry libs in `lib/`.
- Keep scripts in `script/` (Foundry) and `scripts/` (Hardhat) as today.
- Place the Rust crate for the non-linear pricing in `src/nonlinear-pricing/` (mirrors your existing `src/power-calculator` pattern for consistency).

### Exact config edits

- In `local/hardhat.config.js` set unified paths:

```js
/** Hardhat config - unified with Foundry */
require("@nomicfoundation/hardhat-toolbox");

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.20",
    settings: {
      optimizer: { enabled: true, runs: 200 }
    }
  },
  paths: {
    sources: "src",
    artifacts: "out",
    cache: "cache",
    tests: "test"
  }
};
```

- In `local/foundry.toml` use the same paths:

```toml
[profile.default]
src = "src"
out = "out"
libs = ["lib"]
evm_version = "paris"
optimizer = true
optimizer_runs = 200

[fmt]
line_length = 100
tab_width = 4
```

### Reference example: Dutch auction

- Base version: use the Solidity-by-Example implementation of a Dutch auction and keep its linear `getPrice` logic. Reference: `https://solidity-by-example.org/app/dutch-auction/`.
- Final version: replace `getPrice` with a call into a Fluentbase Rust function via gblend to compute a non-linear price curve (e.g., exponential decay or quadratic).

### Branching and repo setup

1) Create the repo and base branch

```bash
# From project root
git init
git checkout -b base

# If your current code lives in ./local, keep it; we will align it.
# Ensure minimal Hardhat-only Dutch auction exists in src/ and compiles.
git add .
git commit -m "chore: init repo with Hardhat-only Dutch auction (base)"

# Create the remote and push
gh repo create hh-gblend-fluentbase-dutch-auction --public --source . --push
git push -u origin base
```

2) Create the final branch from base

```bash
git checkout -b final
# Integrate Foundry + gblend + Fluentbase as per steps below
git commit -am "feat: add Foundry, gblend, Fluentbase non-linear pricing"
git push -u origin final
```

### Base branch tasks (Hardhat-only)

- [ ] Add `src/DutchAuction.sol` with the vanilla logic from Solidity-by-Example.
- [ ] Ensure `local/hardhat.config.js` uses `src` and `out` (see config above).
- [ ] Add a minimal deployment script `local/scripts/deployDutchAuction.js`.
- [ ] Add a minimal Hardhat test in `local/test/DutchAuction.t.js` covering price decreasing over time.
- [ ] Document in README where `getPrice` is defined and its simple linear formula; link to the external article for details.
- [ ] Verify compilation and tests:

```bash
cd local
npm i
npx hardhat compile
npx hardhat test
```

### Final branch tasks (Foundry + gblend + Fluentbase)

1) Add Foundry and keep unified paths

- [ ] Ensure `local/foundry.toml` matches the unified config above.
- [ ] Add `forge-std` in `local/lib/` (already present in your repo).
- [ ] Add a Foundry test `local/test/DutchAuction.t.sol` that asserts the non-linear price curve.

2) Add Fluentbase Rust crate for pricing

- [ ] Create a Rust lib crate at `local/src/nonlinear-pricing/`:

```bash
cd local/src
cargo new nonlinear-pricing --lib
cd nonlinear-pricing
```

- [ ] In `Cargo.toml`, add any math dependency you plan to use (e.g., PRB-math analog or implement in pure Rust floats with appropriate conversion; keep within current limitations).
- [ ] Implement a safe, deterministic `get_price` like:
  - Inputs: `startPrice`, `startAt`, `duration`, `currentBlock`.
  - Output: `uint256` price, computed by a non-linear curve (e.g., exponential decay capped by min price).
- [ ] Follow the pattern from your existing `src/power-calculator` crate and `BlendedCounter.sol` for gblend interop glue.

3) Wire gblend into Solidity

- [ ] Add a Solidity interface/library that gblend generates or that you hand-wire to call into the Rust function.
- [ ] Modify `src/DutchAuction.sol#getPrice` to delegate to the Rust function when on the final branch.
- [ ] Keep function signature stable so the guide focuses on toolchain integration rather than contract API changes.

4) Keep both toolchains happy with unified paths

- [ ] Confirm Hardhat compiles into `out/` and Foundry also uses `out/` for artifacts.
- [ ] If any name collisions in `out/`, consider namespacing Rust build outputs under `out/gblend/` if configurable.

5) Tests and scripts

- [ ] Add or update Hardhat tests to assert the non-linear curve now differs from the base branch linear curve.
- [ ] Add Foundry tests (`.t.sol`) that call `getPrice` for multiple blocks and validate monotonicity and expected shape.
- [ ] Ensure deploy scripts are unchanged or minimally updated, illustrating that integration does not break DX.

6) Validate the setup

```bash
cd local

# Hardhat
npx hardhat clean && npx hardhat compile
npx hardhat test

# Foundry
forge clean && forge build
forge test -vvv
```

### Update the guide (new or replace)

Decide if you want to replace `GUIDE.md` or add `MIGRATION_GUIDE.md`. Recommended: add `MIGRATION_GUIDE.md` and keep `GUIDE.md` as a landing page linking to it.

Proposed structure for `MIGRATION_GUIDE.md`:

1) What you will build
   - Hardhat → Hardhat + gblend + Fluentbase using a Dutch auction.
   - Link to base and final branches.
   - External link to Dutch auction explanation.

2) Project layout and configs
   - Why we chose `src/` and `out/` for both toolchains.
   - Show the exact `hardhat.config.js` and `foundry.toml` snippets.

3) Start from base (Hardhat-only)
   - Compile and test commands.
   - Highlights of `getPrice` linear formula.

4) Add Foundry + gblend + Fluentbase
   - Where the Rust crate lives and its function signature.
   - How the Solidity contract calls into Rust (show the tiny glue change only).
   - Build and test commands for both toolchains.

5) Compare results
   - Show that the price curve differs (plot or tabulate a few block values).
   - Mention limitations (precision, gas, determinism considerations with the current Rust math approach).

6) Troubleshooting
   - Common path issues (contracts in `contracts/` vs `src/`), fix by unifying paths.
   - `out/` vs `artifacts/` mismatches; how to update Hardhat paths.
   - gblend linkage errors and how to verify the Rust crate exports.

### Optional: add CI to test both branches

- Add a GitHub Actions workflow `.github/workflows/ci.yml` that runs on both `base` and `final` to compile and test with both toolchains (Hardhat on base; both Hardhat and Foundry on final).

### Acceptance criteria (checklist)

- [ ] Public repo exists with `base` and `final` branches.
- [ ] Base branch compiles and tests pass with Hardhat.
- [ ] Final branch compiles and tests pass with both Hardhat and Foundry; gblend interop works.
- [ ] Unified `src/` and `out/` are used by both toolchains.
- [ ] `MIGRATION_GUIDE.md` clearly documents the journey, with links, commands, and minimal diffs.
- [ ] The example remains realistic but focused on the toolchain migration, not auction theory.

### Notes on your current repo

- You already have a working pattern with `src/power-calculator` (Rust) and `BlendedCounter.sol` (Solidity). Mirror that pattern for `nonlinear-pricing` and `DutchAuction.sol` on the final branch to keep the guide concise and focused on the migration.
- Keep everything under `local/` as-is; the unified paths above are relative to `local/` and already match Hardhat and Foundry conventions when you set `sources=src` and `out=out` in both configs.


