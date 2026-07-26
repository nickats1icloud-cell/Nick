// Logic for profile.html: signed-in members view/edit their own row in
// public.profiles.
(function () {
  function setStatus(el, message, state) {
    el.textContent = message;
    if (state) {
      el.setAttribute('data-state', state);
    } else {
      el.removeAttribute('data-state');
    }
  }

  document.addEventListener('DOMContentLoaded', async () => {
    const unavailable = document.getElementById('auth-unavailable');
    const loading = document.getElementById('profile-loading');
    const content = document.getElementById('profile-content');

    if (typeof window.supabaseClient === 'undefined') {
      loading.classList.add('is-hidden');
      unavailable.classList.add('is-visible');
      return;
    }

    const { data: { session } } = await window.supabaseClient.auth.getSession();
    if (!session || !session.user) {
      window.location.href = 'auth.html';
      return;
    }

    const user = session.user;
    const { data: profile, error: fetchError } = await window.supabaseClient
      .from('profiles')
      .select('display_name, favorite_sim, setup_type, favorite_track')
      .eq('user_id', user.id)
      .single();

    loading.classList.add('is-hidden');
    content.classList.remove('is-hidden');

    const emailEl = document.getElementById('profile-email');
    const avatarEl = document.getElementById('profile-avatar');
    const displayNameInput = document.getElementById('profile-display-name');
    const favoriteSimSelect = document.getElementById('profile-favorite-sim');
    const setupTypeSelect = document.getElementById('profile-setup-type');
    const favoriteTrackInput = document.getElementById('profile-favorite-track');
    const form = document.getElementById('profile-form');
    const status = document.getElementById('profile-status');
    const signOutBtn = document.getElementById('profile-signout');

    emailEl.textContent = user.email || '';
    avatarEl.textContent = ((profile && profile.display_name) || user.email || '?').charAt(0).toUpperCase();

    if (fetchError) {
      setStatus(status, 'Δεν ήταν δυνατή η φόρτωση του προφίλ σου.', 'error');
    } else if (profile) {
      displayNameInput.value = profile.display_name || '';
      favoriteSimSelect.value = profile.favorite_sim || '';
      setupTypeSelect.value = profile.setup_type || '';
      favoriteTrackInput.value = profile.favorite_track || '';
    }

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      setStatus(status, '', null);

      const submitBtn = form.querySelector('button[type="submit"]');
      submitBtn.disabled = true;

      const { error } = await window.supabaseClient
        .from('profiles')
        .update({
          display_name: displayNameInput.value.trim(),
          favorite_sim: favoriteSimSelect.value,
          setup_type: setupTypeSelect.value,
          favorite_track: favoriteTrackInput.value.trim(),
        })
        .eq('user_id', user.id);

      submitBtn.disabled = false;

      if (error) {
        setStatus(status, 'Κάτι πήγε στραβά. Δοκίμασε ξανά.', 'error');
        return;
      }

      avatarEl.textContent = (displayNameInput.value || user.email || '?').charAt(0).toUpperCase();
      setStatus(status, 'Το προφίλ σου αποθηκεύτηκε!', 'success');
    });

    signOutBtn.addEventListener('click', async () => {
      signOutBtn.disabled = true;
      await window.supabaseClient.auth.signOut();
      window.location.href = 'index.html';
    });
  });
})();
