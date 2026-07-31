#!/usr/bin/env node
/*
 * Φορτώνει τα αρχεία του φακέλου knowledge/ στη βάση γνώσης του Supabase.
 *
 * Τρέξιμο:
 *   SUPABASE_URL=https://xxxx.supabase.co \
 *   SUPABASE_SERVICE_ROLE_KEY=eyJ... \
 *   node scripts/ingest.mjs
 *
 * Το service_role key το βρίσκεις στο Supabase Dashboard → Project Settings →
 * API. ΠΡΟΣΟΧΗ: είναι μυστικό — μην το βάλεις ποτέ σε αρχείο που ανεβαίνει
 * στο GitHub και μην το χρησιμοποιήσεις σε κώδικα του browser.
 *
 * Δεν χρειάζεται npm install: μιλάει απευθείας στο REST API του Supabase.
 *
 * Το script είναι idempotent — μπορείς να το τρέξεις όσες φορές θες. Κάθε
 * φορά σβήνει και ξαναγράφει τα chunks της κάθε πηγής, οπότε αν διορθώσεις
 * ένα transcript, απλά ξανατρέχεις.
 */

import { readdir, readFile } from "node:fs/promises";
import { join, relative, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const KNOWLEDGE_DIR = join(ROOT, "knowledge");

/* Στόχος μεγέθους ανά chunk. Αρκετά μεγάλο για να έχει νόημα από μόνο του,
   αρκετά μικρό ώστε να μη γεμίζουμε το context με άσχετα. */
const TARGET_CHARS = 1200;
const MAX_CHARS = 1800;

const SUPABASE_URL = process.env.SUPABASE_URL?.replace(/\/+$/, "");
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error(
    "Λείπουν οι μεταβλητές SUPABASE_URL και SUPABASE_SERVICE_ROLE_KEY.\n" +
      "Παράδειγμα:\n" +
      "  SUPABASE_URL=https://xxxx.supabase.co SUPABASE_SERVICE_ROLE_KEY=eyJ... node scripts/ingest.mjs",
  );
  process.exit(1);
}

/* ---------- Ανάγνωση αρχείων ---------- */

/** Μαζεύει αναδρομικά όλα τα .md του knowledge/. */
async function collectMarkdown(dir) {
  const found = [];
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return found;
  }
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) found.push(...(await collectMarkdown(full)));
    else if (entry.name.endsWith(".md") && !entry.name.startsWith("_")) found.push(full);
  }
  return found.sort();
}

/**
 * Διαβάζει το μπλοκ μεταδεδομένων στην κορυφή του αρχείου:
 *
 *   ---
 *   source: podcast
 *   title: Επεισόδιο 3 — Το πρώτο μας πρωτάθλημα
 *   url: https://open.spotify.com/episode/...
 *   ---
 */
function parseFrontMatter(raw) {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!match) return { meta: {}, body: raw };

  const meta = {};
  for (const line of match[1].split(/\r?\n/)) {
    const pair = line.match(/^([a-zA-Z_]+)\s*:\s*(.*)$/);
    if (pair) meta[pair[1].toLowerCase()] = pair[2].trim();
  }
  return { meta, body: raw.slice(match[0].length) };
}

/*
 * Πετάει τα σχόλια HTML. Είναι σημειώσεις προς εσένα ("συμπλήρωσε εδώ…"),
 * όχι γνώση — αν έμπαιναν στη βάση, ο βοηθός θα απαντούσε με οδηγίες
 * συμπλήρωσης αντί για το περιεχόμενο.
 */
function stripComments(body) {
  return body.replace(/<!--[\s\S]*?-->/g, "");
}

/** "12:34" ή "1:02:33" → δευτερόλεπτα. */
function timestampToSeconds(stamp) {
  const parts = stamp.split(":").map(Number);
  if (parts.some(Number.isNaN)) return null;
  return parts.reduce((total, part) => total * 60 + part, 0);
}

/**
 * Σπάει το κείμενο σε chunks. Σέβεται τις παραγράφους (δεν κόβει πρόταση
 * στη μέση) και κρατάει την τρέχουσα επικεφαλίδα ως πρόθεμα, ώστε κάθε
 * chunk να βγάζει νόημα ακόμα κι όταν διαβαστεί μόνο του.
 */
function chunkText(body) {
  const paragraphs = body
    .split(/\r?\n\s*\r?\n/)
    .map((p) => p.trim())
    .filter(Boolean);

  const chunks = [];
  let heading = null;
  let buffer = [];
  let bufferLength = 0;
  let startSec = null;

  const flush = () => {
    if (!buffer.length) return;
    const text = buffer.join("\n\n");
    chunks.push({
      content: heading ? `${heading}\n\n${text}` : text,
      start_sec: startSec,
    });
    buffer = [];
    bufferLength = 0;
    startSec = null;
  };

  for (const paragraph of paragraphs) {
    /* Επικεφαλίδα: κλείνει το προηγούμενο chunk και γίνεται το νέο πρόθεμα. */
    const headingMatch = paragraph.match(/^#{1,4}\s+(.*)$/);
    if (headingMatch) {
      flush();
      heading = headingMatch[1].trim();
      continue;
    }

    /* Πρώτη χρονική σήμανση του chunk, π.χ. "[12:34]" ή "(1:02:33)". */
    if (startSec === null) {
      const stamp = paragraph.match(/[[(](\d{1,2}:\d{2}(?::\d{2})?)[\])]/);
      if (stamp) startSec = timestampToSeconds(stamp[1]);
    }

    /* Μια πολύ μεγάλη παράγραφος γίνεται δικό της chunk αντί να φουσκώσει
       το τρέχον πέρα από το όριο. */
    if (bufferLength + paragraph.length > MAX_CHARS && buffer.length) {
      flush();
    }

    buffer.push(paragraph);
    bufferLength += paragraph.length + 2;

    if (bufferLength >= TARGET_CHARS) flush();
  }

  flush();
  return chunks;
}

/* ---------- Supabase REST ---------- */

async function supabaseRequest(path, options = {}) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
      ...options.headers,
    },
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Supabase ${response.status}: ${detail || response.statusText}`);
  }
  return response;
}

/* ---------- Κύρια ροή ---------- */

const files = await collectMarkdown(KNOWLEDGE_DIR);

if (files.length === 0) {
  console.error(
    `Δεν βρέθηκε κανένα .md στο ${relative(ROOT, KNOWLEDGE_DIR)}/.\n` +
      "Πρόσθεσε τα transcripts και τους κανονισμούς εκεί και ξανατρέξε.",
  );
  process.exit(1);
}

let totalChunks = 0;
let skipped = 0;

for (const file of files) {
  const shortPath = relative(ROOT, file);
  const raw = await readFile(file, "utf8");
  const { meta, body } = parseFrontMatter(raw);

  const source = meta.source ?? "general";
  const title = meta.title ?? shortPath;

  if (!["podcast", "rules", "site", "general"].includes(source)) {
    console.warn(`⚠  ${shortPath}: άγνωστο source "${source}" — το προσπερνάω.`);
    skipped += 1;
    continue;
  }

  const chunks = chunkText(stripComments(body));
  if (chunks.length === 0) {
    console.warn(`⚠  ${shortPath}: άδειο αρχείο — το προσπερνάω.`);
    skipped += 1;
    continue;
  }

  /* Καθαρίζουμε τα παλιά chunks αυτής της πηγής πριν γράψουμε τα νέα.
     Ο τίτλος μπαίνει σε διπλά εισαγωγικά: το PostgREST μεταχειρίζεται το
     κόμμα ως διαχωριστικό τιμών, οπότε ένας τίτλος τύπου
     "Επεισόδιο 3, μέρος Β" θα έσπαγε το φίλτρο και θα έσβηνε λάθος γραμμές. */
  const quotedTitle = `"${title.replaceAll('\\', '\\\\').replaceAll('"', '\\"')}"`;
  const filter =
    `source=eq.${encodeURIComponent(source)}` +
    `&title=eq.${encodeURIComponent(quotedTitle)}`;
  await supabaseRequest(`kb_chunks?${filter}`, { method: "DELETE" });

  const rows = chunks.map((chunk, index) => ({
    source,
    title,
    url: meta.url || null,
    ordinal: index,
    start_sec: chunk.start_sec,
    content: chunk.content,
  }));

  /* Σε παρτίδες, για να μη σκάσει το αίτημα σε μεγάλα transcripts. */
  for (let i = 0; i < rows.length; i += 100) {
    await supabaseRequest("kb_chunks", {
      method: "POST",
      body: JSON.stringify(rows.slice(i, i + 100)),
    });
  }

  totalChunks += chunks.length;
  console.log(`✓  ${shortPath} → ${chunks.length} chunks  [${source}]`);
}

console.log(
  `\nΈτοιμο: ${totalChunks} chunks από ${files.length - skipped} αρχεία.` +
    (skipped ? ` (${skipped} προσπεράστηκαν)` : ""),
);
