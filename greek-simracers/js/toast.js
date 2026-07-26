function ensureRoot() {
  let root = document.getElementById("toast-root");
  if (!root) {
    root = document.createElement("div");
    root.id = "toast-root";
    document.body.appendChild(root);
  }
  return root;
}

function show(message, variant = "default", timeout = 4000) {
  const root = ensureRoot();
  const el = document.createElement("div");
  el.className = `gsr__toast${variant !== "default" ? ` gsr__toast--${variant}` : ""}`;
  el.textContent = message;
  root.appendChild(el);
  setTimeout(() => el.remove(), timeout);
}

export const toast = Object.assign((message) => show(message), {
  success: (message) => show(message, "success"),
  error: (message) => show(message, "error"),
});
