/**
 * Στατικά δεδομένα του GSR Team Manager: ελαστικά, αναβαθμίσεις, δεξαμενή
 * οδηγών, αντίπαλες ομάδες, καλεντάρι και βαθμολογία.
 *
 * Ό,τι είναι "ρύθμιση παιχνιδιού" ζει εδώ, ώστε το balance να αλλάζει χωρίς
 * να πειραχτεί η λογική (model.js) ή η προσομοίωση (race.js).
 */

/** Ελαστικά: grip vs φθορά. Τα μαλακά είναι γρήγορα αλλά τελειώνουν. */
export const TYRES = [
  { id: "soft", name: "Μαλακά", short: "S", grip: 1.05, wear: 1.75, color: "#e0483d" },
  { id: "medium", name: "Μεσαία", short: "M", grip: 1.0, wear: 1.0, color: "#e8c33d" },
  { id: "hard", name: "Σκληρά", short: "H", grip: 0.955, wear: 0.6, color: "#dde3ea" },
];

export function tyreById(id) {
  return TYRES.find((t) => t.id === id) || TYRES[1];
}

/** Ρυθμός οδήγησης: ταχύτητα vs φθορά ελαστικών και κίνδυνος βλάβης. */
export const PACE_MODES = [
  { id: "push", name: "Επίθεση", pace: 1.035, wear: 1.55, risk: 1.8, fuel: 1.18 },
  { id: "balanced", name: "Ισορροπία", pace: 1.0, wear: 1.0, risk: 1.0, fuel: 1.0 },
  { id: "save", name: "Διαχείριση", pace: 0.962, wear: 0.62, risk: 0.6, fuel: 0.84 },
];

export function paceModeById(id) {
  return PACE_MODES.find((m) => m.id === id) || PACE_MODES[1];
}

/**
 * Τομείς ανάπτυξης. Κάθε αγορά ανεβάζει το rating κατά `step` (με φθίνουσα
 * απόδοση όσο πλησιάζει το 100) και ακριβαίνει.
 */
export const UPGRADES = [
  {
    id: "aero",
    name: "Αεροδυναμική",
    emoji: "🌀",
    desc: "Περισσότερο grip στις στροφές — μεγαλύτερη ταχύτητα εκεί που κρίνεται ο γύρος.",
    baseCost: 180000,
  },
  {
    id: "engine",
    name: "Κινητήρας",
    emoji: "⚙️",
    desc: "Επιτάχυνση και τελική ταχύτητα στις ευθείες.",
    baseCost: 200000,
  },
  {
    id: "reliability",
    name: "Αξιοπιστία",
    emoji: "🔧",
    desc: "Λιγότερες μηχανικές βλάβες μέσα στον αγώνα.",
    baseCost: 140000,
  },
  {
    id: "pit",
    name: "Συνεργείο",
    emoji: "🛠️",
    desc: "Ταχύτερα pit stop — δευτερόλεπτα που γίνονται θέσεις.",
    baseCost: 110000,
  },
];

/** Κόστος της επόμενης αναβάθμισης για το τρέχον rating. */
export function upgradeCost(upgrade, rating) {
  // Όσο ψηλότερα είσαι, τόσο ακριβότερο το επόμενο σκαλί.
  return Math.round(upgrade.baseCost * (0.6 + (rating / 100) ** 2 * 2.4));
}

/** Πόσο ανεβαίνει το rating με μία αγορά (φθίνουσα απόδοση). */
export function upgradeGain(rating) {
  return Math.max(1.2, (100 - rating) * 0.16);
}

/** Ελληνικά ονόματα οδηγών για τη δεξαμενή μεταγραφών. */
const FIRST_NAMES = [
  "Νίκος", "Γιώργος", "Κώστας", "Δημήτρης", "Θανάσης", "Αντώνης", "Στέφανος",
  "Μιχάλης", "Βασίλης", "Αλέξης", "Πέτρος", "Χρήστος", "Ηλίας", "Μάριος",
  "Λευτέρης", "Σπύρος", "Άρης", "Φώτης", "Τάσος", "Παύλος", "Ελένη", "Μαρία",
  "Κατερίνα", "Δανάη", "Ιωάννα",
];

const LAST_NAMES = [
  "Παπαδόπουλος", "Βασιλείου", "Ιωάννου", "Αντωνίου", "Σταθόπουλος",
  "Καραγιάννης", "Μακρής", "Δημητρίου", "Οικονόμου", "Νικολάου", "Παππάς",
  "Αθανασίου", "Γεωργίου", "Σπανός", "Ραπτόπουλος", "Βλάχος", "Κουτσός",
  "Μανωλάς", "Ζαφειρίου", "Τσάκαλος", "Λαμπρόπουλος", "Στεργίου",
];

/** Θηλυκή κατάληξη επωνύμου όταν το όνομα είναι γυναικείο. */
const FEMALE_NAMES = new Set(["Ελένη", "Μαρία", "Κατερίνα", "Δανάη", "Ιωάννα"]);

/**
 * Θηλυκός τύπος επωνύμου. Τα -ου (Ιωάννου, Νικολάου) είναι ήδη γενική και
 * μένουν ως έχουν· στα -όπουλος ο τόνος μετακινείται (Παπαδόπουλος →
 * Παπαδοπούλου).
 */
function feminize(lastName) {
  if (lastName.endsWith("όπουλος")) return `${lastName.slice(0, -7)}οπούλου`;
  if (lastName.endsWith("ός")) return `${lastName.slice(0, -2)}ού`;
  if (lastName.endsWith("ος")) return `${lastName.slice(0, -2)}ου`;
  if (lastName.endsWith("ης") || lastName.endsWith("ής")) return lastName.slice(0, -1);
  if (lastName.endsWith("ας") || lastName.endsWith("άς")) return lastName.slice(0, -1);
  return lastName;
}

/** Ντετερμινιστική γεννήτρια (ίδιο seed = ίδια καριέρα, χρήσιμο και σε tests). */
export function makeRng(seed) {
  let s = seed >>> 0 || 1;
  return function rng() {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    s >>>= 0;
    return s / 4294967296;
  };
}

let driverSerial = 0;

/**
 * Φτιάχνει έναν οδηγό.
 * @param {number} skill 1-100 — καθαρή ταχύτητα
 */
export function makeDriver(rng, { skill, name } = {}) {
  const first = name?.first ?? FIRST_NAMES[Math.floor(rng() * FIRST_NAMES.length)];
  let last = name?.last ?? LAST_NAMES[Math.floor(rng() * LAST_NAMES.length)];
  if (FEMALE_NAMES.has(first)) last = feminize(last);

  const rating = Math.round(skill ?? 55 + rng() * 40);
  const age = 19 + Math.floor(rng() * 18);
  return {
    id: `d${++driverSerial}`,
    name: `${first} ${last}`,
    short: last.slice(0, 3).toUpperCase(),
    skill: rating,
    // Σταθερότητα: πόσο κοντά στο μέγιστό του οδηγεί κάθε γύρο.
    consistency: Math.round(45 + rng() * 50),
    age,
    // Νέοι οδηγοί βελτιώνονται, βετεράνοι όχι.
    potential: Math.min(99, rating + (age < 26 ? 6 + Math.floor(rng() * 12) : 2)),
    morale: 70,
    // Μισθός ανά αγώνα — ο κύριος περιορισμός στο grid σου.
    salary: Math.round((6000 + (rating - 50) ** 2 * 24) / 1000) * 1000,
  };
}

/** Δεξαμενή διαθέσιμων οδηγών στην αρχή της καριέρας. */
export function makeDriverPool(rng, count = 14) {
  const pool = [];
  for (let i = 0; i < count; i++) {
    // Λίγοι σταρ, πολλοί μεσαίοι — καμπύλη αντί για ομοιόμορφη τύχη.
    const roll = rng();
    const skill = roll > 0.88 ? 88 + rng() * 10 : roll > 0.55 ? 70 + rng() * 16 : 52 + rng() * 20;
    pool.push(makeDriver(rng, { skill }));
  }
  return pool.sort((a, b) => b.skill - a.skill);
}

/** Οι αντίπαλες ομάδες του πρωταθλήματος. */
export const RIVAL_TEAMS = [
  { id: "olympus", name: "Olympus Racing", color: "#d63b3b", strength: 84 },
  { id: "aegean", name: "Aegean Motorsport", color: "#2f9fd0", strength: 79 },
  { id: "spartan", name: "Spartan Speed", color: "#c8a032", strength: 74 },
  { id: "delphi", name: "Delphi Dynamics", color: "#7d5fd0", strength: 70 },
  { id: "ionian", name: "Ionian Racing", color: "#43a86b", strength: 65 },
];

/**
 * Καλεντάρι σεζόν. Τα `laps` είναι ρυθμισμένα ώστε ο αγώνας να κρατά περίπου
 * 4-5 λεπτά σε κανονική ταχύτητα — αρκετά για μία στάση στα pit.
 */
export const CALENDAR = [
  { round: 1, trackId: "acropolis", name: "Grand Prix Ακρόπολης", laps: 8, prize: 1 },
  { round: 2, trackId: "thessaloniki", name: "Θεσσαλονίκη Street Race", laps: 5, prize: 1 },
  { round: 3, trackId: "olympia", name: "Ολυμπία 500", laps: 4, prize: 1.1 },
  { round: 4, trackId: "thessaloniki", name: "Νυχτερινός Θεσσαλονίκης", laps: 6, prize: 1.1 },
  { round: 5, trackId: "acropolis", name: "Attica Sprint", laps: 9, prize: 1.15 },
  { round: 6, trackId: "olympia", name: "Φινάλε Ολυμπίας", laps: 5, prize: 1.4 },
];

/** Βαθμοί ανά θέση (όπως στα περισσότερα πρωταθλήματα). */
export const POINTS = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1];

export function pointsFor(position) {
  return POINTS[position - 1] ?? 0;
}

/** Έπαθλο ανά θέση, πολλαπλασιασμένο με τον συντελεστή του αγώνα. */
const PRIZE = [420000, 320000, 260000, 210000, 175000, 145000, 120000, 100000, 85000, 70000];

export function prizeFor(position, multiplier = 1) {
  return Math.round((PRIZE[position - 1] ?? 55000) * multiplier);
}

/** Δυσκολίες: πόσο ξεκινάς πίσω από τους αντιπάλους. */
export const DIFFICULTIES = [
  { id: "rookie", name: "Rookie", budget: 4200000, carBonus: 8, rivalPace: 0.97 },
  { id: "pro", name: "Pro", budget: 3000000, carBonus: 0, rivalPace: 0.99 },
  { id: "legend", name: "Legend", budget: 2200000, carBonus: -6, rivalPace: 1.005 },
];

export function difficultyById(id) {
  return DIFFICULTIES.find((d) => d.id === id) || DIFFICULTIES[1];
}

/** Χρήματα σε αναγνώσιμη μορφή (1.250.000 € → «1,25 εκ. €»). */
export function money(value) {
  const v = Math.round(value);
  if (Math.abs(v) >= 1000000) return `${(v / 1000000).toFixed(2).replace(".", ",")} εκ. €`;
  if (Math.abs(v) >= 1000) return `${Math.round(v / 1000)}K €`;
  return `${v} €`;
}

/** Χρόνος γύρου/διαφορά σε μορφή Μ:ΔΔ.χχχ. */
export function formatTime(ms) {
  if (ms == null || !Number.isFinite(ms)) return "--:--.---";
  const total = Math.max(0, Math.round(ms));
  const m = Math.floor(total / 60000);
  const s = Math.floor((total % 60000) / 1000);
  return `${m}:${String(s).padStart(2, "0")}.${String(total % 1000).padStart(3, "0")}`;
}

/** Διαφορά σε δευτερόλεπτα (+1.284). */
export function formatGap(ms) {
  if (ms == null || !Number.isFinite(ms)) return "—";
  return `+${(ms / 1000).toFixed(3)}`;
}
