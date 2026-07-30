# Ιδέες εφαρμογών για το Le Mans Ultimate

Έρευνα αγοράς + προτάσεις υλοποίησης (Ιούλιος 2026).
Στόχος: να βρούμε τι υπάρχει ήδη στην κοινότητα του LMU, πού είναι τα κενά, και
τι αξίζει να φτιάξουμε με το υπάρχον stack (React + Vite, GitHub Pages,
Supabase).

---

## 1. Τι υπάρχει ήδη (η αγορά)

### Telemetry & ανάλυση γύρων
| Εργαλείο | Τι κάνει | Μορφή |
|---|---|---|
| [LMU Trace](https://lmutrace.com/) | Καταγραφή από shared memory, σύγκριση γύρων με άλλους οδηγούς, in-game HUD | Desktop |
| [MyLMU](https://mylmu.app/) | Auto-sync των result & telemetry αρχείων σε online dashboard | Desktop + web |
| [LMU-Stats](https://lmu-stats.com/) | Upload των XML results → fuel, tyre deg, consistency | Web |
| [LMU Analyzer](https://github.com/arminreiter/lmu-analyzer/) | Parsing των αρχείων 100% στον browser, charts & tables | Web (open source) |
| [Telemetry Tool for LMU](https://www.overtake.gg/downloads/telemetry-tool-for-lmu.73664/) | Real-time & offline telemetry, race engineering | Desktop |
| [TinyPedal](https://github.com/s-victor/TinyPedal) | Open-source overlay πάνω από το παιχνίδι | Desktop (Python) |
| [RaceLab](https://racelab.app/) | Overlays, VR-native, streaming tools | Desktop |

### Στρατηγική & καύσιμο
- [LMU Fuel (App Store)](https://apps.apple.com/my/app/lmu-fuel/id6761951654) — mobile fuel/stint planner.
- [StrategyMaster 3000](https://strategymaster3000.com/) — δωρεάν web calculator.
- [ACJ Creative WEC Pit Stint Calculator](https://acjcreative.com/wec-pit-strategy/) και
  [LMU Academy Stint Calculator](https://www.lmu-academy.com/stint-calculator).
- [Ultimate Setup Hub — Pitstop Calculator](https://ultimatesetuphub.com/pitstop-calculator).
- [PitSkill.io fuel calculator](https://pitskill.io/fuel-calculator) (multi-sim).

### Setups
- [Ultimate Setup Hub](https://ultimatesetuphub.com/setups),
  [LMUHub](https://lmuhub.com/setups),
  [LMUCarSetups](https://lmucarsetups.com/),
  [Track Titan](https://app.tracktitan.io/setups/leMansUltimate),
  [GitHub setup collection](https://github.com/seralaci/Le-Mans-Ultimate-Setups).

### Πρόγραμμα αγώνων (Daily/Weekly/Special)
- [LMU Portal](https://lmuportal.com/), [LMU Races](https://lmuraces.com/),
  [LMU Schedule](https://www.lmuschedule.com/), [LMUHub Schedule](https://lmuhub.com/schedule),
  [LMU Daily (Android)](https://play.google.com/store/apps/details?id=com.bshpanchuk.lmudaily).
- Πηγή δεδομένων όλων: [racecontrol.gg](https://www.racecontrol.gg/) (η επίσημη
  πλατφόρμα του LMU/rF2, powered by SimGrid).

### Στατιστικά & rating
- [LMUdata](https://lmudata.com/) — rank distribution, charts, rankings.
- [Rating System wiki](https://lemansultimate.wiki.gg/wiki/Rating_System) — DR/SR σύστημα.

**Συμπέρασμα:** τα «εύκολα» πεδία είναι κορεσμένα — schedule viewers, fuel
calculators, setup libraries και telemetry viewers υπάρχουν σε πολλαπλά
αντίγραφα. Το ενδιαφέρον είναι εκεί που **κανείς δεν έχει πάει καλά**.

---

## 2. Τα πραγματικά κενά

1. **Όλοι οι calculators είναι στατικοί / pre-race.** Υπολογίζεις πριν τον
   αγώνα και μετά αυτοσχεδιάζεις. Δεν υπάρχει καλό *live* εργαλείο που να λέει
   «είσαι 1.8% πίσω από το target virtual energy, σήκωσε το πόδι 3% στις
   ευθείες» ενώ οδηγείς.
2. **Το Virtual Energy είναι η πιο παρεξηγημένη μηχανική του LMU** (Hypercar/
   LMGT3) και τα υπάρχοντα εργαλεία το αντιμετωπίζουν σαν «δεύτερο fuel».
3. **Τα setups είναι κατακερματισμένα** σε 5+ sites χωρίς ενιαία αναζήτηση.
4. **Endurance / driver swaps:** το παιχνίδι πρόσθεσε teams & driver swaps
   (Update 5, Ιούνιος 2025), αλλά ο *προγραμματισμός* της ομάδας — ποιος οδηγεί
   ποιο stint, σε ποια πραγματική ώρα, με ποια διαθεσιμότητα και timezone —
   γίνεται ακόμα σε Discord και Google Sheets.
5. **League admin tooling:** τα υπάρχοντα εργαλεία διαβάζουν *το δικό σου*
   result αρχείο. Δεν υπάρχει καλό εργαλείο για διοργανωτή πρωταθλήματος
   (πολλά races → βαθμολογία → ποινές → δημοσίευση κατάταξης).
6. **Καμία παρουσία στα ελληνικά** — μηδενικό περιεχόμενο/εργαλεία για την
   ελληνική sim racing κοινότητα.

---

## 3. Οι προτάσεις

Κάθε ιδέα με: τι είναι, γιατί έχει νόημα, δυσκολία, και ταίριασμα με το stack.

### 🥇 Ιδέα 1 — «Virtual Energy Race Engineer» (live strategy coach)

**Τι είναι:** εφαρμογή που τρέχει δίπλα στο παιχνίδι, διαβάζει shared memory
και σου δίνει *ζωντανά*:
- delta ενέργειας/καυσίμου ανά γύρο σε σχέση με το target του stint,
- πρόβλεψη «θα φτάσεις ή όχι» μέχρι το επόμενο pit window,
- συγκεκριμένη οδηγία lift-and-coast (π.χ. «lift 40m νωρίτερα στο T1»),
- προσαρμογή σε πραγματικό χρόνο όταν μπει Full Course Yellow / Safety Car.

**Γιατί:** είναι το #1 κενό. Όλοι υπολογίζουν πριν, κανείς δεν σε βοηθά *μέσα*
στον αγώνα. Στο WEC ruleset το virtual energy είναι που κρίνει τους αγώνες.

**Δυσκολία:** ⭐⭐⭐⭐ (υψηλή). Χρειάζεται Windows desktop app (Python/C#) που
διαβάζει το [rF2 Shared Memory Map Plugin](https://github.com/TheIronWolfModding/rF2SharedMemoryMapPlugin)
— **δεν** γίνεται από browser.

**Ταίριασμα με το stack:** μερικό. Το μοντέλο που έχεις ήδη δουλέψει στο
`useVehicleSim.js` (physics loop + gauges + warning lights) μεταφέρεται σχεδόν
αυτούσιο στο UI. Μπορείς να το κάνεις **υβριδικό**: μικρό Python backend
(FastAPI + WebSocket στα 50 Hz, όπως το κάνει το
[le-mans-ultimate-telemetry](https://github.com/NikMusy/le-mans-ultimate-telemetry))
και React frontend σε localhost — δηλαδή γράφεις React, όχι desktop GUI.

---

### 🥈 Ιδέα 2 — «Stint Planner» για endurance teams

**Τι είναι:** web app όπου μια ομάδα στήνει έναν αγώνα 6/12/24 ωρών:
- ορίζεις διάρκεια αγώνα, ώρα εκκίνησης, μήκος stint,
- κάθε οδηγός δηλώνει διαθεσιμότητα **στη δική του ώρα/timezone**,
- το app βγάζει αυτόματα το roster των stints (ποιος, πότε, από πότε ως πότε),
- shareable link, countdown στο επόμενο swap, εξαγωγή σε .ics / Discord webhook.

**Γιατί:** το παιχνίδι έδωσε driver swaps αλλά όχι εργαλείο σχεδιασμού. Κάθε
endurance ομάδα το κάνει σήμερα με spreadsheet. Πραγματικός πόνος, μηδενικός
ανταγωνισμός.

**Δυσκολία:** ⭐⭐ (μεσαία-χαμηλή).

**Ταίριασμα:** ✅ **τέλειο**. Καθαρό React + Supabase (auth + teams + stints),
ακριβώς ό,τι έχεις ήδη στήσει στο `greek-simracers/`. Deploy σε GitHub Pages.

---

### 🥉 Ιδέα 3 — «LMU Setup Meta-Search»

**Τι είναι:** ένας ενιαίος index πάνω από όλα τα setup sites. Ψάχνεις
`Porsche 963 @ Fuji` και βλέπεις σε ένα σημείο τι υπάρχει σε Ultimate Setup Hub,
LMUHub, LMUCarSetups, GitHub — με φίλτρα (wet/dry, qualy/race, έκδοση παιχνιδιού)
και σήμανση «outdated» όταν βγαίνει patch που αλλάζει το BoP.

**Γιατί:** το «σε ποιο site είναι το setup μου;» είναι καθημερινή απορία.
Επιπλέον, μετά από κάθε update τα setups παλιώνουν και κανείς δεν το επισημαίνει.

**Δυσκολία:** ⭐⭐⭐. Το τεχνικό μέρος είναι εύκολο· το δύσκολο είναι το scraping
(ToS των sites) και η συντήρηση όταν αλλάζουν HTML. Καλύτερη προσέγγιση:
ξεκίνα ως **community-submitted index** (links, όχι αντιγραφή αρχείων) και
πρόσθεσε αυτοματισμό μόνο όπου υπάρχει άδεια/API.

**Ταίριασμα:** ✅ React + Supabase. Θέλει και ένα μικρό cron (GitHub Actions).

---

### Ιδέα 4 — «League Control» (championship manager για διοργανωτές)

**Τι είναι:** ανεβάζεις τα XML results ενός αγώνα (ή τα ανεβάζουν οι οδηγοί) και
το app βγάζει: αποτελέσματα, βαθμολογία πρωταθλήματος με custom points system,
drop scores, ποινές (χειροκίνητες προσθήκες χρόνου/βαθμών), fastest lap points,
πίνακες ανά κλάση (Hypercar/LMP2/LMGT3), δημόσια σελίδα κατάταξης ανά
πρωτάθλημα.

**Γιατί:** τα υπάρχοντα εργαλεία είναι *ατομικά* («τα δικά μου αποτελέσματα»).
Ο διοργανωτής ενός ελληνικού ή διεθνούς league δεν έχει τίποτα — κάνει
copy-paste σε Excel κάθε Κυριακή.

**Δυσκολία:** ⭐⭐⭐ (το XML parsing είναι ήδη λυμένο πρόβλημα, βλ. LMU Analyzer).

**Ταίριασμα:** ✅ React + Supabase. Και συνδέεται άμεσα με το
`greek-simracers/` (championships module).

---

### Ιδέα 5 — «Greek LMU Hub» (ελληνικό portal)

**Τι είναι:** επέκταση του υπάρχοντος greeksimracers.gr με LMU-specific
κομμάτι: πρόγραμμα daily/weekly races σε ελληνική ώρα, οδηγοί/guides στα
ελληνικά (virtual energy, hybrid deployment, pit rules, tyre allocation),
ελληνικό leaderboard, ελληνικά leagues, Discord integration.

**Γιατί:** μηδενικός ανταγωνισμός στη γλώσσα, και έχεις ήδη την υποδομή.
Είναι το ταχύτερο «πρώτο κέρδος».

**Δυσκολία:** ⭐ (χαμηλή τεχνικά — το βάρος είναι στο περιεχόμενο).

**Ταίριασμα:** ✅✅ ήδη υπάρχει το site και το schema.

---

### Ιδέα 6 — «Broadcast Kit» για league μεταδόσεις

**Τι είναι:** πακέτο overlays για streamers/διοργανωτές — timing tower ανά
κλάση, gap-to-leader, pit status, ζωντανή κατάταξη πρωταθλήματος, lower thirds —
που τραβάει δεδομένα από shared memory ή από τα results και δίνει διαφανείς
HTML σελίδες για browser source στο OBS.

**Γιατί:** οι ελληνικές και μικρές διεθνείς μεταδόσεις LMU δείχνουν σήμερα σκέτο
gameplay. Ένα δωρεάν, καθαρό broadcast kit είναι εύκολα viral στην κοινότητα.

**Δυσκολία:** ⭐⭐⭐.

**Ταίριασμα:** ✅ καθαρό HTML/CSS/JS — ακριβώς η αισθητική δουλειά που έχεις ήδη
κάνει στο dashboard (`Gauge.jsx`, `BarGauge.jsx`, `WarningLights.jsx`).

---

### Ιδέα 7 — «Track & Car Meta Tracker»

**Τι είναι:** ανά πίστα και ανά έκδοση παιχνιδιού: ποιο αυτοκίνητο είναι
γρήγορο, μέσος χρόνος ανά rank tier, κατανάλωση ενέργειας, tyre deg. Δηλαδή
«τι να διαλέξω για το weekly race αυτής της εβδομάδας».

**Γιατί:** το BoP αλλάζει σε κάθε update και η κοινότητα μαντεύει. Το
[LMUdata](https://lmudata.com/) αγγίζει το θέμα αλλά όχι με «τι να οδηγήσω
τώρα» οπτική.

**Δυσκολία:** ⭐⭐⭐⭐ — το πρόβλημα δεν είναι ο κώδικας, είναι τα **δεδομένα**.
Χρειάζεσαι κρίσιμη μάζα χρηστών που ανεβάζουν results. Καλή ιδέα ως *φάση 2*
πάνω από την Ιδέα 4.

---

### Ιδέα 8 — «Practice Planner / Consistency Coach»

**Τι είναι:** δεν σου λέει «πήγαινε γρηγορότερα», αλλά *τι να εξασκήσεις*:
αναλύει τους γύρους σου, βρίσκει σε ποια σημεία χάνεις χρόνο **και** πού είσαι
ασυνεπής, και σου φτιάχνει πρόγραμμα προπόνησης 20 λεπτών («10 γύροι με focus
στο braking του T1»).

**Γιατί:** όλα τα telemetry tools δείχνουν *δεδομένα*· κανένα δεν δίνει
*πρόγραμμα*. Καλή διαφοροποίηση.

**Δυσκολία:** ⭐⭐⭐.

**Ταίριασμα:** μερικό — θέλει telemetry ingestion (αρχεία .csv/.ld ή XML), αλλά
το UI/λογική είναι web.

---

## 4. Τι προτείνω να κάνεις

**Πρόταση: Ιδέα 2 (Stint Planner) πρώτα, μετά Ιδέα 4 (League Control).**

Λόγοι:
- Καθαρά web — δουλεύει 100% με React + Vite + Supabase + GitHub Pages, χωρίς
  Windows-only κώδικα και χωρίς να χρειάζεται ο χρήστης να εγκαταστήσει τίποτα.
- Πραγματικό, ανεκμετάλλευτο κενό (το παιχνίδι έδωσε driver swaps χωρίς
  εργαλείο σχεδιασμού).
- Μικρό scope για v1: μια σελίδα, ένα shareable link, μηδενικό backend πέρα από
  Supabase.
- Οδηγεί φυσικά στο League Control (ίδιοι χρήστες, ίδιες ομάδες, ίδιο schema) και
  τροφοδοτεί το greeksimracers.gr.

Η Ιδέα 1 (Virtual Energy Engineer) είναι η **πιο πολύτιμη τεχνικά** και το
καλύτερο portfolio project, αλλά είναι και η πιο απαιτητική: θέλει desktop
runtime, Windows testing και το ίδιο το παιχνίδι για δοκιμές. Καλή ως δεύτερο,
πιο φιλόδοξο βήμα — και ταιριάζει απόλυτα με το gauge/simulation know-how που
υπάρχει ήδη σε αυτό το repo.

---

## 5. Τεχνικές σημειώσεις (για όποια ιδέα διαλέξεις)

### Πηγές δεδομένων του LMU

| Πηγή | Πού | Τι δίνει | Πρόσβαση |
|---|---|---|---|
| **Shared memory** | rF2 Shared Memory Map Plugin (TheIronWolf) | live τηλεμετρία ~50–100 Hz | Windows desktop app μόνο |
| **Results XML** | `…\Le Mans Ultimate\UserData\Log\Results\` (π.χ. `2025_06_20_10_29_59-35R1.xml`, όπου P/Q/R = Practice/Quali/Race) | γύροι, sectors, ελαστικά, καύσιμο, ποινές, incidents | Απλό parsing, γίνεται και client-side |
| **Telemetry logs** | `Documents\Le Mans Ultimate\Telemetry\` (.ld / .csv) | κανάλια ανά γύρο, συμβατά με MoTeC | Parsing offline |
| **racecontrol.gg** | Επίσημη πλατφόρμα (SimGrid) | schedule, events, teams, ratings | Δεν υπάρχει τεκμηριωμένο δημόσιο API — τα schedule sites τραβούν από εκεί· χρειάζεται επιβεβαίωση των ToS πριν από οποιοδήποτε automated fetch |

### Αρχιτεκτονική ανά τύπο app
- **Καθαρά web (Ιδέες 2, 3, 4, 5, 7):** React + Vite → GitHub Pages, Supabase για
  auth/DB. Ακριβώς το υπάρχον setup.
- **Client-side parsing (Ιδέα 8):** ο χρήστης κάνει drag-n-drop το XML/CSV, όλα
  τρέχουν στον browser. Μηδενικό κόστος server, μηδενικό ζήτημα privacy.
- **Live telemetry (Ιδέα 1):** μικρό τοπικό backend (Python FastAPI ή C#) που
  διαβάζει shared memory και εκθέτει WebSocket → React UI στο `localhost`.
- **OBS overlays (Ιδέα 6):** στατικές HTML σελίδες με διαφανές background και
  query params — δουλεύουν και από GitHub Pages.

### Νομικά / πρακτικά
- Το LMU είναι Motorsport Games / Studio 397 — μην χρησιμοποιείς επίσημα logos,
  ονόματα ομάδων WEC ή branding. Όλα τα community sites βάζουν disclaimer
  «not associated with Le Mans Ultimate, Studio 397 or Motorsport Games».
- Μην κάνεις scraping χωρίς έλεγχο των ToS· προτίμησε user-submitted δεδομένα.

---

## Πηγές

- [Telemetry — Le Mans Ultimate Wiki](https://lemansultimate.wiki.gg/wiki/Telemetry)
- [Rating System — Le Mans Ultimate Wiki](https://lemansultimate.wiki.gg/wiki/Rating_System)
- [The Best Apps For Le Mans Ultimate — Coach Dave Academy](https://coachdaveacademy.com/tutorials/the-5-best-apps-you-need-for-le-mans-ultimate/)
- [LMU Trace](https://lmutrace.com/) · [MyLMU](https://mylmu.app/) · [LMU-Stats](https://lmu-stats.com/) · [LMUdata](https://lmudata.com/)
- [LMU Analyzer (GitHub)](https://github.com/arminreiter/lmu-analyzer/)
- [TinyPedal (GitHub)](https://github.com/s-victor/TinyPedal) · [RaceLab](https://racelab.app/)
- [rF2 Shared Memory Map Plugin (GitHub)](https://github.com/TheIronWolfModding/rF2SharedMemoryMapPlugin)
- [le-mans-ultimate-telemetry (GitHub)](https://github.com/NikMusy/le-mans-ultimate-telemetry)
- [StrategyMaster 3000](https://strategymaster3000.com/) · [ACJ WEC Pit Stint Calculator](https://acjcreative.com/wec-pit-strategy/) · [LMU Academy Stint Calculator](https://www.lmu-academy.com/stint-calculator)
- [Ultimate Setup Hub](https://ultimatesetuphub.com/setups) · [LMUHub](https://lmuhub.com/setups) · [LMUCarSetups](https://lmucarsetups.com/) · [Le-Mans-Ultimate-Setups (GitHub)](https://github.com/seralaci/Le-Mans-Ultimate-Setups)
- [LMU Portal](https://lmuportal.com/) · [LMU Races](https://lmuraces.com/) · [LMU Schedule](https://www.lmuschedule.com/) · [LMU Daily (Google Play)](https://play.google.com/store/apps/details?id=com.bshpanchuk.lmudaily)
- [RaceControl](https://www.racecontrol.gg/) · [RaceControl.gg for LMU powered by SimGrid](https://pits.thesimgrid.com/announcements/your-brand-new-racecontrol-gg-for-le-mans-ultimate-powered-by-simgrid/)
- [Driver Swaps / Team Management update (Motorsport Games)](https://motorsportgames.com/le-mans-ultimate-introduces-driver-swaps-team-management-custom-liveries-and-final-2024-wec-content-in-major-june-update/)
- [MyLMU — File Locations](https://mylmu.app/docs/sessions/import/file-locations)
- [Le Mans Ultimate v1.0 review — SimRacingCockpit](https://simracingcockpit.gg/le-mans-ultimate-v1-0-review/)
