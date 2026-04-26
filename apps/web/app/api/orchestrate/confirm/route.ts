// POST /api/orchestrate/confirm
// Called by the studio UI when the user approves or cancels the payment gate.

import { NextResponse } from "next/server";
import { z } from "zod";
import { resolveApproval } from "@/lib/orchestrate/approval";

export const runtime = "nodejs";

const Body = z.object({
  sessionId: z.string().uuid(),
  approved: z.boolean().default(true),
});

export async function POST(req: Request) {
  let body: z.infer<typeof Body>;
  try {
    body = Body.parse(await req.json());
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 400 });
  }
  const found = resolveApproval(body.sessionId, body.approved);
  return NextResponse.json({ ok: found });
}
