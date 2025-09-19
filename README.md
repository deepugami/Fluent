### Branch roles
- `starting-point`: Baseline Hardhat-only starting state for the migration (pre-gblend, pre-WASM). Use this to begin the guide’s steps.
- `blended-final`: Final state after integrating gblend + Rust/WASM and adding the Dutch auction wrapper, deploy script, and JS client. This reflects the completed guide.
- `master`: Main repo branch that hosts the overall project (contains Task_1/), not the branch used for the step-by-step migration walkthrough.

How to check out locally:

```bash
git fetch origin
git checkout starting-point
# ... follow the guide to migrate ...
git checkout blended-final
```
