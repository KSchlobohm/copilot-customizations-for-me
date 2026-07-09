// HTML page shell for the summary canvas iframe. Uses the app's mirrored
// theme CSS variables (see create-canvas skill docs) with sane fallbacks so
// the canvas still looks reasonable if the host doesn't inject them.

import { renderMarkdown } from "./markdown.mjs";

const PAGE_CSS = `
  body {
    margin: 0;
    padding: 1.25rem 1.5rem 3rem;
    background: var(--background-color-default, #ffffff);
    color: var(--text-color-default, #1f2328);
    font-family: var(--font-sans, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif);
    font-size: var(--text-body-medium, 14px);
    line-height: var(--leading-body-medium, 20px);
  }
  h1, h2, h3, h4, h5, h6 {
    font-family: var(--font-sans-display, var(--font-sans, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif));
    font-weight: var(--font-weight-semibold, 600);
    margin: 1.25em 0 0.5em;
  }
  h1 { font-size: var(--text-title-large, 26px); line-height: var(--leading-title-large, 32px); margin-top: 0; }
  h2 { font-size: var(--text-title-medium, 20px); border-bottom: 1px solid var(--border-color-default, #d0d7de); padding-bottom: 0.3em; }
  code, pre { font-family: var(--font-mono, "SFMono-Regular", Consolas, "Liberation Mono", monospace); }
  code { font-size: var(--text-code-inline, 12px); background: var(--border-color-default, #eee); border-radius: 4px; padding: 0.1em 0.35em; }
  pre { background: var(--border-color-default, #f0f0f0); padding: 0.75em 1em; border-radius: 6px; overflow-x: auto; }
  pre code { background: none; padding: 0; }
  a { color: var(--true-color-blue, #0969da); }
  blockquote { margin: 0.5em 0; padding: 0 1em; border-left: 3px solid var(--border-color-default, #d0d7de); color: var(--text-color-muted, #59636e); }
  table { border-collapse: collapse; width: 100%; margin: 0.75em 0; }
  th, td { border: 1px solid var(--border-color-default, #d0d7de); padding: 0.4em 0.6em; text-align: left; vertical-align: top; }
  th { background: var(--border-color-default, #f6f8fa); }
  ul.task-list { list-style: none; padding-left: 0.25em; }
  ul.task-list li { margin: 0.25em 0; }
  ol.task-list { padding-left: 1.5em; }
  ol.task-list li { margin: 0.25em 0; }
  .task-list-section-label { margin: 0.75em 0 0.25em; font-size: var(--text-body-small, 12px); font-weight: var(--font-weight-semibold, 600);
    color: var(--text-color-muted, #59636e); text-transform: uppercase; letter-spacing: 0.03em; }
  hr { border: none; border-top: 1px solid var(--border-color-default, #d0d7de); margin: 1.5em 0; }
  details { border: 1px solid var(--border-color-default, #d0d7de); border-radius: 6px; padding: 0.5em 0.75em; margin: 0.75em 0; }
  summary { cursor: pointer; font-weight: var(--font-weight-semibold, 600); }
  .csc-stale { position: fixed; top: 0; left: 0; right: 0; background: var(--true-color-red-muted, #ffebe9); color: var(--text-color-default, #1f2328);
    padding: 0.35em 0.75em; font-size: var(--text-body-small, 12px); text-align: center; display: none; }
  .csc-stale.visible { display: block; }
`;

const CLIENT_SCRIPT = `
  const contentEl = document.getElementById('csc-content');
  const staleEl = document.getElementById('csc-stale');
  function connect() {
    const es = new EventSource('/events');
    es.addEventListener('update', (ev) => {
      try {
        const data = JSON.parse(ev.data);
        contentEl.innerHTML = data.html;
      } catch (e) { /* ignore malformed payloads */ }
    });
    es.onerror = () => {
      staleEl.classList.add('visible');
      es.close();
      setTimeout(connect, 1500);
    };
    es.onopen = () => staleEl.classList.remove('visible');
  }
  connect();
`;

export function renderPage({ title, html }) {
    return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>${title ? title.replace(/</g, "&lt;") : "Conversation summary"}</title>
    <style>${PAGE_CSS}</style>
  </head>
  <body>
    <div id="csc-stale" class="csc-stale">Reconnecting to canvas provider&hellip;</div>
    <div id="csc-content">${html}</div>
    <script>${CLIENT_SCRIPT}</script>
  </body>
</html>`;
}

export function renderContent(markdown) {
    return renderMarkdown(markdown);
}
