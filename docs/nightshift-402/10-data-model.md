# 10 — Data model

Σκίτσο του σχήματος Postgres. Δεν είναι τελική μετανάστευση — είναι οι
οντότητες, οι σχέσεις και οι περιορισμοί που πρέπει να ισχύουν, ώστε να μη
χρειαστεί ανασχεδίαση όταν μπει το multiplayer.

## Ταυτότητα & χαρακτήρας

```
profiles            id (= auth.users.id), display_name, role, status, created_at
characters          id, profile_id, name, energy, stress, heat,
                    rep_street, rep_motorsport, career_days, created_at
character_xp        character_id, specialty, xp                    ⟨PK: και τα δύο⟩
```

Ένα `profile` μπορεί να έχει έναν ενεργό `character` ανά κόσμο.

## Χρήμα

```
accounts            id, kind ('personal'|'business'|'crew'|'team'|'escrow'|'system'),
                    owner_id, balance_cents, currency
ledger              id, from_account, to_account, amount_cents,
                    reason, ref_type, ref_id, created_at
```

- `balance_cents` σε **ακέραιο**. Ποτέ float για χρήμα.
- Κάθε `INSERT` στο `ledger` γίνεται στην ίδια transaction με τα δύο `UPDATE`
  των balances, μέσα σε συνάρτηση `transfer()`.
- `kind = 'system'` είναι οι ονομασμένες πηγές mint/burn (AI demand, admin,
  φόροι). Το άθροισμα των system λογαριασμών είναι η καθαρή ροή του κόσμου.

## Εργασία

```
businesses          id, owner_profile_id, category, parcel_id, account_id,
                    name, solvency_flag, created_at
business_members    business_id, profile_id, permissions jsonb
job_postings        id, business_id, role, required_xp, shift, pay_rate_cents,
                    energy_cost, escrow_account_id, open_slots, status
employment_contracts id, posting_id, character_id, started_at, ended_at,
                    end_reason
job_tasks           id, contract_id, spec jsonb, assigned_at, deadline
job_task_results    id, task_id, steps jsonb, quality numeric, outcome,
                    pay_cents, xp_awarded, created_at
```

**Ο περιορισμός που κρατά τον κανόνα «μία εταιρεία τη φορά»:**

```sql
CREATE UNIQUE INDEX one_active_job_per_character
  ON employment_contracts (character_id)
  WHERE ended_at IS NULL;
```

## Είδη & παραγωγή

```
skus                id, category, name, base_cost_cents, unit
items               id, sku_id, quality, condition, maker_business_id,
                    batch_id, holder_kind, holder_id, qty
item_inputs         item_id, input_item_id, qty          ⟨provenance graph⟩
production_orders   id, business_id, sku_id, qty, status, started_at, finished_at
supply_contracts    id, supplier_id, buyer_id, sku_id, qty_per_period,
                    price_cents, period, ends_at, penalty_cents
market_orders       id, seller_kind, seller_id, sku_id, qty, price_cents,
                    region_id, status
```

Το `item_inputs` είναι ο γράφος προέλευσης. Επιτρέπει «από πού ήρθε αυτό το
κλουβί» και στοχευμένη ανάκληση με `batch_id`.

## Αυτοκίνητα & αγώνες

```
vehicles            id, owner_kind, owner_id, model, mileage_km,
                    engine_cond, tyre_cond, brake_cond, garage_id
service_records     id, vehicle_id, business_id, kind, quality,
                    parts jsonb, cost_cents, created_at
race_events         id, promoter_kind, promoter_id, name, location,
                    legality, entry_fee_cents, bracket_size,
                    escrow_account_id, status, server_seed
race_entries        event_id, vehicle_id, character_id, crew_id, prep jsonb
race_results        id, event_id, round, position, payout_cents, telemetry jsonb
```

Το `server_seed` γράφεται **πριν** ξεκινήσει το event και δεν αλλάζει. Κάθε
πελάτης μπορεί να αναπαράγει το αποτέλεσμα· κανείς δεν μπορεί να το επηρεάσει.

## Crews & ομάδες

```
crews               id, name, account_id, garage_id, rent_cents,
                    morale, debt_cents
crew_members        crew_id, character_id, role, ownership_pct,
                    permissions jsonb, joined_at, is_ai
garages             id, parcel_id, capacity, upgrades jsonb
teams               id, crew_id, account_id, club_license, national_license,
                    performance, reliability
sponsor_contracts   id, team_id, sponsor_name, signing_bonus_cents,
                    race_bonus_cents, targets jsonb, ends_at
```

Περιορισμός: `SUM(ownership_pct) = 100` ανά crew, ελεγμένο με trigger.

## Κόσμος

```
parcels             id, geom geography, area_m2, land_class,
                    base_price_cents, owner_kind, owner_id
regions             id, name, geom geography          ⟨περιοχές αγοράς⟩
```

Το road graph **δεν** μπαίνει στη βάση ως γραμμές: ζει ως προεπεξεργασμένα
αρχεία tile στο Storage (βλ. [01](01-world-map.md)). Στη βάση μπαίνει μόνο ό,τι
αλλάζει από παίκτες.

## Έλεγχος

```
admin_audit         id, actor_id, action, target_kind, target_id,
                    before jsonb, after jsonb, reason, created_at
idempotency_keys    key, profile_id, response jsonb, created_at
```

## RLS — οι βασικοί κανόνες

| Πίνακας | Ανάγνωση | Εγγραφή |
| ------- | -------- | ------- |
| `characters` | ο ιδιοκτήτης· δημόσια πεδία σε όλους | **μόνο service role** |
| `accounts` / `ledger` | ο ιδιοκτήτης ή μέλος με `funds.view` | **μόνο service role** |
| `job_postings` | όλοι | `hr.post` στην επιχείρηση |
| `job_task_results` | ο εργαζόμενος + ο εργοδότης | **μόνο service role** |
| `items` | ο κάτοχος | **μόνο service role** |
| `admin_audit` | ρόλοι admin | append-only, service role |

**Ο κανόνας πίσω από τον πίνακα:** τίποτα που παράγει αξία δεν είναι εγγράψιμο
από τον client, ούτε με RLS που «φαίνεται σωστό». Ο client καλεί RPC· η RPC
τρέχει τους rules και γράφει. Η RLS είναι το δεύτερο δίχτυ, όχι το πρώτο.
