import type { Config } from "@netlify/functions";

export default async () => Response.json({ service: "Aspen Keys", ok: true });

export const config: Config = { path: "/api/health" };
