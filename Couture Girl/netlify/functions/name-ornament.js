// Writes names and descriptions for the Studio. The API key stays on the server,
// never in the page, so it cannot be copied by anyone visiting the site.
const MODEL = 'claude-sonnet-4-5';

const TONES = {
  Romantic: 'warm and a little poetic — soft imagery, never flowery to the point of silliness',
  Minimal: 'clean and understated — short, confident, modern, no ornate language',
  Traditional: 'rooted in Indian craft vocabulary — refer to jhumkas, kundan, meenakari, temple work where the photo supports it'
};

exports.handler = async function (event) {
  const cors = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  };
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: cors, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers: cors, body: '{"error":"Use POST."}' };

  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    return { statusCode: 200, headers: cors, body: JSON.stringify({
      error: 'The naming helper is not switched on yet. In Netlify open Site configuration → Environment variables and add ANTHROPIC_API_KEY, then redeploy.' }) };
  }

  let body;
  try { body = JSON.parse(event.body || '{}'); } catch (e) {
    return { statusCode: 200, headers: cors, body: '{"error":"Could not read the photo that was sent."}' };
  }
  const image = String(body.image || '').replace(/^data:[^,]+,/, '');
  if (!image) return { statusCode: 200, headers: cors, body: '{"error":"No photo was sent."}' };

  const tone = TONES[body.tone] || TONES.Romantic;
  const notes = String(body.notes || '').slice(0, 400).trim();
  const cats = Array.isArray(body.cats) && body.cats.length ? body.cats.join(', ') : 'Earrings, Necklaces, Bracelets, Rings';
  const stones = Array.isArray(body.stones) && body.stones.length ? body.stones.join(', ') : 'Crystal, Rose, Amethyst';

  const system = 'You name and describe handmade jewellery for a small Indian online boutique called Couture Girl. '
    + 'Voice: ' + tone + '. '
    + 'Judge only what you can actually see in the photo — never invent a stone, metal or technique you cannot see. '
    + 'Names are two or three words, no numbers, no "elegant"/"exquisite"/"stunning", never the word Couture. '
    + (notes ? 'The owner adds: ' + notes + '. ' : '')
    + 'Reply with JSON only, no prose, no code fence, exactly: '
    + '{"names":["","",""],"short":"","story":"","category":"","stone":"","metal":""} — '
    + 'short is one sentence under 18 words for a shop card; story is two or three sentences a customer reads on the product page; '
    + 'category must be exactly one of: ' + cats + '; stone must be exactly one of: ' + stones + ' (pick the closest visible colour); '
    + 'metal is the visible finish and materials, like "18k gold-plated brass · cubic zirconia".';

  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 900,
        system: system,
        messages: [{ role: 'user', content: [
          { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: image } },
          { type: 'text', text: 'Name and describe this piece.' }
        ] }]
      })
    });
    const j = await r.json();
    if (!r.ok) {
      const m = (j && j.error && j.error.message) || ('Naming service returned ' + r.status + '.');
      return { statusCode: 200, headers: cors, body: JSON.stringify({ error: m }) };
    }
    const text = (j.content || []).map(c => c.text || '').join('');
    return { statusCode: 200, headers: cors, body: JSON.stringify({ text: text }) };
  } catch (e) {
    return { statusCode: 200, headers: cors, body: JSON.stringify({ error: 'Could not reach the naming service. Try again in a moment.' }) };
  }
};
