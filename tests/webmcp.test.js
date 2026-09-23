import { afterEach, describe, expect, it, vi } from "vitest";
import { registerWebMCPTools } from "../site/webmcp.js";

afterEach(() => {
  delete globalThis.document;
});

describe("Aspen Keys WebMCP", () => {
  it("registers only the visible user journey", async () => {
    const tools = [];
    globalThis.document = {
      modelContext: {
        registerTool: vi.fn(async (tool) => tools.push(tool)),
      },
    };

    const app = {
      setSongSource: vi.fn(),
      startArrangement: vi.fn(),
      getArrangementState: vi.fn(),
      resetArrangement: vi.fn(),
    };

    await registerWebMCPTools(app);

    expect(tools.map((tool) => tool.name)).toEqual([
      "set_song_source",
      "get_arrangement_state",
      "start_arrangement",
      "reset_arrangement",
    ]);
    expect(tools.find((tool) => tool.name === "get_arrangement_state").annotations.readOnlyHint).toBe(true);
    expect(tools.find((tool) => tool.name === "start_arrangement").annotations.consequentialHint).toBe(true);
  });

  it("does nothing when WebMCP is unavailable", async () => {
    globalThis.document = {};
    await expect(registerWebMCPTools({})).resolves.toBeUndefined();
  });
});
