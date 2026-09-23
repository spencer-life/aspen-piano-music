import type { Config } from "@netlify/functions";
import { runpodFetch } from "./_shared/runpod.ts";
import { normalizeCreatePayload } from "./_shared/validation.ts";

export default async (req: Request) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  try {
    const input = normalizeCreatePayload(await req.json());
    const result = await runpodFetch("/run", {
      method: "POST",
      body: JSON.stringify({ input }),
    });
    return Response.json({ jobId: result.id, status: result.status ?? "IN_QUEUE" }, { status: 202 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to start the arrangement.";
    return Response.json({ error: message }, { status: 400 });
  }
};

export const config: Config = {
  path: "/api/jobs",
  rateLimit: { action: "rate_limit", aggregateBy: "ip", windowSize: 60, windowLimit: 10 },
};
