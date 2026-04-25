/**
 * Prints the Stellar CLI commands needed to deploy the Synapse Soroban contracts.
 *
 * This does not submit transactions. It is safe to run before the Stellar CLI
 * or Rust target is installed, and it keeps generated contract IDs inside
 * `.stellar/contract-deployments.json` when you deploy manually.
 */

const contracts = [
  { name: "TaskEscrow", wasm: "task_escrow.wasm" },
  { name: "SessionBudget", wasm: "session_budget.wasm" },
  { name: "Dispute", wasm: "dispute.wasm" },
];

const identity = process.env.STELLAR_CLI_IDENTITY ?? "<stellar-cli-identity>";
const network = (process.env.STELLAR_NETWORK ?? "testnet").toLowerCase();

console.log("\nSynapse Soroban deploy plan\n");
console.log("1. Build contracts:");
console.log("   cargo build --manifest-path contracts/Cargo.toml --target wasm32-unknown-unknown --release\n");
console.log("2. Deploy each contract and store the returned contract IDs in .stellar/contract-deployments.json:\n");

for (const c of contracts) {
  console.log(`# ${c.name}`);
  console.log(
    `stellar contract deploy --wasm target/wasm32-unknown-unknown/release/${c.wasm} --source ${identity} --network ${network}`,
  );
  console.log("");
}

console.log("3. Wire the returned IDs into apps/web/.env.local if you want the UI to show live contract IDs:");
console.log("   NEXT_PUBLIC_TASK_ESCROW_CONTRACT_ID=<contract-id>");
console.log("   NEXT_PUBLIC_SESSION_BUDGET_CONTRACT_ID=<contract-id>");
console.log("   NEXT_PUBLIC_DISPUTE_CONTRACT_ID=<contract-id>\n");
