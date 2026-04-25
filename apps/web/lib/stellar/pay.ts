// payAgent — the single function the orchestrator calls to pay a hired agent.
//
// Behavior:
//   1. Build a USDC payment from `fromSecret` to `toAddress`.
//   2. Attach a Memo.hash(sha256(requestPayload)) so the payment is
//      cryptographically bound to the request that triggered it.
//   3. Submit to Horizon and return tx hash + ledger.
//
// Errors are surfaced verbatim — the caller persists the receipt with status
// "pending" before submission and updates to "confirmed"/"failed" after.

import {
  BASE_FEE,
  Keypair,
  Operation,
  TransactionBuilder,
  Horizon,
} from "@stellar/stellar-sdk";
import { horizon, loadAccount, networkPassphrase } from "./client";
import { hashRequest, memoFromHash } from "./receipts";
import { toStellarAmount, usdcAsset } from "./usdc";

export type PayAgentInput = {
  /** Source account secret. For demos this is the platform treasury. */
  fromSecret: string;
  /** Destination G... pubkey for the agent. */
  toAddress: string;
  /** USDC amount as a number (will be normalized to 7 decimals). */
  amountUsdc: number;
  /** Arbitrary JSON request payload — gets sha256'd into the memo. */
  requestPayload: unknown;
};

export type PayAgentResult = {
  txHash: string;
  ledger: number;
  fromAddress: string;
  toAddress: string;
  amountUsdc: number;
  requestHash: string;
  memoBase64: string;
  submittedAt: string;
};

export async function payAgent(input: PayAgentInput): Promise<PayAgentResult> {
  const { fromSecret, toAddress, amountUsdc, requestPayload } = input;

  if (!toAddress.startsWith("G") || toAddress.length !== 56) {
    throw new Error(`[payAgent] Bad destination pubkey: ${toAddress}`);
  }

  const source = Keypair.fromSecret(fromSecret);
  const account = await loadAccount(source.publicKey());

  const requestHash = hashRequest(requestPayload);

  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: networkPassphrase(),
  })
    .addOperation(
      Operation.payment({
        destination: toAddress,
        asset: usdcAsset(),
        amount: toStellarAmount(amountUsdc),
      }),
    )
    .addMemo(memoFromHash(requestHash))
    .setTimeout(30)
    .build();

  tx.sign(source);

  const result = (await horizon().submitTransaction(tx)) as Horizon.HorizonApi.SubmitTransactionResponse;

  return {
    txHash: result.hash,
    ledger: result.ledger,
    fromAddress: source.publicKey(),
    toAddress,
    amountUsdc,
    requestHash,
    memoBase64: tx.memo.toXDRObject().toXDR("base64"),
    submittedAt: new Date().toISOString(),
  };
}

/**
 * Best-effort poll for confirmation. Horizon usually returns success synchronously,
 * but in slow network conditions we sometimes want to wait until ingestion catches up.
 */
export async function awaitConfirmation(
  txHash: string,
  { timeoutMs = 8_000, pollMs = 500 }: { timeoutMs?: number; pollMs?: number } = {},
): Promise<{ confirmed: boolean; ledger: number | null }> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const tx = await horizon().transactions().transaction(txHash).call();
      if (tx.successful) return { confirmed: true, ledger: tx.ledger_attr };
      return { confirmed: false, ledger: tx.ledger_attr ?? null };
    } catch {
      await new Promise((r) => setTimeout(r, pollMs));
    }
  }
  return { confirmed: false, ledger: null };
}
