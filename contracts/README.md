# Synapse Soroban Contracts

Real contract source for the Synapse contract suite.

## Contracts

- `task-escrow`: locks task-level USDC, then releases, holds, or refunds based on hash-bound results.
- `session-budget`: records a session spending ceiling and tracks allocations.
- `dispute`: opens evidence-bound disputes and resolves held payouts.

## Build

```bash
rustup target add wasm32-unknown-unknown
cargo build --manifest-path contracts/Cargo.toml --target wasm32-unknown-unknown --release
```

The compiled WASM files will be under each package target output after build.

## Test

```bash
cargo test --manifest-path contracts/Cargo.toml
```

## Deploy

Install the Stellar CLI, configure a testnet identity, then deploy the desired WASM:

```bash
stellar contract deploy \
  --wasm target/wasm32-unknown-unknown/release/task_escrow.wasm \
  --source <identity> \
  --network testnet
```

Keep generated IDs in `.stellar/contract-deployments.json`; `.stellar/` is intentionally gitignored.
