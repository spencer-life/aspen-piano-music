import type { Config, Context } from "@netlify/functions";
import { artifactStore, persistCompletedJob, runpodFetch, safeJobId } from "./_shared/runpod.ts";

export default async (_req: Request, context: Context) => {
  try {
    const jobId = safeJobId(context.params.jobId ?? "");
    const store = artifactStore(context);
    const saved = await store.get(`jobs/${jobId}/manifest.json`, { type: "json" });
    if (saved) {
      return Response.json({ status: "COMPLETED", ready: true, downloadUrl: `/api/jobs/${jobId}/download`, ...saved });
    }

    const status = await runpodFetch(`/status/${jobId}`);
    const normalized = String(status.status ?? "UNKNOWN").toUpperCase();
    if (normalized === "COMPLETED") {
      const persisted = await persistCompletedJob(context, jobId, status);
      if (!persisted) throw new Error("The worker completed without an artifact bundle.");
      return Response.json({
        status: normalized,
        ready: true,
        downloadUrl: `/api/jobs/${jobId}/download`,
        bundleName: persisted.bundleName,
        manifest: status.output?.manifest ?? {},
      });
    }

    if (["FAILED", "CANCELLED", "TIMED_OUT"].includes(normalized)) {
      return Response.json({ status: normalized, ready: false, error: status.error ?? "Arrangement failed." }, { status: 502 });
    }

    return Response.json({ status: normalized, ready: false });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to check the arrangement.";
    return Response.json({ error: message }, { status: 400 });
  }
};

export const config: Config = { path: "/api/jobs/:jobId" };
