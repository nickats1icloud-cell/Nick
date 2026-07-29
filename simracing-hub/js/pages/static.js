/**
 * Σελίδες χωρίς δυναμικό περιεχόμενο: about, terms, privacy, 404.
 *
 * Το μόνο που κάνουν είναι να στήνουν το κέλυφος και να γεμίζουν τα στοιχεία
 * με `data-setting="<key>"` από τα `site_settings` (π.χ. το email επικοινωνίας
 * στους Όρους Χρήσης) — έτσι ο admin τα αλλάζει από ένα σημείο.
 */

import { mountShell } from "../shell.js";
import { settings, loadSettings } from "../auth.js";
import { $$ } from "../ui.js";

await mountShell("");
await loadSettings();

$$("[data-setting]").forEach((node) => {
  const value = settings[node.dataset.setting];
  if (value) node.textContent = value;
});
