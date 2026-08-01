/* Μικρές ειδοποιήσεις κάτω δεξιά. */

import { icon } from "./icons.js";

let host = null;

function ensureHost() {
  if (host && document.body.contains(host)) return host;
  host = document.createElement("div");
  host.className = "toasts";
  host.setAttribute("role", "status");
  host.setAttribute("aria-live", "polite");
  document.body.appendChild(host);
  return host;
}

/**
 * @param {string} message κείμενο (μπαίνει ως textContent — δεν γίνεται HTML)
 * @param {"info"|"ok"|"err"} type
 */
export function toast(message, type = "info") {
  const node = document.createElement("div");
  node.className = `toast toast--${type}`;
  const glyph = document.createElement("span");
  glyph.style.cssText = "display:grid;place-items:center;width:18px;flex:none";
  glyph.innerHTML = type === "err" ? icon("close") : icon("check");
  const text = document.createElement("span");
  text.textContent = message;
  node.append(glyph, text);
  ensureHost().appendChild(node);

  setTimeout(() => {
    node.classList.add("is-out");
    node.addEventListener("animationend", () => node.remove(), { once: true });
  }, 3200);
}
