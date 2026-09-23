import type { Config } from "@netlify/functions";
import { isAccessConfigured } from "./_shared/auth.ts";

export default async () => {
  const runpodConfigured = Boolean(
    Netlify.env.get("RUNPOD_API_KEY") && Netlify.env.get("RUNPOD_ENDPOINT_ID"),
  );
  const accessConfigured = isAccessConfigured();

  return Response.json({
    service: "Aspen Keys",
    ok: true,
    ready: runpodConfigured && accessConfigured,
    runpodConfigured,
    accessConfigured,
  });
};

export const config: Config = { path: "/api/health" };
