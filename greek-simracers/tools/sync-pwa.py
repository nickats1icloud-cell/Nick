#!/usr/bin/env python3
"""Δηλώνει το PWA (manifest, theme-color, apple meta) σε όλες τις σελίδες.

    python3 tools/sync-pwa.py

Η εγγραφή του service worker γίνεται από το assets/js/pwa.js, που φορτώνεται
μαζί με το main.js. Το offline.html μένει εκτός: είναι η σελίδα που δείχνει ο
service worker και δεν χρειάζεται να εγγράψει τον εαυτό της.
"""

import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
SKIP = {"offline.html"}

BLOCK = """  <!-- PWA: εγκαταστάσιμη εφαρμογή με offline εναλλακτική -->
  <link rel="manifest" href="manifest.webmanifest">
  <meta name="theme-color" content="#090d15">
  <meta name="apple-mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
  <meta name="apple-mobile-web-app-title" content="GSR Hub">
  <link rel="apple-touch-icon" href="assets/images/icon-192.png">
"""

BLOCK_RE = re.compile(r"[ \t]*<!-- PWA:.*?<link rel=\"apple-touch-icon\"[^>]*>\n", re.DOTALL)
SCRIPT_TAG = '<script src="assets/js/pwa.js"></script>'


def main():
    changed = []
    missing = []

    for page in sorted(ROOT.glob("*.html")):
        if page.name in SKIP:
            continue

        text = page.read_text(encoding="utf-8")
        original = text

        text = BLOCK_RE.sub("", text)
        if "</head>" not in text:
            missing.append(page.name + " (χωρίς </head>)")
            continue
        text = text.replace("</head>", BLOCK + "</head>", 1)

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
