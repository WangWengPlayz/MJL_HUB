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

document.getElementById("sort-select")?.addEventListener("change", async (e) => {
  try {
    const res = await fetch(`/api/scripts?sort=${e.target.value}`);
    const data = await res.json();
    const grid = document.getElementById("script-grid");
    if (!grid || !data.scripts) return;
    grid.innerHTML = data.scripts
      .map(
        (s) => `
      <article class="card" data-name="${s.name.toLowerCase()}" data-tags="${s.tags.join(",").toLowerCase()}">
        <div class="card-head"><h3><a href="/scripts/${encodeURIComponent(s.name)}">${s.name}</a></h3><span class="badge">v${s.checksum.slice(0, 6)}</span></div>
        <p class="card-meta">Updated ${s.updated_at} UTC &middot; ${s.size_bytes} bytes</p>
        ${s.tags.length ? `<div class="card-tags">${s.tags.map((t) => `<span class="tag">${t}</span>`).join("")}</div>` : ""}
        <div class="loader-box"><code>${s.loader}</code><button class="copy-btn" data-copy="${s.loader.replace(/"/g, "&quot;")}">Copy</button></div>
        <div class="card-actions">
          <button class="btn btn-primary btn-sm copy-btn" data-copy="${s.loader.replace(/"/g, "&quot;")}">Copy Loader</button>
          <a class="btn btn-sm" href="/scripts/${encodeURIComponent(s.name)}">View Source</a>
          <a class="btn btn-sm" href="${s.raw_url}" download>Download</a>
        </div>
      </article>`
      )
      .join("");
    document.getElementById("script-count").textContent = data.count;
  } catch (err) {
    /* ignore */
  }
});

loadStats();
setInterval(loadStats, 15000);
