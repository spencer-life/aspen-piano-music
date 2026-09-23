import { getDeployStore, getStore } from "@netlify/blobs";
import type { Context } from "@netlify/functions";

const RUNPOD_ROOT = "https://api.runpod.ai/v2";
const STORE_NAME = "aspen-keys-artifacts";

export type RunpodStatus = {
  id?: string;
  status?: string;
  output?: {
    bundle_name?: string;
    bundle_base64?: string;
    bundle_bytes?: number;
    manifest?: Record<string, unknown>;
  };
  error?: string;
};

export function getRunpodConfig() {
  const apiKey = Netlify.env.get("RUNPOD_API_KEY");
  const endpointId = Netlify.env.get("RUNPOD_ENDPOINT_ID");
  if (!apiKey || !endpointId) {
    throw new Error("RunPod is not configured yet.");
  }
  return { apiKey, endpointId };
}

export function artifactStore(context: Context) {
  if (context.deploy?.context === "production") {
    return getStore(STORE_NAME, { consistency: "strong" });
  }
  return getDeployStore(STORE_NAME);
}

export async function runpodFetch(path: string, init: RequestInit = {}) {
  const { apiKey, endpointId } = getRunpodConfig();
  const response = await fetch(`${RUNPOD_ROOT}/${endpointId}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  const body = (await response.json()) as RunpodStatus;
  if (!response.ok) {
    throw new Error(body.error || `RunPod request failed (${response.status}).`);
  }
  return body;
}

export function safeJobId(value: string) {
  if (!/^[A-Za-z0-9_-]{4,128}$/.test(value)) {
    throw new Error("Invalid job ID.");
  }
  return value;
}

export async function persistCompletedJob(context: Context, jobId: string, status: RunpodStatus) {
  const output = status.output;
  if (!output?.bundle_base64 || !output.bundle_name) return null;

  const store = artifactStore(context);
  const bundleKey = `jobs/${jobId}/bundle.zip`;
  const manifestKey = `jobs/${jobId}/manifest.json`;
  const bytes = Uint8Array.from(atob(output.bundle_base64), (char) => char.charCodeAt(0));
  await store.set(bundleKey, bytes.buffer);
  await store.setJSON(manifestKey, {
    bundleName: output.bundle_name,
    bundleBytes: output.bundle_bytes ?? bytes.byteLength,
    manifest: output.manifest ?? {},
  });

  return { bundleKey, manifestKey, bundleName: output.bundle_name };
}
