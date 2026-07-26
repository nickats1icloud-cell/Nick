#!/usr/bin/env python3
"""Συγχρονίζει τα εικονίδια κοινωνικών δικτύων στο footer όλων των σελίδων.

Το site είναι στατικό HTML χωρίς build step, οπότε το footer επαναλαμβάνεται
σε κάθε σελίδα. Αντί να αλλάζουμε 17 αρχεία στο χέρι κάθε φορά που μπαίνει
ένα καινούργιο κανάλι, κρατάμε τη λίστα εδώ και ξαναγράφουμε το μπλοκ:

    python3 tools/sync-footer-socials.py

Τα σχήματα των εικονιδίων ζουν σε ΕΝΑ αρχείο, το assets/icons.json. Εδώ
γράφονται ως <symbol> μία φορά ανά σελίδα και κάθε σύνδεσμος τα δείχνει με
<use>. Έτσι δεν επαναλαμβάνεται κανένα path — και τα εικονίδια φαίνονται
κανονικά ακόμη και χωρίς JavaScript.

Για να προστεθεί δίκτυο: μια εγγραφή στο NETWORKS (το εικονίδιο υπάρχει ήδη
στο icons.json για Instagram, TikTok, Twitch και X) και ξανατρέξε το script.
"""

import json
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
ICONS = json.loads((ROOT / "assets" / "icons.json").read_text(encoding="utf-8"))

# Η offline.html είναι σκόπιμα λιτή: χωρίς μενού και χωρίς footer.
SKIP = {"offline.html"}

# (ετικέτα, κλειδί εικονιδίου στο icons.json, url).
# Η σειρά εδώ είναι και η σειρά στο footer.
NETWORKS = [
    ("Discord", "discord", "https://discord.gg/v5RsBTnPpY"),
    ("YouTube", "youtube", "https://www.youtube.com/@GreekSimracers"),
    ("Facebook", "facebook", "https://www.facebook.com/groups/greeksimracers"),
    ("Spotify", "spotify", "https://open.spotify.com/show/62c9vN8ZOT4unAzzJmtOXD"),
    # Έτοιμα — λείπει μόνο το πραγματικό URL:
    # ("Instagram", "instagram", "https://www.instagram.com/…"),
    # ("TikTok", "tiktok", "https://www.tiktok.com/@…"),
    # ("Twitch", "twitch", "https://www.twitch.tv/…"),
    # ("X", "x", "https://x.com/…"),
]

# Πιάνει και το σωστό <div class="footer-socials"> και τα παλιά inline-styled
# div που είχαν μείνει σε μερικές σελίδες — όλα ξαναγράφονται με την κλάση.
BLOCK_RE = re.compile(
    r'([ \t]*)<div[^>]*class="footer-socials"[^>]*>.*?</div>'
    r'|([ \t]*)<div[^>]*>\s*(?:<a\b[^>]*class="social-icon"[^>]*>.*?</a>\s*)+</div>',
    re.DOTALL,
)

# Το μπλοκ με τα <symbol>, ακριβώς πριν το </body>.
DEFS_RE = re.compile(r'[ \t]*<svg class="icon-defs".*?</svg>\n', re.DOTALL)


def build_block(indent):
    lines = [f'{indent}<div class="footer-socials">']
    for label, icon, url in NETWORKS:
        lines.append(
            f'{indent}  <a href="{url}" target="_blank" rel="noopener noreferrer" '
            f'aria-label="{label}" class="social-icon">'
        )
        lines.append(
            f'{indent}    <svg class="social-icon__glyph" width="18" height="18" '
            f'aria-hidden="true"><use href="#gsr-icon-{icon}"></use></svg>'
        )
        lines.append(f"{indent}  </a>")
    lines.append(f"{indent}</div>")
    return "\n".join(lines)


def build_defs():
    symbols = "".join(
        f'<symbol id="gsr-icon-{icon}" viewBox="0 0 24 24">'
        f'<path fill="currentColor" d="{ICONS[icon]}"/></symbol>'
        for _, icon, _ in NETWORKS
    )
    return f'<svg class="icon-defs" aria-hidden="true" focusable="false">{symbols}</svg>\n'


def main():
    changed = []
    missing = []

    for page in sorted(ROOT.glob("*.html")):
        if page.name in SKIP:
            continue

        text = page.read_text(encoding="utf-8")
        original = text

        match = BLOCK_RE.search(text)
        if not match:
            missing.append(page.name)
            continue

        indent = match.group(1) if match.group(1) is not None else match.group(2)
        text = text[: match.start()] + build_block(indent) + text[match.end() :]

        # Τα symbols μπαίνουν μία φορά, στο τέλος του body.
        text = DEFS_RE.sub("", text)
        if "</body>" in text:
            text = text.replace("</body>", build_defs() + "</body>", 1)
        else:
            missing.append(page.name + " (χωρίς </body>)")
            continue

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
