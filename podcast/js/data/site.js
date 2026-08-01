/*
 * Κεντρικές ρυθμίσεις του site — άλλαξε ΜΟΝΟ εδώ links, στοιχεία επικοινωνίας
 * και ονόματα. Δεν χρειάζεται build step: είναι απλό ES module.
 */

export const SITE = {
  name: "Greek SimRacers Podcast",
  tagline: "Το ελληνικό podcast του sim racing",
  description:
    "Κάθε εβδομάδα συζητάμε iRacing, ACC, rFactor 2 και Le Mans Virtual, " +
    "κάνουμε setup talk, φέρνουμε καλεσμένους από την ελληνική σκηνή και " +
    "λέμε τα νέα των πρωταθλημάτων.",
  email: "podcast@greeksimracers.gr",
  communityUrl: "../greek-simracers/home.html",
  startedYear: 2023,
  // Σε ποια πλατφόρμα ακούγεται. Βάλε τα πραγματικά links όταν είναι έτοιμα.
  platforms: [
    { id: "spotify", name: "Spotify", note: "Full κατάλογος", url: "#", color: "141 73% 42%" },
    { id: "apple", name: "Apple Podcasts", note: "Με chapters", url: "#", color: "280 68% 60%" },
    { id: "youtube", name: "YouTube", note: "Video εκδοχή", url: "#", color: "0 78% 55%" },
    { id: "rss", name: "RSS Feed", note: "Για κάθε app", url: "#", color: "28 90% 55%" },
  ],
  socials: [
    { id: "instagram", name: "Instagram", url: "#" },
    { id: "youtube", name: "YouTube", url: "#" },
    { id: "discord", name: "Discord", url: "#" },
    { id: "x", name: "X", url: "#" },
  ],
  stats: [
    { value: 148000, suffix: "+", label: "Συνολικές ακροάσεις" },
    { value: 62, suffix: "", label: "Επεισόδια" },
    { value: 41, suffix: "", label: "Καλεσμένοι" },
  ],
  hosts: [
    {
      initials: "ΝΚ",
      name: "Νίκος Καραμήτσος",
      role: "Host / Παραγωγός",
      bio: "Οδηγεί iRacing από το 2016, GT3 ψυχή. Στήνει τα επεισόδια και κάνει τις ερωτήσεις που όλοι θέλουν να ρωτήσουν.",
    },
    {
      initials: "ΕΔ",
      name: "Ελένη Δρακοπούλου",
      role: "Co-host / Endurance",
      bio: "Ειδική στα endurance, με stints 4 ωρών στο ACC. Φέρνει τη στρατηγική και τα δεδομένα στο τραπέζι.",
    },
    {
      initials: "ΤΜ",
      name: "Τάσος Μανιάτης",
      role: "Tech & Setups",
      bio: "Direct drive, pedals, LFE, triples. Ό,τι έχει καλώδιο και ροπή περνάει πρώτα από τα χέρια του.",
    },
  ],
  quotes: [
    {
      initials: "ΓΠ",
      name: "Γιώργος Π.",
      role: "Ακροατής από τη Θεσσαλονίκη",
      text: "Το μόνο ελληνικό podcast που μιλάει σοβαρά για setups χωρίς να γίνεται βαρετό. Το ακούω πάντα στη διαδρομή για τη δουλειά.",
    },
    {
      initials: "ΜΚ",
      name: "Μαρία Κ.",
      role: "iRacing rookie",
      text: "Ξεκίνησα sim racing πριν 6 μήνες. Το επεισόδιο για τα rookie λάθη μου γλίτωσε μήνες απογοήτευσης.",
    },
    {
      initials: "ΔΑ",
      name: "Δημήτρης Α.",
      role: "Team manager",
      text: "Οι συνεντεύξεις με τους Έλληνες οδηγούς είναι χρυσάφι. Έχω βρει δύο οδηγούς για την ομάδα μου μέσα από εδώ.",
    },
  ],
  faq: [
    {
      q: "Πόσο συχνά βγαίνει νέο επεισόδιο;",
      a: "Κάθε Πέμπτη στις 20:00. Στις περιόδους των μεγάλων endurance αγώνων βγάζουμε και έκτακτα επεισόδια-αναλύσεις.",
    },
    {
      q: "Πού μπορώ να το ακούσω;",
      a: "Σε Spotify, Apple Podcasts, YouTube και σε όποια εφαρμογή υποστηρίζει RSS. Όλα τα επεισόδια παίζουν και απευθείας εδώ στο site.",
    },
    {
      q: "Μπορώ να έρθω καλεσμένος;",
      a: "Ναι. Στείλε μας μήνυμα από τη σελίδα επικοινωνίας επιλέγοντας «Θέλω να έρθω καλεσμένος» και πες μας δυο λόγια για εσένα και το θέμα.",
    },
    {
      q: "Χρειάζομαι ακριβό εξοπλισμό για να ξεκινήσω;",
      a: "Όχι. Στο επεισόδιο 7 αναλύουμε πλήρη setups από 150€ μέχρι 4.000€ — η διαφορά στα lap times είναι πολύ μικρότερη απ' ό,τι νομίζεις.",
    },
    {
      q: "Υπάρχουν απομαγνητοφωνήσεις (transcripts);",
      a: "Στα πιο πρόσφατα επεισόδια ναι — θα τα βρεις στην καρτέλα «Απομαγνητοφώνηση» μέσα στη σελίδα του επεισοδίου, με κλικ σε κάθε γραμμή για να πας στο σημείο.",
    },
    {
      q: "Δέχεστε χορηγίες;",
      a: "Δεχόμαστε συνεργασίες που έχουν νόημα για την κοινότητα (sim gear, πρωταθλήματα, events). Γράψε μας στο podcast@greeksimracers.gr.",
    },
  ],
};

export const NAV = [
  { href: "index.html", label: "Αρχική" },
  { href: "episodes.html", label: "Επεισόδια" },
  { href: "about.html", label: "Η εκπομπή" },
  { href: "subscribe.html", label: "Ακρόαση" },
  { href: "contact.html", label: "Επικοινωνία" },
];
