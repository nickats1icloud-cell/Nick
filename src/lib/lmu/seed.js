// Δεδομένα επίδειξης: ένα ολόκληρο πρωτάθλημα αντοχής με 11 ομάδες σε 3
// κατηγορίες, 6 αγώνες (οι 3 έχουν γίνει), roster, διαθεσιμότητες και έτοιμα
// πλάνα stint για τον επόμενο αγώνα.
//
// Τα ids είναι σταθερά strings (όχι τυχαία) ώστε τα αποτελέσματα να μπορούν να
// αναφέρονται στις ομάδες μέσα στο ίδιο αρχείο.

import { createCarSetup, createPlan, createResult, createResultEntry, emptyState } from './model.js'
import { generateStints } from './stints.js'
import { DEFAULT_RULES, POINTS_PRESETS } from './constants.js'

const PACE_BY_CATEGORY = { PLATINUM: -0.7, GOLD: 0, SILVER: 1.1, BRONZE: 2.4 }

function driver(id, name, category, extra = {}) {
  return {
    id: `drv_${id}`,
    name,
    nickname: '',
    country: 'Ελλάδα',
    category,
    steamId: '',
    discord: '',
    role: 'DRIVER',
    teamId: null,
    paceDeltaSec: PACE_BY_CATEGORY[category] ?? 1,
    notes: '',
    ...extra,
  }
}

const TEAM_BLUEPRINTS = [
  {
    id: 'hellenic',
    name: 'Hellenic Endurance Team',
    shortName: 'HET',
    carClass: 'HYPERCAR',
    car: 'Toyota GR010 Hybrid',
    number: '7',
    color: '#e01e1e',
    drivers: [
      ['papadopoulos', 'Γιώργος Παπαδόπουλος', 'PLATINUM'],
      ['nikolaou', 'Δημήτρης Νικολάου', 'GOLD'],
      ['vasileiou', 'Ανδρέας Βασιλείου', 'GOLD'],
      ['mavridis', 'Στέφανος Μαυρίδης', 'SILVER'],
    ],
  },
  {
    id: 'aegean',
    name: 'Aegean Motorsport',
    shortName: 'AEG',
    carClass: 'HYPERCAR',
    car: 'Porsche 963',
    number: '12',
    color: '#00a3e0',
    drivers: [
      ['ioannidis', 'Κώστας Ιωαννίδης', 'PLATINUM'],
      ['stathakis', 'Μάριος Σταθάκης', 'GOLD'],
      ['roussos', 'Βαγγέλης Ρούσσος', 'SILVER'],
      ['lampropoulos', 'Νεκτάριος Λαμπρόπουλος', 'SILVER'],
    ],
  },
  {
    id: 'olympus',
    name: 'Olympus Racing',
    shortName: 'OLY',
    carClass: 'HYPERCAR',
    car: 'Ferrari 499P',
    number: '3',
    color: '#ffcc00',
    drivers: [
      ['karagiannis', 'Θανάσης Καραγιάννης', 'PLATINUM'],
      ['antoniou', 'Πέτρος Αντωνίου', 'GOLD'],
      ['dimitriou', 'Ηλίας Δημητρίου', 'SILVER'],
    ],
  },
  {
    id: 'thessaloniki',
    name: 'Thessaloniki Speed Works',
    shortName: 'TSW',
    carClass: 'LMP2',
    car: 'Oreca 07 Gibson',
    number: '22',
    color: '#3fa9ff',
    drivers: [
      ['chatzis', 'Λευτέρης Χατζής', 'GOLD'],
      ['samaras', 'Μιχάλης Σαμαράς', 'SILVER'],
      ['vlachakis', 'Χρήστος Βλαχάκης', 'SILVER'],
    ],
  },
  {
    id: 'attica',
    name: 'Attica Racing Club',
    shortName: 'ARC',
    carClass: 'LMP2',
    car: 'Oreca 07 Gibson',
    number: '28',
    color: '#7c5cff',
    drivers: [
      ['manolas', 'Σπύρος Μανωλάς', 'GOLD'],
      ['tsakos', 'Αλέξανδρος Τσάκος', 'SILVER'],
      ['georgiadis', 'Φώτης Γεωργιάδης', 'BRONZE'],
    ],
  },
  {
    id: 'ionian',
    name: 'Ionian Motorsport',
    shortName: 'ION',
    carClass: 'LMP2',
    car: 'Oreca 07 Gibson',
    number: '34',
    color: '#21c7a8',
    drivers: [
      ['zacharias', 'Παύλος Ζαχαρίας', 'GOLD'],
      ['kyriakidis', 'Νάσος Κυριακίδης', 'SILVER'],
      ['fragoulis', 'Τάκης Φραγκούλης', 'BRONZE'],
    ],
  },
  {
    id: 'spartan',
    name: 'Spartan Racing',
    shortName: 'SPR',
    carClass: 'LMP2',
    car: 'Oreca 07 Gibson',
    number: '41',
    color: '#ff7a18',
    drivers: [
      ['kosmas', 'Λεωνίδας Κοσμάς', 'PLATINUM'],
      ['papanikolaou', 'Ρήγας Παπανικολάου', 'SILVER'],
      ['alexiou', 'Θοδωρής Αλεξίου', 'SILVER'],
    ],
  },
  {
    id: 'crete',
    name: 'Crete GT Squad',
    shortName: 'CRE',
    carClass: 'LMGT3',
    car: 'Ferrari 296 GT3',
    number: '55',
    color: '#e83f6f',
    drivers: [
      ['koutsakis', 'Μανώλης Κουτσάκης', 'GOLD'],
      ['daskalakis', 'Γιάννης Δασκαλάκης', 'SILVER'],
      ['bitsakis', 'Νίκος Μπιτσάκης', 'BRONZE'],
    ],
  },
  {
    id: 'delphi',
    name: 'Delphi Racing',
    shortName: 'DLP',
    carClass: 'LMGT3',
    car: 'Porsche 911 GT3 R (992)',
    number: '77',
    color: '#b0b7c3',
    drivers: [
      ['leventis', 'Άρης Λεβέντης', 'GOLD'],
      ['papageorgiou', 'Σωτήρης Παπαγεωργίου', 'SILVER'],
      ['oikonomou', 'Βασίλης Οικονόμου', 'BRONZE'],
    ],
  },
  {
    id: 'meteora',
    name: 'Meteora Competition',
    shortName: 'MTC',
    carClass: 'LMGT3',
    car: 'BMW M4 GT3',
    number: '88',
    color: '#4ddc7a',
    drivers: [
      ['kalogirou', 'Θέμης Καλογήρου', 'SILVER'],
      ['rigas', 'Απόστολος Ρήγας', 'SILVER'],
      ['stefanidis', 'Γρηγόρης Στεφανίδης', 'BRONZE'],
    ],
  },
  {
    id: 'corinth',
    name: 'Corinth Motorsport',
    shortName: 'COR',
    carClass: 'LMGT3',
    car: 'Aston Martin Vantage AMR LMGT3',
    number: '95',
    color: '#1f6f4a',
    drivers: [
      ['melas', 'Χάρης Μελάς', 'GOLD'],
      ['verginis', 'Ιάσονας Βεργίνης', 'SILVER'],
      ['papastergiou', 'Δώρα Παπαστεργίου', 'SILVER'],
    ],
  },
]

const EVENT_BLUEPRINTS = [
  {
    id: 'r1',
    round: 1,
    name: '4 Ώρες Ίμολα',
    trackId: 'imola',
    dateISO: '2026-03-15T19:00',
    durationMinutes: 240,
    status: 'DONE',
  },
  {
    id: 'r2',
    round: 2,
    name: '6 Ώρες Spa-Francorchamps',
    trackId: 'spa',
    dateISO: '2026-04-19T18:00',
    durationMinutes: 360,
    status: 'DONE',
  },
  {
    id: 'r3',
    round: 3,
    name: '12 Ώρες Le Mans (μειωμένος)',
    trackId: 'lemans',
    dateISO: '2026-06-14T14:00',
    durationMinutes: 720,
    status: 'DONE',
    notes: 'Διπλοί βαθμοί. Υποχρεωτικά 4 οδηγοί ανά αυτοκίνητο.',
  },
  {
    id: 'r4',
    round: 4,
    name: '6 Ώρες Interlagos',
    trackId: 'interlagos',
    dateISO: '2026-09-13T18:00',
    durationMinutes: 360,
    status: 'UPCOMING',
  },
  {
    id: 'r5',
    round: 5,
    name: '6 Ώρες Fuji',
    trackId: 'fuji',
    dateISO: '2026-10-11T13:00',
    durationMinutes: 360,
    status: 'UPCOMING',
  },
  {
    id: 'r6',
    round: 6,
    name: '8 Ώρες Μπαχρέιν',
    trackId: 'bahrain',
    dateISO: '2026-11-08T16:00',
    durationMinutes: 480,
    status: 'UPCOMING',
  },
]

/** Σειρά τερματισμού ανά κατηγορία για τους αγώνες που έχουν γίνει. */
const RESULT_BLUEPRINTS = [
  {
    eventId: 'ev_r1',
    winnerLaps: { HYPERCAR: 152, LMP2: 149, LMGT3: 138 },
    order: {
      HYPERCAR: ['aegean', 'hellenic', 'olympus'],
      LMP2: ['thessaloniki', 'spartan', 'attica', 'ionian'],
      LMGT3: ['crete', 'delphi', 'corinth', 'meteora'],
    },
    dnf: ['olympus'],
    pole: 'aegean',
    fastestLap: { HYPERCAR: 'hellenic', LMP2: 'thessaloniki', LMGT3: 'crete' },
  },
  {
    eventId: 'ev_r2',
    winnerLaps: { HYPERCAR: 178, LMP2: 173, LMGT3: 160 },
    order: {
      HYPERCAR: ['hellenic', 'olympus', 'aegean'],
      LMP2: ['spartan', 'ionian', 'thessaloniki', 'attica'],
      LMGT3: ['delphi', 'crete', 'meteora', 'corinth'],
    },
    dnf: ['attica'],
    pole: 'hellenic',
    fastestLap: { HYPERCAR: 'hellenic', LMP2: 'spartan', LMGT3: 'meteora' },
  },
  {
    eventId: 'ev_r3',
    winnerLaps: { HYPERCAR: 208, LMP2: 202, LMGT3: 188 },
    order: {
      HYPERCAR: ['hellenic', 'aegean', 'olympus'],
      LMP2: ['thessaloniki', 'attica', 'spartan', 'ionian'],
      LMGT3: ['corinth', 'crete', 'delphi', 'meteora'],
    },
    dnf: ['ionian', 'meteora'],
    pole: 'aegean',
    fastestLap: { HYPERCAR: 'aegean', LMP2: 'attica', LMGT3: 'corinth' },
  },
]

/**
 * Ποιες ομάδες έχουν ήδη ετοιμάσει πλάνο για τον επόμενο αγώνα — μία σε κάθε
 * κατάσταση, ώστε να φαίνεται όλη η ροή έγκρισης. Το πλάνο της Hellenic είναι
 * επίτηδες «θέλει αλλαγές»: ο μόνος Silver της ομάδας δήλωσε ότι δεν είναι
 * διαθέσιμος, οπότε δεν βγαίνει ο ελάχιστος χρόνος Am του κανονισμού.
 */
const SEEDED_PLANS = [
  { teamId: 'team_thessaloniki', status: 'APPROVED' },
  { teamId: 'team_crete', status: 'SUBMITTED' },
  { teamId: 'team_hellenic', status: 'CHANGES' },
]

/** Διαθεσιμότητες που δεν είναι «ΝΑΙ», για να φαίνεται η λογική στο UI. */
const AVAILABILITY_EXCEPTIONS = {
  ev_r4: {
    drv_mavridis: 'NO',
    drv_lampropoulos: 'MAYBE',
    drv_georgiadis: 'MAYBE',
    drv_stefanidis: 'NO',
    drv_dimitriou: 'MAYBE',
  },
  ev_r5: { drv_vlachakis: 'MAYBE', drv_bitsakis: 'NO' },
}

export function buildSeedState() {
  const state = emptyState()

  state.championship = {
    ...state.championship,
    id: 'champ_gr_endurance',
    name: 'Greek Endurance Series — Le Mans Ultimate',
    season: '2026',
    organizer: 'Greek Sim Racers',
    description:
      'Πρωτάθλημα αντοχής 6 αγώνων στο Le Mans Ultimate, με Hypercar, LMP2 και LMGT3. Κάθε αυτοκίνητο δηλώνει 2–4 οδηγούς και υποβάλλει πλάνο stint πριν από κάθε αγώνα.',
    classes: ['HYPERCAR', 'LMP2', 'LMGT3'],
    rules: {
      ...DEFAULT_RULES,
      maxStintMinutes: 75,
      minRestMinutes: 40,
      maxDriveShare: 0.6,
      minDriveMinutes: 45,
      minAmDriveMinutes: 60,
      tyreSetsPerEvent: 9,
    },
    scoring: {
      preset: 'WEC',
      table: POINTS_PRESETS.WEC.table,
      polePoint: 1,
      fastestLapPoint: 1,
      finishRequiredLapsShare: 0.7,
      dropRounds: 0,
      doublePointsEvents: ['ev_r3'],
    },
  }

  // --- Διοργανωτής (ο «χρήστης» με ρόλο ADMIN) ---
  const admin = driver('athanasiou', 'Νίκος Αθανασίου', 'GOLD', {
    role: 'ADMIN',
    notes: 'Race Control — διοργανωτής του πρωταθλήματος.',
  })
  state.drivers.push(admin)

  // --- Ομάδες & οδηγοί ---
  TEAM_BLUEPRINTS.forEach((bp) => {
    const teamId = `team_${bp.id}`
    const driverIds = []
    bp.drivers.forEach(([slug, name, category], index) => {
      const d = driver(slug, name, category, {
        teamId,
        role: index === 0 ? 'PRINCIPAL' : 'DRIVER',
      })
      state.drivers.push(d)
      driverIds.push(d.id)
    })
    state.teams.push({
      id: teamId,
      name: bp.name,
      shortName: bp.shortName,
      carClass: bp.carClass,
      car: bp.car,
      number: bp.number,
      color: bp.color,
      principalId: driverIds[0],
      driverIds,
      notes: '',
    })
  })

  // --- Καλεντάρι ---
  state.events = EVENT_BLUEPRINTS.map((bp) => ({
    id: `ev_${bp.id}`,
    round: bp.round,
    name: bp.name,
    trackId: bp.trackId,
    dateISO: bp.dateISO,
    durationMinutes: bp.durationMinutes,
    formationLapMinutes: 0,
    status: bp.status,
    notes: bp.notes || '',
  }))

  // --- Αποτελέσματα περασμένων αγώνων ---
  state.results = RESULT_BLUEPRINTS.map((bp) => {
    const entries = []
    let overall = 0
    Object.entries(bp.order).forEach(([classId, teams]) => {
      const winnerLaps = bp.winnerLaps[classId]
      teams.forEach((slug, index) => {
        const teamId = `team_${slug}`
        const isDnf = bp.dnf.includes(slug)
        overall += 1
        entries.push(
          createResultEntry({
            teamId,
            position: isDnf ? 0 : overall,
            classPosition: isDnf ? 0 : index + 1,
            laps: isDnf ? Math.round(winnerLaps * 0.55) : winnerLaps - index * 2,
            status: isDnf ? 'DNF' : 'FINISHED',
            pole: bp.pole === slug,
            fastestLap: bp.fastestLap[classId] === slug,
            driverIds: [],
            note: isDnf ? 'Μηχανική βλάβη' : '',
          }),
        )
      })
    })
    return createResult({ eventId: bp.eventId, entries, publishedAt: Date.now() })
  })

  // --- Διαθεσιμότητες: όλοι «ΝΑΙ» για τους επόμενους αγώνες, με εξαιρέσεις ---
  state.events
    .filter((e) => e.status === 'UPCOMING')
    .forEach((event) => {
      const map = {}
      state.drivers
        .filter((d) => d.teamId)
        .forEach((d) => {
          map[d.id] = 'YES'
        })
      Object.assign(map, AVAILABILITY_EXCEPTIONS[event.id] || {})
      state.availability[event.id] = map
    })

  // --- Έτοιμα πλάνα για τον επόμενο αγώνα ---
  const nextEvent = state.events.find((e) => e.id === 'ev_r4')
  SEEDED_PLANS.forEach(({ teamId, status }) => {
    const team = state.teams.find((t) => t.id === teamId)
    if (!team || !nextEvent) return
    const car = createCarSetup(team, nextEvent)
    state.plans.push(
      createPlan({
        id: `plan_${teamId}_${nextEvent.id}`,
        eventId: nextEvent.id,
        teamId,
        status,
        car,
        strategyNote:
          status === 'APPROVED'
            ? 'Διπλό stint στα ελαστικά όσο κρατά ο ρυθμός. Ο Bronze μπαίνει στο τρίτο stint, όταν πέφτει η θερμοκρασία.'
            : status === 'CHANGES'
              ? 'Ψάχνουμε αντικαταστάτη για τον Μαυρίδη — χωρίς Silver δεν βγαίνει ο ελάχιστος χρόνος Am.'
              : '',
        stints: generateStints({
          event: nextEvent,
          team,
          drivers: state.drivers,
          rules: state.championship.rules,
          car,
          availability: state.availability,
        }),
      }),
    )
  })

  state.session = { userId: admin.id }
  state.log = [
    {
      at: Date.now(),
      who: admin.name,
      text: 'Φορτώθηκε το πρωτάθλημα επίδειξης με 11 ομάδες και 6 αγώνες.',
    },
  ]
  return state
}
