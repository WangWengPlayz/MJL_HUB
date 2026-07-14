// Homepage: live stats, client-side sort/filter, category filter.
async function loadStats() {
  try {
    const res = await fetch("/api/stats");
    const data = await res.json();
    const uptimeH = Math.floor(data.uptime_seconds / 3600);
    const uptimeM = Math.floor((data.uptime_seconds % 3600) / 60);
    setStat("uptime", `${uptimeH}h ${uptimeM}m`);
    setStat("storage", formatBytes(data.total_bytes));
    const lastScan = data.last_scan ? new Date(data.last_scan * 1000) : null;
    setStat("scan", lastScan ? relativeTime(lastScan) : "never");
  } catch (e) {
    /* ignore */
  }
}

function setStat(name, value) {
  const el = document.querySelector(`[data-stat="${name}"] .stat-value`);
  if (el) el.textContent = value;
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

function relativeTime(date) {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  return `${Math.floor(seconds / 3600)}h ago`;
}

function applyFilters() {
  const q = (document.getElementById("admin-search-home")?.value || "").toLowerCase();
  const activeTag = document.querySelector(".tag-btn.active")?.getAttribute("data-tag") || "";
  document.querySelectorAll("#script-grid .card").forEach((card) => {
    const name = card.getAttribute("data-name") || "";
    const tags = card.getAttribute("data-tags") || "";
    const matchesTag = !activeTag || tags.split(",").includes(activeTag.toLowerCase());
    const matchesText = !q || name.includes(q);
    card.style.display = matchesTag && matchesText ? "" : "none";
  });
}

document.querySelectorAll(".tag-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tag-btn").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    applyFilters();
  });
});

// Support-script (sp) pills: click to expand a small inline panel with the
// raw URL + copy actions, without leaving the card or the homepage.
document.querySelectorAll(".sp-pill").forEach((pill) => {
  pill.addEventListener("click", () => {
    const card = pill.closest(".card");
    const panel = card?.querySelector(".sp-panel");
    if (!panel) return;
    const alreadyOpenForThis = pill.classList.contains("active") && !panel.hidden;
    card.querySelectorAll(".sp-pill").forEach((p) => p.classList.remove("active"));
    if (alreadyOpenForThis) {
      panel.hidden = true;
      panel.classList.remove("open");
      return;
    }
    pill.classList.add("active");
    panel.innerHTML = `
      <div class="sp-panel-head">
        <span class="sp-panel-label">${pill.dataset.label}.js</span>
        <span class="sp-panel-meta">${pill.dataset.lines} lines &middot; ${formatBytes(parseInt(pill.dataset.size, 10) || 0)}</span>
      </div>
      <div class="loader-box">
        <code>${pill.dataset.loader}</code>
        <button class="copy-btn" data-copy="${pill.dataset.loader.replace(/"/g, "&quot;")}">Copy</button>
      </div>
      <div class="sp-panel-actions">
        <a class="btn btn-sm" href="${pill.dataset.raw}" target="_blank" rel="noopener">View raw</a>
        <button class="btn btn-sm copy-btn" data-copy="${pill.dataset.raw.replace(/"/g, "&quot;")}">Copy URL</button>
      </div>`;
    panel.hidden = false;
    requestAnimationFrame(() => panel.classList.add("open"));
  });
});

loadStats();
setInterval(loadStats, 15000);
