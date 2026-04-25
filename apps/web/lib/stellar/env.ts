// Centralized, typed access to Stellar env. Throws loudly on missing
// values so we don't ship a broken demo with silent fallbacks.

import { STELLAR_TESTNET_HORIZON, STELLAR_TESTNET_PASSPHRASE } from "@synapse/shared";

function required(name: string, value: string | undefined): string {
  if (!value || value.length === 0) {
    throw new Error(
      `[stellar/env] Missing required env var: ${name}. ` +
        `Run \`pnpm stellar:bootstrap\` to generate testnet credentials, ` +
        `then copy the printed values into .env.local.`,
    );
  }
  return value;
}

export const stellarEnv = {
  network: process.env.STELLAR_NETWORK ?? "TESTNET",
  horizonUrl: process.env.STELLAR_HORIZON_URL ?? STELLAR_TESTNET_HORIZON,
  passphrase: process.env.STELLAR_PASSPHRASE ?? STELLAR_TESTNET_PASSPHRASE,

  /** Server-only. Funds new agent keypairs and pays agents on behalf of guest users. */
  get treasurySecret() {
    return required("PLATFORM_TREASURY_SECRET", process.env.PLATFORM_TREASURY_SECRET);
  },
  get treasuryPublic() {
    return required("PLATFORM_TREASURY_PUBLIC", process.env.PLATFORM_TREASURY_PUBLIC);
  },
} as const;

export function isStellarConfigured(): boolean {
  return !!(
    process.env.PLATFORM_TREASURY_SECRET &&
    process.env.PLATFORM_TREASURY_PUBLIC
  );
}
