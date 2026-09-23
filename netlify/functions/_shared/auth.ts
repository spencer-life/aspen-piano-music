const ACCESS_HEADER = "X-Aspen-Key";

export function isAccessConfigured() {
  return Boolean(Netlify.env.get("ASPEN_ACCESS_CODE")?.trim());
}

async function digest(value: string) {
  const bytes = new TextEncoder().encode(value);
  return new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
}

async function secureEqual(left: string, right: string) {
  const [a, b] = await Promise.all([digest(left), digest(right)]);
  if (a.length !== b.length) return false;

  let difference = 0;
  for (let index = 0; index < a.length; index += 1) {
    difference |= a[index] ^ b[index];
  }
  return difference === 0;
}

export async function requireAspenAccess(req: Request) {
  const expected = Netlify.env.get("ASPEN_ACCESS_CODE")?.trim();
  if (!expected) {
    return Response.json(
      { error: "Aspen Keys private access is not configured yet." },
      { status: 503 },
    );
  }

  const provided = req.headers.get(ACCESS_HEADER)?.trim() ?? "";
  if (!provided || !(await secureEqual(provided, expected))) {
    return Response.json(
      { error: "Enter the Aspen Keys access code to continue." },
      { status: 401 },
    );
  }

  return null;
}
