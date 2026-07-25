// Contact form: honeypot spam check, minimal validation, Supabase insert.
document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("contact-form");
  if (!form) return;

  const statusEl = form.querySelector(".form-status");
  const submitBtn = form.querySelector('button[type="submit"]');

  const setStatus = (message, state) => {
    statusEl.textContent = message;
    if (state) {
      statusEl.setAttribute("data-state", state);
    } else {
      statusEl.removeAttribute("data-state");
    }
  };

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const honeypot = form.elements.website.value.trim();
    if (honeypot) {
      // Silently drop the submission — a bot filled the hidden field.
      return;
    }

    const name = form.elements.name.value.trim();
    const email = form.elements.email.value.trim();
    const subject = form.elements.subject.value.trim();
    const message = form.elements.message.value.trim();

    if (!name || !email || !message) {
      setStatus("Συμπλήρωσε όνομα, email και μήνυμα.", "error");
      return;
    }

    if (!email.includes("@")) {
      setStatus("Δώσε ένα έγκυρο email.", "error");
      return;
    }

    submitBtn.disabled = true;
    setStatus("Αποστολή...", null);

    const { error } = await supabaseClient.from("contact_messages").insert({
      name,
      email,
      subject: subject || null,
      message,
    });

    submitBtn.disabled = false;

    if (error) {
      setStatus("Κάτι πήγε στραβά. Δοκίμασε ξανά σε λίγο.", "error");
      return;
    }

    setStatus("Το μήνυμά σου στάλθηκε! Θα σου απαντήσουμε σύντομα.", "success");
    form.reset();
  });
});
