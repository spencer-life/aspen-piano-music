import type { Config, Context } from "@netlify/functions";
import { requireAspenAccess } from "./_shared/auth.ts";
import { artifactStore, safeJobId } from "./_shared/runpod.ts";

export default async (req: Request, context: Context) => {
  const accessResponse = await requireAspenAccess(req);
  if (accessResponse) return accessResponse;

  try {
    const jobId = safeJobId(context.params.jobId ?? "");
    const store = artifactStore(context);
    const manifest = await store.get(`jobs/${jobId}/manifest.json`, { type: "json" }) as { bundleName?: string } | null;
    const bundle = await store.get(`jobs/${jobId}/bundle.zip`, { type: "arrayBuffer" });
    if (!manifest || !bundle) return new Response("Not found", { status: 404 });

    const filename = (manifest.bundleName || "Aspen Keys.zip").replace(/[\r\n\"]/g, "");
    return new Response(bundle, {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
};

export const config: Config = { path: "/api/jobs/:jobId/download" };
