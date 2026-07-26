document.addEventListener("DOMContentLoaded", () => {
  const IMAGE_MAP = {
    "tshirt-black": "assets/images/shop/tshirt-black.png",
    "tshirt-white": "assets/images/shop/tshirt-white.png",
    "hoodie-navy": "assets/images/shop/hoodie-navy.png",
    "cap-blue": "assets/images/shop/cap-blue.png",
    "keychain-helmet": "assets/images/shop/keychain-helmet.png",
    "keychain-wheel": "assets/images/shop/keychain-wheel.png",
  };
  const FALLBACK_IMAGE = "assets/images/shop/tshirt-black.png";
  const CART_KEY = "gsr-cart";

  const STATUS_META = {
    pending: { label: "Σε αναμονή", className: "order-status--pending" },
    confirmed: { label: "Επιβεβαιωμένη", className: "order-status--confirmed" },
    shipped: { label: "Απεστάλη", className: "order-status--shipped" },
    delivered: { label: "Παραδόθηκε", className: "order-status--delivered" },
    cancelled: { label: "Ακυρώθηκε", className: "order-status--cancelled" },
  };

  const getImage = (key) => IMAGE_MAP[key] || FALLBACK_IMAGE;
  const formatPrice = (value) => `€${Number(value).toFixed(2)}`;
  const formatDate = (iso) =>
    new Date(iso).toLocaleDateString("el-GR", { day: "numeric", month: "long", year: "numeric" });

  const escapeHtml = (str) => {
    const div = document.createElement("div");
    div.textContent = String(str);
    return div.innerHTML;
  };

  const setStatus = (el, message, state) => {
    el.textContent = message;
    if (state) {
      el.setAttribute("data-state", state);
    } else {
      el.removeAttribute("data-state");
    }
  };

  const filterBar = document.getElementById("shop-filters");
  const grid = document.getElementById("shop-grid");
  const stateMessage = document.getElementById("shop-state");

  const modal = document.getElementById("product-modal");
  const modalClose = document.getElementById("modal-close");
  const modalImage = document.getElementById("modal-image");
  const modalCategory = document.getElementById("modal-category");
  const modalSoldout = document.getElementById("modal-soldout");
  const modalName = document.getElementById("modal-name");
  const modalDescription = document.getElementById("modal-description");
  const modalSizesWrap = document.getElementById("modal-sizes");
  const modalSizeButtons = document.getElementById("modal-size-buttons");
  const modalPrice = document.getElementById("modal-price");
  const modalOriginalPrice = document.getElementById("modal-original-price");
  const modalAdd = document.getElementById("modal-add");
  const modalSizeHint = document.getElementById("modal-size-hint");

  const cartOpenBtn = document.getElementById("cart-open");
  const cartCount = document.getElementById("cart-count");
  const cartModal = document.getElementById("cart-modal");
  const cartClose = document.getElementById("cart-close");
  const cartEmpty = document.getElementById("cart-empty");
  const cartItemsEl = document.getElementById("cart-items");
  const cartFooter = document.getElementById("cart-footer");
  const cartTotalEl = document.getElementById("cart-total");
  const cartStatus = document.getElementById("cart-status");
  const checkoutOpenBtn = document.getElementById("checkout-open");

  const checkoutModal = document.getElementById("checkout-modal");
  const checkoutClose = document.getElementById("checkout-close");
  const checkoutMain = document.getElementById("checkout-main");
  const checkoutSummary = document.getElementById("checkout-summary");
  const checkoutForm = document.getElementById("checkout-form");
  const checkoutSubmit = document.getElementById("checkout-submit");
  const checkoutStatus = document.getElementById("checkout-status");
  const checkoutSuccess = document.getElementById("checkout-success");
  const checkoutSuccessClose = document.getElementById("checkout-success-close");

  const ordersOpenBtn = document.getElementById("orders-open");
  const ordersModal = document.getElementById("orders-modal");
  const ordersClose = document.getElementById("orders-close");
  const ordersList = document.getElementById("orders-list");

  const toast = document.getElementById("shop-toast");

  let products = [];
  let activeCategory = "Όλα";

  // Το προϊόν και το μέγεθος που είναι ανοιχτά στο modal προϊόντος.
  let modalProduct = null;
  let modalSize = null;

  /* ============ Καλάθι (localStorage) ============ */

  const loadCart = () => {
    try {
      const parsed = JSON.parse(localStorage.getItem(CART_KEY));
      return Array.isArray(parsed) ? parsed : [];
    } catch (err) {
      return [];
    }
  };

  let cart = loadCart();

  const saveCart = () => {
    try {
      localStorage.setItem(CART_KEY, JSON.stringify(cart));
    } catch (err) {
      // Ιδιωτική περιήγηση/γεμάτος χώρος: το καλάθι δουλεύει μόνο στη μνήμη.
    }
  };

  const getCartTotal = () => cart.reduce((sum, item) => sum + item.price * item.qty, 0);

  const updateCartCount = () => {
    const count = cart.reduce((sum, item) => sum + item.qty, 0);
    cartCount.textContent = String(count);
    cartCount.hidden = count === 0;
    cartOpenBtn.setAttribute("aria-label", `Καλάθι αγορών, ${count} προϊόντα`);
  };

  let toastTimer = null;
  const showToast = (message) => {
    toast.textContent = message;
    toast.classList.add("is-visible");
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => toast.classList.remove("is-visible"), 2600);
  };

  const addToCart = (product, size) => {
    if (product.stock <= 0) return;
    const existing = cart.find(
      (item) => item.productId === product.id && (item.size || null) === (size || null)
    );
    if (existing) {
      existing.qty += 1;
    } else {
      cart.push({
        productId: product.id,
        name: product.name,
        price: Number(product.price),
        image_url: product.image_url,
        size: size || null,
        qty: 1,
      });
    }
    saveCart();
    updateCartCount();
    renderCart();
    showToast(`Το «${product.name}» μπήκε στο καλάθι!`);
  };

  const changeQty = (index, delta) => {
    const item = cart[index];
    if (!item) return;
    item.qty += delta;
    if (item.qty <= 0) cart.splice(index, 1);
    saveCart();
    updateCartCount();
    renderCart();
  };

  const removeItem = (index) => {
    cart.splice(index, 1);
    saveCart();
    updateCartCount();
    renderCart();
  };

  const renderCart = () => {
    cartItemsEl.innerHTML = "";
    const hasItems = cart.length > 0;
    cartEmpty.hidden = hasItems;
    cartFooter.hidden = !hasItems;
    setStatus(cartStatus, "", null);

    cart.forEach((item, index) => {
      const row = document.createElement("div");
      row.className = "cart-item";
      row.innerHTML = `
        <img class="cart-item__thumb" src="${getImage(item.image_url)}" alt="">
        <div class="cart-item__info">
          <p class="cart-item__name">${escapeHtml(item.name)}</p>
          <p class="cart-item__meta">${item.size ? `Μέγεθος: ${escapeHtml(item.size)} · ` : ""}${formatPrice(item.price)}</p>
        </div>
        <div class="cart-item__qty">
          <button type="button" class="cart-item__step" data-step="-1" aria-label="Μείωση ποσότητας">−</button>
          <span class="cart-item__qty-value">${item.qty}</span>
          <button type="button" class="cart-item__step" data-step="1" aria-label="Αύξηση ποσότητας">+</button>
        </div>
        <strong class="cart-item__line-total">${formatPrice(item.price * item.qty)}</strong>
        <button type="button" class="cart-item__remove" aria-label="Αφαίρεση από το καλάθι">✕</button>
      `;
      row.querySelectorAll(".cart-item__step").forEach((btn) => {
        btn.addEventListener("click", () => changeQty(index, Number(btn.dataset.step)));
      });
      row.querySelector(".cart-item__remove").addEventListener("click", () => removeItem(index));
      cartItemsEl.appendChild(row);
    });

    cartTotalEl.textContent = formatPrice(getCartTotal());
  };

  /* ============ Auth helper ============ */

  const getSession = async () => {
    if (typeof window.supabaseClient === "undefined") return null;
    try {
      const { data: { session } } = await window.supabaseClient.auth.getSession();
      return session && session.user ? session : null;
    } catch (err) {
      return null;
    }
  };

  /* ============ Λίστα προϊόντων ============ */

  const showLoading = () => {
    grid.innerHTML = "";
    stateMessage.hidden = false;
    stateMessage.innerHTML = `<div class="spinner"></div><p>Φόρτωση προϊόντων...</p>`;
  };

  const showError = () => {
    grid.innerHTML = "";
    stateMessage.hidden = false;
    stateMessage.innerHTML = `<p>Δεν καταφέραμε να φορτώσουμε τα προϊόντα αυτή τη στιγμή. Δοκίμασε ξανά σε λίγο.</p>`;
  };

  const showEmpty = () => {
    stateMessage.hidden = false;
    stateMessage.innerHTML = `<p>Κανένα προϊόν σε αυτή την κατηγορία.</p>`;
  };

  const openModal = (product) => {
    modalProduct = product;
    modalSize = null;
    modalSizeHint.hidden = true;

    modalImage.src = getImage(product.image_url);
    modalImage.alt = product.name;
    modalCategory.textContent = product.category;
    modalName.textContent = product.name;
    modalDescription.textContent = product.description || "";
    modalPrice.textContent = formatPrice(product.price);

    const soldOut = product.stock <= 0;
    modalSoldout.hidden = !soldOut;
    modalAdd.disabled = soldOut;
    modalAdd.textContent = soldOut ? "Εξαντλήθηκε" : "Προσθήκη στο καλάθι";

    if (product.original_price) {
      modalOriginalPrice.textContent = formatPrice(product.original_price);
      modalOriginalPrice.hidden = false;
    } else {
      modalOriginalPrice.hidden = true;
    }

    modalSizeButtons.innerHTML = "";
    if (Array.isArray(product.sizes) && product.sizes.length) {
      product.sizes.forEach((size) => {
        const sizeBtn = document.createElement("button");
        sizeBtn.type = "button";
        sizeBtn.className = "pill";
        sizeBtn.textContent = size;
        sizeBtn.addEventListener("click", () => {
          modalSizeButtons.querySelectorAll(".pill").forEach((btn) => btn.classList.remove("is-active"));
          sizeBtn.classList.add("is-active");
          modalSize = size;
          modalSizeHint.hidden = true;
        });
        modalSizeButtons.appendChild(sizeBtn);
      });
      modalSizesWrap.hidden = false;
    } else {
      modalSizesWrap.hidden = true;
    }

    modal.showModal();
  };

  modalClose.addEventListener("click", () => modal.close());

  modalAdd.addEventListener("click", () => {
    if (!modalProduct || modalProduct.stock <= 0) return;
    const needsSize = Array.isArray(modalProduct.sizes) && modalProduct.sizes.length > 0;
    if (needsSize && !modalSize) {
      // Toast δεν φαίνεται πάνω από ανοιχτό dialog (top layer) — inline μήνυμα.
      modalSizeHint.hidden = false;
      return;
    }
    addToCart(modalProduct, modalSize);
    modal.close();
  });

  const renderCard = (product) => {
    const card = document.createElement("article");
    card.className = "card shop-card";
    const soldOut = product.stock <= 0;
    if (soldOut) card.classList.add("shop-card--sold-out");

    const media = document.createElement("div");
    media.className = "shop-card__media";

    const img = document.createElement("img");
    img.src = getImage(product.image_url);
    img.alt = product.name;
    img.loading = "lazy";
    media.appendChild(img);

    if (product.badge) {
      const badge = document.createElement("span");
      badge.className = "badge badge-primary shop-card__badge";
      badge.textContent = product.badge;
      media.appendChild(badge);
    }

    if (soldOut) {
      const overlay = document.createElement("div");
      overlay.className = "shop-card__overlay";
      overlay.textContent = "ΕΞΑΝΤΛΗΘΗΚΕ";
      media.appendChild(overlay);
    }

    const body = document.createElement("div");
    body.className = "shop-card__body";

    const category = document.createElement("p");
    category.className = "shop-card__category";
    category.textContent = product.category;

    const name = document.createElement("h3");
    name.className = "shop-card__name";
    name.textContent = product.name;

    const priceRow = document.createElement("div");
    priceRow.className = "shop-card__price";

    const priceCurrent = document.createElement("span");
    priceCurrent.className = "shop-card__price-current";
    priceCurrent.textContent = formatPrice(product.price);
    priceRow.appendChild(priceCurrent);

    if (product.original_price) {
      const priceOriginal = document.createElement("span");
      priceOriginal.className = "shop-card__price-original";
      priceOriginal.textContent = formatPrice(product.original_price);
      priceRow.appendChild(priceOriginal);
    }

    const buyBtn = document.createElement("button");
    buyBtn.type = "button";
    buyBtn.className = "btn btn-outline btn-sm shop-card__buy";
    buyBtn.textContent = soldOut ? "ΕΞΑΝΤΛΗΘΗΚΕ" : "Αγορά";
    buyBtn.disabled = soldOut;
    buyBtn.addEventListener("click", (event) => {
      // Να μην ανοίξει και το modal από το click του card.
      event.stopPropagation();
      const hasSizes = Array.isArray(product.sizes) && product.sizes.length > 0;
      if (hasSizes) {
        // Πρώτα επιλογή μεγέθους μέσα στο modal.
        openModal(product);
      } else {
        addToCart(product, null);
      }
    });

    body.append(category, name, priceRow, buyBtn);
    card.append(media, body);
    card.addEventListener("click", () => openModal(product));

    return card;
  };

  const renderGrid = () => {
    grid.innerHTML = "";
    stateMessage.hidden = true;

    const filtered = activeCategory === "Όλα"
      ? products
      : products.filter((product) => product.category === activeCategory);

    if (!filtered.length) {
      showEmpty();
      return;
    }

    filtered.forEach((product) => grid.appendChild(renderCard(product)));
  };

  const initFilters = () => {
    filterBar.querySelectorAll(".pill").forEach((pill) => {
      pill.addEventListener("click", () => {
        if (pill.classList.contains("is-active")) return;
        activeCategory = pill.dataset.category;
        filterBar.querySelectorAll(".pill").forEach((p) => p.classList.remove("is-active"));
        pill.classList.add("is-active");
        renderGrid();
      });
    });
  };

  const fetchProducts = async () => {
    showLoading();
    try {
      const { data, error } = await supabaseClient
        .from("shop_products")
        .select("*")
        .eq("active", true)
        .order("created_at", { ascending: false });

      if (error) throw error;

      products = data || [];
      renderGrid();
    } catch (err) {
      showError();
    }
  };

  /* ============ Dialog καλαθιού ============ */

  cartOpenBtn.addEventListener("click", () => {
    renderCart();
    cartModal.showModal();
  });
  cartClose.addEventListener("click", () => cartModal.close());

  checkoutOpenBtn.addEventListener("click", async () => {
    if (!cart.length) return;
    checkoutOpenBtn.disabled = true;
    const session = await getSession();
    checkoutOpenBtn.disabled = false;

    if (!session) {
      setStatus(cartStatus, "Χρειάζεται σύνδεση για να ολοκληρώσεις την παραγγελία — σε πάμε στη σελίδα σύνδεσης...", null);
      window.setTimeout(() => {
        window.location.href = "auth.html";
      }, 1800);
      return;
    }

    cartModal.close();
    openCheckout(session);
  });

  /* ============ Dialog ολοκλήρωσης παραγγελίας ============ */

  const renderCheckoutSummary = () => {
    const rows = cart
      .map(
        (item) => `
        <div class="checkout-summary__row">
          <span>${item.qty} × ${escapeHtml(item.name)}${item.size ? ` (${escapeHtml(item.size)})` : ""}</span>
          <span>${formatPrice(item.price * item.qty)}</span>
        </div>`
      )
      .join("");
    checkoutSummary.innerHTML = `${rows}
      <div class="checkout-summary__row checkout-summary__row--total">
        <span>Σύνολο</span>
        <span>${formatPrice(getCartTotal())}</span>
      </div>`;
  };

  const openCheckout = async (session) => {
    checkoutMain.hidden = false;
    checkoutSuccess.hidden = true;
    checkoutModal.setAttribute("aria-labelledby", "checkout-title");
    renderCheckoutSummary();
    setStatus(checkoutStatus, "", null);

    const emailInput = checkoutForm.elements.email;
    const nameInput = checkoutForm.elements.full_name;
    if (!emailInput.value) emailInput.value = session.user.email || "";

    checkoutModal.showModal();

    // Προαιρετικό prefill του ονόματος από το προφίλ — δεν μπλοκάρει το dialog.
    if (!nameInput.value) {
      try {
        const { data: profile } = await window.supabaseClient
          .from("profiles")
          .select("display_name")
          .eq("user_id", session.user.id)
          .maybeSingle();
        if (profile && profile.display_name && !nameInput.value) {
          nameInput.value = profile.display_name;
        }
      } catch (err) {
        // Χωρίς prefill αν αποτύχει — ο χρήστης το συμπληρώνει ο ίδιος.
      }
    }
  };

  checkoutClose.addEventListener("click", () => checkoutModal.close());
  checkoutSuccessClose.addEventListener("click", () => checkoutModal.close());

  checkoutForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (!cart.length) {
      setStatus(checkoutStatus, "Το καλάθι σου είναι άδειο.", "error");
      return;
    }

    const session = await getSession();
    if (!session) {
      setStatus(checkoutStatus, "Η σύνδεσή σου έληξε. Συνδέσου ξανά για να ολοκληρώσεις την παραγγελία.", "error");
      return;
    }

    const fields = checkoutForm.elements;
    checkoutSubmit.disabled = true;
    setStatus(checkoutStatus, "Καταχώρηση παραγγελίας...", null);

    try {
      const { data: order, error } = await window.supabaseClient
        .from("shop_orders")
        .insert({
          user_id: session.user.id,
          total: Number(getCartTotal().toFixed(2)),
          full_name: fields.full_name.value.trim(),
          email: fields.email.value.trim(),
          phone: fields.phone.value.trim() || null,
          address: fields.address.value.trim(),
          city: fields.city.value.trim(),
          postal_code: fields.postal_code.value.trim(),
          notes: fields.notes.value.trim() || null,
        })
        .select()
        .single();

      if (error) throw error;

      const items = cart.map((item) => ({
        order_id: order.id,
        product_id: item.productId,
        product_name: item.name,
        price: item.price,
        quantity: item.qty,
        size: item.size || null,
      }));

      const { error: itemsError } = await window.supabaseClient
        .from("shop_order_items")
        .insert(items);

      if (itemsError) throw itemsError;

      // Επιτυχία: άδειασμα καλαθιού + οθόνη επιβεβαίωσης.
      cart = [];
      saveCart();
      updateCartCount();
      renderCart();
      checkoutForm.reset();
      checkoutMain.hidden = true;
      checkoutSuccess.hidden = false;
      checkoutModal.setAttribute("aria-labelledby", "checkout-success-title");
    } catch (err) {
      // Το καλάθι μένει άθικτο ώστε ο χρήστης να ξαναπροσπαθήσει.
      setStatus(checkoutStatus, "Κάτι πήγε στραβά και η παραγγελία δεν καταχωρήθηκε. Το καλάθι σου είναι ασφαλές — δοκίμασε ξανά σε λίγο.", "error");
    } finally {
      checkoutSubmit.disabled = false;
    }
  });

  /* ============ Dialog «Οι Παραγγελίες μου» ============ */

  const renderOrders = (orders) => {
    if (!orders.length) {
      ordersList.innerHTML = `<p class="shop-dialog__empty">Δεν έχεις κάνει καμία παραγγελία ακόμα.</p>`;
      return;
    }

    ordersList.innerHTML = orders
      .map((order) => {
        const meta = STATUS_META[order.status] || { label: order.status, className: "" };
        const items = (order.shop_order_items || [])
          .map(
            (item) => `
            <li>
              <span>${item.quantity} × ${escapeHtml(item.product_name)}${item.size ? ` (${escapeHtml(item.size)})` : ""}</span>
              <span>${formatPrice(item.price * item.quantity)}</span>
            </li>`
          )
          .join("");
        return `
        <article class="order-card">
          <header class="order-card__header">
            <span class="order-card__date">${formatDate(order.created_at)}</span>
            <span class="badge ${meta.className}">${escapeHtml(meta.label)}</span>
          </header>
          <ul class="order-card__items">${items}</ul>
          <div class="order-card__total">
            <span>Σύνολο</span>
            <strong>${formatPrice(order.total)}</strong>
          </div>
        </article>`;
      })
      .join("");
  };

  ordersOpenBtn.addEventListener("click", async () => {
    ordersModal.showModal();
    ordersList.innerHTML = `<div class="spinner"></div>`;
    try {
      const { data, error } = await window.supabaseClient
        .from("shop_orders")
        .select("*, shop_order_items(*)")
        .order("created_at", { ascending: false });

      if (error) throw error;

      renderOrders(data || []);
    } catch (err) {
      ordersList.innerHTML = `<p class="shop-dialog__empty">Δεν καταφέραμε να φορτώσουμε τις παραγγελίες σου. Δοκίμασε ξανά σε λίγο.</p>`;
    }
  });
  ordersClose.addEventListener("click", () => ordersModal.close());

  // Το κουμπί παραγγελιών εμφανίζεται μόνο σε συνδεδεμένα μέλη.
  const refreshOrdersButton = async () => {
    const session = await getSession();
    ordersOpenBtn.hidden = !session;
  };

  refreshOrdersButton();
  if (typeof window.supabaseClient !== "undefined") {
    window.supabaseClient.auth.onAuthStateChange(() => refreshOrdersButton());
  }

  initFilters();
  fetchProducts();
  updateCartCount();
  renderCart();
});
