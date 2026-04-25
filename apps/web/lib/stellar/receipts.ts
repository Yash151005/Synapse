// Cryptographic receipt construction.
//
// Every agent payment carries a Stellar memo containing sha256(request).
// Anyone with the on-chain tx + the original request payload can verify
// independently that "yes, this exact request was paid for at this exact
// price by this exact source." That's what makes Synapse receipts verifiable
// without trusting Synapse.

import { Memo } from "@stellar/stellar-sdk";
import crypto from "node:crypto";

/**
 * Canonicalize a request payload for hashing. JSON stringify with sorted
 * keys → deterministic hex digest. Reproducible by any verifier.
 */
export function hashRequest(payload: unknown): string {
  const canonical = canonicalize(payload);
  return crypto.createHash("sha256").update(canonical).digest("hex");
}

/** Build a Stellar memo (32-byte hash) from a request hash. */
export function memoFromHash(hexHash: string): Memo {
  if (!/^[a-f0-9]{64}$/.test(hexHash)) {
    throw new Error(`[receipts] Invalid sha256 hex: ${hexHash}`);
  }
  return Memo.hash(hexHash);
}

/**
 * Verify that an on-chain memo matches a request payload.
 * Used by /sessions/[id] to prove receipts to the user.
 */
export function verifyReceipt(payload: unknown, onChainMemoHex: string): boolean {
  return hashRequest(payload) === onChainMemoHex.toLowerCase();
}

/**
 * Sorted-key JSON stringify so { a:1, b:2 } and { b:2, a:1 } hash identically.
 * Recursive on objects + arrays. Skips `undefined` values entirely (matches JSON.stringify).
 */
function canonicalize(value: unknown): string {
  if (value === null) return "null";
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (typeof value === "string") return JSON.stringify(value);
  if (Array.isArray(value)) {
    return "[" + value.map(canonicalize).join(",") + "]";
  }
  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const keys = Object.keys(obj)
      .filter((k) => obj[k] !== undefined)
      .sort();
    return (
      "{" +
      keys.map((k) => JSON.stringify(k) + ":" + canonicalize(obj[k])).join(",") +
      "}"
    );
  }
  // numbers like NaN/Infinity, functions, undefined
  throw new Error(`[receipts] Non-serializable value in payload: ${typeof value}`);
}
