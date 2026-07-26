// Logic for auth.html: login + register forms toggled in the same card.
(function () {
  function setStatus(el, message, state) {
    el.textContent = message;
    if (state) {
      el.setAttribute('data-state', state);
    } else {
      el.removeAttribute('data-state');
    }
  }

  function setFormDisabled(form, disabled) {
    form.querySelectorAll('input, button').forEach((el) => {
      el.disabled = disabled;
    });
  }

  function showRegister(loginForm, registerForm) {
    loginForm.classList.add('is-hidden');
    registerForm.classList.remove('is-hidden');
  }

  function showLogin(loginForm, registerForm) {
    registerForm.classList.add('is-hidden');
    loginForm.classList.remove('is-hidden');
  }

  document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    const loginStatus = document.getElementById('login-status');
    const registerStatus = document.getElementById('register-status');
    const unavailable = document.getElementById('auth-unavailable');

    document.getElementById('show-register').addEventListener('click', () => {
      showRegister(loginForm, registerForm);
    });
    document.getElementById('show-login').addEventListener('click', () => {
      showLogin(loginForm, registerForm);
    });

    if (typeof window.supabaseClient === 'undefined') {
      unavailable.classList.add('is-visible');
      setFormDisabled(loginForm, true);
      setFormDisabled(registerForm, true);
      return;
    }

    // Already signed in — nothing to do here, send them home.
    window.supabaseClient.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        window.location.href = 'index.html';
      }
    });

    loginForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      setStatus(loginStatus, '', null);

      const email = document.getElementById('login-email').value.trim();
      const password = document.getElementById('login-password').value;

      setFormDisabled(loginForm, true);
      const { error } = await window.supabaseClient.auth.signInWithPassword({ email, password });
      setFormDisabled(loginForm, false);

      if (error) {
        const message = /invalid login credentials/i.test(error.message)
          ? 'Λάθος email ή κωδικός.'
          : error.message;
        setStatus(loginStatus, message, 'error');
        return;
      }

      window.location.href = 'index.html';
    });

    registerForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      setStatus(registerStatus, '', null);

      const displayName = document.getElementById('register-name').value.trim();
      const email = document.getElementById('register-email').value.trim();
      const password = document.getElementById('register-password').value;

      if (password.length < 6) {
        setStatus(registerStatus, 'Ο κωδικός πρέπει να έχει τουλάχιστον 6 χαρακτήρες.', 'error');
        return;
      }

      setFormDisabled(registerForm, true);
      const { data, error } = await window.supabaseClient.auth.signUp({
        email,
        password,
        options: { data: { full_name: displayName } },
      });
      setFormDisabled(registerForm, false);

      if (error) {
        const message = /already registered/i.test(error.message)
          ? 'Υπάρχει ήδη λογαριασμός με αυτό το email. Δοκίμασε να συνδεθείς.'
          : error.message;
        setStatus(registerStatus, message, 'error');
        return;
      }

      if (data.session) {
        // Email confirmation not required on this project — the user is
        // already signed in.
        window.location.href = 'index.html';
        return;
      }

      // Email confirmation required: no session yet, so send them to the
      // login form with instructions to confirm first. The success message
      // is shown on the login form's status line since the register form
      // (and its own status line) is about to be hidden.
      registerForm.reset();
      setStatus(registerStatus, '', null);
      showLogin(loginForm, registerForm);
      setStatus(loginStatus, 'Ο λογαριασμός δημιουργήθηκε! Έλεγξε τα εισερχόμενά σου και επιβεβαίωσε το email σου πριν συνδεθείς.', 'success');
    });
  });
})();
