"use client";

// Browser-side Freighter wallet integration. Thin convenience wrapper that
// gives the rest of the app a stable API surface, regardless of breaking
// changes in @stellar/freighter-api.

import {
  isConnected,
  isAllowed,
  setAllowed,
  requestAccess,
  getAddress,
  getNetwork,
  signTransaction,
} from "@stellar/freighter-api";

export type FreighterStatus =
  | { kind: "missing" }
  | { kind: "wrong-network"; network: string }
  | { kind: "ready"; address: string };

const FREIGHTER_INSTALL_URL = "https://www.freighter.app/";

export async function checkFreighter(): Promise<FreighterStatus> {
  const conn = await isConnected();
  if (!conn.isConnected) return { kind: "missing" };

  if (!(await isAllowed()).isAllowed) {
    await setAllowed();
  }
  await requestAccess();
  const { address } = await getAddress();
  const { network } = await getNetwork();

  if (network !== "TESTNET") return { kind: "wrong-network", network };
  return { kind: "ready", address };
}

export async function connectFreighter(): Promise<string> {
  const status = await checkFreighter();
  switch (status.kind) {
    case "missing":
      window.open(FREIGHTER_INSTALL_URL, "_blank", "noopener,noreferrer");
      throw new Error("Freighter is not installed. Opening install page…");
    case "wrong-network":
      throw new Error(
        `Freighter is on ${status.network}. Switch to Testnet in the Freighter extension settings.`,
      );
    case "ready":
      return status.address;
  }
}

/**
 * Sign an XDR-encoded transaction via Freighter. The orchestrator typically
 * uses the platform treasury for autonomous agent hires, but if the user
 * wants their own funds to flow on-chain we route through this.
 */
export async function signWithFreighter(xdr: string, address: string): Promise<string> {
  const result = await signTransaction(xdr, {
    networkPassphrase: "Test SDF Network ; September 2015",
    address,
  });
  // Newer SDK shape returns { signedTxXdr }
  if (typeof result === "string") return result;
  return (result as { signedTxXdr: string }).signedTxXdr;
}
