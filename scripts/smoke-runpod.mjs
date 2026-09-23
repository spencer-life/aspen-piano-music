import fs from "node:fs/promises";\nimport { spawnSync } from "node:child_process";

const apiKey = process.env.RUNPOD_API_KEY;
const endpointId = process.env.RUNPOD_ENDPOINT_ID;
const sourceUrl = process.argv[2];
const title = process.argv[3] || "Aspen Keys Smoke Test";

if (!apiKey || !endpointId) {
  throw new Error("Set RUNPOD_API_KEY and RUNPOD_ENDPOINT_ID first.");
}
if (!sourceUrl) {
  throw new Error("Usage: node scripts/smoke-runpod.mjs <youtube-url> [title]");
}

const root = `https://api.runpod.ai/v2/${endpointId}`;
const headers = {
  authorization: apiKey,
  "content-type": "application/json",
};

async function request(path, init = {}) {
  const response = await fetch(`${root}${path}`, {
    ...init,
    headers: { ...headers, ...(init.headers || {}) },
  });
  const body = await response.json();
  if (!response.ok) throw new Error(JSON.stringify(body, null, 2));
  return body;
}

const started = await request("/run", {
  method: "POST",
  body: JSON.stringify({
    input: { source_url: sourceUrl, title },
  }),
});

console.log(`Started ${started.id}`);

for (;;) {
  await new Promise((resolve) => setTimeout(resolve, 10_000));
  const status = await request(`/status/${started.id}`);
  console.log(status.status);

  if (status.status === "COMPLETED") {
    const output = status.output;
    if (!output?.bundle_base64 || !output.bundle_name) {
      throw new Error("Worker completed without a bundle.");
    }
    const file = Buffer.from(output.bundle_base64, "base64");
    await fs.writeFile(output.bundle_name, file);
    console.log(`Saved ${output.bundle_name} (${file.length} bytes)`);
    break;
  }

  if (["FAILED", "CANCELLED", "TIMED_OUT"].includes(status.status)) {
    throw new Error(status.error || `RunPod job ended with ${status.status}`);
  }
}
