// Barrel for the Stellar layer. Anything orchestrator/UI needs imports from here.

export { horizon, networkPassphrase, loadAccount } from "./client";
export { stellarEnv, isStellarConfigured } from "./env";
export {
  generateKeypair,
  fundViaFriendbot,
  addUsdcTrustline,
  provisionAgentAccount,
  pubFromSecret,
  type GeneratedKeypair,
} from "./keypair";
export { usdcAsset, getUsdcBalance, toStellarAmount } from "./usdc";
export { hashRequest, memoFromHash, verifyReceipt } from "./receipts";
export {
  payAgent,
  awaitConfirmation,
  type PayAgentInput,
  type PayAgentResult,
} from "./pay";
