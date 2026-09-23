# Aspen Keys — Browser agent tools

Aspen Keys exposes a small WebMCP surface from the production page so agents can use the same visible user journey instead of scraping the DOM.

## Chrome DevTools MCP

Current Chrome DevTools MCP can discover and execute WebMCP tools when its experimental WebMCP category is enabled.

Codex one-time setup:

```bash
codex mcp add chrome-devtools -- npx -y chrome-devtools-mcp@latest --categoryExperimentalWebmcp=true
```

Or run it directly for another MCP client:

```bash
npx -y chrome-devtools-mcp@latest --categoryExperimentalWebmcp=true
```

Do not run a remote-debugging Chrome profile while signed into sensitive sites.

## Page tools

The site feature-detects the current WebMCP imperative API at `document.modelContext`. Unsupported browsers simply skip registration.

Registered tools:

- `set_song_source`: fills the visible URL/title fields without starting work.
- `get_arrangement_state`: reads visible form/job state; read-only.
- `start_arrangement`: starts the same real generation path as the button. It is marked consequential because it can consume paid RunPod GPU time.
- `reset_arrangement`: resets the visible result/status state.

Never add hidden admin operations, secret reads, RunPod credentials, or deployment controls to the production WebMCP surface.

## Agent QA loop

1. Open the Netlify preview/production URL in Chrome DevTools MCP.
2. Call `list_webmcp_tools`.
3. Use `set_song_source` with a harmless YouTube test.
4. Inspect responsive rendering and accessibility.
5. Do **not** call `start_arrangement` in automated loops unless real GPU spend was explicitly intended.
6. For end-to-end production validation, call it once, wait for ready, download the bundle, and inspect the PDF/audio.

WebMCP is experimental. Keep the feature-detection fallback and update the page tools when Chrome's current API changes.
