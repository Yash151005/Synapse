export * from "./capabilities.js";
export * from "./schemas.js";
export * from "./prompts.js";

/** Network/protocol constants — single source of truth */
export const STELLAR_TESTNET_PASSPHRASE = "Test SDF Network ; September 2015";
export const STELLAR_TESTNET_HORIZON = "https://horizon-testnet.stellar.org";
export const STELLAR_FRIENDBOT = "https://friendbot.stellar.org";

/** Default budget caps. Surfaced to user in the orb tooltip. */
export const DEFAULTS = {
  PER_TASK_USDC: 0.005,
  PER_SESSION_USDC: 0.05,
  MAX_TASKS: 6,
  MAX_PARALLEL: 4,
} as const;
