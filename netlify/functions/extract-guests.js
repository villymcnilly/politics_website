// Netlify Function: given an article URL, extract candidate Gæstearkiv guests
// (named sources / interview subjects) with a short descriptor, gender/category
// guesses, and best-fit topic tags. Results are a *draft* — the editor reviews
// and edits each candidate in the UI before anything is written to Supabase.

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
];
const GENDERS = ['mand', 'kvinde', 'ukendt'];
const CATEGORIES = ['politiker', 'ekspert', 'case', 'pro-deb', 'ukendt'];

// Hand-written JSON Schema rather than the SDK's zodOutputFormat() helper —
// that helper currently mis-serializes z.enum() (dumps the enum into a
// stringified `description` instead of a real `enum` array) with the
// installed Zod version, so enum constraints silently didn't apply.
const OUTPUT_SCHEMA = {
  type: 'json_schema',
  schema: {
    type: 'object',
    properties: {
      people: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            descriptor: { type: 'string' },
            gender_guess: { type: 'string', enum: GENDERS },
            category_guess: { type: 'string', enum: CATEGORIES },
            topics: { type: 'array', items: { type: 'string', enum: TOPICS } },
          },
          required: ['name', 'descriptor', 'gender_guess', 'category_guess', 'topics'],
          additionalProperties: false,
        },
      },
    },
    required: ['people'],
    additionalProperties: false,
  },
};

function sanitizePerson(p) {
  return {
    name: String((p && p.name) || '').slice(0, 200),
    descriptor: String((p && p.descriptor) || '').slice(0, 300),
    gender_guess: GENDERS.includes(p && p.gender_guess) ? p.gender_guess : 'ukendt',
    category_guess: CATEGORIES.includes(p && p.category_guess) ? p.category_guess : 'ukendt',
    topics: Array.isArray(p && p.topics) ? p.topics.filter((t) => TOPICS.includes(t)).slice(0, 3) : [],
  };
}

function decodeEntities(s) {
  return String(s)
    .replace(/&nbsp;/gi, ' ')
    .replace(/&#(\d+);/g, function (_, n) { return String.fromCharCode(parseInt(n, 10)); })
    .replace(/&#x([0-9a-f]+);/gi, function (_, n) { return String.fromCharCode(parseInt(n, 16)); })
    .replace(/&quot;/gi, '"')
    .replace(/&apos;|&#39;/gi, "'")
    .replace(/&lsquo;|&rsquo;/gi, "'")
    .replace(/&ldquo;|&rdquo;/gi, '"')
    .replace(/&ndash;/gi, '–')
    .replace(/&mdash;/gi, '—')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&amp;/gi, '&');
}

// The article's headline, preferring og:title (usually the clean headline)
// over <title> (often carries a " | Site name" suffix).
function extractTitle(html) {
  var og =
    html.match(/<meta[^>]+property=["']og:title["'][^>]*content=["']([^"']*)["']/i) ||
    html.match(/<meta[^>]+content=["']([^"']*)["'][^>]+property=["']og:title["']/i);
  if (og && og[1].trim()) return decodeEntities(og[1]).replace(/\s+/g, ' ').trim().slice(0, 300);

  var t = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (t && t[1].trim()) {
    var title = decodeEntities(t[1]).replace(/\s+/g, ' ').trim();
    // Drop a trailing " | Site" / " – Site" suffix when there's a real headline left.
    var trimmed = title.replace(/\s*[|–—]\s*[^|–—]{2,40}$/, '').trim();
    return (trimmed.length >= 15 ? trimmed : title).slice(0, 300);
  }
  return '';
}

function stripHtml(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&[a-z]+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

exports.handler = async function (event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  let url, titleOnly;
  try {
    const body = JSON.parse(event.body || '{}');
    url = body.url;
    titleOnly = body.titleOnly === true;
  } catch (e) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Ugyldig request' }) };
  }
  if (!url || !/^https?:\/\//i.test(url)) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Mangler en gyldig artikel-URL' }) };
  }

  let articleText, articleTitle;
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
      },
      redirect: 'follow',
    });
    if (!res.ok) {
      return {
        statusCode: 502,
        body: JSON.stringify({ error: 'Kunne ikke hente artiklen (status ' + res.status + ')' }),
      };
    }
    const html = await res.text();
    articleTitle = extractTitle(html);

    // A manual link only needs the headline — skip the model call entirely.
    if (titleOnly) {
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ articleTitle: articleTitle }),
      };
    }

    articleText = stripHtml(html).slice(0, 20000);
    if (articleText.length < 200) {
      return {
        statusCode: 422,
        body: JSON.stringify({ error: 'Kunne ikke finde nok tekst på siden — måske kræver den login eller er JS-genereret' }),
      };
    }
  } catch (e) {
    return {
      statusCode: 502,
      body: JSON.stringify({ error: 'Kunne ikke hente artiklen: ' + e.message }),
    };
  }

  try {
    const client = new Anthropic();
    const response = await client.messages.create({
      model: 'claude-opus-5',
      max_tokens: 4096,
      output_config: { effort: 'medium', format: OUTPUT_SCHEMA },
      system:
        'Du analyserer danske nyhedsartikler for at finde potentielle gæster til en politisk debat-podcast. ' +
        'Find hver navngivet person i artiklen der er en kilde, citeret, interviewet, eller som artiklen handler om — ikke journalisten/bylinen. ' +
        'For hver person: navn, en kort ét-linje beskrivelse af hvem de er (fx "kvindelig studerende, klimaaktivist" eller "sundhedsminister, Socialdemokratiet") baseret KUN på hvad artiklen faktisk siger — opfind ikke detaljer der ikke fremgår. ' +
        'Gæt køn og kategori ud fra navn/kontekst (brug "ukendt" hvis det er for usikkert). ' +
        'Vælg 0-3 emner fra den faste liste der passer bedst til personens rolle/ekspertise — vælg ingen hvis intet passer godt. ' +
        'Returnér en tom liste hvis der ingen relevante personer er.',
      messages: [
        {
          role: 'user',
          content: 'Artikeltekst:\n\n' + articleText,
        },
      ],
    });

    const textBlock = response.content.find((b) => b.type === 'text');
    if (!textBlock) {
      return { statusCode: 502, body: JSON.stringify({ error: 'Intet svar fra Claude' }) };
    }

    let parsed;
    try {
      parsed = JSON.parse(textBlock.text);
    } catch (e) {
      return { statusCode: 502, body: JSON.stringify({ error: 'Kunne ikke tolke svaret fra Claude' }) };
    }

    const people = Array.isArray(parsed.people) ? parsed.people.map(sanitizePerson) : [];

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ people, articleTitle: articleTitle }),
    };
  } catch (e) {
    return {
      statusCode: 502,
      body: JSON.stringify({ error: 'Fejl fra Claude API: ' + e.message }),
    };
  }
};
