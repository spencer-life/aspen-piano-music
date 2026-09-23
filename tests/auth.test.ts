import { afterEach, describe, expect, it, vi } from "vitest";
import { requireAspenAccess } from "../netlify/functions/_shared/auth.ts";

afterEach(() => {
  delete (globalThis as any).Netlify;
});

function setAccessCode(value: string | undefined) {
  (globalThis as any).Netlify = {
    env: {
      get: vi.fn((key: string) => key === "ASPEN_ACCESS_CODE" ? value : undefined),
    },
  };
}

describe("Aspen Keys private API access", () => {
  it("fails closed when no access code is configured", async () => {
    setAccessCode(undefined);
    const response = await requireAspenAccess(new Request("https://example.test/api/jobs"));
    expect(response?.status).toBe(503);
  });

  it("rejects an incorrect access code", async () => {
    setAccessCode("aspen-secret");
    const response = await requireAspenAccess(
      new Request("https://example.test/api/jobs", {
        headers: { "X-Aspen-Key": "wrong" },
      }),
    );
    expect(response?.status).toBe(401);
  });

  it("allows the configured access code", async () => {
    setAccessCode("aspen-secret");
    const response = await requireAspenAccess(
      new Request("https://example.test/api/jobs", {
        headers: { "X-Aspen-Key": "aspen-secret" },
      }),
    );
    expect(response).toBeNull();
  });
});
