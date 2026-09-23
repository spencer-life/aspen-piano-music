export async function registerWebMCPTools(app) {
  const modelContext = document.modelContext;
  if (!modelContext?.registerTool) return;

  const register = (tool) => modelContext.registerTool(tool);

  await register({
    name: "set_song_source",
    description: "Fill the visible Aspen Keys form with a YouTube song URL and optional sheet-music title. Does not start generation.",
    inputSchema: {
      type: "object",
      properties: {
        sourceUrl: {
          type: "string",
          description: "HTTPS YouTube video URL to arrange for piano.",
        },
        title: {
          type: "string",
          description: "Optional title to print on the generated sheet music.",
        },
      },
      required: ["sourceUrl"],
    },
    annotations: {
      readOnlyHint: false,
      consequentialHint: false,
      untrustedContentHint: true,
    },
    execute: async ({ sourceUrl, title }) => app.setSongSource({ sourceUrl, title }),
  });

  await register({
    name: "get_arrangement_state",
    description: "Read the current visible Aspen Keys form and arrangement status, including whether a download is ready.",
    inputSchema: { type: "object", properties: {} },
    annotations: {
      readOnlyHint: true,
      consequentialHint: false,
      untrustedContentHint: false,
    },
    execute: async () => app.getArrangementState(),
  });

  await register({
    name: "start_arrangement",
    description: "Start a real Aspen Keys piano-generation job using the visible form or supplied YouTube URL. This can consume paid GPU time.",
    inputSchema: {
      type: "object",
      properties: {
        sourceUrl: {
          type: "string",
          description: "Optional HTTPS YouTube video URL. If omitted, use the visible form value.",
        },
        title: {
          type: "string",
          description: "Optional sheet-music title.",
        },
      },
    },
    annotations: {
      readOnlyHint: false,
      consequentialHint: true,
      untrustedContentHint: true,
    },
    execute: async ({ sourceUrl, title }) => app.startArrangement({ sourceUrl, title }),
  });

  await register({
    name: "reset_arrangement",
    description: "Reset the visible Aspen Keys result/status area while keeping the page open.",
    inputSchema: { type: "object", properties: {} },
    annotations: {
      readOnlyHint: false,
      consequentialHint: false,
      untrustedContentHint: false,
    },
    execute: async () => app.resetArrangement(),
  });
}
