# 08 — Admin & audit

## Πεδίο

Server administration layer για player management, cash και reputation,
businesses και ownership, market prices, materials και inventories, server
settings, account status, career resets, audit history και economy control.

## Ο μη διαπραγματεύσιμος κανόνας

**Στην τελική online έκδοση, όλες οι admin ενέργειες εκτελούνται server-side,
με permissions και audit logging.** Καμία admin δυνατότητα δεν υπάρχει στον
client πέρα από το UI που καλεί τα endpoints. Ένα admin panel που δίνει
χρήματα με client-side κώδικα είναι δώρο σε κάθε παίκτη με devtools.

## Ρόλοι

| Ρόλος | Μπορεί |
| ----- | ------ |
| `support` | να δει παίκτες, ιστορικό, να ξεμπλοκάρει κολλημένο task |
| `moderator` | + account status (mute, suspend), ακύρωση event |
| `economy` | + market prices, AI παράμετροι, materials, οικονομικά dashboards |
| `admin` | + cash/reputation adjustments, ownership transfers, career resets |
| `owner` | + server settings, διαχείριση ρόλων |

Κάθε ρόλος περιλαμβάνει τον προηγούμενο. Το `cash adjustment` είναι η πιο
επικίνδυνη άδεια στο παιχνίδι και ανήκει μόνο στο `admin`.

## Audit

Κάθε admin ενέργεια γράφει εγγραφή που **δεν διαγράφεται και δεν αλλάζει**:

| Πεδίο | |
| ----- | - |
| `actor_id` | ποιος admin |
| `action` | τι είδος ενέργεια |
| `target` | σε ποιον/τι |
| `before` / `after` | η κατάσταση πριν και μετά, ως JSON |
| `reason` | **υποχρεωτικό ελεύθερο κείμενο** |
| `created_at` | χρόνος server |

Το `reason` είναι υποχρεωτικό γιατί το 90% των προβλημάτων εμπιστοσύνης σε RP
servers είναι «γιατί μου το έκανε αυτό;» χωρίς απάντηση.

**Πρόταση διαφάνειας:** οι οικονομικές admin ενέργειες (mint, adjustment) να
είναι δημόσια ορατές σε συγκεντρωτική μορφή — πόσο χρήμα δημιουργήθηκε από
admins αυτή την εβδομάδα. Η κοινότητα εμπιστεύεται μια οικονομία που μπορεί να
ελέγξει.

## Economy control

Τα εργαλεία που χρειάζεται πραγματικά ο `economy` ρόλος:

- **Faucet/sink dashboard** — καθαρή ροή ανά ημέρα, ανά πηγή (βλ. [03](03-economy.md)).
- **Παράμετροι AI** — κατώφλια shortage, markup, starter demand.
- **Market snapshot** — τιμές ανά SKU ανά περιοχή, με ιστορικό.
- **Shortage alerts** — τι λείπει και πόσο καιρό.
- **Ανάκληση παρτίδας** — αν ένα bug παρήγαγε λάθος items, το `batch_id`
  επιτρέπει στοχευμένη διόρθωση αντί για wipe.

## Career reset

Ο παίκτης μπορεί να ζητήσει reset. Ο κανόνας: το reset **δεν κάνει mint και δεν
κάνει burn**. Τα περιουσιακά στοιχεία πωλούνται στην αγορά ή περνούν σε AI
κάτοχο, οι υποχρεώσεις τακτοποιούνται, και ο χαρακτήρας ξεκινά από την αρχή.
Αλλιώς το reset γίνεται exploit.

## Account status

`active` / `muted` / `suspended` / `banned`. Σε `suspended` ή `banned`, οι
επιχειρήσεις και τα crews του παίκτη **δεν παγώνουν** — οι εργαζόμενοι
πληρώνονται από το escrow και οι συνιδιοκτήτες αναλαμβάνουν. Η τιμωρία ενός
παίκτη δεν πρέπει να τιμωρεί δέκα άλλους.
