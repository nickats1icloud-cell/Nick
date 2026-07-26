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

  function renderSignedIn(slot, user, profile, isAdmin, unreadCount) {
    const name = (profile && profile.display_name) || (user.email ? user.email.split('@')[0] : 'Μέλος');
    const badge = unreadCount > 0
      ? '<span class="nav-auth__badge" data-messages-badge>' + (unreadCount > 99 ? '99+' : unreadCount) + '</span>'
      : '<span class="nav-auth__badge" data-messages-badge hidden></span>';

    slot.innerHTML =
      (isAdmin ? '<a class="nav-auth__admin" href="admin.html">⚙️ Admin</a>' : '') +
      '<a class="nav-auth__messages" href="messages.html" aria-label="Προσωπικά μηνύματα">✉️' + badge + '</a>' +
      '<a class="nav-auth__link nav-auth__name" href="profile.html#/user/' + encodeURIComponent(user.id) + '">' + escapeHtml(name) + '</a>' +
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
      const [{ data: profile }, { data: roles }, unread] = await Promise.all([
        window.supabaseClient
          .from('profiles')
          .select('display_name')
          .eq('user_id', session.user.id)
          .maybeSingle(),
        window.supabaseClient
          .from('user_roles')
          .select('role')
          .eq('user_id', session.user.id),
        window.supabaseClient
          .from('private_messages')
          .select('id', { count: 'exact', head: true })
          .eq('recipient_id', session.user.id)
          .is('read_at', null),
      ]);
      const isAdmin = Array.isArray(roles) && roles.some((r) => r.role === 'admin');
      renderSignedIn(slot, session.user, profile, isAdmin, (unread && unread.count) || 0);
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
