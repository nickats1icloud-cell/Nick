// Drives the #nav-auth slot on every page: shows a "Σύνδεση" link when
// signed out, or the member's name + a logout button when signed in.
// Depends on window.supabaseClient (see supabase-client.js) and the
// public.profiles table (one row per auth user, display_name column).
(function () {
  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function renderSignedOut(slot) {
    slot.innerHTML = '<a class="nav-auth__link" href="auth.html">Σύνδεση</a>';
  }

  function renderSignedIn(slot, user, profile) {
    const name = (profile && profile.display_name) || (user.email ? user.email.split('@')[0] : 'Μέλος');
    slot.innerHTML =
      '<a class="nav-auth__link nav-auth__name" href="profile.html">' + escapeHtml(name) + '</a>' +
      '<button type="button" class="nav-auth__logout" data-auth-logout>Αποσύνδεση</button>';

    const logoutBtn = slot.querySelector('[data-auth-logout]');
    logoutBtn.addEventListener('click', async () => {
      logoutBtn.disabled = true;
      await window.supabaseClient.auth.signOut();
      window.location.href = 'index.html';
    });
  }

  async function refreshAuthNav() {
    const slot = document.getElementById('nav-auth');
    if (!slot) return;

    if (typeof window.supabaseClient === 'undefined') {
      renderSignedOut(slot);
      return;
    }

    try {
      const { data: { session } } = await window.supabaseClient.auth.getSession();
      if (!session || !session.user) {
        renderSignedOut(slot);
        return;
      }
      const { data: profile } = await window.supabaseClient
        .from('profiles')
        .select('display_name')
        .eq('user_id', session.user.id)
        .maybeSingle();
      renderSignedIn(slot, session.user, profile);
    } catch (err) {
      renderSignedOut(slot);
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    refreshAuthNav();
    if (typeof window.supabaseClient !== 'undefined') {
      window.supabaseClient.auth.onAuthStateChange(() => refreshAuthNav());
    }
  });
})();
