/**
 * scripts/seed-agents.ts
 *
 *   pnpm agents:seed
 *
 * For each agent in seed/agents.json:
 *   1. Generate a Stellar keypair
 *   2. Friendbot-fund it
 *   3. Add USDC trustline + drip 0.1 starting USDC from issuer
 *   4. OpenAI-embed the description (1536-dim)
 *   5. Insert/upsert into Supabase `agents`, with the keypair secret
 *      stored in `metadata.secret` (hackathon scope — production would
 *      use Supabase Vault or KMS).
 *
 * Re-runs are upsert-by-slug. Existing agents keep their keypairs.
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import { config as loadEnv } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import OpenAI from "openai";
import {
  Asset,
  BASE_FEE,
  Horizon,
  Keypair,
  Networks,
  Operation,
  TransactionBuilder,
} from "@stellar/stellar-sdk";

// Load .env.local from project root, then apps/web (last-wins).
const ROOT = path.resolve(__dirname, "..");
loadEnv({ path: path.join(ROOT, ".env.local") });
loadEnv({ path: path.join(ROOT, "apps/web/.env.local") });

const HORIZON_URL = process.env.STELLAR_HORIZON_URL ?? "https://horizon-testnet.stellar.org";
const FRIENDBOT = "https://friendbot.stellar.org";

type SeedAgent = {
  slug: string;
  name: string;
  capability: string;
  description: string;
  endpoint_path: string;
  price_usdc: number;
  metadata: Record<string, unknown>;
};

async function main() {
  must("ANTHROPIC_API_KEY", false);
  const openaiKey = must("OPENAI_API_KEY");
  const supabaseUrl = must("NEXT_PUBLIC_SUPABASE_URL");
  const serviceKey = must("SUPABASE_SERVICE_ROLE_KEY");
  const treasurySecret = must("PLATFORM_TREASURY_SECRET");
  const issuerSecret = must("USDC_ISSUER_SECRET");
  const issuerPublic = must("USDC_ISSUER_PUBLIC");
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const openai = new OpenAI({ apiKey: openaiKey });
  const horizon = new Horizon.Server(HORIZON_URL);
  const usdc = new Asset("USDC", issuerPublic);
  const issuer = Keypair.fromSecret(issuerSecret);
  const treasury = Keypair.fromSecret(treasurySecret);

  const seedFile = path.join(ROOT, "seed/agents.json");
  const agents: SeedAgent[] = JSON.parse(readFileSync(seedFile, "utf8"));
  console.log(`→ Seeding ${agents.length} agents…`);

  for (const a of agents) {
    console.log(`\n[${a.slug}] ${a.name} (${a.capability})`);

    // 1. Reuse existing keypair if we already inserted this slug
    const { data: existing } = await supabase
      .from("agents")
      .select("id, stellar_address, metadata")
      .eq("slug", a.slug)
      .maybeSingle();

    let kp: Keypair;
    if (existing && existing.metadata && typeof existing.metadata === "object") {
      const meta = existing.metadata as Record<string, unknown>;
      if (typeof meta.secret === "string") {
        kp = Keypair.fromSecret(meta.secret);
        console.log(`  ↳ reusing keypair ${kp.publicKey()}`);
      } else {
        kp = Keypair.random();
      }
    } else {
      kp = Keypair.random();
    }

    // 2. Fund + trust + drip (skip if already done)
    const provisioned = await isProvisioned(horizon, kp.publicKey());
    if (!provisioned) {
      console.log(`  ↳ funding ${kp.publicKey()}…`);
      await fundFriendbot(kp.publicKey()).catch(() => {});
      const acc = await horizon.loadAccount(kp.publicKey());
      const tx = new TransactionBuilder(acc, {
        fee: BASE_FEE,
        networkPassphrase: Networks.TESTNET,
      })
        .addOperation(Operation.changeTrust({ asset: usdc }))
        .setTimeout(60)
        .build();
      tx.sign(kp);
      await horizon.submitTransaction(tx);

      const issAcc = await horizon.loadAccount(issuer.publicKey());
      const dripTx = new TransactionBuilder(issAcc, {
        fee: BASE_FEE,
        networkPassphrase: Networks.TESTNET,
      })
        .addOperation(
          Operation.payment({ destination: kp.publicKey(), asset: usdc, amount: "0.1" }),
        )
        .setTimeout(60)
        .build();
      dripTx.sign(issuer);
      await horizon.submitTransaction(dripTx);
      console.log(`  ↳ trustline + 0.1 USDC seeded`);
    } else {
      console.log(`  ↳ already provisioned, skipping Stellar setup`);
    }

    // 3. Embed
    console.log(`  ↳ embedding description…`);
    const emb = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: `${a.name}. ${a.description}. Capability: ${a.capability}.`,
    });
    const embedding = emb.data[0]!.embedding;

    // 4. Upsert
    const endpoint_url = new URL(a.endpoint_path, baseUrl).toString();
    const { error } = await supabase.from("agents").upsert(
      {
        slug: a.slug,
        name: a.name,
        description: a.description,
        capability: a.capability,
        endpoint_url,
        price_usdc: a.price_usdc,
        stellar_address: kp.publicKey(),
        embedding: embedding as never,
        metadata: { ...a.metadata, secret: kp.secret() } as never,
      },
      { onConflict: "slug" },
    );
    if (error) {
      console.error(`  ✗ upsert failed: ${error.message}`);
      process.exitCode = 1;
    } else {
      console.log(`  ✔ inserted ${a.slug}`);
    }
  }

  // Suppress unused-warning on treasury — kept for parity / future fanout
  void treasury;

  console.log("\n✔ Seed complete.");
}

function must(name: string, throwOnMissing = true): string {
  const v = process.env[name];
  if (!v && throwOnMissing) throw new Error(`Missing env: ${name}`);
  return v ?? "";
}

async function fundFriendbot(pubkey: string): Promise<void> {
  const r = await fetch(`${FRIENDBOT}?addr=${encodeURIComponent(pubkey)}`);
  if (!r.ok && r.status !== 400) {
    throw new Error(`Friendbot ${r.status}: ${await r.text()}`);
  }
}

async function isProvisioned(horizon: Horizon.Server, pubkey: string): Promise<boolean> {
  try {
    const acc = await horizon.loadAccount(pubkey);
    return acc.balances.some(
      (b) => b.asset_type !== "native" && "asset_code" in b && b.asset_code === "USDC",
    );
  } catch {
    return false;
  }
}

main().catch((e) => {
  console.error("✗ seed failed:", e);
  process.exit(1);
});
