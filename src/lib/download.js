// Κατέβασμα αρχείων που παράγονται στον browser.
//
// Ο Chromium αγνοεί το `download` attribute όταν το όνομα έχει ελληνικούς
// χαρακτήρες και σώζει το αρχείο ως «download» — γι' αυτό μεταγράφουμε σε
// greeklish πριν το δώσουμε.

const GREEK_MAP = {
  α: 'a',
  β: 'v',
  γ: 'g',
  δ: 'd',
  ε: 'e',
  ζ: 'z',
  η: 'i',
  θ: 'th',
  ι: 'i',
  κ: 'k',
  λ: 'l',
  μ: 'm',
  ν: 'n',
  ξ: 'x',
  ο: 'o',
  π: 'p',
  ρ: 'r',
  σ: 's',
  ς: 's',
  τ: 't',
  υ: 'y',
  φ: 'f',
  χ: 'ch',
  ψ: 'ps',
  ω: 'o',
}

/** «Το πρωτάθλημά μου» → «To-protathlima-mou». */
export function safeFileName(name, fallback = 'export') {
  const stripped = String(name || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // τόνοι και διαλυτικά

  let out = ''
  for (const ch of stripped) {
    const lower = ch.toLowerCase()
    const latin = GREEK_MAP[lower]
    if (latin) {
      out += ch === lower ? latin : latin.charAt(0).toUpperCase() + latin.slice(1)
    } else if (/[a-zA-Z0-9._-]/.test(ch)) {
      out += ch
    } else {
      out += '-'
    }
  }

  out = out.replace(/-+/g, '-').replace(/^-|-$/g, '')
  return out || fallback
}

/** Δημιουργεί και κατεβάζει ένα αρχείο κειμένου. */
export function downloadText(fileName, text, mime) {
  const url = URL.createObjectURL(new Blob([text], { type: mime }))
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  // Ο σύνδεσμος πρέπει να μπει στο DOM για να δουλέψει σε όλους τους browsers.
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
