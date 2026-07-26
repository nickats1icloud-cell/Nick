// Logic for reset-password.html: handles both the "request a reset email"
// step and the "set a new password" step the emailed link lands back on.
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

  function showStep(steps, id) {
    Object.keys(steps).forEach((key) => {
      steps[key].classList.toggle('is-hidden', key !== id);
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    const steps = {
      request: document.getElementById('request-step'),
      requestSent: document.getElementById('request-sent-step'),
      update: document.getElementById('update-step'),
      updateDone: document.getElementById('update-done-step'),
    };

    const requestForm = document.getElementById('request-form');
    const requestStatus = document.getElementById('request-status');
    const updateForm = document.getElementById('update-form');
    const updateStatus = document.getElementById('update-status');
    const unavailable = document.getElementById('auth-unavailable');

    if (typeof window.supabaseClient === 'undefined') {
      unavailable.classList.add('is-visible');
      setFormDisabled(requestForm, true);
      setFormDisabled(updateForm, true);
      return;
    }

    // Supabase fires a PASSWORD_RECOVERY event once it has parsed the
    // recovery token from the URL fragment of the emailed link — that's
    // our signal to show the "set a new password" step instead of the
    // default "request a reset email" step.
    window.supabaseClient.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        showStep(steps, 'update');
      }
    });

    requestForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      const email = document.getElementById('request-email').value.trim();

      const redirectTo = window.location.origin
        + window.location.pathname.replace(/[^/]*$/, '')
        + 'reset-password.html';

      setFormDisabled(requestForm, true);
      try {
        await window.supabaseClient.auth.resetPasswordForEmail(email, { redirectTo });
      } catch (err) {
        // Fall through — we still show the same confirmation regardless of
        // outcome, so we never reveal whether an account exists.
      }
      setFormDisabled(requestForm, false);
      setStatus(requestStatus, '', null);
      showStep(steps, 'requestSent');
    });

    updateForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      setStatus(updateStatus, '', null);

      const password = document.getElementById('update-password').value;
      const confirm = document.getElementById('update-password-confirm').value;

      if (password.length < 6) {
        setStatus(updateStatus, 'Ο κωδικός πρέπει να έχει τουλάχιστον 6 χαρακτήρες.', 'error');
        return;
      }
      if (password !== confirm) {
        setStatus(updateStatus, 'Οι κωδικοί δεν ταιριάζουν.', 'error');
        return;
      }

      setFormDisabled(updateForm, true);
      const { error } = await window.supabaseClient.auth.updateUser({ password });
      setFormDisabled(updateForm, false);

      if (error) {
        setStatus(updateStatus, error.message, 'error');
        return;
      }

      showStep(steps, 'updateDone');
      setTimeout(() => {
        window.location.href = 'index.html';
      }, 2500);
    });
  });
})();
