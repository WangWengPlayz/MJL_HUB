document.getElementById("login-form")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const form = e.target;
  const errorEl = document.getElementById("login-error");
  errorEl.classList.add("hidden");
  const body = new FormData(form);
  try {
    const res = await fetch("/admin/api/login", { method: "POST", body });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      errorEl.textContent = data.error || "Invalid credentials";
      errorEl.classList.remove("hidden");
      return;
    }
    window.location.href = "/admin";
  } catch (err) {
    errorEl.textContent = "Network error, please try again.";
    errorEl.classList.remove("hidden");
  }
});
