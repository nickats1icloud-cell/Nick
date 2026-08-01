/* Σελίδα "Η εκπομπή": ομάδα + FAQ accordion από το site.js. */

import { initPage, initReveal, initAccordions } from "./ui.js";
import { SITE } from "./data/site.js";
import { icon } from "./icons.js";
import { esc } from "./format.js";

initPage();

const hosts = document.querySelector("[data-hosts]");
if (hosts) {
  hosts.innerHTML = SITE.hosts
    .map(
      (person, index) => `<article class="card host" data-reveal style="--reveal-delay:${index * 80}ms">
        <div class="host__avatar" aria-hidden="true">${esc(person.initials)}</div>
        <h3>${esc(person.name)}</h3>
        <div class="host__role">${esc(person.role)}</div>
        <p class="host__bio">${esc(person.bio)}</p>
      </article>`
    )
    .join("");
}

const faq = document.querySelector("[data-faq]");
if (faq) {
  faq.innerHTML = SITE.faq
    .map(
      (item, index) => `<div class="acc__item">
        <button class="acc__btn" aria-expanded="${index === 0}" id="faq-${index}" aria-controls="faq-panel-${index}">
          <span>${esc(item.q)}</span>${icon("plus")}
        </button>
        <div class="acc__panel" id="faq-panel-${index}" role="region" aria-labelledby="faq-${index}">
          <div><p>${esc(item.a)}</p></div>
        </div>
      </div>`
    )
    .join("");
  initAccordions();
}

initReveal();
