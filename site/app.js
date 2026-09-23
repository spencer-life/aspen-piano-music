import { registerWebMCPTools } from "./webmcp.js";

const form = document.querySelector("#arrangement-form");
const sourceInput = document.querySelector("#source-url");
const titleInput = document.querySelector("#song-title");
const generateButton = document.querySelector("#generate-button");
const statusRegion = document.querySelector("#status-region");
const statusTitle = document.querySelector("#status-title");
const statusCopy = document.querySelector("#status-copy");
const statusTime = document.querySelector("#status-time");
const progressBar = document.querySelector("#progress-bar");
const readyRegion = document.querySelector("#ready-region");
const readyTitle = document.querySelector("#ready-title");
const downloadButton = document.querySelector("#download-link");
const errorRegion = document.querySelector("#error-region");
const errorCopy = document.querySelector("#error-copy");
const retryButton = document.querySelector("#retry-button");
const accessDialog = document.querySelector("#access-dialog");
const accessForm = document.querySelector("#access-form");
const accessInput = document.querySelector("#access-code");
const accessError = document.querySelector("#access-error");
const accessCancel = document.querySelector("#access-cancel");

const POLL_MS = 5000;
const MAX_POLL_MS = 15 * 60 * 1000;
const ACCESS_STORAGE_KEY = "aspen-keys-access";
const JOB_STORAGE_KEY = "aspen-keys-active-job";
const RESUME_MAX_MS = 25 * 60 * 1000;

let activeJobId = null;
let pollTimer = null;
let startedAt = 0;
let elapsedTimer = null;
let currentState = "idle";
let readyDownloadUrl = null;
let readyBundleName = "Aspen Keys.zip";
let accessPromptResolve = null;

const statusText = {
  IN_QUEUE: ["Waiting for a piano…", "Your song is queued for the arrangement model.", 22],
  IN_PROGRESS: ["Listening and arranging…", "Aspen Keys is turning the song into a two-hand piano performance.", 62],
  COMPLETED: ["Finishing the score…", "The arrangement is being packaged for download.", 92],
};

function accessCode() {
  return window.localStorage.getItem(ACCESS_STORAGE_KEY) || "";
}

function requestAccessCode({ invalid = false } = {}) {
  if (accessPromptResolve) {
    throw new Error("The Aspen Keys access prompt is already open.");
  }

  accessInput.value = invalid ? "" : accessCode();
  accessError.hidden = !invalid;
  if (!accessDialog.open) accessDialog.showModal();
  window.setTimeout(() => accessInput.focus(), 0);

  return new Promise((resolve) => {
    accessPromptResolve = resolve;
  });
}

function resolveAccessPrompt(value) {
  if (!accessPromptResolve) return;
  const resolve = accessPromptResolve;
  accessPromptResolve = null;
  resolve(value);
}

async function apiFetch(url, init = {}) {
  let code = accessCode();
  let invalid = false;

  for (;;) {
    const headers = new Headers(init.headers || {});
    headers.set("Accept", headers.get("Accept") || "application/json");
    if (code) headers.set("X-Aspen-Key", code);

    const response = await fetch(url, { ...init, headers });
    if (response.status !== 401) return response;

    window.localStorage.removeItem(ACCESS_STORAGE_KEY);
    const nextCode = await requestAccessCode({ invalid: invalid || Boolean(code) });
    if (!nextCode) return response;

    code = nextCode;
    invalid = true;
    window.localStorage.setItem(ACCESS_STORAGE_KEY, code);
  }
}

function setState(next) {
  currentState = next;
  document.body.dataset.state = next;
}

function formatElapsed(ms) {
  const seconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(seconds / 60);
  const remainder = String(seconds % 60).padStart(2, "0");
  return minutes ? `${minutes}:${remainder}` : `0:${remainder}`;
}

function startClock(started = Date.now()) {
  stopClock();
  startedAt = started;
  statusTime.textContent = formatElapsed(Date.now() - startedAt);
  elapsedTimer = window.setInterval(() => {
    statusTime.textContent = formatElapsed(Date.now() - startedAt);
  }, 1000);
}

function stopClock() {
  if (elapsedTimer) window.clearInterval(elapsedTimer);
  elapsedTimer = null;
}

function clearPoll() {
  if (pollTimer) window.clearTimeout(pollTimer);
  pollTimer = null;
}

function saveActiveJob() {
  if (!activeJobId) return;
  window.localStorage.setItem(
    JOB_STORAGE_KEY,
    JSON.stringify({
      jobId: activeJobId,
      sourceUrl: sourceInput.value.trim(),
      title: titleInput.value.trim(),
      startedAt,
    }),
  );
}

function clearActiveJob() {
  window.localStorage.removeItem(JOB_STORAGE_KEY);
}

function readActiveJob() {
  try {
    const raw = window.localStorage.getItem(JOB_STORAGE_KEY);
    if (!raw) return null;
    const value = JSON.parse(raw);
    if (
      !value ||
      typeof value.jobId !== "string" ||
      typeof value.startedAt !== "number" ||
      Date.now() - value.startedAt > RESUME_MAX_MS
    ) {
      clearActiveJob();
      return null;
    }
    return value;
  } catch {
    clearActiveJob();
    return null;
  }
}

function resetOutput() {
  clearPoll();
  stopClock();
  activeJobId = null;
  clearActiveJob();
  readyDownloadUrl = null;
  readyBundleName = "Aspen Keys.zip";
  statusRegion.hidden = true;
  readyRegion.hidden = true;
  errorRegion.hidden = true;
  generateButton.disabled = false;
  progressBar.style.width = "12%";
  setState("idle");
}

function setStatus(status) {
  const normalized = String(status || "IN_QUEUE").toUpperCase();
  const [heading, copy, progress] = statusText[normalized] || statusText.IN_PROGRESS;
  statusRegion.hidden = false;
  readyRegion.hidden = true;
  errorRegion.hidden = true;
  statusTitle.textContent = heading;
  statusCopy.textContent = copy;
  progressBar.style.width = `${progress}%`;
  setState(normalized.toLowerCase());
}

function showError(message) {
  clearPoll();
  stopClock();
  statusRegion.hidden = true;
  readyRegion.hidden = true;
  errorRegion.hidden = false;
  errorCopy.textContent = message || "Try the link again in a moment.";
  generateButton.disabled = false;
  setState("error");
}

function showReady(payload) {
  clearPoll();
  stopClock();
  statusRegion.hidden = true;
  errorRegion.hidden = true;
  readyRegion.hidden = false;
  const chosenTitle = titleInput.value.trim();
  readyTitle.textContent = chosenTitle
    ? `${chosenTitle} is ready.`
    : "Your piano arrangement is ready.";
  readyDownloadUrl = payload.downloadUrl;
  readyBundleName = payload.bundleName || "Aspen Keys.zip";
  generateButton.disabled = false;
  setState("ready");
}

async function responsePayload(response) {
  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("application/json")) return response.json();
  return { error: await response.text() };
}

async function pollJob(jobId) {
  try {
    if (Date.now() - startedAt > MAX_POLL_MS) {
      throw new Error("This arrangement is taking longer than expected. Try again in a moment.");
    }

    const response = await apiFetch(`/api/jobs/${encodeURIComponent(jobId)}`);
    const payload = await responsePayload(response);
    if (!response.ok) throw new Error(payload.error || "The arrangement could not be completed.");

    setStatus(payload.status);
    if (payload.ready && payload.downloadUrl) {
      showReady(payload);
      return;
    }

    pollTimer = window.setTimeout(() => pollJob(jobId), POLL_MS);
  } catch (error) {
    showError(error instanceof Error ? error.message : "The arrangement could not be completed.");
  }
}

async function downloadBundle() {
  if (!readyDownloadUrl) return;
  downloadButton.disabled = true;

  try {
    const response = await apiFetch(readyDownloadUrl);
    if (!response.ok) {
      const payload = await responsePayload(response);
      throw new Error(payload.error || "The download is not available yet.");
    }

    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = objectUrl;
    link.download = readyBundleName;
    document.body.append(link);
    link.click();
    link.remove();
    clearActiveJob();
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 30_000);
  } catch (error) {
    showError(error instanceof Error ? error.message : "The download could not be opened.");
  } finally {
    downloadButton.disabled = false;
  }
}

export function setSongSource({ sourceUrl = "", title = "" } = {}) {
  sourceInput.value = sourceUrl;
  titleInput.value = title;
  sourceInput.dispatchEvent(new Event("input", { bubbles: true }));
  titleInput.dispatchEvent(new Event("input", { bubbles: true }));
  return getArrangementState();
}

export function getArrangementState() {
  return {
    state: currentState,
    sourceUrl: sourceInput.value.trim(),
    title: titleInput.value.trim(),
    jobId: activeJobId,
    ready: currentState === "ready",
    downloadUrl: currentState === "ready" ? readyDownloadUrl : null,
  };
}

export function resetArrangement() {
  resetOutput();
  sourceInput.focus();
  return getArrangementState();
}

export async function startArrangement({ sourceUrl, title } = {}) {
  if (sourceUrl !== undefined || title !== undefined) {
    setSongSource({
      sourceUrl: sourceUrl ?? sourceInput.value,
      title: title ?? titleInput.value,
    });
  }

  const source = sourceInput.value.trim();
  const sheetTitle = titleInput.value.trim();

  if (!source) {
    sourceInput.focus();
    showError("Paste the YouTube link you want to arrange.");
    throw new Error("A YouTube link is required.");
  }

  clearPoll();
  stopClock();
  readyRegion.hidden = true;
  errorRegion.hidden = true;
  statusRegion.hidden = false;
  generateButton.disabled = true;
  statusTitle.textContent = "Sending the song to the piano…";
  statusCopy.textContent = "This should only take a moment.";
  progressBar.style.width = "10%";
  setState("starting");
  startClock();

  try {
    const response = await apiFetch("/api/jobs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sourceUrl: source, title: sheetTitle }),
    });
    const payload = await responsePayload(response);
    if (!response.ok || !payload.jobId) {
      throw new Error(payload.error || "Aspen Keys could not start this arrangement.");
    }

    activeJobId = payload.jobId;
    setStatus(payload.status || "IN_QUEUE");
    saveActiveJob();
    pollTimer = window.setTimeout(() => pollJob(activeJobId), 1200);
    return getArrangementState();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Aspen Keys could not start this arrangement.";
    showError(message);
    throw error;
  }
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  startArrangement().catch(() => {});
});

retryButton.addEventListener("click", () => {
  errorRegion.hidden = true;
  sourceInput.focus();
});

downloadButton.addEventListener("click", () => {
  downloadBundle().catch(() => {});
});

accessForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const code = accessInput.value.trim();
  if (!code) return;
  window.localStorage.setItem(ACCESS_STORAGE_KEY, code);
  accessDialog.close();
  resolveAccessPrompt(code);
});

accessCancel.addEventListener("click", () => {
  accessDialog.close();
  resolveAccessPrompt(null);
});

accessDialog.addEventListener("cancel", (event) => {
  event.preventDefault();
  accessDialog.close();
  resolveAccessPrompt(null);
});

function restoreActiveJob() {
  const saved = readActiveJob();
  if (!saved) return;

  activeJobId = saved.jobId;
  sourceInput.value = saved.sourceUrl || "";
  titleInput.value = saved.title || "";
  readyRegion.hidden = true;
  errorRegion.hidden = true;
  statusRegion.hidden = false;
  generateButton.disabled = true;
  setStatus("IN_QUEUE");
  startClock(saved.startedAt);
  pollTimer = window.setTimeout(() => pollJob(activeJobId), 350);
}

registerWebMCPTools({
  setSongSource,
  startArrangement,
  getArrangementState,
  resetArrangement,
});

restoreActiveJob();
