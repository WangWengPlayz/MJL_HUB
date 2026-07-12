// Script source viewer: fetch raw source, highlight, line numbers, search, fullscreen, theme, wrap.
//
// Large/minified scripts (a single very long line is common for Roblox
// loaders) can make highlight.js's grammar backtracking freeze the tab and
// make horizontal layout of one giant line tank scroll FPS. We detect that
// case and fall back to plain, wrapped text instead of hanging the page.
(async function () {
  const codeBlock = document.getElementById("code-block");
  const viewer = document.getElementById("viewer");
  const wrapToggle = document.getElementById("wrap-toggle");
  const searchInput = document.getElementById("source-search");
  let sourceText = "";
  let loadFailed = false;

  const MAX_HIGHLIGHT_CHARS = 120000; // total file size above which we skip hljs entirely
  const MAX_LINE_LENGTH = 4000; // any single line longer than this skips hljs (minified/obfuscated code)

  try {
    // Same-origin relative fetch -- avoids CORS entirely regardless of what
    // domain/proxy is serving the page (dev preview, custom domain, etc).
    const res = await fetch(`/script/${encodeURIComponent(window.__SCRIPT__)}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    sourceText = await res.text();
  } catch (e) {
    sourceText = "// failed to load source";
    loadFailed = true;
  }

  const longestLine = loadFailed ? 0 : Math.max(0, ...sourceText.split("\n").map((l) => l.length));
  const tooLargeForHighlight = sourceText.length > MAX_HIGHLIGHT_CHARS || longestLine > MAX_LINE_LENGTH;

  if (tooLargeForHighlight && !loadFailed) {
    const notice = document.createElement("p");
    notice.className = "muted";
    notice.textContent = "This file is large or minified (very long lines) — syntax highlighting is disabled and word wrap is on to keep the page responsive.";
    viewer.parentElement.insertBefore(notice, viewer);
    if (wrapToggle) wrapToggle.checked = true;
    viewer.classList.add("wrap");
  }

  function escapeHtml(text) {
    return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  function renderPlain(highlightTerm) {
    const lines = sourceText.split("\n");
    const re = highlightTerm
      ? new RegExp(highlightTerm.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi")
      : null;
    const html = lines
      .map((line) => {
        let safe = escapeHtml(line);
        if (re) safe = safe.replace(re, (m) => `<mark class="hl">${m}</mark>`);
        return `<span class="code-line">${safe}</span>`;
      })
      .join("\n");
    codeBlock.className = "";
    codeBlock.innerHTML = html;
  }

  function renderHighlighted() {
    codeBlock.textContent = sourceText;
    codeBlock.className = "language-lua";
    if (window.hljs) {
      hljs.highlightElement(codeBlock);
      const wrapped = codeBlock.innerHTML
        .split("\n")
        .map((l) => `<span class="code-line">${l}</span>`)
        .join("\n");
      codeBlock.innerHTML = wrapped;
    } else {
      renderPlain();
    }
  }

  function render(highlightTerm) {
    if (tooLargeForHighlight || highlightTerm) {
      renderPlain(highlightTerm);
    } else {
      renderHighlighted();
    }
  }

  render();

  let searchDebounce;
  searchInput?.addEventListener("input", (e) => {
    clearTimeout(searchDebounce);
    const value = e.target.value.trim();
    searchDebounce = setTimeout(() => render(value), 150);
  });

  wrapToggle?.addEventListener("change", (e) => {
    viewer.classList.toggle("wrap", e.target.checked);
  });

  document.getElementById("theme-toggle")?.addEventListener("click", (e) => {
    const html = document.documentElement;
    const isDark = html.getAttribute("data-theme") !== "light";
    html.setAttribute("data-theme", isDark ? "light" : "dark");
    e.target.textContent = isDark ? "Dark mode" : "Light mode";
  });

  document.getElementById("fullscreen-btn")?.addEventListener("click", () => {
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      viewer.requestFullscreen?.();
    }
  });

  document.getElementById("share-btn")?.addEventListener("click", () => {
    document.getElementById("share-links")?.classList.toggle("hidden");
  });

  document.getElementById("qr-btn")?.addEventListener("click", () => {
    const panel = document.getElementById("qr-panel");
    const img = document.getElementById("qr-img");
    if (!panel || !img) return;
    if (panel.classList.contains("hidden")) {
      img.src = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(window.__RAW_URL__)}`;
    }
    panel.classList.toggle("hidden");
  });
})();
