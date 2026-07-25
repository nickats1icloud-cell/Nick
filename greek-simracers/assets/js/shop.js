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

  const getImage = (key) => IMAGE_MAP[key] || FALLBACK_IMAGE;
  const formatPrice = (value) => `€${Number(value).toFixed(2)}`;

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

  let products = [];
  let activeCategory = "Όλα";

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
    modalImage.src = getImage(product.image_url);
    modalImage.alt = product.name;
    modalCategory.textContent = product.category;
    modalName.textContent = product.name;
    modalDescription.textContent = product.description || "";
    modalPrice.textContent = formatPrice(product.price);

    modalSoldout.hidden = !(product.stock <= 0);

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

    body.append(category, name, priceRow);
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

  initFilters();
  fetchProducts();
});
