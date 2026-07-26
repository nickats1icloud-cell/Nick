// Λογική για το admin.html — τον πίνακα διαχείρισης.
//
// ΣΗΜΕΙΩΣΗ ΑΣΦΑΛΕΙΑΣ: ο έλεγχος ρόλου παρακάτω (user_roles / role='admin')
// είναι ΜΟΝΟ για την εμπειρία χρήστη — κρύβει το UI από μη διαχειριστές.
// Η πραγματική ασφάλεια επιβάλλεται αποκλειστικά από τα RLS policies στη
// Supabase (πίνακας user_roles + συνάρτηση has_role()). Ένας μη διαχειριστής
// που καλέσει τα ίδια APIs απευθείας θα πάρει απλώς σφάλματα RLS.
(function () {
  'use strict';

  function sb() {
    return window.supabaseClient;
  }

  function escapeHtml(value) {
    const div = document.createElement('div');
    div.textContent = value ?? '';
    return div.innerHTML;
  }

  function formatDate(iso) {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('el-GR', {
      day: 'numeric', month: 'short', year: 'numeric',
    });
  }

  function formatDateTime(iso) {
    if (!iso) return '—';
    return new Date(iso).toLocaleString('el-GR', {
      day: 'numeric', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  }

  function formatPrice(value) {
    const num = Number(value);
    return Number.isFinite(num) ? num.toFixed(2) + ' €' : '—';
  }

  // ============ Toasts ============
  function showToast(message, state) {
    const region = document.getElementById('admin-toasts');
    if (!region) return;
    const toast = document.createElement('div');
    toast.className = 'admin-toast';
    if (state) toast.setAttribute('data-state', state);
    toast.textContent = message;
    region.appendChild(toast);
    setTimeout(() => toast.remove(), 4000);
  }

  function setStatus(el, message, state) {
    if (!el) return;
    el.textContent = message;
    if (state) {
      el.setAttribute('data-state', state);
    } else {
      el.removeAttribute('data-state');
    }
  }

  // ============ Καταστάσεις λίστας ============
  function renderLoadingState(el, message) {
    el.innerHTML = `
      <div class="state-message">
        <div class="spinner"></div>
        <p>${escapeHtml(message)}</p>
      </div>
    `;
  }

  function renderErrorState(el) {
    el.innerHTML = `
      <div class="state-message">
        <p>Κάτι πήγε στραβά κατά τη φόρτωση. Δοκίμασε ξανά σε λίγο.</p>
      </div>
    `;
  }

  function renderEmptyState(el, message) {
    el.innerHTML = `
      <div class="state-message">
        <p>${escapeHtml(message)}</p>
      </div>
    `;
  }

  // ============ Dialogs ============
  function openDialog(dialog) {
    if (typeof dialog.showModal === 'function') {
      dialog.showModal();
    } else {
      dialog.setAttribute('open', '');
    }
  }

  function closeDialog(dialog) {
    if (typeof dialog.close === 'function') {
      dialog.close();
    } else {
      dialog.removeAttribute('open');
    }
  }

  function wireDialogCloseButtons() {
    document.querySelectorAll('[data-close-dialog]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const dialog = btn.closest('dialog');
        if (dialog) closeDialog(dialog);
      });
    });
  }

  /* ==================================================================
     Tab 1: Podcasts
     ================================================================== */
  let podcasts = [];
  const podcastListEl = () => document.getElementById('podcasts-list');

  async function loadPodcasts() {
    const listEl = podcastListEl();
    renderLoadingState(listEl, 'Φόρτωση επεισοδίων…');

    let data, error;
    try {
      ({ data, error } = await sb()
        .from('podcast_episodes')
        .select('*')
        .order('episode_number', { ascending: false }));
    } catch (err) {
      error = err;
    }

    if (error) {
      renderErrorState(listEl);
      return;
    }

    podcasts = data || [];
    renderPodcastsList();
  }

  function renderPodcastsList() {
    const listEl = podcastListEl();

    if (podcasts.length === 0) {
      renderEmptyState(listEl, 'Δεν υπάρχουν επεισόδια ακόμα.');
      return;
    }

    listEl.innerHTML = `
      <div class="admin-rows">
        ${podcasts.map((ep) => `
          <article class="admin-row" data-id="${escapeHtml(ep.id)}">
            <div class="admin-row__main">
              <p class="admin-row__title">
                <span class="admin-row__num">EP ${escapeHtml(String(ep.episode_number ?? '').padStart(2, '0'))}</span>
                ${escapeHtml(ep.title)}
              </p>
              <div class="admin-row__meta">
                ${ep.category ? `<span class="badge badge-primary">${escapeHtml(ep.category)}</span>` : ''}
                ${ep.host ? `<span>${escapeHtml(ep.host)}</span>` : ''}
                ${ep.duration ? `<span>${escapeHtml(ep.duration)}</span>` : ''}
              </div>
            </div>
            <div class="admin-row__actions">
              <label class="admin-toggle">
                <input type="checkbox" data-action="toggle-published" ${ep.published ? 'checked' : ''}>
                <span>Δημοσιευμένο</span>
              </label>
              <button type="button" class="btn btn-outline btn-sm" data-action="edit">Επεξεργασία</button>
              <button type="button" class="btn btn-danger btn-sm" data-action="delete">Διαγραφή</button>
            </div>
          </article>
        `).join('')}
      </div>
    `;

    listEl.querySelectorAll('.admin-row').forEach((row) => {
      const id = row.dataset.id;
      const episode = podcasts.find((ep) => String(ep.id) === id);
      if (!episode) return;

      row.querySelector('[data-action="toggle-published"]').addEventListener('change', async (event) => {
        const checkbox = event.target;
        checkbox.disabled = true;
        const { error } = await sb()
          .from('podcast_episodes')
          .update({ published: checkbox.checked })
          .eq('id', episode.id);
        if (error) {
          checkbox.checked = !checkbox.checked;
          checkbox.disabled = false;
          showToast('Η αλλαγή δημοσίευσης απέτυχε.', 'error');
          return;
        }
        showToast(checkbox.checked ? 'Το επεισόδιο δημοσιεύτηκε.' : 'Το επεισόδιο αποσύρθηκε.', 'success');
        loadPodcasts();
      });

      row.querySelector('[data-action="edit"]').addEventListener('click', () => {
        openPodcastDialog(episode);
      });

      row.querySelector('[data-action="delete"]').addEventListener('click', async (event) => {
        if (!confirm(`Σίγουρα θέλεις να διαγράψεις το επεισόδιο «${episode.title}»;`)) return;
        const btn = event.target;
        btn.disabled = true;
        const { error } = await sb().from('podcast_episodes').delete().eq('id', episode.id);
        if (error) {
          btn.disabled = false;
          showToast('Η διαγραφή απέτυχε.', 'error');
          return;
        }
        showToast('Το επεισόδιο διαγράφηκε.', 'success');
        loadPodcasts();
      });
    });
  }

  function openPodcastDialog(episode) {
    const dialog = document.getElementById('podcast-dialog');
    const form = document.getElementById('podcast-form');
    form.reset();
    setStatus(document.getElementById('podcast-status'), '', null);

    document.getElementById('podcast-dialog-title').textContent =
      episode ? 'Επεξεργασία Επεισοδίου' : 'Νέο Επεισόδιο';

    form.elements.id.value = episode ? episode.id : '';
    if (episode) {
      form.elements.episode_number.value = episode.episode_number ?? '';
      form.elements.title.value = episode.title ?? '';
      form.elements.description.value = episode.description ?? '';
      form.elements.host.value = episode.host ?? '';
      form.elements.category.value = episode.category ?? '';
      form.elements.duration.value = episode.duration ?? '';
      form.elements.spotify_url.value = episode.spotify_url ?? '';
      form.elements.published.checked = Boolean(episode.published);
    }

    openDialog(dialog);
  }

  function wirePodcastsTab() {
    document.getElementById('podcast-new-btn').addEventListener('click', () => openPodcastDialog(null));

    const form = document.getElementById('podcast-form');
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const statusEl = document.getElementById('podcast-status');
      setStatus(statusEl, '', null);

      const payload = {
        episode_number: parseInt(form.elements.episode_number.value, 10),
        title: form.elements.title.value.trim(),
        description: form.elements.description.value.trim() || null,
        host: form.elements.host.value.trim() || null,
        category: form.elements.category.value.trim() || null,
        duration: form.elements.duration.value.trim() || null,
        spotify_url: form.elements.spotify_url.value.trim() || null,
        published: form.elements.published.checked,
      };

      const id = form.elements.id.value;
      const submitBtn = form.querySelector('button[type="submit"]');
      submitBtn.disabled = true;

      const { error } = id
        ? await sb().from('podcast_episodes').update(payload).eq('id', id)
        : await sb().from('podcast_episodes').insert(payload);

      submitBtn.disabled = false;

      if (error) {
        setStatus(statusEl, 'Η αποθήκευση απέτυχε. Δοκίμασε ξανά.', 'error');
        return;
      }

      closeDialog(document.getElementById('podcast-dialog'));
      showToast('Το επεισόδιο αποθηκεύτηκε.', 'success');
      loadPodcasts();
    });
  }

  /* ==================================================================
     Tab 2: Πρωταθλήματα
     ================================================================== */
  let championships = [];
  const CHAMP_STATUS_LABELS = {
    active: 'Ενεργό',
    upcoming: 'Έρχεται',
    completed: 'Ολοκληρωμένο',
  };
  const CHAMP_STATUS_BADGES = {
    active: 'badge-success',
    upcoming: 'badge-primary',
    completed: '',
  };
  const champListEl = () => document.getElementById('championships-list');

  async function loadChampionships() {
    const listEl = champListEl();
    renderLoadingState(listEl, 'Φόρτωση πρωταθλημάτων…');

    let data, error;
    try {
      ({ data, error } = await sb()
        .from('championships')
        .select('*')
        .order('created_at', { ascending: false }));
    } catch (err) {
      error = err;
    }

    if (error) {
      renderErrorState(listEl);
      return;
    }

    championships = data || [];
    renderChampionshipsList();
  }

  function renderChampionshipsList() {
    const listEl = champListEl();

    if (championships.length === 0) {
      renderEmptyState(listEl, 'Δεν υπάρχουν πρωταθλήματα ακόμα.');
      return;
    }

    listEl.innerHTML = `
      <div class="admin-rows">
        ${championships.map((champ) => `
          <article class="admin-row" data-id="${escapeHtml(champ.id)}">
            <div class="admin-row__main">
              <p class="admin-row__title">${escapeHtml(champ.title)}</p>
              <div class="admin-row__meta">
                <span class="badge ${CHAMP_STATUS_BADGES[champ.status] || ''}">${escapeHtml(CHAMP_STATUS_LABELS[champ.status] || champ.status)}</span>
                ${champ.category ? `<span class="badge badge-primary">${escapeHtml(champ.category)}</span>` : ''}
                <span>Αγώνες: ${escapeHtml(String(champ.races_completed ?? 0))}/${escapeHtml(String(champ.races_total ?? 0))}</span>
                <span>Συμμετέχοντες: ${escapeHtml(String(champ.participants ?? 0))}</span>
                ${champ.start_date ? `<span>Έναρξη: ${escapeHtml(formatDate(champ.start_date))}</span>` : ''}
              </div>
            </div>
            <div class="admin-row__actions">
              <button type="button" class="btn btn-outline btn-sm" data-action="edit">Επεξεργασία</button>
              <button type="button" class="btn btn-danger btn-sm" data-action="delete">Διαγραφή</button>
            </div>
          </article>
        `).join('')}
      </div>
    `;

    listEl.querySelectorAll('.admin-row').forEach((row) => {
      const champ = championships.find((c) => String(c.id) === row.dataset.id);
      if (!champ) return;

      row.querySelector('[data-action="edit"]').addEventListener('click', () => {
        openChampDialog(champ);
      });

      row.querySelector('[data-action="delete"]').addEventListener('click', async (event) => {
        if (!confirm(`Σίγουρα θέλεις να διαγράψεις το πρωτάθλημα «${champ.title}»;`)) return;
        const btn = event.target;
        btn.disabled = true;
        const { error } = await sb().from('championships').delete().eq('id', champ.id);
        if (error) {
          btn.disabled = false;
          showToast('Η διαγραφή απέτυχε.', 'error');
          return;
        }
        showToast('Το πρωτάθλημα διαγράφηκε.', 'success');
        loadChampionships();
      });
    });
  }

  function openChampDialog(champ) {
    const dialog = document.getElementById('champ-dialog');
    const form = document.getElementById('champ-form');
    form.reset();
    setStatus(document.getElementById('champ-status-msg'), '', null);

    document.getElementById('champ-dialog-title').textContent =
      champ ? 'Επεξεργασία Πρωταθλήματος' : 'Νέο Πρωτάθλημα';

    form.elements.id.value = champ ? champ.id : '';
    if (champ) {
      form.elements.title.value = champ.title ?? '';
      form.elements.description.value = champ.description ?? '';
      form.elements.category.value = champ.category ?? '';
      form.elements.status.value = champ.status ?? 'upcoming';
      form.elements.races_completed.value = champ.races_completed ?? 0;
      form.elements.races_total.value = champ.races_total ?? 0;
      form.elements.participants.value = champ.participants ?? 0;
      form.elements.start_date.value = champ.start_date ?? '';
      form.elements.image_url.value = champ.image_url ?? '';
    }

    openDialog(dialog);
  }

  function wireChampionshipsTab() {
    document.getElementById('champ-new-btn').addEventListener('click', () => openChampDialog(null));

    const form = document.getElementById('champ-form');
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const statusEl = document.getElementById('champ-status-msg');
      setStatus(statusEl, '', null);

      const payload = {
        title: form.elements.title.value.trim(),
        description: form.elements.description.value.trim() || null,
        category: form.elements.category.value.trim() || null,
        status: form.elements.status.value,
        races_completed: parseInt(form.elements.races_completed.value, 10) || 0,
        races_total: parseInt(form.elements.races_total.value, 10) || 0,
        participants: parseInt(form.elements.participants.value, 10) || 0,
        start_date: form.elements.start_date.value || null,
        image_url: form.elements.image_url.value.trim() || null,
      };

      const id = form.elements.id.value;
      const submitBtn = form.querySelector('button[type="submit"]');
      submitBtn.disabled = true;

      const { error } = id
        ? await sb().from('championships').update(payload).eq('id', id)
        : await sb().from('championships').insert(payload);

      submitBtn.disabled = false;

      if (error) {
        setStatus(statusEl, 'Η αποθήκευση απέτυχε. Δοκίμασε ξανά.', 'error');
        return;
      }

      closeDialog(document.getElementById('champ-dialog'));
      showToast('Το πρωτάθλημα αποθηκεύτηκε.', 'success');
      loadChampionships();
    });
  }

  /* ==================================================================
     Tab 3: Προϊόντα
     ================================================================== */
  let products = [];
  const prodListEl = () => document.getElementById('products-list');

  async function loadProducts() {
    const listEl = prodListEl();
    renderLoadingState(listEl, 'Φόρτωση προϊόντων…');

    let data, error;
    try {
      ({ data, error } = await sb()
        .from('shop_products')
        .select('*')
        .order('created_at', { ascending: false }));
    } catch (err) {
      error = err;
    }

    if (error) {
      renderErrorState(listEl);
      return;
    }

    products = data || [];
    renderProductsList();
  }

  function renderProductsList() {
    const listEl = prodListEl();

    if (products.length === 0) {
      renderEmptyState(listEl, 'Δεν υπάρχουν προϊόντα ακόμα.');
      return;
    }

    listEl.innerHTML = `
      <div class="admin-rows">
        ${products.map((product) => `
          <article class="admin-row" data-id="${escapeHtml(product.id)}">
            <div class="admin-row__main">
              <p class="admin-row__title">${escapeHtml(product.name)}</p>
              <div class="admin-row__meta">
                <span class="badge badge-primary">${escapeHtml(product.category)}</span>
                ${product.badge ? `<span class="badge">${escapeHtml(product.badge)}</span>` : ''}
                <span>${escapeHtml(formatPrice(product.price))}</span>
                ${product.original_price != null ? `<span><s>${escapeHtml(formatPrice(product.original_price))}</s></span>` : ''}
                <span>Απόθεμα: ${escapeHtml(String(product.stock ?? 0))}</span>
                ${Array.isArray(product.sizes) && product.sizes.length ? `<span>Μεγέθη: ${escapeHtml(product.sizes.join(', '))}</span>` : ''}
              </div>
            </div>
            <div class="admin-row__actions">
              <label class="admin-toggle">
                <input type="checkbox" data-action="toggle-active" ${product.active ? 'checked' : ''}>
                <span>Ενεργό</span>
              </label>
              <button type="button" class="btn btn-outline btn-sm" data-action="edit">Επεξεργασία</button>
              <button type="button" class="btn btn-danger btn-sm" data-action="delete">Διαγραφή</button>
            </div>
          </article>
        `).join('')}
      </div>
    `;

    listEl.querySelectorAll('.admin-row').forEach((row) => {
      const product = products.find((p) => String(p.id) === row.dataset.id);
      if (!product) return;

      row.querySelector('[data-action="toggle-active"]').addEventListener('change', async (event) => {
        const checkbox = event.target;
        checkbox.disabled = true;
        const { error } = await sb()
          .from('shop_products')
          .update({ active: checkbox.checked })
          .eq('id', product.id);
        if (error) {
          checkbox.checked = !checkbox.checked;
          checkbox.disabled = false;
          showToast('Η αλλαγή απέτυχε.', 'error');
          return;
        }
        showToast(checkbox.checked ? 'Το προϊόν ενεργοποιήθηκε.' : 'Το προϊόν απενεργοποιήθηκε.', 'success');
        loadProducts();
      });

      row.querySelector('[data-action="edit"]').addEventListener('click', () => {
        openProductDialog(product);
      });

      row.querySelector('[data-action="delete"]').addEventListener('click', async (event) => {
        if (!confirm(`Σίγουρα θέλεις να διαγράψεις το προϊόν «${product.name}»;`)) return;
        const btn = event.target;
        btn.disabled = true;
        const { error } = await sb().from('shop_products').delete().eq('id', product.id);
        if (error) {
          btn.disabled = false;
          showToast('Η διαγραφή απέτυχε.', 'error');
          return;
        }
        showToast('Το προϊόν διαγράφηκε.', 'success');
        loadProducts();
      });
    });
  }

  function openProductDialog(product) {
    const dialog = document.getElementById('prod-dialog');
    const form = document.getElementById('prod-form');
    form.reset();
    setStatus(document.getElementById('prod-status'), '', null);

    document.getElementById('prod-dialog-title').textContent =
      product ? 'Επεξεργασία Προϊόντος' : 'Νέο Προϊόν';

    form.elements.id.value = product ? product.id : '';
    if (product) {
      form.elements.name.value = product.name ?? '';
      form.elements.description.value = product.description ?? '';
      form.elements.price.value = product.price ?? '';
      form.elements.original_price.value = product.original_price ?? '';
      form.elements.image_url.value = product.image_url ?? 'tshirt-black';
      form.elements.category.value = product.category ?? 'Ρούχα';
      form.elements.badge.value = product.badge ?? '';
      form.elements.stock.value = product.stock ?? 0;
      form.elements.sizes.value = Array.isArray(product.sizes) ? product.sizes.join(', ') : '';
      form.elements.active.checked = Boolean(product.active);
    }

    openDialog(dialog);
  }

  function wireProductsTab() {
    document.getElementById('prod-new-btn').addEventListener('click', () => openProductDialog(null));

    const form = document.getElementById('prod-form');
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const statusEl = document.getElementById('prod-status');
      setStatus(statusEl, '', null);

      const sizes = form.elements.sizes.value
        .split(',')
        .map((size) => size.trim())
        .filter(Boolean);

      const originalPriceRaw = form.elements.original_price.value;

      const payload = {
        name: form.elements.name.value.trim(),
        description: form.elements.description.value.trim() || null,
        price: parseFloat(form.elements.price.value),
        original_price: originalPriceRaw === '' ? null : parseFloat(originalPriceRaw),
        image_url: form.elements.image_url.value,
        category: form.elements.category.value,
        badge: form.elements.badge.value.trim() || null,
        stock: parseInt(form.elements.stock.value, 10) || 0,
        sizes: sizes.length ? sizes : null,
        active: form.elements.active.checked,
      };

      const id = form.elements.id.value;
      const submitBtn = form.querySelector('button[type="submit"]');
      submitBtn.disabled = true;

      const { error } = id
        ? await sb().from('shop_products').update(payload).eq('id', id)
        : await sb().from('shop_products').insert(payload);

      submitBtn.disabled = false;

      if (error) {
        setStatus(statusEl, 'Η αποθήκευση απέτυχε. Δοκίμασε ξανά.', 'error');
        return;
      }

      closeDialog(document.getElementById('prod-dialog'));
      showToast('Το προϊόν αποθηκεύτηκε.', 'success');
      loadProducts();
    });
  }

  /* ==================================================================
     Tab 4: Παραγγελίες
     ================================================================== */
  let orders = [];
  let orderStatusFilter = 'all';
  const ORDER_STATUS_LABELS = {
    pending: 'Σε αναμονή',
    confirmed: 'Επιβεβαιωμένη',
    shipped: 'Απεστάλη',
    delivered: 'Παραδόθηκε',
    cancelled: 'Ακυρωμένη',
  };
  const ordersListEl = () => document.getElementById('orders-list');

  async function loadOrders() {
    const listEl = ordersListEl();
    renderLoadingState(listEl, 'Φόρτωση παραγγελιών…');

    let data, error;
    try {
      ({ data, error } = await sb()
        .from('shop_orders')
        .select('*, shop_order_items(*)')
        .order('created_at', { ascending: false }));
    } catch (err) {
      error = err;
    }

    if (error) {
      renderErrorState(listEl);
      return;
    }

    orders = data || [];
    renderOrderFilters();
    renderOrdersList();
  }

  function renderOrderFilters() {
    const filtersEl = document.getElementById('orders-filters');
    const options = [['all', 'Όλες'], ...Object.entries(ORDER_STATUS_LABELS)];

    filtersEl.innerHTML = options
      .map(([value, label]) => {
        const isActive = value === orderStatusFilter;
        return `
          <button type="button" class="pill${isActive ? ' is-active' : ''}" data-status="${escapeHtml(value)}" aria-pressed="${isActive}">
            ${escapeHtml(label)}
          </button>
        `;
      })
      .join('');

    filtersEl.querySelectorAll('.pill').forEach((pill) => {
      pill.addEventListener('click', () => {
        orderStatusFilter = pill.dataset.status;
        renderOrderFilters();
        renderOrdersList();
      });
    });
  }

  function summarizeOrderItems(order) {
    const items = Array.isArray(order.shop_order_items) ? order.shop_order_items : [];
    if (items.length === 0) return 'Χωρίς είδη';
    return items
      .map((item) => `${item.quantity}× ${item.product_name}${item.size ? ` (${item.size})` : ''}`)
      .join(', ');
  }

  function renderOrdersList() {
    const listEl = ordersListEl();
    const filtered = orderStatusFilter === 'all'
      ? orders
      : orders.filter((order) => order.status === orderStatusFilter);

    if (orders.length === 0) {
      renderEmptyState(listEl, 'Δεν υπάρχουν παραγγελίες ακόμα.');
      return;
    }

    if (filtered.length === 0) {
      renderEmptyState(listEl, 'Δεν υπάρχουν παραγγελίες με αυτή την κατάσταση.');
      return;
    }

    listEl.innerHTML = `
      <div class="admin-rows">
        ${filtered.map((order) => `
          <article class="admin-row" data-id="${escapeHtml(order.id)}">
            <div class="admin-row__main">
              <p class="admin-row__title">${escapeHtml(order.full_name)}</p>
              <div class="admin-row__meta">
                <span>${escapeHtml(order.email)}</span>
                <span>${escapeHtml(formatDateTime(order.created_at))}</span>
                <span>${escapeHtml(order.city ?? '')}</span>
              </div>
              <div class="admin-row__meta">
                <span>${escapeHtml(summarizeOrderItems(order))}</span>
                <span><strong>${escapeHtml(formatPrice(order.total))}</strong></span>
              </div>
              ${order.notes ? `<div class="admin-row__meta"><span>Σημειώσεις: ${escapeHtml(order.notes)}</span></div>` : ''}
            </div>
            <div class="admin-row__actions">
              <label class="admin-toggle" for="order-status-${escapeHtml(order.id)}">
                <span>Κατάσταση</span>
              </label>
              <select class="admin-select" id="order-status-${escapeHtml(order.id)}" data-action="set-status">
                ${Object.entries(ORDER_STATUS_LABELS).map(([value, label]) => `
                  <option value="${escapeHtml(value)}" ${order.status === value ? 'selected' : ''}>${escapeHtml(label)}</option>
                `).join('')}
              </select>
            </div>
          </article>
        `).join('')}
      </div>
    `;

    listEl.querySelectorAll('.admin-row').forEach((row) => {
      const order = orders.find((o) => String(o.id) === row.dataset.id);
      if (!order) return;

      row.querySelector('[data-action="set-status"]').addEventListener('change', async (event) => {
        const select = event.target;
        const previous = order.status;
        select.disabled = true;
        const { error } = await sb()
          .from('shop_orders')
          .update({ status: select.value })
          .eq('id', order.id);
        if (error) {
          select.value = previous;
          select.disabled = false;
          showToast('Η αλλαγή κατάστασης απέτυχε.', 'error');
          return;
        }
        showToast('Η κατάσταση της παραγγελίας ενημερώθηκε.', 'success');
        loadOrders();
      });
    });
  }

  /* ==================================================================
     Tab 5: Προβλέψεις
     ================================================================== */
  let predictionEvents = [];
  let predictionPickCounts = {};
  let settleEventId = null;
  const PRED_STATUS_LABELS = {
    open: 'Ανοιχτή',
    closed: 'Κλειστή',
    settled: 'Οριστικοποιημένη',
  };
  const PRED_STATUS_BADGES = {
    open: 'badge-success',
    closed: 'badge-warning',
    settled: 'badge-primary',
  };
  const predListEl = () => document.getElementById('predictions-list');

  async function loadPredictions() {
    const listEl = predListEl();
    renderLoadingState(listEl, 'Φόρτωση προβλέψεων…');

    let eventsRes, picksRes;
    try {
      [eventsRes, picksRes] = await Promise.all([
        sb().from('prediction_events').select('*').order('created_at', { ascending: false }),
        sb().from('prediction_picks').select('event_id, pick'),
      ]);
    } catch (err) {
      renderErrorState(listEl);
      return;
    }

    if (eventsRes.error) {
      renderErrorState(listEl);
      return;
    }

    predictionEvents = eventsRes.data || [];

    // Ομαδοποίηση των picks ανά event στη μεριά του client
    predictionPickCounts = {};
    ((picksRes && picksRes.data) || []).forEach((pick) => {
      const bucket = predictionPickCounts[pick.event_id] || (predictionPickCounts[pick.event_id] = { total: 0, byPick: {} });
      bucket.total += 1;
      bucket.byPick[pick.pick] = (bucket.byPick[pick.pick] || 0) + 1;
    });

    renderPredictionsList();
  }

  function renderPredictionsList() {
    const listEl = predListEl();

    if (predictionEvents.length === 0) {
      renderEmptyState(listEl, 'Δεν υπάρχουν προβλέψεις ακόμα.');
      return;
    }

    listEl.innerHTML = `
      <div class="admin-rows">
        ${predictionEvents.map((event) => {
          const counts = predictionPickCounts[event.id] || { total: 0, byPick: {} };
          const options = Array.isArray(event.options) ? event.options : [];
          return `
            <article class="admin-row" data-id="${escapeHtml(event.id)}">
              <div class="admin-row__main">
                <p class="admin-row__title">${escapeHtml(event.title)}</p>
                <div class="admin-row__meta">
                  <span class="badge ${PRED_STATUS_BADGES[event.status] || ''}">${escapeHtml(PRED_STATUS_LABELS[event.status] || event.status)}</span>
                  ${event.closes_at ? `<span>Κλείνει: ${escapeHtml(formatDateTime(event.closes_at))}</span>` : ''}
                  <span>${escapeHtml(String(counts.total))} ${counts.total === 1 ? 'πρόβλεψη' : 'προβλέψεις'}</span>
                  ${event.result ? `<span class="badge badge-success">Νικητής: ${escapeHtml(event.result)}</span>` : ''}
                </div>
                <div class="admin-row__meta">
                  ${options.map((option) => `<span>${escapeHtml(option)} (${escapeHtml(String(counts.byPick[option] || 0))})</span>`).join('')}
                </div>
              </div>
              <div class="admin-row__actions">
                ${event.status === 'open' ? '<button type="button" class="btn btn-outline btn-sm" data-action="close">Κλείσιμο</button>' : ''}
                ${event.status !== 'settled' ? '<button type="button" class="btn btn-outline btn-sm" data-action="settle">Οριστικοποίηση</button>' : ''}
                <button type="button" class="btn btn-danger btn-sm" data-action="delete">Διαγραφή</button>
              </div>
            </article>
          `;
        }).join('')}
      </div>
    `;

    listEl.querySelectorAll('.admin-row').forEach((row) => {
      const event = predictionEvents.find((e) => String(e.id) === row.dataset.id);
      if (!event) return;

      const closeBtn = row.querySelector('[data-action="close"]');
      if (closeBtn) {
        closeBtn.addEventListener('click', async () => {
          closeBtn.disabled = true;
          const { error } = await sb()
            .from('prediction_events')
            .update({ status: 'closed' })
            .eq('id', event.id);
          if (error) {
            closeBtn.disabled = false;
            showToast('Το κλείσιμο απέτυχε.', 'error');
            return;
          }
          showToast('Η πρόβλεψη έκλεισε.', 'success');
          loadPredictions();
        });
      }

      const settleBtn = row.querySelector('[data-action="settle"]');
      if (settleBtn) {
        settleBtn.addEventListener('click', () => openSettleDialog(event));
      }

      row.querySelector('[data-action="delete"]').addEventListener('click', async (clickEvent) => {
        if (!confirm(`Σίγουρα θέλεις να διαγράψεις την πρόβλεψη «${event.title}»;`)) return;
        const btn = clickEvent.target;
        btn.disabled = true;
        const { error } = await sb().from('prediction_events').delete().eq('id', event.id);
        if (error) {
          btn.disabled = false;
          showToast('Η διαγραφή απέτυχε.', 'error');
          return;
        }
        showToast('Η πρόβλεψη διαγράφηκε.', 'success');
        loadPredictions();
      });
    });
  }

  function openSettleDialog(event) {
    settleEventId = event.id;
    const dialog = document.getElementById('settle-dialog');
    const select = document.getElementById('settle-result');
    setStatus(document.getElementById('settle-status'), '', null);

    document.getElementById('settle-event-title').textContent = event.title;
    select.innerHTML = (Array.isArray(event.options) ? event.options : [])
      .map((option) => `<option value="${escapeHtml(option)}">${escapeHtml(option)}</option>`)
      .join('');

    openDialog(dialog);
  }

  function wirePredictionsTab() {
    document.getElementById('pred-new-btn').addEventListener('click', () => {
      const form = document.getElementById('pred-form');
      form.reset();
      setStatus(document.getElementById('pred-status-msg'), '', null);
      openDialog(document.getElementById('pred-dialog'));
    });

    const predForm = document.getElementById('pred-form');
    predForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      const statusEl = document.getElementById('pred-status-msg');
      setStatus(statusEl, '', null);

      const options = predForm.elements.options.value
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean);

      if (options.length < 2) {
        setStatus(statusEl, 'Χρειάζονται τουλάχιστον 2 επιλογές.', 'error');
        return;
      }

      const closesAtRaw = predForm.elements.closes_at.value;
      const payload = {
        title: predForm.elements.title.value.trim(),
        description: predForm.elements.description.value.trim() || null,
        options,
        closes_at: closesAtRaw ? new Date(closesAtRaw).toISOString() : null,
        status: predForm.elements.status.value,
      };

      const submitBtn = predForm.querySelector('button[type="submit"]');
      submitBtn.disabled = true;

      const { error } = await sb().from('prediction_events').insert(payload);

      submitBtn.disabled = false;

      if (error) {
        setStatus(statusEl, 'Η δημιουργία απέτυχε. Δοκίμασε ξανά.', 'error');
        return;
      }

      closeDialog(document.getElementById('pred-dialog'));
      showToast('Η πρόβλεψη δημιουργήθηκε.', 'success');
      loadPredictions();
    });

    const settleForm = document.getElementById('settle-form');
    settleForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      const statusEl = document.getElementById('settle-status');
      setStatus(statusEl, '', null);

      const result = document.getElementById('settle-result').value;
      if (!result || !settleEventId) return;

      const submitBtn = settleForm.querySelector('button[type="submit"]');
      submitBtn.disabled = true;

      const { error } = await sb()
        .from('prediction_events')
        .update({ status: 'settled', result })
        .eq('id', settleEventId);

      submitBtn.disabled = false;

      if (error) {
        setStatus(statusEl, 'Η οριστικοποίηση απέτυχε. Δοκίμασε ξανά.', 'error');
        return;
      }

      closeDialog(document.getElementById('settle-dialog'));
      showToast('Η πρόβλεψη οριστικοποιήθηκε.', 'success');
      loadPredictions();
    });
  }

  /* ==================================================================
     Tab 6: Μηνύματα επικοινωνίας (μόνο ανάγνωση)
     ================================================================== */
  let contactMessages = [];
  let expandedMessageId = null;
  const messagesListEl = () => document.getElementById('messages-list');

  async function loadMessages() {
    const listEl = messagesListEl();
    renderLoadingState(listEl, 'Φόρτωση μηνυμάτων…');

    let data, error;
    try {
      ({ data, error } = await sb()
        .from('contact_messages')
        .select('*')
        .order('created_at', { ascending: false }));
    } catch (err) {
      error = err;
    }

    if (error) {
      renderErrorState(listEl);
      return;
    }

    contactMessages = data || [];
    renderMessagesList();
  }

  function renderMessagesList() {
    const listEl = messagesListEl();

    if (contactMessages.length === 0) {
      renderEmptyState(listEl, 'Δεν υπάρχουν μηνύματα ακόμα.');
      return;
    }

    listEl.innerHTML = '';
    const wrapper = document.createElement('div');
    wrapper.className = 'admin-rows';

    contactMessages.forEach((message) => {
      const isExpanded = expandedMessageId === message.id;
      const rowId = `msg-row-${message.id}`;
      const panelId = `msg-panel-${message.id}`;

      const card = document.createElement('article');
      card.className = 'admin-msg';
      card.innerHTML = `
        <button type="button" class="admin-msg__row" id="${escapeHtml(rowId)}" aria-expanded="${isExpanded}" aria-controls="${escapeHtml(panelId)}">
          <span class="admin-msg__name">${escapeHtml(message.name)}</span>
          <span class="admin-msg__email">${escapeHtml(message.email)}</span>
          <span class="admin-msg__date">${escapeHtml(formatDateTime(message.created_at))}</span>
          <span class="admin-msg__chevron" aria-hidden="true">▾</span>
          ${message.subject ? `<span class="admin-msg__subject">Θέμα: ${escapeHtml(message.subject)}</span>` : ''}
        </button>
        <div class="admin-msg__body" id="${escapeHtml(panelId)}" role="region" aria-labelledby="${escapeHtml(rowId)}" ${isExpanded ? '' : 'hidden'}>${escapeHtml(message.message)}</div>
      `;

      card.querySelector('.admin-msg__row').addEventListener('click', () => {
        expandedMessageId = expandedMessageId === message.id ? null : message.id;
        renderMessagesList();
      });

      wrapper.appendChild(card);
    });

    listEl.appendChild(wrapper);
  }

  /* ==================================================================
     Tabs / πύλη πρόσβασης
     ================================================================== */
  const TAB_LOADERS = {
    podcasts: loadPodcasts,
    championships: loadChampionships,
    products: loadProducts,
    orders: loadOrders,
    predictions: loadPredictions,
    messages: loadMessages,
  };
  const loadedTabs = new Set();

  function activateTab(name) {
    document.querySelectorAll('.admin-tabs [role="tab"]').forEach((tab) => {
      const isActive = tab.dataset.tab === name;
      tab.classList.toggle('is-active', isActive);
      tab.setAttribute('aria-selected', String(isActive));
    });

    document.querySelectorAll('.admin-tabpanel').forEach((panel) => {
      panel.hidden = panel.id !== `panel-${name}`;
    });

    if (!loadedTabs.has(name)) {
      loadedTabs.add(name);
      TAB_LOADERS[name]();
    }
  }

  function setupTabs() {
    document.querySelectorAll('.admin-tabs [role="tab"]').forEach((tab) => {
      tab.addEventListener('click', () => activateTab(tab.dataset.tab));
    });
  }

  function showGateState(id) {
    ['admin-loading', 'admin-signin', 'admin-denied', 'admin-unavailable', 'admin-panel'].forEach((elId) => {
      document.getElementById(elId).classList.toggle('is-hidden', elId !== id);
    });
  }

  async function init() {
    wireDialogCloseButtons();

    if (typeof window.supabaseClient === 'undefined') {
      showGateState('admin-unavailable');
      return;
    }

    let session;
    try {
      ({ data: { session } } = await sb().auth.getSession());
    } catch (err) {
      showGateState('admin-unavailable');
      return;
    }

    if (!session || !session.user) {
      showGateState('admin-signin');
      return;
    }

    // Το RLS επιτρέπει σε κάθε χρήστη να διαβάζει μόνο τους δικούς του ρόλους.
    let roles, rolesError;
    try {
      ({ data: roles, error: rolesError } = await sb()
        .from('user_roles')
        .select('role')
        .eq('user_id', session.user.id));
    } catch (err) {
      rolesError = err;
    }

    const isAdmin = !rolesError && Array.isArray(roles) && roles.some((row) => row.role === 'admin');
    if (!isAdmin) {
      showGateState('admin-denied');
      return;
    }

    showGateState('admin-panel');
    setupTabs();
    wirePodcastsTab();
    wireChampionshipsTab();
    wireProductsTab();
    wirePredictionsTab();
    activateTab('podcasts');
  }

  document.addEventListener('DOMContentLoaded', init);
})();
