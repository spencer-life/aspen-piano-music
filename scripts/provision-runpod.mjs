const apiKey = process.env.RUNPOD_API_KEY;
if (!apiKey) {
  throw new Error("Set RUNPOD_API_KEY before running this script.");
}

const image =
  process.env.RUNPOD_IMAGE ||
  "ghcr.io/spencer-life/aspen-piano-music-worker:latest";
const gpuTier = process.env.RUNPOD_GPU_TIER || "AMPERE_24";
const registryAuthId = process.env.RUNPOD_REGISTRY_AUTH_ID || "";
const suffix = (process.env.GITHUB_SHA || Date.now().toString(36)).slice(0, 8);

const q = (value) => JSON.stringify(String(value));

async function graphql(query) {
  const response = await fetch(
    `https://api.runpod.io/graphql?api_key=${encodeURIComponent(apiKey)}`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ query }),
    },
  );
  const body = await response.json();
  if (!response.ok || body.errors?.length) {
    throw new Error(JSON.stringify(body.errors || body, null, 2));
  }
  return body.data;
}

const registryField = registryAuthId
  ? `, containerRegistryAuthId: ${q(registryAuthId)}`
  : "";

const templateData = await graphql(`
  mutation {
    saveTemplate(input: {
      containerDiskInGb: 30,
      imageName: ${q(image)},
      isServerless: true,
      name: ${q(`Aspen Keys Worker ${suffix}`)},
      volumeInGb: 0
      ${registryField}
    }) {
      id
      name
      imageName
      isServerless
      containerDiskInGb
    }
  }
`);

const templateId = templateData.saveTemplate.id;

const endpointData = await graphql(`
  mutation {
    saveEndpoint(input: {
      gpuIds: ${q(gpuTier)},
      idleTimeout: 5,
      name: ${q("Aspen Keys")},
      flashBootType: FLASHBOOT,
      scalerType: "QUEUE_DELAY",
      scalerValue: 4,
      templateId: ${q(templateId)},
      workersMax: 1,
      workersMin: 0,
      type: "QB"
    }) {
      id
      name
      gpuIds
      idleTimeout
      flashBootType
      scalerType
      scalerValue
      templateId
      workersMax
      workersMin
    }
  }
`);

const endpoint = endpointData.saveEndpoint;
console.log(
  JSON.stringify(
    {
      template: templateData.saveTemplate,
      endpoint,
      netlify: {
        RUNPOD_ENDPOINT_ID: endpoint.id,
      },
    },
    null,
    2,
  ),
);
console.log(`\nRUNPOD_ENDPOINT_ID=${endpoint.id}`);
