// Edge function: imagekit-analyze-video
// Deploy to the ReadyCode Lovable project (NOT this repo).
//
// Ingests a YouTube / Shorts URL directly with Gemini via the Lovable AI
// Gateway and returns the same storyboard JSON shape the Chrome extension
// already understands (slot_prompts[], condensed.beats, etc.).
//
// On any failure or unsupported platform it returns
// `{ fallback: "text_only", reason }` so the extension transparently falls
// back to the existing `imagekit-enhance-prompt` text-rewriter path.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Body {
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

// deno-lint-ignore no-explicit-any
(globalThis as any).Deno?.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  let body: Body;
  try { body = await req.json(); }
  catch { return Response.json({ error: "Invalid JSON body" }, { status: 400, headers: corsHeaders }); }

  const { url, platform, system, directive } = body || ({} as Body);
  if (!url || !system || !directive) {
    return Response.json({ error: "Missing url, system, or directive" }, { status: 400, headers: corsHeaders });
  }

  // Gemini's native YouTube ingestion only covers youtube.com / youtu.be /
  // youtube.com/shorts. TikTok and unknown platforms fall back.
  const supported = platform === "youtube" || platform === "shorts" || /youtube\.com|youtu\.be/.test(url);
  if (!supported) {
    return Response.json({ fallback: "text_only", reason: `platform ${platform || "unknown"} not ingestable by gemini` }, { headers: corsHeaders });
  }

  // deno-lint-ignore no-explicit-any
  const apiKey = (globalThis as any).Deno?.env?.get("LOVABLE_API_KEY");
  if (!apiKey) {
    return Response.json({ fallback: "text_only", reason: "LOVABLE_API_KEY missing" }, { headers: corsHeaders });
  }

  try {
    const upstream = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Lovable-API-Key": apiKey,
        "X-Lovable-AIG-SDK": "raw-fetch",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-pro",
        messages: [
          { role: "system", content: system },
          {
            role: "user",
            content: [
              { type: "text", text: directive + "\n\nWATCH THE VIDEO AT THE URL ABOVE. Return ONLY the JSON object." },
              // Gemini-style file_data part. The Lovable gateway forwards this
              // through to Gemini which natively reads YouTube URLs.
              { type: "file", file: { file_uri: url, mime_type: "video/*" } },
            ],
          },
        ],
        temperature: 0.4,
      }),
    });

    if (upstream.status === 429) return Response.json({ fallback: "text_only", reason: "rate_limited" }, { headers: corsHeaders });
    if (upstream.status === 402) return Response.json({ fallback: "text_only", reason: "credits_exhausted" }, { headers: corsHeaders });
    if (!upstream.ok) {
      const t = await upstream.text().catch(() => "");
      return Response.json({ fallback: "text_only", reason: `gateway_${upstream.status}`, detail: t.slice(0, 300) }, { headers: corsHeaders });
    }

    const data = await upstream.json();
    const text: string = data?.choices?.[0]?.message?.content ?? "";
    const analysis = parseLooseJson(text);
    if (!analysis || typeof analysis !== "object") {
      return Response.json({ fallback: "text_only", reason: "unparseable_response", raw: text.slice(0, 300) }, { headers: corsHeaders });
    }

    return Response.json({ analysis }, { headers: corsHeaders });
  } catch (e) {
    return Response.json({ fallback: "text_only", reason: "exception", detail: String((e as Error)?.message || e) }, { headers: corsHeaders });
  }
});