#!/usr/bin/env python3
"""Συγχρονίζει το dropdown «Πρωταθλήματα» του κύριου μενού σε όλες τις σελίδες.

Ίδια λογική με το sync-footer-socials.py: το site είναι στατικό HTML χωρίς
build step, οπότε το header επαναλαμβάνεται σε κάθε αρχείο. Η δομή του
dropdown ορίζεται μία φορά εδώ και γράφεται παντού:

    python3 tools/sync-nav.py

Αντικαθιστά **μόνο** τον σύνδεσμο μέσα στο <nav class="main-nav">, όχι τους
συνδέσμους του footer ή του κειμένου.
"""

import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent

# Ενότητες του Championship Hub. Μπαίνουν εδώ όσο χτίζονται οι σελίδες τους —
# προς το παρόν δείχνουν στις ενότητες της championships.html ώστε να μην
# υπάρχει ούτε ένας νεκρός σύνδεσμος.
HUB_LINKS = [
    ("Όλα τα πρωταθλήματα", "championships.html"),
    ("Βαθμολογίες", "championships.html#championships"),
    ("Στατιστικά", "championships.html#championships-stats"),
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
        lines.append(f'{pad}    <a href="{href}">{label}</a>')
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
        text = page.read_text(encoding="utf-8")
        original = text

        nav = NAV_BLOCK_RE.search(text)
        if not nav:
            missing.append(page.name + " (χωρίς .main-nav)")
            continue

        block = nav.group(0)
        match = NAV_LINK_RE.search(block)
        if match:
            indent = match.group(1)
            current = bool(match.group(2))
            new_block = (
                block[: match.start()] + build_dropdown(indent, current) + block[match.end() :]
            )
            text = text[: nav.start()] + new_block + text[nav.end() :]
        elif "data-nav-drop" not in block:
            missing.append(page.name)
            continue

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
