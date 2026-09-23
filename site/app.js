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
const downloadLink = document.querySelector("#download-link");
const errorRegion = document.querySelector("#error-region");
const errorCopy = document.querySelector("#error-copy");
const retryButton = document.querySelector("#retry-button");

const POLL_MS = 5000;
const MAX_POLL_MS = 15 * 60 * 1000;

let activeJobId = null;
let pollTimer = null;
let startedAt = 0;
let elapsedTimer = null;
let currentState = "idle";

const statusText = {
  IN_QUEUE: ["Waiting for a piano…", "Your song is queued for the arrangement model.", 22],
  IN_PROGRESS: ["Listening and arranging…", "Aspen Keys is turning the song into a two-hand piano performance.", 62],
  COMPLETED: ["Finishing the score…", "The arrangement is being packaged for download.", 92],
};

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

function startClock() {
  stopClock();
  startedAt = Date.now();
  statusTime.textContent = "0:00";
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

function resetOutput() {
  clearPoll();
  stopClock();
  activeJobId = null;
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
  downloadLink.href = payload.downloadUrl;
  generateButton.disabled = false;
  setState("ready");
}

async function pollJob(jobId) {
  try {
    if (Date.now() - startedAt > MAX_POLL_MS) {
      throw new Error("This arrangement is taking longer than expected. Try again in a moment.");
    }

    const response = await fetch(`/api/jobs/${encodeURIComponent(jobId)}`, {
      headers: { Accept: "application/json" },
    });
    const payload = await response.json();
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
    downloadUrl: currentState === "ready" ? downloadLink.href : null,
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
    const response = await fetch("/api/jobs", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ sourceUrl: source, title: sheetTitle }),
    });
    const payload = await response.json();
    if (!response.ok || !payload.jobId) {
      throw new Error(payload.error || "Aspen Keys could not start this arrangement.");
    }

    activeJobId = payload.jobId;
    setStatus(payload.status || "IN_QUEUE");
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

registerWebMCPTools({
  setSongSource,
  startArrangement,
  getArrangementState,
  resetArrangement,
});
