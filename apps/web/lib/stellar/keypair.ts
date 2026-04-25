// Keypair generation, Friendbot funding, and trustline + initial-USDC drip
// for newly-registered agents. All testnet-only — never run any of this
// against the public network without explicit treasury controls.

import {
  Asset,
  BASE_FEE,
  Keypair,
  Operation,
  TransactionBuilder,
} from "@stellar/stellar-sdk";
import { STELLAR_FRIENDBOT } from "@synapse/shared";
import { horizon, loadAccount, networkPassphrase } from "./client";
import { stellarEnv } from "./env";
import { usdcAsset } from "./usdc";

export type GeneratedKeypair = {
  publicKey: string;
  /** Hot-wallet secret. NEVER log, NEVER ship to the browser. */
  secret: string;
};

export function generateKeypair(): GeneratedKeypair {
  const kp = Keypair.random();
  return { publicKey: kp.publicKey(), secret: kp.secret() };
}

/**
 * Hits the public Friendbot to fund a fresh testnet account with 10,000 XLM.
 * Idempotent — will return success even if already funded.
 */
export async function fundViaFriendbot(publicKey: string): Promise<void> {
  const url = `${STELLAR_FRIENDBOT}?addr=${encodeURIComponent(publicKey)}`;
  const res = await fetch(url);
  if (!res.ok && res.status !== 400) {
    // 400 typically means "already funded" — treat as success
    const body = await res.text();
    throw new Error(`[friendbot] ${res.status}: ${body}`);
  }
}

/**
 * Add a USDC trustline so an account can receive our test-USDC.
 * Stellar requires the recipient to opt in to non-native assets.
 */
export async function addUsdcTrustline(accountSecret: string): Promise<string> {
  const account = Keypair.fromSecret(accountSecret);
  const acc = await loadAccount(account.publicKey());

  const tx = new TransactionBuilder(acc, {
    fee: BASE_FEE,
    networkPassphrase: networkPassphrase(),
  })
    .addOperation(
      Operation.changeTrust({
        asset: usdcAsset(),
        // Default limit (922337203685.4775807) is fine for a hackathon
      }),
    )
    .setTimeout(30)
    .build();

  tx.sign(account);
  const result = await horizon().submitTransaction(tx);
  return result.hash;
}

/**
 * One-shot setup for a new agent: fund with XLM, add USDC trustline,
 * receive a small starting USDC balance from the issuer for visibility.
 *
 * Returns the Friendbot tx hash + trustline tx hash + initial-funding tx hash.
 */
export async function provisionAgentAccount(
  agentSecret: string,
  initialUsdc = "0.1",
): Promise<{ friendbot: void; trustline: string; funded: string }> {
  const agentKp = Keypair.fromSecret(agentSecret);

  // 1. Fund via Friendbot
  await fundViaFriendbot(agentKp.publicKey());
  const friendbot = undefined as unknown as void;

  // 2. Add USDC trustline (signed by the agent itself)
  const trustline = await addUsdcTrustline(agentSecret);

  // 3. Issuer drips a tiny starting USDC so balances aren't 0 in the UI
  const issuer = Keypair.fromSecret(stellarEnv.usdcIssuerSecret);
  const issuerAcc = await loadAccount(issuer.publicKey());

  const fundTx = new TransactionBuilder(issuerAcc, {
    fee: BASE_FEE,
    networkPassphrase: networkPassphrase(),
  })
    .addOperation(
      Operation.payment({
        destination: agentKp.publicKey(),
        asset: usdcAsset(),
        amount: initialUsdc,
      }),
    )
    .setTimeout(30)
    .build();
  fundTx.sign(issuer);
  const fundResult = await horizon().submitTransaction(fundTx);

  return { friendbot, trustline, funded: fundResult.hash };
}

export function pubFromSecret(secret: string): string {
  return Keypair.fromSecret(secret).publicKey();
}
