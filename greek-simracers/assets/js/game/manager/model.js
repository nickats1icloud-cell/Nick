/**
 * Η κατάσταση της καριέρας: ομάδα, οδηγοί, αυτοκίνητο, οικονομικά, σεζόν.
 *
 * Όλα τα δεδομένα ζουν σε ένα απλό, serializable αντικείμενο (`state`), ώστε
 * η αποθήκευση να είναι ένα JSON.stringify στο localStorage. Καμία συνάρτηση
 * εδώ δεν αγγίζει DOM — το UI (page.js) διαβάζει και ζωγραφίζει.
 */

import {
  CALENDAR,
  RIVAL_TEAMS,
  difficultyById,
  makeDriver,
  makeDriverPool,
  makeRng,
  pointsFor,
  prizeFor,
  upgradeCost,
  upgradeGain,
  UPGRADES,
} from "./data.js";

const STORAGE_KEY = "gsr-manager-v1";

/** Έσοδα χορηγών ανά αγώνα, ανάλογα με τη φήμη της ομάδας. */
function sponsorIncome(state) {
  return Math.round(180000 + state.team.reputation * 9000);
}

/** Νέα καριέρα. */
export function newCareer({ teamName, color, difficultyId, driverIds, seed, pool: providedPool }) {
  const difficulty = difficultyById(difficultyId);
  const rng = makeRng(seed ?? Math.floor(Math.random() * 1e9));
  // Η δεξαμενή έρχεται από την οθόνη επιλογής — αν τη φτιάχναμε ξανά εδώ, οι
  // οδηγοί θα έπαιρναν καινούργια id και οι υπογραφές δεν θα ταίριαζαν.
  const pool = providedPool ?? makeDriverPool(rng, 14);

  // Οι αντίπαλες ομάδες παίρνουν οδηγούς ανάλογους της δύναμής τους.
  const rivals = RIVAL_TEAMS.map((team) => ({
    id: team.id,
    name: team.name,
    color: team.color,
    car: {
      aero: team.strength + (rng() - 0.5) * 6,
      engine: team.strength + (rng() - 0.5) * 6,
      reliability: team.strength + (rng() - 0.5) * 10,
      pit: team.strength + (rng() - 0.5) * 12,
    },
    drivers: [
      makeDriver(rng, { skill: team.strength + (rng() - 0.3) * 8 }),
      makeDriver(rng, { skill: team.strength - 4 + (rng() - 0.5) * 10 }),
    ],
    points: 0,
  }));

  const hired = driverIds
    .map((id) => pool.find((d) => d.id === id))
    .filter(Boolean)
    .map((d) => ({ ...d, contract: 2 }));

  const state = {
    version: 1,
    seed: seed ?? 0,
    difficulty: difficulty.id,
    season: 1,
    round: 0, // πόσοι αγώνες έχουν ολοκληρωθεί
    money: difficulty.budget - hired.reduce((sum, d) => sum + d.salary * 3, 0),
    team: {
      name: teamName,
      color,
      reputation: 10,
      car: {
        aero: 69 + difficulty.carBonus,
        engine: 69 + difficulty.carBonus,
        reliability: 71 + difficulty.carBonus,
        pit: 66 + difficulty.carBonus,
      },
      drivers: hired,
      points: 0,
    },
    rivals,
    market: pool.filter((d) => !driverIds.includes(d.id)),
    // Ιστορικό αποτελεσμάτων: ένα αντικείμενο ανά αγώνα.
    history: [],
    log: [],
  };

  addLog(state, `Η ομάδα ${teamName} μπαίνει στο πρωτάθλημα. Καλή επιτυχία!`);
  return state;
}

export function addLog(state, text) {
  state.log.unshift({ text, season: state.season, round: state.round + 1 });
  state.log = state.log.slice(0, 40);
}

/** Ο επόμενος αγώνας του καλενταριού (ή null στο τέλος της σεζόν). */
export function nextRace(state) {
  return CALENDAR[state.round] ?? null;
}

export function seasonFinished(state) {
  return state.round >= CALENDAR.length;
}

/** Συνολικό rating αυτοκινήτου — αυτό που "νιώθει" ο παίκτης ως ρυθμό. */
export function carRating(car) {
  return (car.aero * 0.42 + car.engine * 0.42 + car.reliability * 0.16) / 1;
}

/** Όλες οι ομάδες (η δική σου + οι αντίπαλες) σε ενιαία μορφή για τον αγώνα. */
export function allTeams(state) {
  return [
    {
      id: "player",
      name: state.team.name,
      color: state.team.color,
      car: state.team.car,
      drivers: state.team.drivers,
      isPlayer: true,
    },
    ...state.rivals.map((r) => ({ ...r, isPlayer: false })),
  ];
}

// ---------------------------------------------------------------------------
// Ανάπτυξη αυτοκινήτου
// ---------------------------------------------------------------------------

export function costOfUpgrade(state, upgradeId) {
  const upgrade = UPGRADES.find((u) => u.id === upgradeId);
  return upgradeCost(upgrade, state.team.car[upgradeId]);
}

/** @returns {{ok:boolean, reason?:string}} */
export function buyUpgrade(state, upgradeId) {
  const rating = state.team.car[upgradeId];
  if (rating >= 99) return { ok: false, reason: "maxed" };
  const cost = costOfUpgrade(state, upgradeId);
  if (state.money < cost) return { ok: false, reason: "no-money" };

  state.money -= cost;
  state.team.car[upgradeId] = Math.min(99, rating + upgradeGain(rating));
  const upgrade = UPGRADES.find((u) => u.id === upgradeId);
  addLog(state, `Αναβάθμιση: ${upgrade.name} → ${Math.round(state.team.car[upgradeId])}`);
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Οδηγοί
// ---------------------------------------------------------------------------

/** Κόστος υπογραφής: τρεις μισθοί μπροστά. */
export function signingFee(driver) {
  return driver.salary * 3;
}

export function hireDriver(state, driverId, slot) {
  const driver = state.market.find((d) => d.id === driverId);
  if (!driver) return { ok: false, reason: "not-found" };
  const fee = signingFee(driver);
  if (state.money < fee) return { ok: false, reason: "no-money" };

  state.money -= fee;
  state.market = state.market.filter((d) => d.id !== driverId);

  const replaced = state.team.drivers[slot];
  if (replaced) state.market.push({ ...replaced, morale: 60 });
  state.team.drivers[slot] = { ...driver, contract: 2 };

  addLog(state, `Υπογραφή: ${driver.name} στην ${state.team.name}.`);
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Αποτέλεσμα αγώνα
// ---------------------------------------------------------------------------

/**
 * Εφαρμόζει το αποτέλεσμα ενός αγώνα στην κατάσταση της καριέρας.
 * @param {Array} results [{driverId, teamId, position, dnf, bestLap}] ταξινομημένα
 */
export function applyRaceResult(state, results) {
  const race = nextRace(state);
  const income = { prize: 0, sponsors: sponsorIncome(state), salaries: 0 };

  for (const row of results) {
    const points = row.dnf ? 0 : pointsFor(row.position);

    if (row.teamId === "player") {
      const driver = state.team.drivers.find((d) => d.id === row.driverId);
      if (driver) {
        driver.points = (driver.points || 0) + points;
        // Ηθικό: καλό αποτέλεσμα ανεβάζει, εγκατάλειψη ρίχνει.
        const delta = row.dnf ? -12 : row.position <= 3 ? 12 : row.position <= 6 ? 5 : -4;
        driver.morale = Math.max(5, Math.min(100, driver.morale + delta));
      }
      state.team.points += points;
      income.prize += prizeFor(row.position, race?.prize ?? 1);
      state.team.reputation = Math.min(100, state.team.reputation + (row.dnf ? 0 : Math.max(0, 6 - row.position)));
    } else {
      const rival = state.rivals.find((r) => r.id === row.teamId);
      if (rival) {
        rival.points += points;
        const driver = rival.drivers.find((d) => d.id === row.driverId);
        if (driver) driver.points = (driver.points || 0) + points;
      }
    }
  }

  income.salaries = state.team.drivers.reduce((sum, d) => sum + d.salary, 0);
  state.money += income.prize + income.sponsors - income.salaries;

  state.history.push({
    season: state.season,
    round: state.round + 1,
    raceName: race?.name ?? "",
    trackId: race?.trackId ?? "",
    results: results.map((r) => ({
      driverId: r.driverId,
      teamId: r.teamId,
      name: r.name,
      position: r.position,
      dnf: r.dnf,
      bestLap: r.bestLap,
    })),
    income,
  });

  const best = results.find((r) => r.teamId === "player");
  addLog(
    state,
    best
      ? `${race?.name}: καλύτερο αποτέλεσμα P${best.position}${best.dnf ? " (εγκατάλειψη)" : ""}.`
      : `${race?.name}: ολοκληρώθηκε.`,
  );

  state.round += 1;
  return income;
}

/** Τέλος σεζόν: πρωταθλητής, έπαθλα, εξέλιξη οδηγών, νέα σεζόν. */
export function endSeason(state) {
  const standings = teamStandings(state);
  const position = standings.findIndex((t) => t.id === "player") + 1;
  const bonus = Math.round(1400000 * Math.max(0.25, (7 - position) / 6));
  state.money += bonus;

  // Οι νέοι οδηγοί βελτιώνονται προς το δυναμικό τους, οι μεγάλοι φθίνουν.
  const progress = (driver) => {
    driver.age += 1;
    if (driver.age <= 30) driver.skill = Math.min(driver.potential, driver.skill + (driver.age < 25 ? 3 : 1));
    else if (driver.age > 34) driver.skill = Math.max(40, driver.skill - 2);
    driver.points = 0;
    driver.contract = Math.max(0, (driver.contract ?? 1) - 1);
  };
  state.team.drivers.forEach(progress);
  state.rivals.forEach((r) => r.drivers.forEach(progress));
  state.market.forEach(progress);

  // Οι αντίπαλοι αναπτύσσουν κι αυτοί το αυτοκίνητό τους.
  const rng = makeRng(state.season * 7919 + 13);
  for (const rival of state.rivals) {
    for (const key of ["aero", "engine", "reliability", "pit"]) {
      rival.car[key] = Math.min(99, rival.car[key] + 1.4 + rng() * 3.2);
    }
    rival.points = 0;
  }

  state.team.points = 0;
  state.season += 1;
  state.round = 0;
  addLog(state, `Τέλος σεζόν: P${position} στο πρωτάθλημα ομάδων. Έπαθλο ${Math.round(bonus / 1000)}K €.`);
  return { position, bonus };
}

// ---------------------------------------------------------------------------
// Βαθμολογίες
// ---------------------------------------------------------------------------

export function teamStandings(state) {
  const rows = [
    { id: "player", name: state.team.name, color: state.team.color, points: state.team.points, isPlayer: true },
    ...state.rivals.map((r) => ({ id: r.id, name: r.name, color: r.color, points: r.points, isPlayer: false })),
  ];
  return rows.sort((a, b) => b.points - a.points);
}

export function driverStandings(state) {
  const rows = [];
  for (const d of state.team.drivers) {
    rows.push({ id: d.id, name: d.name, team: state.team.name, color: state.team.color, points: d.points || 0, isPlayer: true });
  }
  for (const r of state.rivals) {
    for (const d of r.drivers) {
      rows.push({ id: d.id, name: d.name, team: r.name, color: r.color, points: d.points || 0, isPlayer: false });
    }
  }
  return rows.sort((a, b) => b.points - a.points);
}

// ---------------------------------------------------------------------------
// Αποθήκευση
// ---------------------------------------------------------------------------

export function save(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    return true;
  } catch {
    return false; // π.χ. private mode — το παιχνίδι συνεχίζει χωρίς save
  }
}

export function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const state = JSON.parse(raw);
    return state && state.version === 1 ? state : null;
  } catch {
    return null;
  }
}

export function clearSave() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // αγνοείται
  }
}
