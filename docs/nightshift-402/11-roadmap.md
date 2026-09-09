# 11 — Roadmap

Κάθε milestone είναι **παίξιμο**. Δεν υπάρχει milestone «τελείωσε το backend»
χωρίς κάτι που να μπορεί να δοκιμάσει παίκτης.

## M0 — Καθαρισμός θεμελίων

*Δεν προσθέτει feature. Κάνει δυνατά όλα τα υπόλοιπα.*

- Εξαγωγή όλων των engines σε `packages/rules`: μηδέν I/O, `now` και `seed` ως
  ορίσματα.
- Κάθε κίνηση χρήματος περνά από μία συνάρτηση `transfer()` με λόγο — ακόμα και
  τοπικά.
- Το road graph βγαίνει από τον client σε προεπεξεργασμένα tiles.

**Done όταν:** ο ίδιος κώδικας κανόνων τρέχει σε Node test χωρίς browser, και
ένα σενάριο 30 ημερών παράγει το ίδιο αποτέλεσμα με το ίδιο seed.

## M1 — Ταυτότητα & persistence

- Supabase Auth, `profiles`, `characters`.
- Μεταφορά του local state σε βάση (χωρίς αλλαγή gameplay).
- `accounts` + `ledger`, με nightly έλεγχο συνέπειας.

**Done όταν:** ο παίκτης συνδέεται από δεύτερη συσκευή και βρίσκει τον
χαρακτήρα του όπως τον άφησε.

## M2 — Η πρώτη multiplayer φέτα: Jobs

- Job board σε realtime.
- `employment_contracts`, `job_tasks`, quality control server-side.
- **Payroll escrow.**
- Δύο πραγματικοί παίκτες: ο ένας δημοσιεύει, ο άλλος δουλεύει, ο μισθός
  μετακινείται με ledger εγγραφή.

**Done όταν:** ένας παίκτης πληρώνει έναν άλλο παίκτη για δουλειά που έγινε,
και κανείς από τους δύο δεν μπορεί να το χειραγωγήσει από devtools.

*Αυτό είναι το πραγματικό vertical slice. Αν δουλέψει, το υπόλοιπο παιχνίδι
είναι επανάληψη του μοτίβου.*

## M3 — Items & αγορά

- `skus`, `items` με provenance, `market_orders`.
- Τιμολόγηση ανά περιοχή, transport cost από το road graph.
- AI shortage cover με τα όρια του [03](03-economy.md).

**Done όταν:** ένα ανταλλακτικό φτιαγμένο από παίκτη Α μπαίνει στο αυτοκίνητο
του παίκτη Β και το `service_record` δείχνει ποιος το έφτιαξε.

## M4 — Επιχειρήσεις

- Αγορά επιχείρησης, company account, εξοπλισμός, παραγωγή.
- Προσλήψεις, vacancies, customer orders, supply contracts.
- Business permissions + audit.

**Done όταν:** μια αλυσίδα τριών επιχειρήσεων παικτών παραδίδει προϊόν σε
τέταρτο παίκτη χωρίς καμία AI παρέμβαση.

## M5 — Crews, γκαράζ, αγώνες

- Crews με ποσοστά, permissions, shared balance, ενοίκιο.
- Race prerequisites, wear, service history.
- Player-created drag events με entry-fee escrow και brackets.

**Done όταν:** ένα event οργανωμένο από παίκτη τρέχει με 8 πραγματικούς οδηγούς
και το prize pool καταλήγει σωστά μοιρασμένο.

## M6 — Επαγγελματική ομάδα

- Licenses, team account, development, engineers.
- Sponsor contracts με στόχους, championship calendar, standings.

**Done όταν:** μια σεζόν ολοκληρώνεται με βαθμολογία και οι χορηγοί πληρώνουν
βάσει αποτελεσμάτων.

## M7 — Traffic worker & κλίμακα

- Dedicated simulation worker, tick 20 Hz, snapshots.
- LOD κίνησης, instanced rendering.
- Streaming tiles πέρα από την αρχική πόλη.

**Done όταν:** 100 ταυτόχρονοι παίκτες σε μία πόλη με σταθερό frame rate και
χωρίς όχημα να εξαφανίζεται μπροστά στα μάτια τους.

## Ρίσκα

| Ρίσκο | Επίπτωση | Μετριασμός |
| ----- | -------- | ---------- |
| **Οι engines δεν καθαρίζουν** (κρυφό I/O, `Date.now()`) | όλη η μετάβαση σε server-authoritative μπλοκάρει | M0 πρώτο, με tests που τρέχουν σε Node |
| **Πληθωρισμός** | η οικονομία χάνει νόημα μέσα σε εβδομάδες | faucet/sink dashboard από το M1, όχι μετά |
| **Χαμηλό population** | κανείς δεν βρίσκει εργοδότη ή προμηθευτή | AI backstop με ρητά όρια· ένας κόσμος, όχι πολλοί |
| **Η εργασία γίνεται βαρετή** | οι παίκτες σταματούν στο βήμα 4 | ≥ 2 τύποι βημάτων ανά ειδικότητα· playtest στο M2 |
| **Κόστος tile pipeline** | καθυστέρηση σε όλα | μία πόλη στο MVP· η «όλη η Γη» είναι M7+ |
| **Cheating** | καταστρέφει την εμπιστοσύνη στην οικονομία | καμία client-side απόφαση για χρήμα, από το M1 |
| **Scope** | 11 συστήματα, κανένα τελειωμένο | κάθετες φέτες· κάθε milestone παίζεται |

## Τι δεν είναι στο MVP

Ρητά εκτός, ώστε να μη διολισθήσει το scope:

- Ολόκληρη η Γη (μία πόλη αρκεί για να αποδειχθεί ο βρόχος).
- Οδήγηση σε πραγματικό χρόνο από τον παίκτη (οι αγώνες επιλύονται από τον
  engine με animation).
- Voice, φωνητικό RP, φαινόμενα ζωής εκτός αυτοκινήτου.
- Mobile client.
