// Σταθερές του συστήματος διαχείρισης πρωταθλήματος για το Le Mans Ultimate.
//
// ΠΡΟΣΟΧΗ: τα τεχνικά νούμερα (μήκη πιστών, χρόνοι γύρου αναφοράς, ρεζερβουάρ,
// κατανάλωση, διάρκεια ελαστικών) είναι *κατά προσέγγιση*. Είναι αρκετά καλά
// για να βγει ένα ρεαλιστικό πλάνο stint και να προγραμματιστεί ένας αγώνας
// αντοχής, δεν είναι δεδομένα setup. Κάθε ομάδα μπορεί να τα αλλάξει από τον
// planner (τα per-event στοιχεία του αυτοκινήτου υπερισχύουν πάντα).

/** Κατηγορίες (classes) του WEC όπως υπάρχουν στο LMU. */
export const CLASSES = [
  { id: 'HYPERCAR', label: 'Hypercar', short: 'HY', color: '#ff4d4d' },
  { id: 'LMP2', label: 'LMP2', short: 'P2', color: '#3fa9ff' },
  { id: 'LMGT3', label: 'LMGT3', short: 'GT3', color: '#4ddc7a' },
  { id: 'GTE', label: 'GTE / LMGTE Am', short: 'GTE', color: '#ffb648' },
]

export const CLASS_IDS = CLASSES.map((c) => c.id)

export function classInfo(id) {
  return CLASSES.find((c) => c.id === id) || CLASSES[0]
}

/** Αυτοκίνητα ανά κατηγορία (περιεχόμενο Le Mans Ultimate). */
export const CARS_BY_CLASS = {
  HYPERCAR: [
    'Toyota GR010 Hybrid',
    'Ferrari 499P',
    'Porsche 963',
    'Cadillac V-Series.R',
    'Peugeot 9X8',
    'BMW M Hybrid V8',
    'Alpine A424',
    'Glickenhaus 007 LMH',
    'Isotta Fraschini Tipo6-C',
  ],
  LMP2: ['Oreca 07 Gibson'],
  LMGT3: [
    'Ferrari 296 GT3',
    'Porsche 911 GT3 R (992)',
    'Corvette Z06 GT3.R',
    'McLaren 720S GT3 Evo',
    'Aston Martin Vantage AMR LMGT3',
    'Lamborghini Huracán GT3 Evo2',
    'BMW M4 GT3',
    'Lexus RC F GT3',
    'Ford Mustang GT3',
  ],
  GTE: [
    'Ferrari 488 GTE Evo',
    'Porsche 911 RSR-19',
    'Chevrolet Corvette C8.R',
    'Aston Martin Vantage AMR GTE',
  ],
}

/**
 * Πίστες του LMU. `refLap` = χρόνος γύρου αναφοράς σε δευτερόλεπτα ανά
 * κατηγορία (μέσος ρυθμός αγώνα, όχι qualifying), `pitLossSec` = χαμένος
 * χρόνος από τη διαδρομή του pit lane χωρίς τη στάση.
 */
export const TRACKS = [
  {
    id: 'lemans',
    name: 'Circuit de la Sarthe (Le Mans)',
    country: 'Γαλλία',
    lengthKm: 13.626,
    pitLossSec: 52,
    refLap: { HYPERCAR: 206, LMP2: 216, LMGT3: 232, GTE: 228 },
  },
  {
    id: 'sebring',
    name: 'Sebring International Raceway',
    country: 'ΗΠΑ',
    lengthKm: 6.019,
    pitLossSec: 38,
    refLap: { HYPERCAR: 106, LMP2: 110, LMGT3: 120, GTE: 118 },
  },
  {
    id: 'portimao',
    name: 'Autódromo Internacional do Algarve',
    country: 'Πορτογαλία',
    lengthKm: 4.653,
    pitLossSec: 33,
    refLap: { HYPERCAR: 88, LMP2: 92, LMGT3: 101, GTE: 100 },
  },
  {
    id: 'spa',
    name: 'Circuit de Spa-Francorchamps',
    country: 'Βέλγιο',
    lengthKm: 7.004,
    pitLossSec: 36,
    refLap: { HYPERCAR: 120, LMP2: 124, LMGT3: 136, GTE: 134 },
  },
  {
    id: 'monza',
    name: 'Autodromo Nazionale Monza',
    country: 'Ιταλία',
    lengthKm: 5.793,
    pitLossSec: 30,
    refLap: { HYPERCAR: 93, LMP2: 96, LMGT3: 107, GTE: 105 },
  },
  {
    id: 'fuji',
    name: 'Fuji Speedway',
    country: 'Ιαπωνία',
    lengthKm: 4.563,
    pitLossSec: 32,
    refLap: { HYPERCAR: 89, LMP2: 93, LMGT3: 103, GTE: 101 },
  },
  {
    id: 'bahrain',
    name: 'Bahrain International Circuit',
    country: 'Μπαχρέιν',
    lengthKm: 5.412,
    pitLossSec: 34,
    refLap: { HYPERCAR: 107, LMP2: 111, LMGT3: 121, GTE: 119 },
  },
  {
    id: 'imola',
    name: 'Autodromo Enzo e Dino Ferrari (Imola)',
    country: 'Ιταλία',
    lengthKm: 4.909,
    pitLossSec: 31,
    refLap: { HYPERCAR: 91, LMP2: 95, LMGT3: 105, GTE: 103 },
  },
  {
    id: 'interlagos',
    name: 'Autódromo José Carlos Pace (Interlagos)',
    country: 'Βραζιλία',
    lengthKm: 4.309,
    pitLossSec: 29,
    refLap: { HYPERCAR: 84, LMP2: 88, LMGT3: 97, GTE: 95 },
  },
  {
    id: 'cota',
    name: 'Circuit of the Americas',
    country: 'ΗΠΑ',
    lengthKm: 5.513,
    pitLossSec: 35,
    refLap: { HYPERCAR: 107, LMP2: 111, LMGT3: 122, GTE: 120 },
  },
  {
    id: 'lusail',
    name: 'Lusail International Circuit',
    country: 'Κατάρ',
    lengthKm: 5.419,
    pitLossSec: 33,
    refLap: { HYPERCAR: 99, LMP2: 103, LMGT3: 113, GTE: 111 },
  },
]

export function trackInfo(id) {
  return TRACKS.find((t) => t.id === id) || null
}

/**
 * Προεπιλογές αυτοκινήτου ανά κατηγορία. Η κατανάλωση δίνεται ανά χιλιόμετρο
 * ώστε να βγαίνει λογικό νούμερο σε κάθε πίστα (Le Mans vs Interlagos).
 *
 * Το `tyreLifeKm` είναι επίτηδες λίγο πάνω από δύο γεμίσματα ρεζερβουάρ σε κάθε
 * κατηγορία: στην αντοχή το διπλό stint στα ελαστικά είναι ο κανόνας, όχι η
 * εξαίρεση, και ο αυτόματος planner πρέπει να το βγάζει μόνος του.
 */
export const CLASS_DEFAULTS = {
  HYPERCAR: { tankL: 68, fuelPerKm: 0.36, tyreLifeKm: 380 },
  LMP2: { tankL: 75, fuelPerKm: 0.47, tyreLifeKm: 350 },
  LMGT3: { tankL: 110, fuelPerKm: 0.66, tyreLifeKm: 350 },
  GTE: { tankL: 97, fuelPerKm: 0.6, tyreLifeKm: 320 },
}

/** Κατηγοριοποίηση οδηγών (FIA-style), για τους κανόνες χρόνου οδήγησης. */
export const DRIVER_CATEGORIES = [
  { id: 'PLATINUM', label: 'Platinum', short: 'PLA' },
  { id: 'GOLD', label: 'Gold', short: 'GLD' },
  { id: 'SILVER', label: 'Silver', short: 'SIL' },
  { id: 'BRONZE', label: 'Bronze', short: 'BRZ' },
]

/** Οι «ερασιτεχνικές» κατηγορίες που μετράνε στον κανόνα ελάχιστου χρόνου Am. */
export const AM_CATEGORIES = ['SILVER', 'BRONZE']

export function categoryInfo(id) {
  return DRIVER_CATEGORIES.find((c) => c.id === id) || DRIVER_CATEGORIES[2]
}

/** Ρόλοι χρηστών. */
export const ROLES = {
  ADMIN: { id: 'ADMIN', label: 'Διοργανωτής' },
  PRINCIPAL: { id: 'PRINCIPAL', label: 'Αρχηγός ομάδας' },
  DRIVER: { id: 'DRIVER', label: 'Οδηγός' },
}

export const ROLE_IDS = Object.keys(ROLES)

/** Διαθεσιμότητα οδηγού για ένα event. */
export const AVAILABILITY = {
  YES: { id: 'YES', label: 'Διαθέσιμος', short: 'ΝΑΙ', tone: 'ok' },
  MAYBE: { id: 'MAYBE', label: 'Πιθανόν', short: 'ΙΣΩΣ', tone: 'warn' },
  NO: { id: 'NO', label: 'Μη διαθέσιμος', short: 'ΟΧΙ', tone: 'bad' },
  UNKNOWN: { id: 'UNKNOWN', label: 'Δεν απάντησε', short: '—', tone: 'muted' },
}

/** Κατάσταση πλάνου stint. */
export const PLAN_STATUS = {
  DRAFT: { id: 'DRAFT', label: 'Πρόχειρο', tone: 'muted' },
  SUBMITTED: { id: 'SUBMITTED', label: 'Υποβλήθηκε', tone: 'warn' },
  APPROVED: { id: 'APPROVED', label: 'Εγκρίθηκε', tone: 'ok' },
  CHANGES: { id: 'CHANGES', label: 'Θέλει αλλαγές', tone: 'bad' },
}

/** Κατάσταση συμμετοχής στο αποτέλεσμα. */
export const RESULT_STATUS = {
  FINISHED: { id: 'FINISHED', label: 'Τερμάτισε' },
  DNF: { id: 'DNF', label: 'DNF (εγκατέλειψε)' },
  DSQ: { id: 'DSQ', label: 'DSQ (ακυρώθηκε)' },
  DNS: { id: 'DNS', label: 'DNS (δεν εκκίνησε)' },
}

/** Είδη ελαστικών ανά stint. */
export const TYRE_ACTIONS = {
  NEW: { id: 'NEW', label: 'Καινούριο σετ' },
  KEEP: { id: 'KEEP', label: 'Κρατάει τα ίδια' },
  USED: { id: 'USED', label: 'Μεταχειρισμένο σετ' },
}

export const COMPOUNDS = [
  { id: 'SOFT', label: 'Soft' },
  { id: 'MEDIUM', label: 'Medium' },
  { id: 'HARD', label: 'Hard' },
  { id: 'WET', label: 'Wet' },
]

/** Έτοιμα συστήματα βαθμολογίας. */
export const POINTS_PRESETS = {
  WEC: {
    label: 'WEC (25-18-15-12-10-8-6-4-2-1)',
    table: [25, 18, 15, 12, 10, 8, 6, 4, 2, 1],
  },
  ELMS: {
    label: 'ELMS (25-18-15-12-10-8-6-4-2-1, χωρίς pole)',
    table: [25, 18, 15, 12, 10, 8, 6, 4, 2, 1],
  },
  SPRINT: { label: 'Sprint (10-8-6-5-4-3-2-1)', table: [10, 8, 6, 5, 4, 3, 2, 1] },
  F1: {
    label: 'F1 style (25-18-15-12-10-8-6-4-2-1)',
    table: [25, 18, 15, 12, 10, 8, 6, 4, 2, 1],
  },
}

/** Προεπιλεγμένοι κανόνες αγωνιστικού χρόνου — «FIA-like», αλλά ρυθμιζόμενοι. */
export const DEFAULT_RULES = {
  maxStintMinutes: 80, // μέγιστη συνεχόμενη οδήγηση χωρίς αλλαγή οδηγού
  minRestMinutes: 45, // ελάχιστη ξεκούραση μεταξύ δύο stint του ίδιου οδηγού
  maxDriveShare: 0.65, // μέγιστο ποσοστό της διάρκειας αγώνα ανά οδηγό
  minDriveMinutes: 45, // ελάχιστος χρόνος οδήγησης για κάθε δηλωμένο οδηγό
  minAmDriveMinutes: 0, // ελάχιστος χρόνος για Silver/Bronze (0 = ανενεργό)
  minDriversPerCar: 2,
  maxDriversPerCar: 4,
  tyreSetsPerEvent: 8,
  driverChangeSec: 35, // στάση με αλλαγή οδηγού (πάνω από το pit loss)
  tyreChangeSec: 25, // επιπλέον χρόνος για αλλαγή ελαστικών
  refuelRateLps: 2.6, // λίτρα ανά δευτερόλεπτο στο ρεφιουλάρισμα
  planLockHoursBefore: 12, // πόσες ώρες πριν τον αγώνα κλειδώνει το πλάνο
}

export const DEFAULT_SCORING = {
  preset: 'WEC',
  table: POINTS_PRESETS.WEC.table,
  polePoint: 1,
  fastestLapPoint: 1,
  finishRequiredLapsShare: 0.7, // % των γύρων του νικητή για να πάρεις βαθμούς
  dropRounds: 0, // πόσα χειρότερα αποτελέσματα αφαιρούνται
  doublePointsEvents: [], // ids αγώνων με διπλούς βαθμούς (π.χ. Le Mans)
}
