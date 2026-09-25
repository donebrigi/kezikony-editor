// Supabase Edge Function: ai-proxy
//
// A Kézikönyv Szerkesztő AI funkciói ezen keresztül hívják a Claude API-t, így az
// API kulcs a szerveren marad (titkos változóként), nem kerül a böngészőkbe.
// Csak bejelentkezett felhasználó hívhatja.
//
// Telepítés: a Supabase felületén (Edge Functions → Deploy a new function → Via Editor,
// név: ai-proxy), a titkos kulcs: Edge Functions → Secrets → ANTHROPIC_API_KEY.
// A "Verify JWT with legacy secret" kapcsolót KI kell kapcsolni — a bejelentkezést a
// függvény maga ellenőrzi (lásd lent). Részletek: README → AI.
//
// Opcionális: AI_MODEL titkos változó a modell rögzítéséhez (alapból a klienstől jövő,
// "claude-" kezdetű modellnevet használja).

import { createClient } from 'jsr:@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'Csak POST kérés engedélyezett' }, 405);

  // Csak bejelentkezett felhasználó (érvényes munkamenet-token) használhatja.
  const authHeader = req.headers.get('Authorization') ?? '';
  // (Az új API-kulcsos projekteknél a régi anon kulcs hiányozhat — ilyenkor a service kulccsal
  // ellenőrizzük a felhasználó tokenjét; ez csak a token érvényességét nézi.)
  const key = Deno.env.get('SUPABASE_ANON_KEY') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, key, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user } } = await supabase.auth.getUser(authHeader.replace(/^Bearer\s+/i, ''));
  if (!user) return json({ error: 'Bejelentkezés szükséges' }, 401);

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return json({ error: 'Hibás kérés' }, 400); }
  if (body.ping) return json({ ok: true });

  const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
  if (!apiKey) return json({ error: 'A szerveren nincs beállítva az ANTHROPIC_API_KEY' }, 500);

  const requested = typeof body.model === 'string' && body.model.startsWith('claude-') ? body.model : 'claude-opus-4-5';
  const payload = {
    model: Deno.env.get('AI_MODEL') || requested,
    max_tokens: Math.min(Number(body.max_tokens) || 1024, 8192),
    system: body.system,
    messages: body.messages,
  };

  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify(payload),
  });
  const data = await r.json().catch(() => ({ error: { message: 'Érvénytelen válasz az AI-tól' } }));
  return json(data, r.status);
});
