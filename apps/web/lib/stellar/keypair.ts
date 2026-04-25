// Keypair generation and Friendbot funding for newly-registered agents.
// All testnet-only; never run any of this against the public network
// without explicit treasury controls.

import { Keypair } from "@stellar/stellar-sdk";
import { STELLAR_FRIENDBOT } from "@synapse/shared";

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
 * Idempotent - will return success even if already funded.
 */
export async function fundViaFriendbot(publicKey: string): Promise<void> {
  const url = `${STELLAR_FRIENDBOT}?addr=${encodeURIComponent(publicKey)}`;
  const res = await fetch(url);
  if (!res.ok && res.status !== 400) {
    const body = await res.text();
    throw new Error(`[friendbot] ${res.status}: ${body}`);
  }
}

/**
 * One-shot setup for a new agent: fund it with testnet XLM via Friendbot.
 */
export async function provisionAgentAccount(
  agentSecret: string,
): Promise<{ friendbot: void }> {
  const agentKp = Keypair.fromSecret(agentSecret);
  await fundViaFriendbot(agentKp.publicKey());
  const friendbot = undefined as unknown as void;
  return { friendbot };
}

export function pubFromSecret(secret: string): string {
  return Keypair.fromSecret(secret).publicKey();
}
