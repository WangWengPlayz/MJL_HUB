(function () {
  const root = document.getElementById("admin-root");
  if (!root) return;
  const csrf = root.getAttribute("data-csrf") || "";

  function authHeaders() {
    return { "X-CSRF-Token": csrf };
  }

  async function api(path, options = {}) {
    const res = await fetch(path, {
      ...options,
      headers: { ...(options.headers || {}), ...authHeaders() },
    });
    if (res.status === 401) {
      window.location.href = "/login";
      throw new Error("unauthenticated");
    }
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || `Request failed (${res.status})`);
    }
    const ct = res.headers.get("content-type") || "";
    return ct.includes("application/json") ? res.json() : res.text();
  }

  // -- tabs -------------------------------------------------------------
  document.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".tab-btn").forEach((b) => b.classList.remove("active"));
      document.querySelectorAll(".tab-panel").forEach((p) => p.classList.remove("active"));
      btn.classList.add("active");
      document.querySelector(`.tab-panel[data-panel="${btn.dataset.tab}"]`)?.classList.add("active");
      if (btn.dataset.tab === "scripts") loadScripts();
      if (btn.dataset.tab === "overview") loadStats();
      if (btn.dataset.tab === "logs") loadLogs("activity");
      if (btn.dataset.tab === "users") loadUsers();
    });
  });

  document.getElementById("logout-btn")?.addEventListener("click", async () => {
    await api("/admin/api/logout", { method: "POST" });
    window.location.href = "/login";
  });

  // -- overview -----------------------------------------------------------
  function fmtBytes(b) {
    if (b < 1024) return `${b} B`;
    if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
    return `${(b / 1024 / 1024).toFixed(2)} MB`;
  }

  async function loadStats() {
    try {
      const s = await api("/admin/api/stats");
      const uptimeH = Math.floor(s.uptime_seconds / 3600);
      const uptimeM = Math.floor((s.uptime_seconds % 3600) / 60);
      const cards = [
        ["Total scripts", s.total_scripts],
        ["Storage used", fmtBytes(s.total_bytes)],
        ["Disk free", fmtBytes(s.disk_free)],
        ["Uptime", `${uptimeH}h ${uptimeM}m`],
        ["Last scan", s.last_scan ? new Date(s.last_scan * 1000).toLocaleTimeString() : "never"],
      ];
      document.getElementById("admin-stats").innerHTML = cards
        .map(([label, value]) => `<div class="stat-card"><span class="stat-value">${value}</span><span class="stat-label">${label}</span></div>`)
        .join("");
    } catch (e) {
      showToast(e.message, true);
    }
  }

  // -- scripts table -----------------------------------------------------
  let allScripts = [];

  async function loadScripts() {
    const data = await api("/api/scripts?sort=updated");
    allScripts = data.scripts;
    renderScripts();
  }

  function renderScripts() {
    const q = (document.getElementById("admin-search").value || "").toLowerCase();
    const filtered = allScripts.filter((s) => s.name.toLowerCase().includes(q));
    document.getElementById("admin-table-body").innerHTML = filtered
      .map(
        (s) => `
      <tr data-filename="${s.filename}">
        <td><input type="checkbox" class="row-check" value="${s.filename}"></td>
        <td>${s.name}</td>
        <td>${s.filename}</td>
        <td>${fmtBytes(s.size_bytes)}</td>
        <td>${s.updated_at}</td>
        <td class="row-actions">
          <button class="btn btn-sm" data-action="edit" data-filename="${s.filename}">Edit</button>
          <button class="btn btn-sm" data-action="rename" data-filename="${s.filename}">Rename</button>
          <button class="btn btn-sm" data-action="replace" data-filename="${s.filename}">Replace</button>
          <a class="btn btn-sm" href="/scripts/${encodeURIComponent(s.name)}" target="_blank">View</a>
          <button class="btn btn-sm btn-danger" data-action="delete" data-filename="${s.filename}">Delete</button>
        </td>
      </tr>`
      )
      .join("");
  }

  document.getElementById("admin-search")?.addEventListener("input", renderScripts);
  document.getElementById("select-all")?.addEventListener("change", (e) => {
    document.querySelectorAll(".row-check").forEach((cb) => (cb.checked = e.target.checked));
  });

  document.getElementById("admin-table-body")?.addEventListener("click", async (e) => {
    const btn = e.target.closest("button[data-action]");
    if (!btn) return;
    const filename = btn.dataset.filename;
    const action = btn.dataset.action;
    if (action === "delete") {
      if (!confirm(`Delete ${filename}? This cannot be undone.`)) return;
      try {
        await api(`/admin/api/script/${encodeURIComponent(filename)}`, { method: "DELETE" });
        showToast(`Deleted ${filename}`);
        loadScripts();
      } catch (err) {
        showToast(err.message, true);
      }
    } else if (action === "edit") {
      openEditModal(filename);
    } else if (action === "rename") {
      openRenameModal(filename);
    } else if (action === "replace") {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = ".js";
      input.onchange = async () => {
        if (!input.files.length) return;
        const fd = new FormData();
        fd.append("filename", filename);
        fd.append("file", input.files[0]);
        try {
          await api("/admin/api/replace", { method: "POST", body: fd });
          showToast(`Replaced ${filename}`);
          loadScripts();
        } catch (err) {
          showToast(err.message, true);
        }
      };
      input.click();
    }
  });

  document.getElementById("bulk-delete-btn")?.addEventListener("click", async () => {
    const files = [...document.querySelectorAll(".row-check:checked")].map((cb) => cb.value);
    if (!files.length) return showToast("Select at least one script", true);
    if (!confirm(`Delete ${files.length} script(s)?`)) return;
    try {
      await api("/admin/api/bulk-delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(files),
      });
      showToast("Bulk delete complete");
      loadScripts();
    } catch (err) {
      showToast(err.message, true);
    }
  });

  // -- edit modal ---------------------------------------------------------
  let editingFilename = null;
  async function openEditModal(filename) {
    editingFilename = filename;
    const data = await api(`/admin/api/source/${encodeURIComponent(filename)}`);
    document.getElementById("edit-modal-title").textContent = `Edit ${filename}`;
    document.getElementById("edit-textarea").value = data.content;
    document.getElementById("edit-modal").classList.remove("hidden");
  }
  document.getElementById("edit-cancel")?.addEventListener("click", () => document.getElementById("edit-modal").classList.add("hidden"));
  document.getElementById("edit-save")?.addEventListener("click", async () => {
    const content = document.getElementById("edit-textarea").value;
    try {
      const fd = new FormData();
      fd.append("filename", editingFilename);
      fd.append("content", content);
      await api("/admin/api/edit", { method: "POST", body: fd });
      showToast("Saved");
      document.getElementById("edit-modal").classList.add("hidden");
      loadScripts();
    } catch (err) {
      showToast(err.message, true);
    }
  });

  // -- rename modal ---------------------------------------------------------
  let renamingFilename = null;
  function openRenameModal(filename) {
    renamingFilename = filename;
    document.getElementById("rename-input").value = filename;
    document.getElementById("rename-modal").classList.remove("hidden");
  }
  document.getElementById("rename-cancel")?.addEventListener("click", () => document.getElementById("rename-modal").classList.add("hidden"));
  document.getElementById("rename-save")?.addEventListener("click", async () => {
    const newName = document.getElementById("rename-input").value.trim();
    try {
      const fd = new FormData();
      fd.append("old_filename", renamingFilename);
      fd.append("new_filename", newName);
      await api("/admin/api/rename", { method: "POST", body: fd });
      showToast("Renamed");
      document.getElementById("rename-modal").classList.add("hidden");
      loadScripts();
    } catch (err) {
      showToast(err.message, true);
    }
  });

  // -- upload ---------------------------------------------------------
  const dropZone = document.getElementById("drop-zone");
  const fileInput = document.getElementById("file-input");

  async function uploadFiles(files) {
    const resultsEl = document.getElementById("upload-results");
    resultsEl.innerHTML = "";
    for (const file of files) {
      const fd = new FormData();
      fd.append("file", file);
      try {
        await api("/admin/api/upload", { method: "POST", body: fd });
        resultsEl.innerHTML += `<div>&#10003; ${file.name} uploaded</div>`;
      } catch (err) {
        resultsEl.innerHTML += `<div style="color:var(--danger)">&#10007; ${file.name}: ${err.message}</div>`;
      }
    }
    showToast("Upload complete");
  }

  dropZone?.addEventListener("dragover", (e) => {
    e.preventDefault();
    dropZone.classList.add("dragover");
  });
  dropZone?.addEventListener("dragleave", () => dropZone.classList.remove("dragover"));
  dropZone?.addEventListener("drop", (e) => {
    e.preventDefault();
    dropZone.classList.remove("dragover");
    uploadFiles([...e.dataTransfer.files]);
  });
  fileInput?.addEventListener("change", () => uploadFiles([...fileInput.files]));

  // -- logs ---------------------------------------------------------
  async function loadLogs(kind) {
    const data = await api(`/admin/api/logs/${kind}`);
    document.getElementById("logs-view").textContent = data.entries.map((e) => JSON.stringify(e)).join("\n") || "No entries yet.";
  }
  document.querySelectorAll("[data-log]").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll("[data-log]").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      loadLogs(btn.dataset.log);
    });
  });

  // -- users ---------------------------------------------------------
  async function loadUsers() {
    const data = await api("/admin/api/users");
    document.getElementById("users-table-body").innerHTML = data.users
      .map(
        (u) => `<tr><td>${u.username}</td><td>${new Date(u.created_at * 1000).toLocaleDateString()}</td>
        <td><button class="btn btn-sm btn-danger" data-user="${u.username}">Remove</button></td></tr>`
      )
      .join("");
  }
  document.getElementById("add-user-form")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    try {
      await api("/admin/api/users", { method: "POST", body: fd });
      showToast("Admin added");
      e.target.reset();
      loadUsers();
    } catch (err) {
      showToast(err.message, true);
    }
  });
  document.getElementById("users-table-body")?.addEventListener("click", async (e) => {
    const btn = e.target.closest("button[data-user]");
    if (!btn) return;
    if (!confirm(`Remove admin ${btn.dataset.user}?`)) return;
    try {
      await api(`/admin/api/users/${encodeURIComponent(btn.dataset.user)}`, { method: "DELETE" });
      loadUsers();
    } catch (err) {
      showToast(err.message, true);
    }
  });

  // -- account ---------------------------------------------------------
  document.getElementById("change-password-form")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    try {
      await api("/admin/api/change-password", { method: "POST", body: fd });
      showToast("Password updated");
      e.target.reset();
    } catch (err) {
      showToast(err.message, true);
    }
  });

  loadStats();
  loadScripts();
})();
