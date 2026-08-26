// Netlify Function: turn a Debatten manuscript (.txt) into a draft episode plus
// its guests. Like the article extractor, the result is a *proposal* — nothing
// is written to Supabase until the editor approves it in the UI.
//
// The model returns only compact metadata. Pre-interview bodies are attached
// here by matching guest names against the headings in the manuscript's
// "Præinterviews" section, which keeps the model's output small: output tokens
// dominate latency, and Netlify gives a synchronous function 10 seconds.

const Anthropic = require('@anthropic-ai/sdk');

const TOPICS = [
  'Klima & energi',
  'Udlændinge & integration',
  'Sundhed & ældrepleje',
  'Uddannelse',
  'Ligestilling & køn',
  'Digitalisering & tech/AI',
  'Geopolitik',
  'Forsvarspolitik',
  'Business og nationaløkonomi',
  'Dannelse og trivsel',
  'Demokrati og folkestyre',
  'Ulighed',
];
const GENDERS = ['mand', 'kvinde', 'andet'];

const MAX_CHARS = 120000;

const OUTPUT_SCHEMA = {
  type: 'json_schema',
  schema: {
    type: 'object',
    properties: {
      episode: {
        type: 'object',
        properties: {
          date: { type: 'string' },
          title: { type: 'string' },
          desc: { type: 'string' },
          keywords: { type: 'array', items: { type: 'string' } },
          topics: { type: 'array', items: { type: 'string', enum: TOPICS } },
        },
        required: ['date', 'title', 'desc', 'keywords', 'topics'],
        additionalProperties: false,
      },
      guests: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            role: { type: 'string' },
            gender: { type: 'string', enum: GENDERS },
            topics: { type: 'array', items: { type: 'string', enum: TOPICS } },
            havkat: { type: 'integer' },
            havkat_reason: { type: 'string' },
          },
          required: ['name', 'role', 'gender', 'topics', 'havkat', 'havkat_reason'],
          additionalProperties: false,
        },
      },
    },
    required: ['episode', 'guests'],
    additionalProperties: false,
  },
};

const SYSTEM = [
  'Du læser manuskripter til det danske debatprogram "Debatten" og udtrækker udsendelsen og dens gæster.',
  '',
  'UDSENDELSEN:',
  '- date: sendedatoen, som ISO (ÅÅÅÅ-MM-DD). Den står typisk øverst, fx "7. maj 2026".',
  '- title: udsendelsens titel — den korte linje øverst, fx "Besværligt folkestyre?". Programnavnet "debatten" er IKKE titlen. Medtag ikke datoen i titlen.',
  '- desc: afsnittet under overskriften "Programtekst", ordret. Findes det ikke, så skriv en kort beskrivelse ud fra manuskriptet.',
  '- keywords: 3-8 korte emneord på dansk.',
  '- topics: 0-3 fra den faste emneliste.',
  '',
  'GÆSTERNE:',
  '- Medtag alle der deltager i studiet eller medvirker direkte, inklusive dem der kommer ind undervejs (fx under "SUPPLER", "LANCIER" eller et nyt panel).',
  '- Medtag også eksperter der bliver spurgt direkte af værten, også hvis de samtidig passer en liveblog.',
  '- Medtag IKKE værten (Clement Kjersgaard).',
  '- Medtag IKKE personer der kun optræder i arkivklip. De er markeret med fx "ATT", "[KGN: ...]" eller en årstalsangivelse, og bliver ikke stillet spørgsmål i studiet.',
  '- name: personens navn i normal skrivemåde ("Jesper Olsen", ikke "JESPER OLSEN"). Optræder navnet med flere stavemåder, så brug den der ser mest korrekt ud.',
  '- role: titlen som den står i manuskriptet, fx "fhv. formand, Transparency International".',
  '- gender: gæt ud fra navn og kontekst; brug "andet" hvis det er usikkert.',
  '- topics: 0-3 fra listen, ud fra personens fagområde.',
  '- havkat: hvor god en gæst personen er, 1-5. Manuskriptet har ofte en "Vurdering"-linje i præinterview-afsnittet ("Hun er rigtig god!" → 5, "God energi!" → 4, "havde ikke tid til at snakke" → 2) — brug KUN den slags eksplicitte vurderinger. Gæt aldrig ud fra rolle, tone eller andet. Findes der ingen eksplicit vurdering i manuskriptet, så svar 0.',
  '- havkat_reason: den korte sætning fra manuskriptet du baserer vurderingen på. Tom streng hvis havkat er 0.',
  '',
  'Gæt aldrig oplysninger der ikke står i manuskriptet.',
].join('\n');

// ── Name matching ────────────────────────────────────────────────────────────
function norm(s) {
  return String(s == null ? '' : s)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/æ/g, 'ae')
    .replace(/ø/g, 'o')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function levenshtein(a, b) {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 0; i < a.length; i++) {
    const cur = [i + 1];
    for (let j = 0; j < b.length; j++) {
      cur[j + 1] = Math.min(
        prev[j + 1] + 1,
        cur[j] + 1,
        prev[j] + (a[i] === b[j] ? 0 : 1),
      );
    }
    prev = cur;
  }
  return prev[b.length];
}

// Tolerates the spelling drift that shows up inside a single manuscript
// (e.g. "SVEISTRUP" in the panel list, "Svejstrup" over the pre-interview).
function namesMatch(a, b) {
  const x = norm(a), y = norm(b);
  if (!x || !y) return false;
  if (x === y || x.includes(y) || y.includes(x)) return true;
  const xs = x.split(' '), ys = y.split(' ');
  const surnameClose =
    xs.length > 1 && ys.length > 1 &&
    levenshtein(xs[xs.length - 1], ys[ys.length - 1]) <= 2 &&
    levenshtein(xs[0], ys[0]) <= 2;
  return surnameClose || levenshtein(x, y) <= 2;
}

// ── Pre-interview extraction ─────────────────────────────────────────────────
// Slices the "Præinterviews" section into per-guest blocks. Deterministic on
// purpose: the bodies are long, and round-tripping them through the model would
// blow up both latency and cost for no gain.
function extractPreinterviews(text, guestNames) {
  const lines = text.split('\n');
  let start = -1;
  for (let i = 0; i < lines.length; i++) {
    if (/^\s*præinterviews?\s*$/i.test(lines[i].replace(/_/g, '').trim())) { start = i + 1; break; }
  }
  if (start === -1) return { blocks: {}, unmatchedHeadings: [] };

  // A heading is a short line that matches one of the guests we know about.
  const marks = [];
  for (let i = start; i < lines.length; i++) {
    const raw = lines[i].trim().replace(/^_+|_+$/g, '').trim();
    if (!raw || raw.length > 60) continue;
    if (/[.:?!]$/.test(raw) && raw.split(/\s+/).length > 4) continue;
    const hit = guestNames.find((n) => namesMatch(n, raw));
    if (hit) marks.push({ line: i, guest: hit, heading: raw });
  }

  const blocks = {};
  marks.forEach((m, idx) => {
    const end = idx + 1 < marks.length ? marks[idx + 1].line : lines.length;
    const body = lines.slice(m.line + 1, end).join('\n')
      .replace(/\n{3,}/g, '\n\n')
      .replace(/^[\s_]+|[\s_]+$/g, '')
      .trim();
    if (!body) return;
    // Same guest can be marked twice; keep the longest block.
    if (!blocks[m.guest] || body.length > blocks[m.guest].length) blocks[m.guest] = body;
  });

  // Headings in the section that matched nobody — usually a guest the model
  // missed, so surface them rather than dropping them silently.
  const unmatchedHeadings = [];
  for (let i = start; i < lines.length; i++) {
    const raw = lines[i].trim().replace(/^_+|_+$/g, '').trim();
    if (!raw || raw.length > 40) continue;
    if (guestNames.some((n) => namesMatch(n, raw))) continue;
    // Must read like a person's name: two to four capitalised words, no comma
    // — otherwise job titles under a heading ("Chefrådgiver, LA") get flagged.
    const words = raw.split(/\s+/);
    if (words.length < 2 || words.length > 4) continue;
    if (raw.includes(',')) continue;
    if (!words.every((w) => /^[A-ZÆØÅ][a-zæøåA-ZÆØÅ'\-]*$/.test(w))) continue;
    if (/^(vurdering|research|programtekst)/i.test(raw)) continue;
    if (!unmatchedHeadings.includes(raw)) unmatchedHeadings.push(raw);
  }

  return { blocks, unmatchedHeadings };
}

// Contact details sitting loose in the manuscript, near a guest's block.
function findPhones(text, guestNames) {
  const lines = text.split('\n');
  const out = {};
  let current = null;
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i].trim();
    if (raw && raw.length <= 60) {
      const hit = guestNames.find((n) => namesMatch(n, raw.replace(/^_+|_+$/g, '').trim()));
      if (hit) { current = hit; continue; }
    }
    if (!current) continue;
    const m = raw.match(/^(?:\+45[\s]?)?((?:\d[\s]?){8})$/);
    if (m) { if (!out[current]) out[current] = raw; }
  }
  return out;
}

function sanitizeGuest(g) {
  const hk = Number(g && g.havkat);
  return {
    name: String((g && g.name) || '').trim().slice(0, 200),
    role: String((g && g.role) || '').trim().slice(0, 300),
    gender: GENDERS.includes(g && g.gender) ? g.gender : 'andet',
    topics: Array.isArray(g && g.topics) ? g.topics.filter((t) => TOPICS.includes(t)).slice(0, 3) : [],
    havkat: Number.isFinite(hk) && hk >= 1 && hk <= 5 ? Math.round(hk) : null,
    havkatReason: String((g && g.havkat_reason) || '').trim().slice(0, 300),
  };
}

exports.handler = async function (event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  let text, filename;
  try {
    const body = JSON.parse(event.body || '{}');
    text = typeof body.text === 'string' ? body.text : '';
    filename = String(body.filename || '');
  } catch (e) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Ugyldig request' }) };
  }
  if (text.trim().length < 200) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Filen er tom eller for kort til at være et manuskript' }) };
  }
  if (text.length > MAX_CHARS) {
    return {
      statusCode: 413,
      body: JSON.stringify({ error: 'Manuskriptet er for stort (' + Math.round(text.length / 1000) + ' KB, maks ' + MAX_CHARS / 1000 + ' KB)' }),
    };
  }

  let parsed;
  try {
    const client = new Anthropic();
    const response = await client.messages.create({
      model: 'claude-opus-5',
      max_tokens: 4096,
      output_config: { effort: 'low', format: OUTPUT_SCHEMA },
      system: SYSTEM,
      messages: [{
        role: 'user',
        content: (filename ? 'Filnavn: ' + filename + '\n\n' : '') + 'Manuskript:\n\n' + text,
      }],
    });

    const block = response.content.find((b) => b.type === 'text');
    if (!block) return { statusCode: 502, body: JSON.stringify({ error: 'Intet svar fra Claude' }) };
    parsed = JSON.parse(block.text);
  } catch (e) {
    return { statusCode: 502, body: JSON.stringify({ error: 'Fejl fra Claude API: ' + e.message }) };
  }

  const ep = parsed.episode || {};
  const guests = (Array.isArray(parsed.guests) ? parsed.guests : []).map(sanitizeGuest).filter((g) => g.name);

  const names = guests.map((g) => g.name);
  const { blocks, unmatchedHeadings } = extractPreinterviews(text, names);
  const phones = findPhones(text, names);

  guests.forEach((g) => {
    g.preinterview = blocks[g.name] || '';
    g.phone = phones[g.name] || '';
  });

  // Guests whose names are near-identical are usually one person written two
  // ways; flag the pair rather than quietly creating two cards.
  const similar = [];
  for (let i = 0; i < guests.length; i++) {
    for (let j = i + 1; j < guests.length; j++) {
      if (norm(guests[i].name) !== norm(guests[j].name) && namesMatch(guests[i].name, guests[j].name)) {
        similar.push([guests[i].name, guests[j].name]);
      }
    }
  }

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      episode: {
        date: String(ep.date || '').slice(0, 10),
        title: String(ep.title || '').trim().slice(0, 300),
        desc: String(ep.desc || '').trim().slice(0, 4000),
        keywords: Array.isArray(ep.keywords) ? ep.keywords.map((k) => String(k).trim()).filter(Boolean).slice(0, 12) : [],
        topics: Array.isArray(ep.topics) ? ep.topics.filter((t) => TOPICS.includes(t)).slice(0, 3) : [],
      },
      guests,
      warnings: { similarNames: similar, unmatchedHeadings: unmatchedHeadings.slice(0, 10) },
    }),
  };
};

// Exposed for tests — the name matching and pre-interview slicing carry the
// logic worth checking without spending a model call.
exports._internals = { norm, namesMatch, extractPreinterviews, findPhones, sanitizeGuest };
