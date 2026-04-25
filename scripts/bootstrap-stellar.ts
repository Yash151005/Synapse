/**
 * scripts/bootstrap-stellar.ts
 *
 * One-shot setup for the Synapse demo. Run once after cloning:
 *
 *   pnpm stellar:bootstrap
 *
 * What it does:
 *   1. Generates two keypairs:
 *        - PLATFORM_TREASURY (pays agents on behalf of guest users)
 *        - USDC_ISSUER       (issues our test-USDC asset)
 *   2. Funds both via Friendbot (10,000 XLM each).
 *   3. Sets issuer flags (auth_required = false; trustlines auto-approve).
 *   4. Adds a USDC trustline to the treasury and pre-funds it with 1,000 test-USDC.
 *   5. Prints the values to copy into .env.local AND writes them to a
 *      .stellar/bootstrap.json file (gitignored) so re-runs are idempotent.
 *
 * Re-running detects existing bootstrap.json and skips generation —
 * pass `--force` to start from scratch (you'll need to drain old accounts).
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import {
  Asset,
  BASE_FEE,
  Horizon,
  Keypair,
  Networks,
  Operation,
  TransactionBuilder,
} from "@stellar/stellar-sdk";

const HORIZON_URL = process.env.STELLAR_HORIZON_URL ?? "https://horizon-testnet.stellar.org";
const FRIENDBOT = "https://friendbot.stellar.org";
const PASSPHRASE = Networks.TESTNET;
const TREASURY_USDC = "1000.0000000";

const ROOT = path.resolve(__dirname, "..");
const OUT_DIR = path.join(ROOT, ".stellar");
const OUT_FILE = path.join(OUT_DIR, "bootstrap.json");

type Bootstrap = {
  network: "TESTNET";
  treasury: { publicKey: string; secret: string };
  issuer: { publicKey: string; secret: string };
  assetCode: "USDC";
  createdAt: string;
};

async function main() {
  const force = process.argv.includes("--force");

  if (existsSync(OUT_FILE) && !force) {
    const existing: Bootstrap = JSON.parse(readFileSync(OUT_FILE, "utf8"));
    console.log("✔ Existing bootstrap detected. Re-using.");
    printEnv(existing);
    return;
  }

  const horizon = new Horizon.Server(HORIZON_URL);

  console.log("→ Generating keypairs…");
  const treasury = Keypair.random();
  const issuer = Keypair.random();
  console.log(`  treasury: ${treasury.publicKey()}`);
  console.log(`  issuer:   ${issuer.publicKey()}`);

  console.log("→ Funding via Friendbot (parallel)…");
  await Promise.all([fundFriendbot(treasury.publicKey()), fundFriendbot(issuer.publicKey())]);

  // Issuer doesn't need flags for test USDC (default behavior allows trustlines).
  // We do, however, need to set the home_domain so it looks legit on stellar.expert.
  console.log("→ Tagging issuer with home_domain…");
  {
    const acc = await horizon.loadAccount(issuer.publicKey());
    const tx = new TransactionBuilder(acc, { fee: BASE_FEE, networkPassphrase: PASSPHRASE })
      .addOperation(Operation.setOptions({ homeDomain: "synapse.app" }))
      .setTimeout(60)
      .build();
    tx.sign(issuer);
    await horizon.submitTransaction(tx);
  }

  console.log("→ Treasury → USDC trustline…");
  {
    const acc = await horizon.loadAccount(treasury.publicKey());
    const usdc = new Asset("USDC", issuer.publicKey());
    const tx = new TransactionBuilder(acc, { fee: BASE_FEE, networkPassphrase: PASSPHRASE })
      .addOperation(Operation.changeTrust({ asset: usdc }))
      .setTimeout(60)
      .build();
    tx.sign(treasury);
    await horizon.submitTransaction(tx);
  }

  console.log(`→ Issuer pays Treasury ${TREASURY_USDC} test-USDC…`);
  {
    const acc = await horizon.loadAccount(issuer.publicKey());
    const usdc = new Asset("USDC", issuer.publicKey());
    const tx = new TransactionBuilder(acc, { fee: BASE_FEE, networkPassphrase: PASSPHRASE })
      .addOperation(
        Operation.payment({
          destination: treasury.publicKey(),
          asset: usdc,
          amount: TREASURY_USDC,
        }),
      )
      .setTimeout(60)
      .build();
    tx.sign(issuer);
    await horizon.submitTransaction(tx);
  }

  const out: Bootstrap = {
    network: "TESTNET",
    treasury: { publicKey: treasury.publicKey(), secret: treasury.secret() },
    issuer: { publicKey: issuer.publicKey(), secret: issuer.secret() },
    assetCode: "USDC",
    createdAt: new Date().toISOString(),
  };

  if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(OUT_FILE, JSON.stringify(out, null, 2), { mode: 0o600 });
  console.log(`✔ Wrote ${OUT_FILE}`);

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
    "STELLAR_PASSPHRASE=Test SDF Network ; September 2015",
    `PLATFORM_TREASURY_PUBLIC=${b.treasury.publicKey}`,
    `PLATFORM_TREASURY_SECRET=${b.treasury.secret}`,
    `USDC_ISSUER_PUBLIC=${b.issuer.publicKey}`,
    `USDC_ISSUER_SECRET=${b.issuer.secret}`,
    `USDC_ASSET_CODE=${b.assetCode}`,
    "================================================================",
    "",
    `View on stellar.expert:`,
    `  treasury → https://stellar.expert/explorer/testnet/account/${b.treasury.publicKey}`,
    `  issuer   → https://stellar.expert/explorer/testnet/account/${b.issuer.publicKey}`,
    "",
  ].join("\n");
  console.log(env);
}

main().catch((e) => {
  console.error("✗ bootstrap failed:", e);
  process.exit(1);
});
