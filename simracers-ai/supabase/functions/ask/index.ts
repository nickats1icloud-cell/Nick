/*
 * Edge Function "ask" — ο εγκέφαλος του βοηθού.
 *
 * Γιατί υπάρχει: το κλειδί του Claude API ΔΕΝ επιτρέπεται να μπει σε
 * client-side κώδικα. Όποιος άνοιγε το site θα το έβλεπε στο devtools και θα
 * χρεωνόσουν εσύ. Οπότε ο browser μιλάει σε αυτή τη συνάρτηση, και μόνο αυτή
 * — που τρέχει στους servers του Supabase — ξέρει το κλειδί.
 *
 * Ροή μιας ερώτησης:
 *   1. Παίρνουμε το ιστορικό της συζήτησης από τον browser.
 *   2. Ψάχνουμε στη βάση γνώσης τα σχετικά κομμάτια (search_kb).
 *   3. Τα βάζουμε στο system prompt μαζί με τις οδηγίες συμπεριφοράς.
 *   4. Στέλνουμε στον Claude με streaming και προωθούμε τις λέξεις όπως
 *      έρχονται, ώστε ο χρήστης να βλέπει την απάντηση να γράφεται.
 *
 * Deploy:
 *   supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
 *   supabase functions deploy ask --no-verify-jwt
 */

import Anthropic from "npm:@anthropic-ai/sdk@0.115.0";
import { createClient } from "npm:@supabase/supabase-js@2";

const MODEL = "claude-opus-5";

/* Όρια — προστασία από κατάχρηση και από φουσκωμένους λογαριασμούς. */
const MAX_QUESTION_CHARS = 2000;
const MAX_HISTORY_TURNS = 20;
const MAX_CONTEXT_CHUNKS = 12;

/* Το max_tokens μετράει σκέψη ΚΑΙ κείμενο μαζί. Στο claude-opus-5 η σκέψη
   είναι ενεργή από προεπιλογή, οπότε ένα σφιχτό όριο θα έκοβε απαντήσεις
   στη μέση. Με 4096 υπάρχει άνεση — και έτσι κι αλλιώς πληρώνεις μόνο ό,τι
   πραγματικά παράγεται, όχι το όριο. */
const MAX_OUTPUT_TOKENS = 4096;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

/*
 * Το σταθερό κομμάτι του system prompt. Δεν αλλάζει ποτέ μεταξύ ερωτήσεων,
 * γι' αυτό μπαίνει πρώτο και με cache_control: ο Claude το κρατάει στη μνήμη
 * του και δεν το ξαναχρεώνει ολόκληρο σε κάθε μήνυμα.
 */
const SYSTEM_CORE = `Είσαι ο βοηθός της ελληνικής κοινότητας sim racing "Greek SimRacers".
Απαντάς σε οδηγούς που παίζουν κυρίως Le Mans Ultimate, Assetto Corsa Competizione,
iRacing και rFactor 2.

ΓΛΩΣΣΑ
- Απαντάς ΠΑΝΤΑ στα ελληνικά, εκτός αν σου γράψουν σε άλλη γλώσσα.
- Οι αγγλικοί όροι του sim racing (setup, apex, trail braking, downforce, stint,
  slipstream) μένουν στα αγγλικά — έτσι τους λέει ο κόσμος. Μη τους μεταφράζεις
  σε αφύσικα ελληνικά.
- Μιλάς απλά και φιλικά, σαν έμπειρος συνοδηγός. Όχι εγχειρίδιο.

ΠΩΣ ΧΡΗΣΙΜΟΠΟΙΕΙΣ ΤΟ ΥΛΙΚΟ
- Παρακάτω σου δίνονται αποσπάσματα από τη βάση γνώσης της κοινότητας:
  απομαγνητοφωνήσεις από το podcast "Greek SimRacers Podcast", οι κανονισμοί
  των πρωταθλημάτων, και περιεχόμενο από το site.
- Για ερωτήσεις σχετικές με την κοινότητα, το podcast ή τους κανονισμούς:
  απάντα ΜΟΝΟ από τα αποσπάσματα. Μην συμπληρώνεις κενά από μόνος σου.
- Όταν χρησιμοποιείς απόσπασμα, ανάφερε την πηγή μέσα στην πρόταση, φυσικά:
  "στο 3ο επεισόδιο το συζητήσατε αυτό" ή "σύμφωνα με τους κανονισμούς LMU".
- Αν τα αποσπάσματα δεν καλύπτουν την ερώτηση, πες το καθαρά: "Δεν το βρίσκω
  σε όσα έχω από το podcast και τους κανονισμούς". Μετά, αν η ερώτηση είναι
  γενική για sim racing, απάντα από τις γνώσεις σου και ΔΗΛΩΣΕ ότι αυτό είναι
  γενική συμβουλή και όχι κάτι που ειπώθηκε στην κοινότητα.
- ΠΟΤΕ μην εφευρίσκεις αριθμό επεισοδίου, άρθρο κανονισμού, όνομα ή ημερομηνία.
  Καλύτερα "δεν το ξέρω" παρά λάθος πληροφορία.

ΓΕΝΙΚΕΣ ΕΡΩΤΗΣΕΙΣ SIM RACING
- Setup, τεχνική οδήγησης, ρυθμίσεις τιμονιού, force feedback, στρατηγική
  αγώνα: απάντα ελεύθερα από τις γνώσεις σου.
- Δώσε συγκεκριμένα βήματα, όχι θεωρία. Αν κάποιος ρωτάει για understeer,
  πες του τι να αλλάξει και προς ποια κατεύθυνση.
- Αν η απάντηση εξαρτάται από το παιχνίδι, το αυτοκίνητο ή την πίστα, ρώτα
  ποιο είναι — μία ερώτηση, όχι ανάκριση.

ΥΦΟΣ
- Σύντομες απαντήσεις. Μπαίνεις κατευθείαν στο θέμα.
- Λίστες με βήματα όπου βοηθάει, αλλιώς κανονικό κείμενο.
- Χωρίς προλόγους τύπου "Πολύ καλή ερώτηση!" και χωρίς emoji.`;

const anthropic = new Anthropic({
  apiKey: Deno.env.get("ANTHROPIC_API_KEY") ?? "",
});

const supabase = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  // service_role: χρειάζεται για να γράψει στο kb_queries (το RLS το μπλοκάρει
  // για όλους τους άλλους). Μένει στον server, δεν φεύγει ποτέ προς τα έξω.
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
);

/** Ετικέτα πηγής, όπως θα τη δει ο Claude μέσα στο context. */
function labelFor(chunk: KbChunk): string {
  const stamp =
    chunk.start_sec != null
      ? ` @ ${Math.floor(chunk.start_sec / 60)}:${String(chunk.start_sec % 60).padStart(2, "0")}`
      : "";

  switch (chunk.source) {
    case "podcast":
      return `PODCAST — ${chunk.title}${stamp}`;
    case "rules":
      return `ΚΑΝΟΝΙΣΜΟΙ — ${chunk.title}`;
    case "site":
      return `SITE — ${chunk.title}`;
    default:
      return chunk.title;
  }
}

interface KbChunk {
  source: string;
  title: string;
  url: string | null;
  start_sec: number | null;
  content: string;
}

/**
 * Φτιάχνει το κείμενο αναζήτησης. Χρησιμοποιούμε την τελευταία ερώτηση μαζί
 * με την προηγούμενη, γιατί σε συνέχεια συζήτησης το "και στο επόμενο;" δεν
 * λέει τίποτα από μόνο του.
 */
function buildSearchText(messages: { role: string; content: string }[]): string {
  const userTurns = messages.filter((m) => m.role === "user").map((m) => m.content);
  return userTurns.slice(-2).join(" ");
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }

  if (req.method !== "POST") {
    return json({ error: "Χρησιμοποίησε POST." }, 405);
  }

  if (!Deno.env.get("ANTHROPIC_API_KEY")) {
    return json(
      { error: "Λείπει το ANTHROPIC_API_KEY. Τρέξε: supabase secrets set ANTHROPIC_API_KEY=..." },
      500,
    );
  }

  let body: { messages?: { role: string; content: string }[] };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Μη έγκυρο JSON." }, 400);
  }

  /* ---- Έλεγχος εισόδου ---- */

  const incoming = Array.isArray(body.messages) ? body.messages : [];
  const messages = incoming
    .filter(
      (m) =>
        m &&
        (m.role === "user" || m.role === "assistant") &&
        typeof m.content === "string" &&
        m.content.trim().length > 0,
    )
    .slice(-MAX_HISTORY_TURNS)
    .map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content.slice(0, MAX_QUESTION_CHARS),
    }));

  if (messages.length === 0) {
    return json({ error: "Δεν έστειλες ερώτηση." }, 400);
  }
  // Το Claude API απαιτεί το πρώτο μήνυμα να είναι του χρήστη.
  while (messages.length > 0 && messages[0].role !== "user") {
    messages.shift();
  }
  if (messages.length === 0 || messages[messages.length - 1].role !== "user") {
    return json({ error: "Το τελευταίο μήνυμα πρέπει να είναι ερώτηση χρήστη." }, 400);
  }

  /* ---- Αναζήτηση στη βάση γνώσης ---- */

  const searchText = buildSearchText(messages);
  let chunks: KbChunk[] = [];

  const { data, error } = await supabase.rpc("search_kb", {
    query_text: searchText,
    match_limit: MAX_CONTEXT_CHUNKS,
  });

  if (error) {
    // Δεν κόβουμε τη ροή: χωρίς βάση γνώσης ο βοηθός απαντάει ακόμα σε
    // γενικές ερωτήσεις sim racing. Απλά το καταγράφουμε.
    console.error("search_kb απέτυχε:", error.message);
  } else if (Array.isArray(data)) {
    chunks = data as KbChunk[];
  }

  // Καταγραφή για στατιστικά — τι ρωτάει ο κόσμος και τι δεν βρίσκουμε.
  // Δεν την περιμένουμε (θα καθυστερούσε την πρώτη λέξη της απάντησης), αλλά
  // τη δίνουμε στο waitUntil ώστε να μην ακυρωθεί όταν τελειώσει το response.
  const logQuery = supabase
    .from("kb_queries")
    .insert({
      question: messages[messages.length - 1].content,
      hit_count: chunks.length,
    })
    .then(({ error: logError }) => {
      if (logError) console.error("Αποτυχία καταγραφής ερώτησης:", logError.message);
    });

  // @ts-ignore — το EdgeRuntime υπάρχει μόνο στο runtime του Supabase.
  globalThis.EdgeRuntime?.waitUntil?.(logQuery);

  const knowledgeBlock =
    chunks.length > 0
      ? chunks
          .map((c) => `<απόσπασμα πηγή="${labelFor(c)}">\n${c.content}\n</απόσπασμα>`)
          .join("\n\n")
      : "(Δεν βρέθηκαν σχετικά αποσπάσματα για αυτή την ερώτηση.)";

  /* ---- Κλήση στον Claude ---- */

  try {
    const stream = anthropic.messages.stream({
      model: MODEL,
      max_tokens: MAX_OUTPUT_TOKENS,
      // Χαμηλό effort: είναι Q&A πάνω σε δοσμένο υλικό, δεν χρειάζεται βαθιά
      // σκέψη — και θέλουμε γρήγορη απάντηση σε chat.
      output_config: { effort: "low" },
      system: [
        {
          type: "text",
          text: SYSTEM_CORE,
          // Σταθερό κομμάτι → μπαίνει στην cache, ~90% φθηνότερο από τη 2η
          // ερώτηση και μετά.
          cache_control: { type: "ephemeral" },
        },
        {
          type: "text",
          text: `ΑΠΟΣΠΑΣΜΑΤΑ ΑΠΟ ΤΗ ΒΑΣΗ ΓΝΩΣΗΣ\n\n${knowledgeBlock}`,
        },
      ],
      messages,
    });

    const encoder = new TextEncoder();
    const sse = new ReadableStream({
      async start(controller) {
        const send = (event: string, payload: unknown) => {
          controller.enqueue(
            encoder.encode(`event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`),
          );
        };

        try {
          // Πρώτα στέλνουμε τις πηγές, ώστε το UI να τις δείξει αμέσως
          // κάτω από την απάντηση ενώ αυτή ακόμα γράφεται.
          send("sources", {
            sources: chunks.map((c) => ({
              label: labelFor(c),
              source: c.source,
              title: c.title,
              url: c.url,
            })),
          });

          for await (const chunk of stream) {
            if (
              chunk.type === "content_block_delta" &&
              chunk.delta.type === "text_delta"
            ) {
              send("delta", { text: chunk.delta.text });
            }
          }

          const final = await stream.finalMessage();

          if (final.stop_reason === "refusal") {
            send("error", {
              message: "Δεν μπορώ να απαντήσω σε αυτή την ερώτηση.",
            });
          } else if (final.stop_reason === "max_tokens") {
            send("notice", {
              message: "Η απάντηση κόπηκε γιατί ήταν πολύ μεγάλη. Ρώτα κάτι πιο συγκεκριμένο.",
            });
          }

          send("done", { usage: final.usage });
        } catch (err) {
          console.error("Σφάλμα streaming:", err);
          send("error", {
            message: "Κάτι πήγε στραβά με την απάντηση. Δοκίμασε ξανά.",
          });
        } finally {
          controller.close();
        }
      },
    });

    return new Response(sse, {
      headers: {
        ...CORS_HEADERS,
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (err) {
    console.error("Σφάλμα κλήσης Claude:", err);
    const status = (err as { status?: number })?.status;
    if (status === 429) {
      return json({ error: "Πολλές ερωτήσεις αυτή τη στιγμή. Δοκίμασε σε λίγο." }, 429);
    }
    return json({ error: "Ο βοηθός δεν είναι διαθέσιμος αυτή τη στιγμή." }, 502);
  }
});

function json(payload: unknown, status: number): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}
