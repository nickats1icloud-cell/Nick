/* Σελίδα ακρόασης: πλατφόρμες, newsletter, αντιγραφή RSS. */

import { initPage, initReveal } from "./ui.js";
import { SITE } from "./data/site.js";
import { icon } from "./icons.js";
import { esc } from "./format.js";
import { toast } from "./toast.js";

initPage();

/* Πλατφόρμες */
const platforms = document.querySelector("[data-platforms]");
if (platforms) {
  platforms.innerHTML = SITE.platforms
    .map(
      (p, index) => `<a class="platform" href="${esc(p.url)}" rel="noopener"
        style="--p-color:${esc(p.color)};--reveal-delay:${index * 70}ms" data-reveal>
        ${icon(p.id)}
        <span><strong>${esc(p.name)}</strong><small>${esc(p.note)}</small></span>
      </a>`
    )
    .join("");
}

/* Τα ✓ στις λίστες μπαίνουν ως SVG (όχι emoji, όχι ::before χαρακτήρας). */
document.querySelectorAll("[data-check-list] li").forEach((item) => {
  item.insertAdjacentHTML("afterbegin", icon("check"));
});

/* Newsletter */
const form = document.querySelector("[data-newsletter]");
form?.addEventListener("submit", (event) => {
  event.preventDefault();
  const input = form.querySelector("input[type=email]");
  const error = form.querySelector("[data-newsletter-error]");
  const valid = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(input.value.trim());

  input.setAttribute("aria-invalid", String(!valid));
  if (!valid) {
    error.textContent = "Χρειαζόμαστε ένα σωστό email.";
    input.focus();
    return;
  }
  error.textContent = "Demo: το newsletter δεν έχει συνδεθεί ακόμα με λίστα.";
  toast("Η φόρμα δεν είναι ακόμα συνδεδεμένη — δες το README.", "info");
  input.value = "";
});

/* Αντιγραφή RSS */
document.querySelector("[data-copy-rss]")?.addEventListener("click", async () => {
  const url = document.querySelector("[data-rss]").textContent.trim();
  try {
    await navigator.clipboard.writeText(url);
    toast("Το RSS αντιγράφηκε", "ok");
  } catch {
    toast("Δεν έγινε η αντιγραφή — επίλεξε το κείμενο χειροκίνητα.", "err");
  }
});

initReveal();
