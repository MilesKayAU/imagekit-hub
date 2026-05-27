// Edge function: imagekit-analyze-video  (BYOK ONLY — never uses Lovable AI)
// Deploy to the ReadyCode Lovable project (NOT this repo).
//
// Resolves the caller's BYOK provider from the ai_providers table and uses
// THEIR key to ask a video-capable model to watch a YouTube / Shorts URL and
// emit the storyboard JSON the Chrome extension expects.
//
// Supported provider types:
//   • OpenRouter             (endpoint hostname ends with openrouter.ai)
//   • Google AI Studio direct (endpoint hostname is generativelanguage.googleapis.com)
//
// Anything else, any upstream failure, or any unsupported platform returns
// `{ fallback: "text_only", reason }` so the extension transparently falls
// back to the existing `imagekit-enhance-prompt` text-rewriter path.
//
// IMPORTANT: This function must NOT read LOVABLE_API_KEY. The whole point of
// the BYOK contract is that ReadyCode never bills inference. If the user
// hasn't added an OpenRouter or Google key, return a clear error so the UI
// can prompt them to add one at readycode.ai/byok.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Body {
  provider_id?: string | null;
  url: string;
  platform?: string;
  mode?: string;
  audio_capable_target?: boolean;
  system: string;
  directive: string;
}

function parseLooseJson(text: string): unknown | null {
  const stripped = text.trim().replace(/^```(?:json)?\s*|\s*```$/gi, "").trim();
  try { return JSON.parse(stripped); } catch {}
  const s = stripped.indexOf("{");
  const e = stripped.lastIndexOf("}");
  if (s >= 0 && e > s) {
    try { return JSON.parse(stripped.slice(s, e + 1)); } catch {}
  }
  return null;
}

const OPENROUTER_DEFAULT_VIDEO_MODEL = "google/gemini-2.5-pro";
const GOOGLE_DIRECT_DEFAULT_MODEL = "gemini-2.5-pro";

function isOpenRouter(endpoint: string): boolean {
  try { return new URL(endpoint).hostname.endsWith("openrouter.ai"); } catch { return false; }
}
function isGoogleDirect(endpoint: string): boolean {
  try { return new URL(endpoint).hostname === "generativelanguage.googleapis.com"; } catch { return false; }
}

// deno-lint-ignore no-explicit-any
async function loadProvider(supabaseUrl: string, serviceKey: string, providerId: string, userJwt: string | null): Promise<any | null> {
  // Service key reads the row; if your RLS requires the user's JWT instead,
  // swap Authorization to `Bearer ${userJwt}` and drop the service-key apikey.
  const res = await fetch(`${supabaseUrl}/rest/v1/ai_providers?id=eq.${providerId}&select=id,name,endpoint_url,api_key,model_name`, {
    headers: {
      "apikey": serviceKey,
      "Authorization": `Bearer ${userJwt || serviceKey}`,
      "Accept": "application/json",
    },
  });
  if (!res.ok) throw new Error(`ai_providers lookup failed: ${res.status}`);
  const rows = await res.json();
  return Array.isArray(rows) && rows[0] ? rows[0] : null;
}

// deno-lint-ignore no-explicit-any
async function callOpenRouter(provider: any, system: string, userText: string, url: string): Promise<Response> {
  const model = provider.model_name || OPENROUTER_DEFAULT_VIDEO_MODEL;
  const endpoint = String(provider.endpoint_url).replace(/\/$/, "") + "/chat/completions";
  return fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${provider.api_key}`,
      "HTTP-Referer": "https://readycode.ai",
      "X-Title": "ReadyCode ImageKit",
    },
    body: JSON.stringify({
      model,
      temperature: 0.4,
      messages: [
        { role: "system", content: system },
        { role: "user", content: [
          { type: "text", text: userText },
          // OpenRouter forwards file/url parts to Gemini, which reads YouTube natively.
          { type: "image_url", image_url: { url } },
        ] },
      ],
    }),
  });
}

// deno-lint-ignore no-explicit-any
async function callGoogleDirect(provider: any, system: string, userText: string, url: string): Promise<Response> {
  const model = provider.model_name || GOOGLE_DIRECT_DEFAULT_MODEL;
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(provider.api_key)}`;
  return fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: [{
        role: "user",
        parts: [
          { text: userText },
          { fileData: { fileUri: url, mimeType: "video/*" } },
        ],
      }],
      generationConfig: { temperature: 0.4 },
    }),
  });
}

// deno-lint-ignore no-explicit-any
async function extractText(provider: any, res: Response): Promise<string> {
  const data = await res.json();
  if (isGoogleDirect(provider.endpoint_url)) {
    // deno-lint-ignore no-explicit-any
    return data?.candidates?.[0]?.content?.parts?.map((p: any) => p.text || "").join("") || "";
  }
  return data?.choices?.[0]?.message?.content || "";
}

// deno-lint-ignore no-explicit-any
(globalThis as any).Deno?.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  let body: Body;
  try { body = await req.json(); }
  catch { return Response.json({ error: "Invalid JSON body" }, { status: 400, headers: corsHeaders }); }

  const { provider_id, url, platform, system, directive } = body || ({} as Body);
  if (!url || !system || !directive) {
    return Response.json({ error: "Missing url, system, or directive" }, { status: 400, headers: corsHeaders });
  }
  if (!provider_id) {
    return Response.json({ error: "Missing provider_id — pick a BYOK provider in the Respin tab first." }, { status: 400, headers: corsHeaders });
  }

  const supported = platform === "youtube" || platform === "shorts" || /youtube\.com|youtu\.be/.test(url);
  if (!supported) {
    return Response.json({ fallback: "text_only", reason: `platform ${platform || "unknown"} not ingestable by gemini` }, { headers: corsHeaders });
  }

  // deno-lint-ignore no-explicit-any
  const env = (globalThis as any).Deno?.env;
  const SUPABASE_URL = env?.get("SUPABASE_URL");
  const SERVICE_KEY = env?.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!SUPABASE_URL || !SERVICE_KEY) {
    return Response.json({ fallback: "text_only", reason: "supabase_env_missing" }, { headers: corsHeaders });
  }
  const userJwt = req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "") || null;

  // deno-lint-ignore no-explicit-any
  let provider: any;
  try {
    provider = await loadProvider(SUPABASE_URL, SERVICE_KEY, provider_id, userJwt);
  } catch (e) {
    return Response.json({ fallback: "text_only", reason: "provider_lookup_failed", detail: String((e as Error)?.message || e) }, { headers: corsHeaders });
  }
  if (!provider || !provider.api_key || !provider.endpoint_url) {
    return Response.json({ error: "Provider not found or missing key. Add an OpenRouter or Google AI Studio key at readycode.ai/byok." }, { status: 400, headers: corsHeaders });
  }

  const userText = directive + "\n\nWATCH THE VIDEO AT THE URL ABOVE. Return ONLY the JSON object.";

  try {
    let upstream: Response;
    if (isOpenRouter(provider.endpoint_url)) {
      upstream = await callOpenRouter(provider, system, userText, url);
    } else if (isGoogleDirect(provider.endpoint_url)) {
      upstream = await callGoogleDirect(provider, system, userText, url);
    } else {
      return Response.json({
        error: `Provider "${provider.name}" can't watch videos. Use an OpenRouter key (google/gemini-2.5-pro) or a Google AI Studio key.`,
      }, { status: 400, headers: corsHeaders });
    }

    if (upstream.status === 429) return Response.json({ fallback: "text_only", reason: "provider_rate_limited" }, { headers: corsHeaders });
    if (upstream.status === 401 || upstream.status === 403) {
      const t = await upstream.text().catch(() => "");
      return Response.json({ error: `Your ${provider.name} key was rejected (${upstream.status}). Check it at readycode.ai/byok.`, detail: t.slice(0, 200) }, { status: 400, headers: corsHeaders });
    }
    if (!upstream.ok) {
      const t = await upstream.text().catch(() => "");
      return Response.json({ fallback: "text_only", reason: `provider_${upstream.status}`, detail: t.slice(0, 300) }, { headers: corsHeaders });
    }

    const text = await extractText(provider, upstream);
    const analysis = parseLooseJson(text);
    if (!analysis || typeof analysis !== "object") {
      return Response.json({ fallback: "text_only", reason: "unparseable_response", raw: text.slice(0, 300) }, { headers: corsHeaders });
    }
    return Response.json({ analysis, provider_name: provider.name, model_name: provider.model_name || null }, { headers: corsHeaders });
  } catch (e) {
    return Response.json({ fallback: "text_only", reason: "exception", detail: String((e as Error)?.message || e) }, { headers: corsHeaders });
  }
});
