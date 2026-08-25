// Netlify Function: given an article URL, extract candidate Gæstearkiv guests
// (named sources / interview subjects) with a short descriptor, gender/category
// guesses, and best-fit topic tags. Results are a *draft* — the editor reviews
// and edits each candidate in the UI before anything is written to Supabase.

const Anthropic = require('@anthropic-ai/sdk');
const { z } = require('zod');
const { zodOutputFormat } = require('@anthropic-ai/sdk/helpers/zod');

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

const ExtractionSchema = z.object({
  people: z.array(
    z.object({
      name: z.string(),
      descriptor: z.string(),
      gender_guess: z.enum(['mand', 'kvinde', 'ukendt']),
      category_guess: z.enum(['politiker', 'ekspert', 'case', 'pro-deb', 'ukendt']),
      topics: z.array(z.enum(TOPICS)),
    }),
  ),
});

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

  let url;
  try {
    url = JSON.parse(event.body || '{}').url;
  } catch (e) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Ugyldig request' }) };
  }
  if (!url || !/^https?:\/\//i.test(url)) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Mangler en gyldig artikel-URL' }) };
  }

  let articleText;
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
    const response = await client.messages.parse({
      model: 'claude-opus-5',
      max_tokens: 4096,
      output_config: { effort: 'medium', format: zodOutputFormat(ExtractionSchema) },
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

    if (!response.parsed_output) {
      return { statusCode: 502, body: JSON.stringify({ error: 'Kunne ikke tolke svaret fra Claude' }) };
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(response.parsed_output),
    };
  } catch (e) {
    return {
      statusCode: 502,
      body: JSON.stringify({ error: 'Fejl fra Claude API: ' + e.message }),
    };
  }
};
