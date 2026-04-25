// NVIDIA NIM — Llama 3.3 70B Instruct. Used by individual agent endpoints
// for parallel sub-task execution. The cost story ("Planned by Claude ·
// Executed by Llama") is a deliberate pitch beat — surface model_used in
// every agent response so the UI can render the badge.

const NIM_URL = "https://integrate.api.nvidia.com/v1/chat/completions";
const LLAMA_MODEL = "meta/llama-3.3-70b-instruct";

export type NimMessage = { role: "system" | "user" | "assistant"; content: string };

export async function callLlama(
  messages: NimMessage[],
  opts?: { temperature?: number; maxTokens?: number; jsonMode?: boolean },
): Promise<{ content: string; model: string }> {
  if (!process.env.NVIDIA_NIM_API_KEY) {
    throw new Error("[nvidia] Missing NVIDIA_NIM_API_KEY");
  }

  const r = await fetch(NIM_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.NVIDIA_NIM_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: LLAMA_MODEL,
      messages,
      temperature: opts?.temperature ?? 0.4,
      max_tokens: opts?.maxTokens ?? 1024,
      stream: false,
      ...(opts?.jsonMode ? { response_format: { type: "json_object" } } : {}),
    }),
  });

  if (!r.ok) {
    const body = await r.text();
    throw new Error(`[nvidia] ${r.status} ${r.statusText}: ${body}`);
  }
  const data = (await r.json()) as {
    choices: { message: { content: string } }[];
    model: string;
  };
  return { content: data.choices[0]?.message?.content ?? "", model: data.model };
}
