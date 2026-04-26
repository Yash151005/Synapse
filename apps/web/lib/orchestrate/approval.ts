// In-process approval registry.
// Both the SSE stream route and the confirm route import this module,
// sharing the same Map instance within a single Node.js process.

const registry = new Map<string, (approved: boolean) => void>();

export function waitForApproval(sessionId: string, timeoutMs = 120_000): Promise<boolean> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      registry.delete(sessionId);
      resolve(false);
    }, timeoutMs);
    registry.set(sessionId, (approved: boolean) => {
      clearTimeout(timer);
      registry.delete(sessionId);
      resolve(approved);
    });
  });
}

export function resolveApproval(sessionId: string, approved: boolean): boolean {
  const resolver = registry.get(sessionId);
  if (resolver) { resolver(approved); return true; }
  return false;
}
