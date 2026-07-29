/**
 * Shop: κατάλογος προϊόντων, καλάθι (localStorage), ολοκλήρωση παραγγελίας
 * (`shop_orders` + `shop_order_items`) και ιστορικό παραγγελιών.
 */

import { mountShell } from "../shell.js";
import { session, onAuth, authReady } from "../auth.js";
import { db, safe } from "../supabase-client.js";
import {
  $, $$, esc, safeUrl, render, fmtPrice, fmtDateTime, empty, skeletonCards,
  openModal, toastOk, toastError, toast,
} from "../ui.js";

await mountShell("shop");
await authReady();

const CART_KEY = "hub-cart";

const state = {
  products: [],
  category: "",
  cart: JSON.parse(localStorage.getItem(CART_KEY) || "[]"),
};

const ORDER_STATUS = {
  pending: "Σε αναμονή",
  confirmed: "Επιβεβαιωμένη",
  shipped: "Απεστάλη",
  delivered: "Παραδόθηκε",
  cancelled: "Ακυρώθηκε",
};

const saveCart = () => {
  localStorage.setItem(CART_KEY, JSON.stringify(state.cart));
  $("#shop-count").textContent = String(state.cart.reduce((sum, line) => sum + line.quantity, 0));
};

onAuth((next) => {
  const button = $("#shop-orders");
  if (button) button.hidden = !next.user;
});

/* ---------------------------------------------------------------- λίστα ---- */

async function load() {
  render("#shop-list", skeletonCards(6, 300));

  state.products =
    (await safe(db.from("shop_products").select("*").eq("active", true).order("created_at", { ascending: false }), [])) || [];

  const categories = Array.from(new Set(state.products.map((row) => row.category).filter(Boolean))).sort();
  render(
    "#shop-cats",
    [`<button class="hub-chip is-active" data-cat="" type="button">Όλα</button>`]
      .concat(categories.map((cat) => `<button class="hub-chip" data-cat="${esc(cat)}" type="button">${esc(cat)}</button>`))
      .join(""),
  );

  paint();
  saveCart();
}

$("#shop-cats").addEventListener("click", (ev) => {
  const chip = ev.target.closest("[data-cat]");
  if (!chip) return;
  state.category = chip.dataset.cat;
  $$("#shop-cats .hub-chip").forEach((node) => node.classList.toggle("is-active", node === chip));
  paint();
});

function paint() {
  const list = state.category ? state.products.filter((row) => row.category === state.category) : state.products;

  if (!list.length) {
    render("#shop-list", `<div style="grid-column:1/-1">${empty("Δεν υπάρχουν προϊόντα αυτή τη στιγμή.", "🛍")}</div>`);
    return;
  }

  render(
    "#shop-list",
    list
      .map((product) => {
        const image = safeUrl(product.image_url);
        const soldOut = product.stock <= 0;
        return `<article class="shop-card" data-product="${esc(product.id)}">
          <div class="shop-card__media">
            ${image ? `<img src="${image}" alt="${esc(product.name)}" loading="lazy" />` : '<span style="font-size:2.4rem;opacity:0.3">🛍</span>'}
            ${product.badge ? `<span class="hub-badge hub-badge--ember" style="position:absolute;top:10px;left:10px">${esc(product.badge)}</span>` : ""}
            ${soldOut ? '<span class="hub-badge hub-badge--bad" style="position:absolute;top:10px;right:10px">Εξαντλήθηκε</span>' : ""}
          </div>
          <div class="shop-card__body">
            <span class="hub-badge">${esc(product.category || "—")}</span>
            <h3 style="font-size:0.98rem">${esc(product.name)}</h3>
            ${product.description ? `<p class="u-small u-dim u-clamp-2">${esc(product.description)}</p>` : ""}
            <p class="shop-card__price">${fmtPrice(product.price)}${product.original_price ? `<span class="shop-card__old">${fmtPrice(product.original_price)}</span>` : ""}</p>
            ${
              product.sizes?.length
                ? `<select class="hub-select" data-size>${product.sizes.map((size) => `<option>${esc(size)}</option>`).join("")}</select>`
                : ""
            }
            <button class="hub-btn hub-btn--primary hub-btn--sm hub-btn--block" type="button" data-add="${esc(product.id)}" style="margin-top:auto" ${soldOut ? "disabled" : ""}>
              ${soldOut ? "Εξαντλήθηκε" : "Προσθήκη στο καλάθι"}
            </button>
          </div>
        </article>`;
      })
      .join(""),
  );
}

$("#shop-list").addEventListener("click", (ev) => {
  const button = ev.target.closest("[data-add]");
  if (!button) return;

  const card = button.closest("[data-product]");
  const product = state.products.find((row) => row.id === button.dataset.add);
  const size = card.querySelector("[data-size]")?.value || null;

  const existing = state.cart.find((line) => line.id === product.id && line.size === size);
  if (existing) existing.quantity += 1;
  else
    state.cart.push({
      id: product.id,
      name: product.name,
      price: Number(product.price),
      image: product.image_url || null,
      size,
      quantity: 1,
    });

  saveCart();
  toastOk("Προστέθηκε στο καλάθι", product.name);
});

/* --------------------------------------------------------------- καλάθι ---- */

$("#shop-cart").addEventListener("click", openCart);

function cartTotal() {
  return state.cart.reduce((sum, line) => sum + line.price * line.quantity, 0);
}

function openCart() {
  const { root, close } = openModal({
    title: "Το καλάθι σου",
    body: cartBody(),
    footer: `<button class="hub-btn hub-btn--ghost" type="button" data-close>Συνέχεια αγορών</button>
             <button class="hub-btn hub-btn--primary" type="button" data-checkout ${state.cart.length ? "" : "disabled"}>Ολοκλήρωση</button>`,
  });

  const refresh = () => {
    root.querySelector(".hub-modal__body").innerHTML = cartBody();
    root.querySelector("[data-checkout]").disabled = state.cart.length === 0;
    saveCart();
  };

  root.addEventListener("click", (ev) => {
    const inc = ev.target.closest("[data-inc]");
    if (inc) {
      state.cart[Number(inc.dataset.inc)].quantity += 1;
      refresh();
      return;
    }

    const dec = ev.target.closest("[data-dec]");
    if (dec) {
      const line = state.cart[Number(dec.dataset.dec)];
      line.quantity = Math.max(line.quantity - 1, 1);
      refresh();
      return;
    }

    const del = ev.target.closest("[data-rm]");
    if (del) {
      state.cart.splice(Number(del.dataset.rm), 1);
      refresh();
      return;
    }

    if (ev.target.closest("[data-checkout]")) {
      close();
      openCheckout();
    }
  });
}

function cartBody() {
  if (!state.cart.length) return empty("Το καλάθι είναι άδειο.", "🛒");
  return `${state.cart
    .map(
      (line, index) => `<div class="cart-line">
        ${line.image ? `<img src="${safeUrl(line.image)}" alt="" />` : '<span class="hub-avatar hub-avatar--fallback">🛍</span>'}
        <div style="min-width:0;flex:1">
          <p class="u-small">${esc(line.name)}</p>
          ${line.size ? `<p class="u-tiny u-faint">Μέγεθος: ${esc(line.size)}</p>` : ""}
          <p class="u-tiny" style="color:hsl(var(--ember))">${fmtPrice(line.price)}</p>
        </div>
        <span class="qty">
          <button type="button" data-dec="${index}">−</button>
          <span>${line.quantity}</span>
          <button type="button" data-inc="${index}">+</button>
        </span>
        <button class="hub-btn hub-btn--sm hub-btn--ghost" type="button" data-rm="${index}">🗑</button>
      </div>`,
    )
    .join("")}
    <div class="u-between" style="padding-top:14px">
      <strong>Σύνολο</strong>
      <strong style="color:hsl(var(--ember));font-size:1.15rem">${fmtPrice(cartTotal())}</strong>
    </div>`;
}

/* ------------------------------------------------------------- checkout ---- */

function openCheckout() {
  if (!session.user) {
    toast("Χρειάζεται σύνδεση", { body: "Συνδέσου για να ολοκληρώσεις την παραγγελία.", tone: "bad" });
    return;
  }

  const { root, close } = openModal({
    title: "Στοιχεία παραγγελίας",
    body: `<div class="u-grid u-grid--2" style="gap:14px">
        <label class="hub-field"><span>Ονοματεπώνυμο *</span><input class="hub-input" name="full_name" value="${esc(session.profile?.display_name || "")}" /></label>
        <label class="hub-field"><span>Email *</span><input class="hub-input" type="email" name="email" value="${esc(session.user.email || "")}" /></label>
      </div>
      <label class="hub-field"><span>Τηλέφωνο</span><input class="hub-input" name="phone" /></label>
      <label class="hub-field"><span>Διεύθυνση *</span><input class="hub-input" name="address" /></label>
      <div class="u-grid u-grid--2" style="gap:14px">
        <label class="hub-field"><span>Πόλη *</span><input class="hub-input" name="city" /></label>
        <label class="hub-field"><span>Τ.Κ. *</span><input class="hub-input" name="postal_code" /></label>
      </div>
      <label class="hub-field"><span>Σημειώσεις</span><textarea class="hub-textarea" name="notes" rows="3"></textarea></label>
      <div class="u-between"><strong>Σύνολο</strong><strong style="color:hsl(var(--ember))">${fmtPrice(cartTotal())}</strong></div>`,
    footer: `<button class="hub-btn hub-btn--ghost" type="button" data-close>Άκυρο</button>
             <button class="hub-btn hub-btn--primary" type="button" data-submit>Αποστολή παραγγελίας</button>`,
  });

  root.querySelector("[data-submit]").addEventListener("click", async (ev) => {
    const value = (name) => root.querySelector(`[name="${name}"]`).value.trim();
    const required = ["full_name", "email", "address", "city", "postal_code"];
    if (required.some((name) => !value(name))) return toastError(null, "Συμπλήρωσε όλα τα υποχρεωτικά πεδία.");

    ev.target.disabled = true;

    const { data: order, error } = await db
      .from("shop_orders")
      .insert({
        user_id: session.user.id,
        full_name: value("full_name"),
        email: value("email"),
        phone: value("phone") || null,
        address: value("address"),
        city: value("city"),
        postal_code: value("postal_code"),
        notes: value("notes") || null,
        total: Number(cartTotal().toFixed(2)),
        status: "pending",
      })
      .select()
      .single();

    if (error) {
      ev.target.disabled = false;
      return toastError(error);
    }

    const items = state.cart.map((line) => ({
      order_id: order.id,
      product_id: line.id,
      product_name: line.name,
      product_image: line.image,
      size: line.size,
      quantity: line.quantity,
      price: line.price,
    }));
    await safe(db.from("shop_order_items").insert(items));

    // Ειδοποίηση admin — δεν μπλοκάρει την παραγγελία αν αποτύχει.
    try {
      await db.functions.invoke("notify-admin-order", { body: { order_id: order.id, total: order.total } });
    } catch (err) {
      console.warn("notify-admin-order", err);
    }

    state.cart = [];
    saveCart();
    toastOk("Η παραγγελία καταχωρήθηκε! 🏁", "Θα επικοινωνήσουμε μαζί σου σύντομα.");
    close();
  });
}

/* ------------------------------------------------------- οι παραγγελίες ---- */

$("#shop-orders").addEventListener("click", async () => {
  const rows =
    (await safe(
      db
        .from("shop_orders")
        .select("*, shop_order_items(*)")
        .eq("user_id", session.user.id)
        .order("created_at", { ascending: false }),
      [],
    )) || [];

  openModal({
    title: "Οι παραγγελίες μου",
    wide: true,
    body: rows.length
      ? `<div class="u-stack" style="--gap:12px">${rows
          .map(
            (order) => `<div class="hub-card">
              <div class="u-between">
                <div>
                  <p class="u-small"><strong>#${esc(String(order.id).slice(0, 8))}</strong></p>
                  <p class="u-tiny u-faint">${fmtDateTime(order.created_at)}</p>
                </div>
                <span class="hub-badge ${order.status === "delivered" ? "hub-badge--ok" : order.status === "cancelled" ? "hub-badge--bad" : "hub-badge--warn"}">${esc(ORDER_STATUS[order.status] || order.status)}</span>
              </div>
              <div class="u-stack" style="--gap:4px;margin-top:10px">
                ${(order.shop_order_items || [])
                  .map(
                    (item) => `<p class="u-small u-dim">${item.quantity}× ${esc(item.product_name)}${item.size ? ` (${esc(item.size)})` : ""} — ${fmtPrice(item.price * item.quantity)}</p>`,
                  )
                  .join("")}
              </div>
              <p class="u-between" style="margin-top:10px"><span class="u-small">Σύνολο</span><strong style="color:hsl(var(--ember))">${fmtPrice(order.total)}</strong></p>
            </div>`,
          )
          .join("")}</div>`
      : empty("Δεν έχεις παραγγελίες ακόμα.", "📦"),
  });
});

load();
