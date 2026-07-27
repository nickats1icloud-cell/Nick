// Διαχείριση του Championship Hub: σεζόν, ομάδες, οδηγοί, πίστες, αγώνες
// και αποτελέσματα.
//
// Ζει σε δικό του αρχείο και συνδέεται με το admin.html μέσω του
// GSRAdmin.registerTab, ώστε το admin.js να μένει στο μέγεθός του.
//
// ΑΣΦΑΛΕΙΑ: όπως και στο υπόλοιπο admin, η απόκρυψη του UI είναι μόνο για
// την εμπειρία χρήστη. Το γράψιμο το επιτρέπει ή το απορρίπτει αποκλειστικά
// το RLS στη Supabase (policies hub_*_admin + has_role()).
(function () {
  'use strict';

  const A = window.GSRAdmin;
  if (!A) return;

  const { sb, escapeHtml, showToast, setStatus, openDialog, closeDialog } = A;

  const $ = (id) => document.getElementById(id);

  // Τρέχουσα επιλογή: όλα τα υπόλοιπα κρέμονται από αυτή.
  const state = {
    championships: [],
    seasons: [],
    championshipId: null,
    seasonId: null,
    teams: [],
    drivers: [],
    events: [],
    tracks: [],
  };

  const season = () => state.seasons.find((s) => s.id === state.seasonId) || null;

  function dateTimeLocal(iso) {
    if (!iso) return '';
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return '';
    // Το datetime-local θέλει τοπική ώρα χωρίς ζώνη.
    const pad = (n) => String(n).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
      `T${pad(date.getHours())}:${pad(date.getMinutes())}`;
  }

  function emptyRow(message) {
    return `<div class="state-message"><p>${escapeHtml(message)}</p></div>`;
  }

  // Μικρός βοηθός: τυλίγει μια λίστα σε γραμμές με κουμπιά επεξεργασίας
  // και διαγραφής, και συνδέει τα κλικ.
  function renderRows(host, items, describe, handlers) {
    if (!items.length) {
      host.innerHTML = emptyRow(handlers.emptyText);
      return;
    }

    host.innerHTML =
      '<div class="admin-rows">' +
      items
        .map((item) => {
          const info = describe(item);
          return (
            `<article class="admin-row" data-id="${escapeHtml(item.id)}">` +
            '<div class="admin-row__main">' +
            `<p class="admin-row__title">${info.title}</p>` +
            `<div class="admin-row__meta">${info.meta}</div>` +
            '</div>' +
            '<div class="admin-row__actions">' +
            (handlers.extraButton ? handlers.extraButton(item) : '') +
            '<button type="button" class="btn btn-outline btn-sm" data-action="edit">Επεξεργασία</button>' +
            '<button type="button" class="btn btn-danger btn-sm" data-action="delete">Διαγραφή</button>' +
            '</div></article>'
          );
        })
        .join('') +
      '</div>';

    host.querySelectorAll('.admin-row').forEach((row) => {
      const item = items.find((i) => String(i.id) === row.dataset.id);
      if (!item) return;

      row.querySelector('[data-action="edit"]').addEventListener('click', () => handlers.onEdit(item));

      row.querySelector('[data-action="delete"]').addEventListener('click', async (event) => {
        if (!window.confirm(handlers.confirmText(item))) return;
        const btn = event.target;
        btn.disabled = true;
        const { error } = await sb().from(handlers.table).delete().eq('id', item.id);
        btn.disabled = false;
        if (error) {
          showToast('Η διαγραφή απέτυχε.', 'error');
          return;
        }
        showToast('Διαγράφηκε.', 'success');
        handlers.onReload();
      });

      const extra = row.querySelector('[data-action="extra"]');
      if (extra) extra.addEventListener('click', () => handlers.onExtra(item));
    });
  }

  // Γενική αποθήκευση φόρμας: ένα insert ή update ανάλογα με το κρυφό id.
  async function saveForm(form, table, payload, statusEl, afterSave) {
    const id = form.elements.id.value;
    const submit = form.querySelector('button[type="submit"]');
    submit.disabled = true;

    const { error } = id
      ? await sb().from(table).update(payload).eq('id', id)
      : await sb().from(table).insert(payload);

    submit.disabled = false;

    if (error) {
      setStatus(statusEl, 'Η αποθήκευση απέτυχε. Δοκίμασε ξανά.', 'error');
      return false;
    }

    closeDialog(form.closest('dialog'));
    showToast('Αποθηκεύτηκε.', 'success');
    await afterSave();
    return true;
  }

  /* ================= Πρωτάθλημα & σεζόν ================= */

  async function loadChampionshipsAndSeasons() {
    const { data, error } = await sb()
      .from('championships')
      .select('id, title, status')
      .order('created_at', { ascending: false });

    if (error) {
      $('hub-empty').innerHTML = emptyRow('Δεν καταφέραμε να φορτώσουμε τα πρωταθλήματα.');
      return;
    }

    state.championships = data || [];

    if (!state.championships.length) {
      $('hub-picker').hidden = true;
      $('hub-body').hidden = true;
      $('hub-empty').innerHTML = emptyRow(
        'Δεν υπάρχει πρωτάθλημα ακόμη. Φτιάξε ένα από την ενότητα «Πρωταθλήματα» και επέστρεψε εδώ.'
      );
      return;
    }

    $('hub-empty').innerHTML = '';
    $('hub-picker').hidden = false;

    const select = $('hub-championship');
    select.innerHTML = state.championships
      .map((c) => `<option value="${escapeHtml(c.id)}">${escapeHtml(c.title)}</option>`)
      .join('');

    state.championshipId = state.championships[0].id;
    select.value = state.championshipId;

    await loadSeasons();
  }

  async function loadSeasons() {
    const { data, error } = await sb()
      .from('hub_seasons')
      .select('*')
      .eq('championship_id', state.championshipId)
      .order('year', { ascending: false });

    state.seasons = error ? [] : data || [];

    const select = $('hub-season');
    if (!state.seasons.length) {
      select.innerHTML = '<option value="">— καμία σεζόν —</option>';
      state.seasonId = null;
      $('hub-body').hidden = true;
      $('hub-season-hint').textContent = 'Φτιάξε μια σεζόν για να προσθέσεις οδηγούς και αγώνες.';
      return;
    }

    select.innerHTML = state.seasons
      .map(
        (s) =>
          `<option value="${escapeHtml(s.id)}">${escapeHtml(s.name)}` +
          `${s.year ? ' · ' + escapeHtml(s.year) : ''}${s.is_active ? ' (ενεργή)' : ''}</option>`
      )
      .join('');

    const active = state.seasons.find((s) => s.is_active) || state.seasons[0];
    state.seasonId = active.id;
    select.value = state.seasonId;
    $('hub-season-hint').textContent = '';
    $('hub-body').hidden = false;

    await loadSeasonData();
  }

  async function loadSeasonData() {
    const [teams, drivers, events, tracks] = await Promise.all([
      sb().from('hub_teams').select('*').eq('season_id', state.seasonId).order('name'),
      sb().from('hub_drivers').select('*').eq('season_id', state.seasonId).order('display_name'),
      sb()
        .from('hub_events')
        .select('*, hub_tracks(name)')
        .eq('season_id', state.seasonId)
        .order('round'),
      sb().from('hub_tracks').select('*').order('name'),
    ]);

    state.teams = teams.data || [];
    state.drivers = drivers.data || [];
    state.events = events.data || [];
    state.tracks = tracks.data || [];

    renderTeams();
    renderDrivers();
    renderEvents();
    renderTracks();
  }

  /* ================= Ομάδες ================= */

  function renderTeams() {
    renderRows(
      $('hub-teams-list'),
      state.teams,
      (team) => ({
        title: escapeHtml(team.name),
        meta: team.car ? `<span>${escapeHtml(team.car)}</span>` : '',
      }),
      {
        table: 'hub_teams',
        emptyText: 'Καμία ομάδα σε αυτή τη σεζόν.',
        confirmText: (t) => `Σίγουρα θέλεις να διαγράψεις την ομάδα «${t.name}»;`,
        onEdit: openTeamDialog,
        onReload: loadSeasonData,
      }
    );
  }

  function openTeamDialog(team) {
    const form = $('hub-team-form');
    form.reset();
    setStatus($('hub-team-status'), '', null);
    $('hub-team-title').textContent = team ? 'Επεξεργασία ομάδας' : 'Νέα ομάδα';
    form.elements.id.value = team ? team.id : '';
    if (team) {
      form.elements.name.value = team.name || '';
      form.elements.car.value = team.car || '';
      form.elements.logo_url.value = team.logo_url || '';
    }
    openDialog($('hub-team-dialog'));
  }

  /* ================= Οδηγοί ================= */

  function renderDrivers() {
    const teamName = (id) => {
      const team = state.teams.find((t) => t.id === id);
      return team ? team.name : '—';
    };

    renderRows(
      $('hub-drivers-list'),
      state.drivers,
      (driver) => ({
        title:
          (driver.car_number ? `#${escapeHtml(driver.car_number)} ` : '') +
          escapeHtml(driver.display_name),
        meta:
          `<span>${escapeHtml(driver.country_flag || '')} ${escapeHtml(driver.country || '')}</span>` +
          `<span>${escapeHtml(teamName(driver.team_id))}</span>` +
          (driver.car ? `<span>${escapeHtml(driver.car)}</span>` : ''),
      }),
      {
        table: 'hub_drivers',
        emptyText: 'Κανένας οδηγός σε αυτή τη σεζόν.',
        confirmText: (d) => `Σίγουρα θέλεις να διαγράψεις τον οδηγό «${d.display_name}»;`,
        onEdit: openDriverDialog,
        onReload: loadSeasonData,
      }
    );
  }

  function openDriverDialog(driver) {
    const form = $('hub-driver-form');
    form.reset();
    setStatus($('hub-driver-status'), '', null);
    $('hub-driver-title').textContent = driver ? 'Επεξεργασία οδηγού' : 'Νέος οδηγός';

    form.elements.team_id.innerHTML =
      '<option value="">— χωρίς ομάδα —</option>' +
      state.teams.map((t) => `<option value="${escapeHtml(t.id)}">${escapeHtml(t.name)}</option>`).join('');

    form.elements.id.value = driver ? driver.id : '';
    if (driver) {
      form.elements.display_name.value = driver.display_name || '';
      form.elements.car_number.value = driver.car_number ?? '';
      form.elements.team_id.value = driver.team_id || '';
      form.elements.car.value = driver.car || '';
      form.elements.country.value = driver.country || '';
      form.elements.country_flag.value = driver.country_flag || '';
      form.elements.photo_url.value = driver.photo_url || '';
    }
    openDialog($('hub-driver-dialog'));
  }

  /* ================= Πίστες ================= */

  function renderTracks() {
    renderRows(
      $('hub-tracks-list'),
      state.tracks,
      (track) => ({
        title: `${escapeHtml(track.country_flag || '')} ${escapeHtml(track.name)}`,
        meta:
          (track.country ? `<span>${escapeHtml(track.country)}</span>` : '') +
          (track.length_km ? `<span>${escapeHtml(track.length_km)} χλμ</span>` : '') +
          (track.corners ? `<span>${escapeHtml(track.corners)} στροφές</span>` : '') +
          (track.lap_record ? `<span>Ρεκόρ: ${escapeHtml(track.lap_record)}</span>` : ''),
      }),
      {
        table: 'hub_tracks',
        emptyText: 'Καμία πίστα καταχωρημένη.',
        confirmText: (t) => `Σίγουρα θέλεις να διαγράψεις την πίστα «${t.name}»;`,
        onEdit: openTrackDialog,
        onReload: loadSeasonData,
      }
    );
  }

  function openTrackDialog(track) {
    const form = $('hub-track-form');
    form.reset();
    setStatus($('hub-track-status'), '', null);
    $('hub-track-title').textContent = track ? 'Επεξεργασία πίστας' : 'Νέα πίστα';
    form.elements.id.value = track ? track.id : '';
    if (track) {
      form.elements.name.value = track.name || '';
      form.elements.country.value = track.country || '';
      form.elements.country_flag.value = track.country_flag || '';
      form.elements.length_km.value = track.length_km ?? '';
      form.elements.corners.value = track.corners ?? '';
      form.elements.lap_record.value = track.lap_record || '';
      form.elements.image_url.value = track.image_url || '';
    }
    openDialog($('hub-track-dialog'));
  }

  /* ================= Αγώνες ================= */

  const EVENT_LABELS = { upcoming: 'Έρχεται', live: 'Live', finished: 'Ολοκληρώθηκε' };

  function renderEvents() {
    renderRows(
      $('hub-events-list'),
      state.events,
      (event) => ({
        title: (event.round ? `R${escapeHtml(event.round)} · ` : '') + escapeHtml(event.name),
        meta:
          `<span class="badge">${escapeHtml(EVENT_LABELS[event.status] || event.status)}</span>` +
          (event.hub_tracks ? `<span>${escapeHtml(event.hub_tracks.name)}</span>` : '') +
          (event.starts_at ? `<span>${escapeHtml(A.formatDateTime(event.starts_at))}</span>` : ''),
      }),
      {
        table: 'hub_events',
        emptyText: 'Κανένας αγώνας σε αυτή τη σεζόν.',
        confirmText: (e) => `Σίγουρα θέλεις να διαγράψεις τον αγώνα «${e.name}»;`,
        onEdit: openEventDialog,
        onReload: loadSeasonData,
        extraButton: () =>
          '<button type="button" class="btn btn-primary btn-sm" data-action="extra">Αποτελέσματα</button>',
        onExtra: openResultsDialog,
      }
    );
  }

  function openEventDialog(event) {
    const form = $('hub-event-form');
    form.reset();
    setStatus($('hub-event-status'), '', null);
    $('hub-event-title').textContent = event ? 'Επεξεργασία αγώνα' : 'Νέος αγώνας';

    form.elements.track_id.innerHTML =
      '<option value="">— χωρίς πίστα —</option>' +
      state.tracks.map((t) => `<option value="${escapeHtml(t.id)}">${escapeHtml(t.name)}</option>`).join('');

    form.elements.id.value = event ? event.id : '';
    if (event) {
      form.elements.name.value = event.name || '';
      form.elements.round.value = event.round ?? '';
      form.elements.track_id.value = event.track_id || '';
      form.elements.status.value = event.status || 'upcoming';
      form.elements.starts_at.value = dateTimeLocal(event.starts_at);
      form.elements.stream_url.value = event.stream_url || '';
    } else {
      // Ο επόμενος γύρος προτείνεται μόνος του.
      form.elements.round.value = state.events.length + 1;
    }
    openDialog($('hub-event-dialog'));
  }

  /* ================= Αποτελέσματα ================= */

  let resultsEvent = null;

  async function openResultsDialog(event) {
    resultsEvent = event;
    setStatus($('hub-results-status'), '', null);
    $('hub-results-title').textContent = `Αποτελέσματα — ${event.name}`;

    const host = $('hub-results-body');

    if (!state.drivers.length) {
      host.innerHTML = emptyRow('Πρόσθεσε πρώτα οδηγούς στη σεζόν.');
      openDialog($('hub-results-dialog'));
      return;
    }

    host.innerHTML = '<div class="state-message"><div class="spinner"></div><p>Φόρτωση…</p></div>';
    openDialog($('hub-results-dialog'));

    const { data } = await sb()
      .from('hub_results')
      .select('*')
      .eq('event_id', event.id);

    const byDriver = {};
    (data || []).forEach((row) => { byDriver[row.driver_id] = row; });

    host.innerHTML =
      '<div class="results-grid">' +
      '<div class="results-grid__head">' +
      '<span>Οδηγός</span><span>Θέση</span><span>Πόντοι</span><span>Καλύτερος γύρος</span>' +
      '<span>Pole</span><span>FL</span><span>DNF</span>' +
      '</div>' +
      state.drivers
        .map((driver) => {
          const row = byDriver[driver.id] || {};
          const id = escapeHtml(driver.id);
          return (
            `<div class="results-grid__row" data-driver="${id}">` +
            `<span class="results-grid__name">${driver.car_number ? '#' + escapeHtml(driver.car_number) + ' ' : ''}${escapeHtml(driver.display_name)}</span>` +
            `<input type="number" min="1" step="1" name="position" value="${row.position ?? ''}" aria-label="Θέση ${escapeHtml(driver.display_name)}">` +
            `<input type="number" min="0" step="0.5" name="points" value="${row.points ?? ''}" aria-label="Πόντοι ${escapeHtml(driver.display_name)}">` +
            `<input type="text" name="best_lap" value="${escapeHtml(row.best_lap || '')}" placeholder="1:47.312" aria-label="Καλύτερος γύρος ${escapeHtml(driver.display_name)}">` +
            `<input type="checkbox" name="is_pole"${row.is_pole ? ' checked' : ''} aria-label="Pole ${escapeHtml(driver.display_name)}">` +
            `<input type="checkbox" name="is_fastest_lap"${row.is_fastest_lap ? ' checked' : ''} aria-label="Ταχύτερος γύρος ${escapeHtml(driver.display_name)}">` +
            `<input type="checkbox" name="dnf"${row.dnf ? ' checked' : ''} aria-label="DNF ${escapeHtml(driver.display_name)}">` +
            '</div>'
          );
        })
        .join('') +
      '</div>';
  }

  // Συμπληρώνει τους πόντους από το σύστημα βαθμολογίας της σεζόν, ώστε ο
  // διαχειριστής να γράφει μόνο τη σειρά τερματισμού.
  function autoFillPoints() {
    const current = season();
    const scale = (current && Array.isArray(current.points_system) ? current.points_system : null) ||
      [25, 18, 15, 12, 10, 8, 6, 4, 2, 1];

    $('hub-results-body').querySelectorAll('.results-grid__row').forEach((row) => {
      const position = parseInt(row.querySelector('[name="position"]').value, 10);
      const dnf = row.querySelector('[name="dnf"]').checked;
      const points = row.querySelector('[name="points"]');
      if (dnf || !position) {
        points.value = 0;
        return;
      }
      points.value = scale[position - 1] ?? 0;
    });

    setStatus($('hub-results-status'), 'Συμπληρώθηκαν οι πόντοι — έλεγξέ τους πριν αποθηκεύσεις.', null);
  }

  async function saveResults() {
    const rows = [...$('hub-results-body').querySelectorAll('.results-grid__row')];
    const payload = [];
    const seen = new Set();
    let duplicate = null;

    rows.forEach((row) => {
      const position = parseInt(row.querySelector('[name="position"]').value, 10);
      const pointsRaw = row.querySelector('[name="points"]').value;
      const bestLap = row.querySelector('[name="best_lap"]').value.trim();
      const dnf = row.querySelector('[name="dnf"]').checked;

      // Κενή γραμμή = ο οδηγός δεν συμμετείχε· δεν αποθηκεύεται τίποτα.
      if (!position && !pointsRaw && !bestLap && !dnf) return;

      if (position) {
        if (seen.has(position)) duplicate = position;
        seen.add(position);
      }

      payload.push({
        event_id: resultsEvent.id,
        driver_id: row.dataset.driver,
        position: position || null,
        points: pointsRaw === '' ? 0 : Number(pointsRaw),
        best_lap: bestLap || null,
        is_pole: row.querySelector('[name="is_pole"]').checked,
        is_fastest_lap: row.querySelector('[name="is_fastest_lap"]').checked,
        dnf,
      });
    });

    if (duplicate) {
      setStatus($('hub-results-status'), `Η θέση ${duplicate} είναι δηλωμένη σε δύο οδηγούς.`, 'error');
      return;
    }

    if (!payload.length) {
      setStatus($('hub-results-status'), 'Δεν υπάρχει τίποτα να αποθηκευτεί.', 'error');
      return;
    }

    const btn = $('hub-results-save');
    btn.disabled = true;

    // Πρώτα καθαρίζουμε τον αγώνα, μετά γράφουμε — έτσι ένας οδηγός που
    // αφαιρέθηκε από τη λίστα δεν μένει με παλιό αποτέλεσμα.
    const { error: deleteError } = await sb().from('hub_results').delete().eq('event_id', resultsEvent.id);
    const { error } = deleteError
      ? { error: deleteError }
      : await sb().from('hub_results').insert(payload);

    btn.disabled = false;

    if (error) {
      setStatus($('hub-results-status'), 'Η αποθήκευση απέτυχε. Δοκίμασε ξανά.', 'error');
      return;
    }

    closeDialog($('hub-results-dialog'));
    showToast('Τα αποτελέσματα αποθηκεύτηκαν.', 'success');
    await loadSeasonData();
  }

  /* ================= Σεζόν (dialog) ================= */

  function openSeasonDialog(existing) {
    const form = $('hub-season-form');
    form.reset();
    setStatus($('hub-season-status'), '', null);
    $('hub-season-title').textContent = existing ? 'Επεξεργασία σεζόν' : 'Νέα σεζόν';
    form.elements.id.value = existing ? existing.id : '';
    if (existing) {
      form.elements.name.value = existing.name || '';
      form.elements.year.value = existing.year ?? '';
      form.elements.description.value = existing.description || '';
      form.elements.rules_url.value = existing.rules_url || '';
      form.elements.is_active.checked = !!existing.is_active;
    } else {
      form.elements.year.value = new Date().getFullYear();
    }
    openDialog($('hub-season-dialog'));
  }

  /* ================= Υπο-ενότητες ================= */

  function activateSubTab(name) {
    document.querySelectorAll('.hub-subtabs [role="tab"]').forEach((tab) => {
      const active = tab.dataset.sub === name;
      tab.classList.toggle('is-active', active);
      tab.setAttribute('aria-selected', String(active));
    });
    document.querySelectorAll('.hub-subpanel').forEach((panel) => {
      panel.hidden = panel.id !== `hub-panel-${name}`;
    });
  }

  /* ================= Σύνδεση ================= */

  function wire() {
    $('hub-championship').addEventListener('change', async (event) => {
      state.championshipId = event.target.value;
      await loadSeasons();
    });

    $('hub-season').addEventListener('change', async (event) => {
      state.seasonId = event.target.value;
      await loadSeasonData();
    });

    $('hub-season-new').addEventListener('click', () => openSeasonDialog(null));
    $('hub-season-edit').addEventListener('click', () => {
      const current = season();
      if (current) openSeasonDialog(current);
    });

    $('hub-team-new').addEventListener('click', () => openTeamDialog(null));
    $('hub-driver-new').addEventListener('click', () => openDriverDialog(null));
    $('hub-event-new').addEventListener('click', () => openEventDialog(null));
    $('hub-track-new').addEventListener('click', () => openTrackDialog(null));

    document.querySelectorAll('.hub-subtabs [role="tab"]').forEach((tab) => {
      tab.addEventListener('click', () => activateSubTab(tab.dataset.sub));
    });

    $('hub-season-form').addEventListener('submit', async (event) => {
      event.preventDefault();
      const form = event.target;
      const payload = {
        championship_id: state.championshipId,
        name: form.elements.name.value.trim(),
        year: parseInt(form.elements.year.value, 10) || null,
        description: form.elements.description.value.trim() || null,
        rules_url: form.elements.rules_url.value.trim() || null,
        is_active: form.elements.is_active.checked,
      };
      await saveForm(form, 'hub_seasons', payload, $('hub-season-status'), loadSeasons);
    });

    $('hub-team-form').addEventListener('submit', async (event) => {
      event.preventDefault();
      const form = event.target;
      const payload = {
        season_id: state.seasonId,
        name: form.elements.name.value.trim(),
        car: form.elements.car.value.trim() || null,
        logo_url: form.elements.logo_url.value.trim() || null,
      };
      await saveForm(form, 'hub_teams', payload, $('hub-team-status'), loadSeasonData);
    });

    $('hub-driver-form').addEventListener('submit', async (event) => {
      event.preventDefault();
      const form = event.target;
      const payload = {
        season_id: state.seasonId,
        team_id: form.elements.team_id.value || null,
        display_name: form.elements.display_name.value.trim(),
        car_number: parseInt(form.elements.car_number.value, 10) || null,
        car: form.elements.car.value.trim() || null,
        country: form.elements.country.value.trim() || null,
        country_flag: form.elements.country_flag.value.trim() || null,
        photo_url: form.elements.photo_url.value.trim() || null,
      };
      await saveForm(form, 'hub_drivers', payload, $('hub-driver-status'), loadSeasonData);
    });

    $('hub-track-form').addEventListener('submit', async (event) => {
      event.preventDefault();
      const form = event.target;
      const payload = {
        name: form.elements.name.value.trim(),
        country: form.elements.country.value.trim() || null,
        country_flag: form.elements.country_flag.value.trim() || null,
        length_km: form.elements.length_km.value ? Number(form.elements.length_km.value) : null,
        corners: parseInt(form.elements.corners.value, 10) || null,
        lap_record: form.elements.lap_record.value.trim() || null,
        image_url: form.elements.image_url.value.trim() || null,
      };
      await saveForm(form, 'hub_tracks', payload, $('hub-track-status'), loadSeasonData);
    });

    $('hub-event-form').addEventListener('submit', async (event) => {
      event.preventDefault();
      const form = event.target;
      const startsAt = form.elements.starts_at.value;
      const payload = {
        season_id: state.seasonId,
        track_id: form.elements.track_id.value || null,
        name: form.elements.name.value.trim(),
        round: parseInt(form.elements.round.value, 10) || null,
        status: form.elements.status.value,
        starts_at: startsAt ? new Date(startsAt).toISOString() : null,
        stream_url: form.elements.stream_url.value.trim() || null,
      };
      await saveForm(form, 'hub_events', payload, $('hub-event-status'), loadSeasonData);
    });

    $('hub-results-autofill').addEventListener('click', autoFillPoints);
    $('hub-results-save').addEventListener('click', saveResults);
  }

  A.registerTab('hub', loadChampionshipsAndSeasons, wire);
})();
