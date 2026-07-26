#!/usr/bin/env python3
"""Συγχρονίζει το dropdown «Πρωταθλήματα» του κύριου μενού σε όλες τις σελίδες.

Ίδια λογική με το sync-footer-socials.py: το site είναι στατικό HTML χωρίς
build step, οπότε το header επαναλαμβάνεται σε κάθε αρχείο. Η δομή του
dropdown ορίζεται μία φορά εδώ και γράφεται παντού:

    python3 tools/sync-nav.py

Αντικαθιστά **μόνο** τον σύνδεσμο μέσα στο <nav class="main-nav">, όχι τους
συνδέσμους του footer ή του κειμένου.
"""

import html
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent

# Η offline.html είναι σκόπιμα λιτή: χωρίς μενού και χωρίς footer.
SKIP = {"offline.html"}

# Ενότητες του Championship Hub. Η championship.html χωρίς ?id δείχνει το
# ενεργό πρωτάθλημα, οπότε αυτοί οι σύνδεσμοι δουλεύουν πάντα.
HUB_LINKS = [
    ("Όλα τα πρωταθλήματα", "championships.html"),
    ("Βαθμολογίες", "championship.html#standings"),
    ("Καλεντάρι", "championship.html#calendar"),
    ("Οδηγοί & ομάδες", "championship.html#drivers"),
    ("Στατιστικά", "championship.html#stats"),
]

CARET = (
    '<svg class="nav-drop__caret" width="12" height="12" viewBox="0 0 24 24" '
    'fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" '
    'stroke-linejoin="round" aria-hidden="true"><polyline points="6 9 12 15 18 9"></polyline></svg>'
)

# Δουλεύουμε ΜΟΝΟ μέσα στο <nav class="main-nav"> — το ίδιο κείμενο υπάρχει
# και στο footer, και μια αντικατάσταση εκεί θα το χαλούσε.
NAV_BLOCK_RE = re.compile(r'<nav class="main-nav"[^>]*>.*?</nav>', re.DOTALL)

# Ο σύνδεσμος στο header, με ή χωρίς aria-current (championships.html).
NAV_LINK_RE = re.compile(
    r'([ \t]*)<a href="championships\.html"( aria-current="page")?>Πρωταθλήματα</a>'
)

# Το ήδη γραμμένο dropdown, ώστε το script να μπορεί να το ξαναγράψει όταν
# αλλάζουν οι σύνδεσμοι — αλλιώς θα δούλευε μόνο την πρώτη φορά. Το κλείσιμο
# αναγνωρίζεται από την ίδια στοίχιση με το άνοιγμα.
EXISTING_DROP_RE = re.compile(
    r'([ \t]*)<div class="nav-drop" data-nav-drop>.*?\n\1</div>',
    re.DOTALL,
)

SCRIPT_TAG = '<script src="assets/js/nav-champs.js"></script>'


def build_dropdown(indent, current):
    aria_current = ' aria-current="page"' if current else ""
    pad = indent
    lines = [
        f'{pad}<div class="nav-drop" data-nav-drop>',
        f'{pad}  <button type="button" class="nav-drop__btn" aria-expanded="false"'
        f' aria-haspopup="true" aria-controls="nav-drop-champs"{aria_current}>',
        f"{pad}    Πρωταθλήματα{CARET}",
        f"{pad}  </button>",
        f'{pad}  <div class="nav-drop__menu" id="nav-drop-champs" hidden>',
        f'{pad}    <p class="nav-drop__title">Championship Hub</p>',
    ]
    for label, href in HUB_LINKS:
        lines.append(f'{pad}    <a href="{href}">{html.escape(label)}</a>')
    lines += [
        f'{pad}    <div data-nav-champs-group hidden>',
        f'{pad}      <div class="nav-drop__sep"></div>',
        f'{pad}      <p class="nav-drop__title">Τα πρωταθλήματά μας</p>',
        f"{pad}      <div data-nav-champs></div>",
        f"{pad}    </div>",
        f"{pad}  </div>",
        f"{pad}</div>",
    ]
    return "\n".join(lines)


def main():
    changed = []
    missing = []

    for page in sorted(ROOT.glob("*.html")):
        if page.name in SKIP:
            continue

        text = page.read_text(encoding="utf-8")
        original = text

        nav = NAV_BLOCK_RE.search(text)
        if not nav:
            missing.append(page.name + " (χωρίς .main-nav)")
            continue

        block = nav.group(0)
        match = NAV_LINK_RE.search(block)
        existing = EXISTING_DROP_RE.search(block)

        if match:
            indent = match.group(1)
            current = bool(match.group(2))
            start, stop = match.start(), match.end()
        elif existing:
            indent = existing.group(1)
            current = 'aria-current="page"' in existing.group(0)
            start, stop = existing.start(), existing.end()
        else:
            missing.append(page.name)
            continue

        new_block = block[:start] + build_dropdown(indent, current) + block[stop:]
        text = text[: nav.start()] + new_block + text[nav.end() :]

        if SCRIPT_TAG not in text:
            anchor = '<script src="assets/js/main.js"></script>'
            if anchor not in text:
                missing.append(page.name + " (χωρίς main.js)")
                continue
            text = text.replace(anchor, anchor + "\n" + SCRIPT_TAG, 1)

        if text != original:
            page.write_text(text, encoding="utf-8")
            changed.append(page.name)

    print(f"Ενημερώθηκαν {len(changed)} σελίδες: {', '.join(changed) or '—'}")
    if missing:
        print(f"ΠΡΟΣΟΧΗ: {', '.join(missing)}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
