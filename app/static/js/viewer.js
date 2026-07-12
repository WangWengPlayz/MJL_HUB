// Script source viewer: fetch raw source, highlight, line numbers, search, fullscreen, theme, wrap.
(async function () {
  const codeBlock = document.getElementById("code-block");
  const viewer = document.getElementById("viewer");
  let sourceText = "";

  try {
    const res = await fetch(window.__RAW_URL__);
    sourceText = await res.text();
  } catch (e) {
    sourceText = "// failed to load source";
  }

  function render(highlightTerm) {
    const lines = sourceText.split("\n");
    codeBlock.innerHTML = lines
      .map((line) => {
        let safe = line
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;");
        if (highlightTerm) {
          const re = new RegExp(highlightTerm.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi");
          safe = safe.replace(re, (m) => `<mark class="hl">${m}</mark>`);
        }
        return `<span class="code-line">${safe}</span>`;
      })
      .join("\n");
    if (window.hljs && !highlightTerm) {
      codeBlock.className = "language-lua";
      hljs.highlightElement(codeBlock);
      // re-wrap into line spans after highlight.js processes it
      const html = codeBlock.innerHTML.split("\n");
      codeBlock.innerHTML = html.map((l) => `<span class="code-line">${l}</span>`).join("\n");
    }
  }

  render();

  document.getElementById("source-search")?.addEventListener("input", (e) => {
    render(e.target.value.trim());
  });

  document.getElementById("wrap-toggle")?.addEventListener("change", (e) => {
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

  document.getElementById("copy-source-btn")?.addEventListener("click", async () => {
    await copyText(sourceText);
    showToast("Source copied to clipboard");
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
