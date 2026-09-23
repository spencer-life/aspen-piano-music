const YOUTUBE_HOSTS = new Set(["youtube.com", "www.youtube.com", "m.youtube.com", "music.youtube.com", "youtu.be"]);

export function normalizeCreatePayload(value: unknown) {
  if (!value || typeof value !== "object") throw new Error("Request body is required.");
  const body = value as Record<string, unknown>;
  const sourceUrl = String(body.sourceUrl ?? "").trim();
  const title = String(body.title ?? "").trim().slice(0, 96);

  let url: URL;
  try {
    url = new URL(sourceUrl);
  } catch {
    throw new Error("Paste a valid YouTube URL.");
  }
  if (url.protocol !== "https:" || !YOUTUBE_HOSTS.has(url.hostname.toLowerCase())) {
    throw new Error("Paste a valid YouTube URL.");
  }
  return { source_url: sourceUrl, title };
}
