"use client";

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

/**
 * Returns true if the Freighter extension is installed and responding.
 * Uses the SDK's postMessage channel (v4 no longer injects window.freighter
 * in MV3 isolated worlds), so this must be awaited.
 */
export async function isFreighterInstalled(): Promise<boolean> {
  if (typeof window === "undefined") return false;
  try {
    const { isConnected: connected } = await isConnected();
    return !!connected;
  } catch {
    return false;
  }
}

export async function checkFreighter(): Promise<FreighterStatus> {
  const installed = await isFreighterInstalled();
  if (!installed) return { kind: "missing" };

  // Extension is present — ensure this origin is allowed, then get address.
  try {
    if (!(await isAllowed()).isAllowed) {
      await setAllowed();
    }
    await requestAccess();
    const { address } = await getAddress();
    const { network } = await getNetwork();

    if (network !== "TESTNET") return { kind: "wrong-network", network };
    return { kind: "ready", address };
  } catch (err) {
    // User dismissed the popup or a transient error — don't open the install page.
    throw err instanceof Error ? err : new Error("Freighter request was cancelled.");
  }
}

export async function connectFreighter(): Promise<string> {
  const installed = await isFreighterInstalled();
  if (!installed) {
    window.open(FREIGHTER_INSTALL_URL, "_blank", "noopener,noreferrer");
    throw new Error("Freighter is not installed. Opening install page…");
  }

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
 * Sign an XDR-encoded transaction via Freighter.
 */
export async function signWithFreighter(xdr: string, address: string): Promise<string> {
  const result = await signTransaction(xdr, {
    networkPassphrase: "Test SDF Network ; September 2015",
    address,
  });
  if (typeof result === "string") return result;
  return (result as { signedTxXdr: string }).signedTxXdr;
}
