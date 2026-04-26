// Singleton Horizon server. Reuse one instance across server actions
// so HTTP keep-alive and account-loading caches work as intended.

import { Horizon, Networks } from "@stellar/stellar-sdk";
import { stellarEnv } from "./env";

let _server: Horizon.Server | null = null;

export function horizon(): Horizon.Server {
  if (!_server) {
    _server = new Horizon.Server(stellarEnv.horizonUrl, {
      allowHttp: stellarEnv.horizonUrl.startsWith("http://"),
    });
  }
  return _server;
}

/** Drop the singleton so the next horizon() call opens a fresh TCP connection.
 *  Call this before retrying after a TLS / socket error. */
export function resetHorizon(): void {
  _server = null;
}

export function networkPassphrase(): string {
  return stellarEnv.network === "PUBLIC" ? Networks.PUBLIC : Networks.TESTNET;
}

/** Convenience: fetch an account, throw cleanly if it doesn't exist on-chain yet */
export async function loadAccount(publicKey: string) {
  try {
    return await horizon().loadAccount(publicKey);
  } catch (e: unknown) {
    const err = e as { response?: { status?: number } };
    if (err?.response?.status === 404) {
      throw new Error(
        `[stellar] Account ${publicKey} not found on ${stellarEnv.network}. ` +
          `Fund it via Friendbot (testnet) or treasury distribution.`,
      );
    }
    throw e;
  }
}
