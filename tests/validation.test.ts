import { describe, expect, it } from "vitest";
import { normalizeCreatePayload } from "../netlify/functions/_shared/validation.ts";

describe("normalizeCreatePayload", () => {
  it("accepts a YouTube share URL", () => {
    expect(normalizeCreatePayload({ sourceUrl: "https://youtu.be/P883-nSegbY", title: "Goodday" })).toEqual({
      source_url: "https://youtu.be/P883-nSegbY",
      title: "Goodday",
    });
  });

  it("preserves an empty title so the worker can use YouTube metadata", () => {
    expect(normalizeCreatePayload({ sourceUrl: "https://youtu.be/P883-nSegbY" })).toEqual({
      source_url: "https://youtu.be/P883-nSegbY",
      title: "",
    });
  });

  it("rejects non-YouTube URLs", () => {
    expect(() => normalizeCreatePayload({ sourceUrl: "https://example.com/song" })).toThrow(/YouTube/);
  });
});
