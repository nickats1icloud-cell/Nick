// Πραγματική σύνδεση μέσω Supabase Auth (email + κωδικός).
//
// Η ταυτότητα δεν είναι πια επιλογή από dropdown: ο χρήστης συνδέεται, και η
// βάση αποφασίζει τι μπορεί να δει και να αλλάξει. Η αντιστοίχιση λογαριασμού →
// οδηγού γίνεται με το email (ο αρχηγός γράφει το email στο roster, και στο
// signup δένονται αυτόματα — δες lmu_link_driver_on_signup στο migration).

import { getClient } from './supabase.js'

function friendly(error) {
  const message = String(error?.message || '')
  if (/Invalid login credentials/i.test(message)) return 'Λάθος email ή κωδικός.'
  if (/Email not confirmed/i.test(message)) {
    return 'Το email δεν έχει επιβεβαιωθεί — δες το inbox σου.'
  }
  if (/User already registered/i.test(message)) {
    return 'Υπάρχει ήδη λογαριασμός με αυτό το email. Κάνε σύνδεση.'
  }
  if (/Password should be at least/i.test(message)) {
    return 'Ο κωδικός είναι πολύ κοντός (τουλάχιστον 6 χαρακτήρες).'
  }
  if (/rate limit|too many/i.test(message)) return 'Πολλές προσπάθειες — δοκίμασε σε λίγο.'
  return message || 'Κάτι πήγε λάθος.'
}

export async function getSession() {
  const supabase = await getClient()
  if (!supabase) return null
  const { data } = await supabase.auth.getSession()
  return data?.session || null
}

/** Καλεί το callback σε κάθε αλλαγή σύνδεσης. Επιστρέφει συνάρτηση καθαρισμού. */
export async function onAuthChange(callback) {
  const supabase = await getClient()
  if (!supabase) return () => {}
  const { data } = supabase.auth.onAuthStateChange((_event, session) => callback(session))
  return () => data?.subscription?.unsubscribe()
}

export async function signIn(email, password) {
  const supabase = await getClient()
  if (!supabase) throw new Error('Δεν υπάρχει ρυθμισμένο backend.')
  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.trim(),
    password,
  })
  if (error) throw new Error(friendly(error))
  // Μήπως ο αρχηγός πρόσθεσε το email μας στο roster μετά το signup;
  await supabase.rpc('lmu_claim_driver')
  return data.session
}

export async function signUp(email, password, displayName = '') {
  const supabase = await getClient()
  if (!supabase) throw new Error('Δεν υπάρχει ρυθμισμένο backend.')
  const { data, error } = await supabase.auth.signUp({
    email: email.trim(),
    password,
    options: { data: { display_name: displayName } },
  })
  if (error) throw new Error(friendly(error))
  if (data.session) await supabase.rpc('lmu_claim_driver')
  return {
    session: data.session,
    // Αν το project απαιτεί επιβεβαίωση email, δεν έρχεται session αμέσως.
    needsConfirmation: !data.session,
  }
}

export async function signOut() {
  const supabase = await getClient()
  if (!supabase) return
  await supabase.auth.signOut()
}

export async function requestPasswordReset(email) {
  const supabase = await getClient()
  if (!supabase) throw new Error('Δεν υπάρχει ρυθμισμένο backend.')
  const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
    redirectTo: `${window.location.origin}${import.meta.env.BASE_URL}championship`,
  })
  if (error) throw new Error(friendly(error))
}

/** «Είμαι εγώ αυτός ο οδηγός» — δένει roster εγγραφή με ίδιο email. */
export async function claimDriver() {
  const supabase = await getClient()
  if (!supabase) return 0
  const { data, error } = await supabase.rpc('lmu_claim_driver')
  if (error) throw new Error(friendly(error))
  return data || 0
}
