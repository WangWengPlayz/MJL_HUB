// Shared helpers: toast notifications, clipboard copy, live global search.

// Block manual text selection/copy (via keyboard, context menu, or drag
// selection) everywhere except real form fields -- use the dedicated Copy
// buttons instead. This is a UX deterrent, not a real security boundary.
function isFormField(el) {
  return !!el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable);
}
document.addEventListener("copy", (e) => {
  if (!isFormField(e.target)) e.preventDefault();
});
document.addEventListener("cut", (e) => {
  if (!isFormField(e.target)) e.preventDefault();
});
document.addEventListener("contextmenu", (e) => {
  if (!isFormField(e.target)) e.preventDefault();
});
document.addEventListener("selectstart", (e) => {
  if (!isFormField(e.target)) e.preventDefault();
});
document.addEventListener(
  "gesturestart",
  (e) => e.preventDefault(),
  { passive: false }
);
document.addEventListener(
  "dblclick",
  (e) => {
    if (!isFormField(e.target)) e.preventDefault();
  },
  { passive: false }
);
function showToast(message, isError) {
  const el = document.getElementById("toast");
  if (!el) return;
  el.textContent = message;
  el.classList.toggle("btn-danger", !!isError);
  el.style.background = isError ? "var(--danger)" : "var(--accent)";
  el.classList.remove("hidden");
  clearTimeout(el._timer);
  el._timer = setTimeout(() => el.classList.add("hidden"), 2200);
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (e) {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    document.body.removeChild(ta);
    return true;
  }
}

document.addEventListener("click", async (e) => {
  const btn = e.target.closest(".copy-btn");
  if (!btn) return;
  const text = btn.getAttribute("data-copy");
  if (!text) return;
  await copyText(text);
  const original = btn.textContent;
  btn.textContent = "Copied!";
  showToast("Copied to clipboard");
  setTimeout(() => (btn.textContent = original), 1400);
});

// Global search dropdown in the topbar.
(function () {
  const input = document.getElementById("global-search");
  const results = document.getElementById("search-results");
  if (!input || !results) return;
  let debounceTimer;
  input.addEventListener("input", () => {
    clearTimeout(debounceTimer);
    const q = input.value.trim();
    if (!q) {
      results.classList.add("hidden");
      results.innerHTML = "";
      return;
    }
    debounceTimer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
        const data = await res.json();
        if (!data.scripts || !data.scripts.length) {
          results.innerHTML = '<div class="muted" style="padding:.6rem .9rem;">No matches</div>';
        } else {
          results.innerHTML = data.scripts
            .slice(0, 8)
            .map((s) => `<a href="/scripts/${encodeURIComponent(s.name)}">${s.name}</a>`)
            .join("");
        }
        results.classList.remove("hidden");
      } catch (err) {
        /* ignore */
      }
    }, 200);
  });
  document.addEventListener("click", (e) => {
    if (!results.contains(e.target) && e.target !== input) {
      results.classList.add("hidden");
    }
  });
})();
