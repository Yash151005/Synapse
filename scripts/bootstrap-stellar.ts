/**
 * scripts/bootstrap-stellar.ts
 *
 * One-shot setup for the Synapse demo. Run once after cloning:
 *
 *   pnpm stellar:bootstrap
 *
 * What it does:
 *   1. Generates the PLATFORM_TREASURY keypair (pays agents on behalf of guest users)
 *   2. Funds it via Friendbot (10,000 XLM)
 *   3. Prints the values to copy into .env.local AND writes them to a
 *      .stellar/bootstrap.json file (gitignored) so re-runs are idempotent
 *
 * Re-running detects existing bootstrap.json and skips generation.
 * Pass `--force` to start from scratch.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { Keypair, Networks } from "@stellar/stellar-sdk";

const FRIENDBOT = "https://friendbot.stellar.org";
const ROOT = path.resolve(__dirname, "..");
const OUT_DIR = path.join(ROOT, ".stellar");
const OUT_FILE = path.join(OUT_DIR, "bootstrap.json");

type Bootstrap = {
  network: "TESTNET";
  treasury: { publicKey: string; secret: string };
  createdAt: string;
};

async function main() {
  const force = process.argv.includes("--force");

  if (existsSync(OUT_FILE) && !force) {
    const existing: Bootstrap = JSON.parse(readFileSync(OUT_FILE, "utf8"));
    console.log("Existing bootstrap detected. Re-using.");
    printEnv(existing);
    return;
  }

  console.log("Generating treasury keypair...");
  const treasury = Keypair.random();
  console.log(`  treasury: ${treasury.publicKey()}`);

  console.log("Funding treasury via Friendbot...");
  await fundFriendbot(treasury.publicKey());

  const out: Bootstrap = {
    network: "TESTNET",
    treasury: { publicKey: treasury.publicKey(), secret: treasury.secret() },
    createdAt: new Date().toISOString(),
  };

  if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(OUT_FILE, JSON.stringify(out, null, 2), { mode: 0o600 });
  console.log(`Wrote ${OUT_FILE}`);

  printEnv(out);
}

async function fundFriendbot(pubkey: string) {
  const r = await fetch(`${FRIENDBOT}?addr=${encodeURIComponent(pubkey)}`);
  if (!r.ok && r.status !== 400) {
    throw new Error(`Friendbot failed for ${pubkey}: ${r.status}`);
  }
}

function printEnv(b: Bootstrap) {
  const env = [
    "",
    "================================================================",
    "  Copy these into apps/web/.env.local (or root .env.local):",
    "================================================================",
    "STELLAR_NETWORK=TESTNET",
    "STELLAR_HORIZON_URL=https://horizon-testnet.stellar.org",
    `STELLAR_PASSPHRASE=${Networks.TESTNET}`,
    `PLATFORM_TREASURY_PUBLIC=${b.treasury.publicKey}`,
    `PLATFORM_TREASURY_SECRET=${b.treasury.secret}`,
    "================================================================",
    "",
    "View on stellar.expert:",
    `  treasury -> https://stellar.expert/explorer/testnet/account/${b.treasury.publicKey}`,
    "",
  ].join("\n");
  console.log(env);
}

main().catch((e) => {
  console.error("bootstrap failed:", e);
  process.exit(1);
});
