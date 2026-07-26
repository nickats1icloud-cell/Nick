// Εγγραφή του service worker + διακριτική πρόταση εγκατάστασης.
//
// Ο service worker εγγράφεται μόνο σε https (ή localhost) — αλλού ο browser
// τον απορρίπτει έτσι κι αλλιώς. Αν η εγγραφή αποτύχει, η σελίδα δουλεύει
// ακριβώς όπως πριν· τίποτα δεν εξαρτάται από αυτόν.
(function () {
  const secure = window.location.protocol === "https:" || window.location.hostname === "localhost";
  if (!("serviceWorker" in navigator) || !secure) return;

  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch(() => {
      /* π.χ. απενεργοποιημένο από τον χρήστη — δεν είναι σφάλμα */
    });
  });

  // Το κουμπί εγκατάστασης εμφανίζεται μόνο αν ο browser το προσφέρει
  // πραγματικά, και μόνο εκεί όπου η σελίδα έχει θέση γι' αυτό.
  let deferred = null;

  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferred = event;
    document.querySelectorAll("[data-pwa-install]").forEach((btn) => {
      btn.hidden = false;
      btn.addEventListener(
        "click",
        async () => {
          if (!deferred) return;
          deferred.prompt();
          await deferred.userChoice;
          deferred = null;
          btn.hidden = true;
        },
        { once: true }
      );
    });
  });

  window.addEventListener("appinstalled", () => {
    deferred = null;
    document.querySelectorAll("[data-pwa-install]").forEach((btn) => {
      btn.hidden = true;
    });
  });
})();
