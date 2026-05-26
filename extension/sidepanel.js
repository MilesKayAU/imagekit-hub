// ReadyCode ImageKit — side panel logic.
// All AI calls flow through ReadyCode edge functions which proxy to the
// user's BYOK provider. ReadyCode never bills for image inference.

const SUPABASE_URL = "https://gmlnipblxehgadagxakt.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_IPEmcWQkq2htpTTubattrQ_NE_mt3Eo";
const TOKEN_KEY = "rc_imagekit_token";
const OPENROUTER_AUTO_IMAGE_MODEL = "openrouter/auto";
const RC_API_BASE = "https://readycode.ai";
const MODEL_CATALOG_CACHE_KEY = "rc_imagekit_models_cache";
const MODEL_CATALOG_TTL_MS = 6 * 60 * 60 * 1000; // 6h

function decodeBundle(raw) {
  const t = (raw || "").trim();
  if (!t) return null;
  if (t.startsWith("RC1.")) {
    try {
      const b64 = t.slice(4).replace(/-/g, "+").replace(/_/g, "/");
      const pad = b64.length % 4 ? b64 + "=".repeat(4 - (b64.length % 4)) : b64;
      const json = decodeURIComponent(escape(atob(pad)));
      const p = JSON.parse(json);
      return p.access_token || null;
    } catch { return null; }
  }
  return t;
}

const STYLE_PROMPTS = {
  lifestyle: "Place the subject in a natural, aspirational real-world setting with soft daylight and a clean composition.",
  white: "Place the subject on a clean pure white seamless catalogue background with even soft lighting and a soft contact shadow.",
  minimalist: "Minimalist scene with negative space, neutral palette, single soft directional light, no clutter.",
  editorial: "Editorial magazine-style scene, considered styling, shallow depth of field, premium feel.",
};

const state = {
  token: null,
  providers: [],
  sourceUrl: null,     // string URL to send to the model
  sourceDataUrl: null, // for preview only (uploads / tab capture)
  style: "lifestyle",
  result: null,        // { image_base64, mime_type, provider_name, model_name }
  extras: [],          // [{ url, dataUrl }] — extra reference images
  lastPrompt: "",      // last prompt sent, for refine history display
  lastProviderId: null,
  lastModel: null,
  modelOverride: null, // explicit model id chosen from the catalog picker
  modelCatalog: [],    // [{ id, name, provider, ... }]
  modelSort: "popularity",
};

// --- tiny DOM helpers ---
const $ = (id) => document.getElementById(id);
function setStatus(msg, kind = "info") {
  const el = $("status");
  if (!msg) { el.classList.add("hidden"); return; }
  el.className = `status ${kind}`;
  el.textContent = msg;
  el.classList.remove("hidden");
}
function setAuth(text, kind = "") {
  const el = $("auth-state");
  el.textContent = text;
  el.className = "auth-state" + (kind ? " " + kind : "");
}

// --- API ---
async function api(path, body) {
  if (!state.token) throw new Error("Not signed in to ReadyCode");
  const res = await fetch(`${SUPABASE_URL}/functions/v1/${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${state.token}`,
      apikey: SUPABASE_ANON_KEY,
    },
    body: JSON.stringify(body || {}),
  });
  const text = await res.text();
  let data; try { data = JSON.parse(text); } catch { data = { error: text }; }
  if (res.status === 401) {
    // Token rejected by the Supabase functions gateway — most likely expired.
    // Clear it so the user can re-link instead of staring at a bare HTTP 401.
    try { await chrome.storage.local.remove(TOKEN_KEY); } catch {}
    state.token = null;
    setAuth("Sign in at readycode.ai", "err");
    throw new Error("Session expired — click Link and paste a fresh token from readycode.ai/imagekit/connect.");
  }
  if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
  return data;
}

async function loadProviders() {
  const data = await api("ai-providers", { action: "list" });
  return Array.isArray(data?.providers) ? data.providers : [];
}

function isOpenRouterProvider(provider) {
  try { return new URL(provider.endpoint_url || "").hostname.endsWith("openrouter.ai"); } catch { return false; }
}

function isLikelyImageModel(modelName) {
  const m = String(modelName || "").toLowerCase();
  return ["openrouter/auto", "image", "gpt-image", "dall-e", "flux", "kontext", "imagen", "ideogram", "recraft", "seedream", "riverflow", "grok-imagine", "stable-diffusion"].some((x) => m.includes(x));
}

function imageModelForProvider(provider) {
  if (isOpenRouterProvider(provider) && !isLikelyImageModel(provider.model_name)) {
    return OPENROUTER_AUTO_IMAGE_MODEL;
  }
  return provider.model_name || "";
}

// --- tabs ---
document.querySelectorAll(".tab").forEach((btn) => {
  btn.addEventListener("click", () => {
    activateTab(btn.dataset.tab);
  });
});

function activateTab(tab) {
  document.querySelectorAll(".tab").forEach((b) => b.classList.toggle("active", b.dataset.tab === tab));
  document.querySelectorAll(".tab-panel").forEach((p) => p.classList.remove("active"));
  const panel = $(`tab-${tab}`);
  if (panel) panel.classList.add("active");
  if (tab === "library") renderLibrary();
}

function updateWelcomeVisibility() {
  const welcomeTab = document.querySelector('.tab[data-tab="welcome"]');
  if (!welcomeTab) return;
  if (state.token) {
    welcomeTab.classList.add("hidden");
    if (welcomeTab.classList.contains("active")) activateTab("respin");
  } else {
    welcomeTab.classList.remove("hidden");
  }
}

// --- source handling ---
function setSource({ url = null, dataUrl = null }) {
  state.sourceUrl = url;
  state.sourceDataUrl = dataUrl;
  const prev = $("source-preview");
  const src = dataUrl || url;
  if (src) {
    prev.classList.remove("empty");
    prev.innerHTML = "";
    const img = document.createElement("img");
    img.src = src;
    prev.appendChild(img);
  }
  refreshGenerateButton();
}

function refreshGenerateButton() {
  const ok = !!(state.sourceUrl || state.sourceDataUrl) && !!state.token && state.providers.length > 0;
  $("generate").disabled = !ok;
}

$("load-url").addEventListener("click", () => {
  const v = $("source-url").value.trim();
  if (!v) return;
  setSource({ url: v, dataUrl: v });
});

$("source-file").addEventListener("change", (e) => {
  const f = e.target.files?.[0];
  if (!f) return;
  const reader = new FileReader();
  reader.onload = () => setSource({ url: reader.result, dataUrl: reader.result });
  reader.readAsDataURL(f);
});

$("grab-tab").addEventListener("click", async () => {
  try {
    const tab = await chrome.tabs.query({ active: true, currentWindow: true });
    const dataUrl = await chrome.tabs.captureVisibleTab(tab[0].windowId, { format: "png" });
    setSource({ url: dataUrl, dataUrl });
  } catch (e) {
    setStatus(`Couldn't capture tab: ${e.message}`, "error");
  }
});

// --- extras strip ---
function renderExtras() {
  const strip = $("extras-strip");
  if (!state.extras.length) {
    strip.classList.add("empty");
    strip.innerHTML = '<span class="muted">No extras added.</span>';
    return;
  }
  strip.classList.remove("empty");
  strip.innerHTML = "";
  state.extras.forEach((ex, i) => {
    const t = document.createElement("div");
    t.className = "thumb";
    const img = document.createElement("img");
    img.src = ex.dataUrl || ex.url;
    const x = document.createElement("button");
    x.type = "button";
    x.textContent = "×";
    x.title = "Remove";
    x.addEventListener("click", () => { state.extras.splice(i, 1); renderExtras(); });
    t.appendChild(img);
    t.appendChild(x);
    strip.appendChild(t);
  });
}

function addExtra(url, dataUrl) {
  if (state.extras.length >= 3) { setStatus("Up to 3 extra references.", "error"); return; }
  state.extras.push({ url, dataUrl: dataUrl || url });
  renderExtras();
}

$("extra-file").addEventListener("change", (e) => {
  const f = e.target.files?.[0];
  if (!f) return;
  const reader = new FileReader();
  reader.onload = () => addExtra(reader.result, reader.result);
  reader.readAsDataURL(f);
  e.target.value = "";
});

// --- style chips ---
document.querySelectorAll(".chip").forEach((c) => {
  c.addEventListener("click", () => {
    document.querySelectorAll(".chip").forEach((x) => x.classList.toggle("active", x === c));
    state.style = c.dataset.style;
  });
});

// --- prompt enhancement ---
const PROMPT_ENGINEER_SYSTEM = `You are a senior prompt engineer for AI image generation models (Nano Banana, GPT-Image, Flux, Imagen, Ideogram). Rewrite the user's rough prompt into ONE production-ready image prompt.
Rules:
- Preserve the user's intent, subject, and any specific brand/product details exactly.
- Add concrete visual detail: lighting, camera/lens, composition, mood, materials, background, color palette.
- Keep it under ~90 words. No preamble, no bullet lists, no quotes — return only the prompt text.
- Do not invent text/logos that weren't requested.`;

async function enhancePromptOnce() {
  const userPrompt = $("prompt").value.trim();
  const styleText = STYLE_PROMPTS[state.style] || "";
  const providerId = $("provider").value || null;
  if (!userPrompt && !styleText) {
    setStatus("Type a prompt first, then enhance.", "error");
    return;
  }
  const combined = [styleText, userPrompt].filter(Boolean).join(" ");
  $("enhance-prompt").disabled = true;
  $("re-enhance").disabled = true;
  setStatus("Enhancing prompt with your AI…", "info");
  try {
    const data = await api("imagekit-enhance-prompt", {
      provider_id: providerId,
      system: PROMPT_ENGINEER_SYSTEM,
      prompt: combined,
      style: state.style,
    });
    const out = (data?.enhanced_prompt || data?.text || "").trim();
    if (!out) throw new Error("No enhanced prompt returned.");
    $("enhanced-prompt").value = out;
    $("enhanced-block").classList.remove("hidden");
    setStatus("", "info");
  } catch (e) {
    setStatus(e.message || "Couldn't enhance prompt", "error");
  } finally {
    $("enhance-prompt").disabled = false;
    $("re-enhance").disabled = false;
  }
}

$("enhance-prompt").addEventListener("click", enhancePromptOnce);
$("re-enhance").addEventListener("click", enhancePromptOnce);
$("use-enhanced").addEventListener("click", () => {
  const v = $("enhanced-prompt").value.trim();
  if (!v) return;
  $("prompt").value = v;
  $("enhanced-block").classList.add("hidden");
  setStatus("Enhanced prompt applied. Hit Generate when ready.", "success");
});
$("discard-enhanced").addEventListener("click", () => {
  $("enhanced-block").classList.add("hidden");
  $("enhanced-prompt").value = "";
});

// --- recommended models picker ---
function effectiveModelForProvider(provider) {
  if (state.modelOverride) return state.modelOverride;
  return provider ? imageModelForProvider(provider) : null;
}

function updateModelOverrideUI() {
  const row = $("model-override-row");
  if (state.modelOverride) {
    row.classList.remove("hidden");
    $("model-override-id").textContent = state.modelOverride;
  } else {
    row.classList.add("hidden");
  }
  renderModelList(); // re-highlight active
  if (typeof updateUgcModelChips === "function") updateUgcModelChips();
}

$("model-override-clear").addEventListener("click", () => {
  state.modelOverride = null;
  updateModelOverrideUI();
});

function updateModelPickerVisibility() {
  const providerId = $("provider").value || null;
  const provider = state.providers.find((p) => p.id === providerId);
  const show = provider && isOpenRouterProvider(provider);
  $("model-picker").classList.toggle("hidden", !show);
  $("custom-model-row").classList.toggle("hidden", !show);
  if (!show) {
    // Clear override if it no longer applies
    if (state.modelOverride) {
      state.modelOverride = null;
      updateModelOverrideUI();
    }
  }
}

async function loadModelCatalog({ force = false } = {}) {
  if (!force) {
    try {
      const { [MODEL_CATALOG_CACHE_KEY]: cached } = await chrome.storage.local.get(MODEL_CATALOG_CACHE_KEY);
      if (cached && Date.now() - cached.ts < MODEL_CATALOG_TTL_MS && Array.isArray(cached.models)) {
        state.modelCatalog = cached.models;
        return { fromCache: true, refreshedAt: cached.refreshedAt };
      }
    } catch {}
  }
  const res = await fetch(`${RC_API_BASE}/api/public/imagekit/models?sort=${state.modelSort}&limit=60`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  const models = Array.isArray(data?.models) ? data.models : [];
  state.modelCatalog = models;
  try {
    await chrome.storage.local.set({
      [MODEL_CATALOG_CACHE_KEY]: { ts: Date.now(), refreshedAt: data?.refreshed_at || null, models },
    });
  } catch {}
  return { fromCache: false, refreshedAt: data?.refreshed_at || null };
}

function sortModelsLocal(models, sort) {
  const out = [...models];
  if (sort === "price") {
    out.sort((a, b) => (priceScore(a) - priceScore(b)));
  } else if (sort === "speed") {
    out.sort((a, b) => (latencyScore(a) - latencyScore(b)));
  } else {
    out.sort((a, b) => (b.weekly_tokens || 0) - (a.weekly_tokens || 0));
  }
  return out;
}
function priceScore(m) {
  if (typeof m.pricing_image === "number" && m.pricing_image > 0) return m.pricing_image;
  return (m.pricing_prompt || 0) + (m.pricing_completion || 0) * 4;
}
function latencyScore(m) {
  if (typeof m.median_latency_ms === "number") return m.median_latency_ms;
  if (typeof m.throughput_tps === "number" && m.throughput_tps > 0) return 1e6 / m.throughput_tps;
  return Number.POSITIVE_INFINITY;
}

function fmtPrice(m) {
  if (typeof m.pricing_image === "number" && m.pricing_image > 0) return `$${m.pricing_image.toFixed(3)}/img`;
  if (typeof m.pricing_prompt === "number") return `$${(m.pricing_prompt).toFixed(2)}/1M in`;
  return "—";
}
function fmtSpeed(m) {
  if (typeof m.median_latency_ms === "number") return `~${(m.median_latency_ms/1000).toFixed(1)}s`;
  if (typeof m.throughput_tps === "number") return `${Math.round(m.throughput_tps)} tps`;
  return "—";
}
function fmtPop(m) {
  const t = m.weekly_tokens || 0;
  if (!t) return "—";
  if (t >= 1e9) return `${(t/1e9).toFixed(1)}B/wk`;
  if (t >= 1e6) return `${(t/1e6).toFixed(1)}M/wk`;
  if (t >= 1e3) return `${(t/1e3).toFixed(1)}K/wk`;
  return `${t}/wk`;
}

function renderModelList() {
  const list = $("model-list");
  const sorted = sortModelsLocal(state.modelCatalog, state.modelSort);
  if (!sorted.length) {
    list.innerHTML = "<p class='muted'>No models yet. The catalog refreshes daily from openrouter.ai.</p>";
    return;
  }
  list.innerHTML = "";
  for (const m of sorted) {
    const card = document.createElement("div");
    card.className = "model-card" + (state.modelOverride === m.id ? " active" : "");
    const row1 = document.createElement("div");
    row1.className = "row1";
    const left = document.createElement("div");
    left.innerHTML = `<span class="name">${escapeHtml(m.name || m.id)}</span> <span class="provider-chip">${escapeHtml(m.provider || "")}</span>`;
    const useBtn = document.createElement("button");
    useBtn.type = "button";
    useBtn.className = "primary use-btn";
    useBtn.textContent = state.modelOverride === m.id ? "In use" : "Use this";
    useBtn.addEventListener("click", () => {
      state.modelOverride = m.id;
      updateModelOverrideUI();
      setStatus(`Next Generate will use ${m.id}.`, "success");
    });
    row1.appendChild(left);
    row1.appendChild(useBtn);
    card.appendChild(row1);
    if (m.description) {
      const desc = document.createElement("div");
      desc.className = "desc";
      desc.textContent = m.description;
      card.appendChild(desc);
    }
    const stats = document.createElement("div");
    stats.className = "stats";
    stats.innerHTML = `<span>${fmtPrice(m)}</span><span>${fmtSpeed(m)}</span><span>${fmtPop(m)}</span>`;
    card.appendChild(stats);
    list.appendChild(card);
  }
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

document.querySelectorAll(".sort-tab").forEach((b) => {
  b.addEventListener("click", () => {
    document.querySelectorAll(".sort-tab").forEach((x) => x.classList.toggle("active", x === b));
    state.modelSort = b.dataset.sort;
    renderModelList();
  });
});

async function refreshModelCatalogUI({ force = false } = {}) {
  const footer = $("model-footer");
  try {
    const { refreshedAt, fromCache } = await loadModelCatalog({ force });
    renderModelList();
    const when = refreshedAt ? new Date(refreshedAt).toLocaleString() : "unknown";
    footer.textContent = `Source: openrouter.ai · refreshed ${when}${fromCache ? " (cached)" : ""}.`;
  } catch (e) {
    $("model-list").innerHTML = `<p class='muted'>Couldn't load catalog: ${e.message}. The ReadyCode endpoint may not be live yet.</p>`;
  }
}

$("model-refresh").addEventListener("click", () => refreshModelCatalogUI({ force: true }));
$("model-picker").addEventListener("toggle", (e) => {
  if (e.target.open && !state.modelCatalog.length) refreshModelCatalogUI();
});

$("custom-model-apply").addEventListener("click", () => {
  const id = $("custom-model-input").value.trim();
  if (!id || !/^[a-z0-9._-]+\/[a-z0-9._:-]+$/i.test(id)) {
    setStatus("Enter a valid OpenRouter model id, e.g. x-ai/grok-imagine", "error");
    return;
  }
  state.modelOverride = id;
  updateModelOverrideUI();
  setStatus(`Next Generate will use ${id}.`, "success");
});
$("custom-model-input").addEventListener("keydown", (e) => {
  if (e.key === "Enter") { e.preventDefault(); $("custom-model-apply").click(); }
});

document.getElementById("provider").addEventListener("change", () => {
  updateModelPickerVisibility();
  if (typeof updateUgcModelChips === "function") updateUgcModelChips();
});

// --- generate ---
$("generate").addEventListener("click", async () => {
  $("generate").disabled = true;
  $("output").classList.add("hidden");
  setStatus("Generating with your AI provider… this can take 10–30s", "info");
  try {
    const userPrompt = $("prompt").value.trim();
    const styleText = STYLE_PROMPTS[state.style] || "";
    const finalPrompt = [styleText, userPrompt].filter(Boolean).join(" ");
    const providerId = $("provider").value || null;
    const provider = state.providers.find((p) => p.id === providerId);
    const model = effectiveModelForProvider(provider);
    const images = [state.sourceUrl, ...state.extras.map((e) => e.url)].filter(Boolean);
    const data = await api("imagekit-generate", {
      provider_id: providerId,
      model,
      mode: "lifestyle",
      prompt: finalPrompt,
      images,
    });
    if (data.error) throw new Error(data.error);
    state.result = data;
    state.lastPrompt = finalPrompt;
    state.lastProviderId = providerId;
    state.lastModel = model;
    const dataUrl = `data:${data.mime_type};base64,${data.image_base64}`;
    $("output-img").src = dataUrl;
    $("output-meta").textContent = `${data.provider_name} · ${data.model_name} · ${(data.duration_ms/1000).toFixed(1)}s`;
    $("output").classList.remove("hidden");
    $("refine-history").textContent = "";
    $("refine-prompt").value = "";
    setStatus("", "info");
  } catch (e) {
    setStatus(e.message || "Generation failed", "error");
  } finally {
    refreshGenerateButton();
  }
});

// --- refine / use as source / start over ---
$("refine-btn").addEventListener("click", async () => {
  if (!state.result) return;
  const refineText = $("refine-prompt").value.trim();
  if (!refineText) { setStatus("Type what you'd like to change.", "error"); return; }
  $("refine-btn").disabled = true;
  setStatus("Refining… 10–30s", "info");
  try {
    const currentDataUrl = `data:${state.result.mime_type};base64,${state.result.image_base64}`;
    const images = [currentDataUrl, ...state.extras.map((e) => e.url)].filter(Boolean);
    const data = await api("imagekit-generate", {
      provider_id: state.lastProviderId,
      model: state.lastModel,
      mode: "refine",
      prompt: refineText,
      images,
    });
    if (data.error) throw new Error(data.error);
    state.result = data;
    const prev = state.lastPrompt;
    state.lastPrompt = refineText;
    const dataUrl = `data:${data.mime_type};base64,${data.image_base64}`;
    $("output-img").src = dataUrl;
    $("output-meta").textContent = `${data.provider_name} · ${data.model_name} · ${(data.duration_ms/1000).toFixed(1)}s`;
    $("refine-history").textContent = `Previous: ${prev}`;
    $("refine-prompt").value = "";
    setStatus("", "info");
  } catch (e) {
    setStatus(e.message || "Refine failed", "error");
  } finally {
    $("refine-btn").disabled = false;
  }
});

$("use-as-source").addEventListener("click", () => {
  if (!state.result) return;
  const dataUrl = `data:${state.result.mime_type};base64,${state.result.image_base64}`;
  setSource({ url: dataUrl, dataUrl });
  $("output").classList.add("hidden");
  state.result = null;
  setStatus("Using result as new source.", "success");
});

$("start-over").addEventListener("click", () => {
  $("output").classList.add("hidden");
  state.result = null;
  $("refine-prompt").value = "";
  $("refine-history").textContent = "";
  setStatus("", "info");
});

$("download").addEventListener("click", () => {
  if (!state.result) return;
  const a = document.createElement("a");
  a.href = `data:${state.result.mime_type};base64,${state.result.image_base64}`;
  a.download = `readycode-imagekit-${Date.now()}.png`;
  a.click();
});

$("save").addEventListener("click", async () => {
  if (!state.result) return;
  $("save").disabled = true;
  setStatus("Saving to your library…", "info");
  try {
    const userPrompt = $("prompt").value.trim();
    await api("imagekit-save", {
      image_base64: state.result.image_base64,
      mime_type: state.result.mime_type,
      kind: "respin",
      source_metadata: {
        prompt: userPrompt,
        style: state.style,
        provider: state.result.provider_name,
        model: state.result.model_name,
        source_urls: [state.sourceUrl].filter((s) => s && !s.startsWith("data:")),
      },
    });
    const el = $("status");
    el.className = "status success";
    el.innerHTML = 'Saved ✓ — <a href="https://readycode.ai/imagekit/library" target="_blank" style="color:inherit;text-decoration:underline;">open library</a>';
    el.classList.remove("hidden");
  } catch (e) {
    setStatus(e.message || "Save failed", "error");
  } finally {
    $("save").disabled = false;
  }
});

// --- library tab ---
async function fetchLibraryRows(limit = 60) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/imagekit_assets?select=id,storage_path,kind,created_at,source_metadata&order=created_at.desc&limit=${limit}`, {
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${state.token}` },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function signedUrlFor(storagePath) {
  const su = await fetch(`${SUPABASE_URL}/storage/v1/object/sign/imagekit-library/${storagePath}`, {
    method: "POST", headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${state.token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ expiresIn: 3600 }),
  }).then((x) => x.ok ? x.json() : null).catch(() => null);
  return su?.signedURL ? `${SUPABASE_URL}/storage/v1${su.signedURL}` : null;
}

async function renderLibrary() {
  const grid = $("library-grid");
  grid.innerHTML = "<p class='muted'>Loading…</p>";
  if (!state.token) { grid.innerHTML = "<p class='muted'>Sign in to ReadyCode to view your library.</p>"; return; }
  try {
    const rows = await fetchLibraryRows(60);
    if (!rows.length) { grid.innerHTML = "<p class='muted'>Your library is empty. Generate something on the Respin tab.</p>"; return; }
    grid.innerHTML = "";
    for (const r of rows) {
      const card = document.createElement("div");
      card.className = "asset";
      const img = document.createElement("img");
      const url = await signedUrlFor(r.storage_path);
      if (url) img.src = url;
      img.onclick = () => { if (img.src) chrome.tabs.create({ url: img.src }); };
      card.appendChild(img);
      const actions = document.createElement("div");
      actions.className = "actions";
      const useBtn = document.createElement("button");
      useBtn.type = "button";
      useBtn.textContent = "Use as source";
      useBtn.addEventListener("click", (ev) => {
        ev.stopPropagation();
        if (!url) return;
        setSource({ url, dataUrl: url });
        activateTab("respin");
      });
      const addBtn = document.createElement("button");
      addBtn.type = "button";
      addBtn.textContent = "Add as reference";
      addBtn.addEventListener("click", (ev) => {
        ev.stopPropagation();
        if (!url) return;
        addExtra(url, url);
        activateTab("respin");
      });
      const vidBtn = document.createElement("button");
      vidBtn.type = "button";
      vidBtn.textContent = "→ Video";
      vidBtn.addEventListener("click", (ev) => {
        ev.stopPropagation();
        if (!url) return;
        sendImageToVideo({ url, dataUrl: url });
      });
      actions.appendChild(useBtn);
      actions.appendChild(addBtn);
      actions.appendChild(vidBtn);
      card.appendChild(actions);
      grid.appendChild(card);
    }
  } catch (e) {
    grid.innerHTML = `<p class='muted'>Couldn't load library: ${e.message}</p>`;
  }
}

// --- Library picker dialog (for Respin source / extras) ---
const libPicker = document.getElementById("lib-picker");
let libPickerTarget = "source"; // "source" | "extra"

async function openLibPicker(target) {
  libPickerTarget = target;
  document.getElementById("lib-picker-title").textContent =
    target === "source" ? "Pick source from Library" : "Add reference from Library";
  const grid = document.getElementById("lib-picker-grid");
  grid.innerHTML = "<p class='muted'>Loading…</p>";
  libPicker.showModal();
  if (!state.token) { grid.innerHTML = "<p class='muted'>Link the extension first.</p>"; return; }
  try {
    const rows = await fetchLibraryRows(40);
    if (!rows.length) { grid.innerHTML = "<p class='muted'>Library is empty.</p>"; return; }
    grid.innerHTML = "";
    for (const r of rows) {
      const card = document.createElement("div");
      card.className = "asset";
      const img = document.createElement("img");
      const url = await signedUrlFor(r.storage_path);
      if (url) img.src = url;
      img.style.cursor = "pointer";
      img.addEventListener("click", () => {
        if (!url) return;
        if (libPickerTarget === "source") setSource({ url, dataUrl: url });
        else if (libPickerTarget === "ugc-source") ugcSetSource({ url, dataUrl: url });
        else if (libPickerTarget === "video-source") videoSetSource({ url, dataUrl: url });
        else addExtra(url, url);
        libPicker.close();
      });
      card.appendChild(img);
      grid.appendChild(card);
    }
  } catch (e) {
    grid.innerHTML = `<p class='muted'>Couldn't load: ${e.message}</p>`;
  }
}

document.getElementById("pick-source-lib").addEventListener("click", () => openLibPicker("source"));
document.getElementById("add-extra-lib").addEventListener("click", () => openLibPicker("extra"));
document.getElementById("lib-picker-cancel").addEventListener("click", () => libPicker.close());

renderExtras();

// --- pending grab from context menu ---
async function consumePending() {
  const { rc_imagekit_pending } = await chrome.storage.local.get("rc_imagekit_pending");
  if (rc_imagekit_pending?.src) {
    // Route grabbed image to the active tab — UGC if the UGC tab is open, otherwise Respin.
    const activeTab = document.querySelector('.tab.active')?.dataset?.tab;
    if (activeTab === "ugc") {
      ugcSetSource({ url: rc_imagekit_pending.src, dataUrl: rc_imagekit_pending.src });
    } else if (activeTab === "video") {
      videoSetSource({ url: rc_imagekit_pending.src, dataUrl: rc_imagekit_pending.src });
    } else {
      setSource({ url: rc_imagekit_pending.src, dataUrl: rc_imagekit_pending.src });
      const respinTab = document.querySelector('[data-tab="respin"]');
      if (respinTab && activeTab !== "respin") respinTab.click();
    }
    await chrome.storage.local.remove("rc_imagekit_pending");
  }
}

// Fire when side panel is already open and user right-clicks another image
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes.rc_imagekit_pending?.newValue) {
    consumePending();
  }
});

// --- token bootstrap ---
async function bootstrap() {
  const stored = await chrome.storage.local.get(TOKEN_KEY);
  state.token = stored[TOKEN_KEY] || null;
  if (!state.token) {
    setAuth("Sign in at readycode.ai", "err");
    $("provider-hint").innerHTML = `Open <a href="https://readycode.ai/imagekit" target="_blank">readycode.ai/imagekit</a> in this browser to link the extension.`;
    updateWelcomeVisibility();
    activateTab("welcome");
    return;
  }
  setAuth("Linked to ReadyCode", "ok");
  updateWelcomeVisibility();
  try {
    state.providers = await loadProviders();
    const sel = $("provider");
    sel.innerHTML = "";
    if (!state.providers.length) {
      const opt = document.createElement("option");
      opt.textContent = "No BYOK providers — add one at readycode.ai/byok";
      sel.appendChild(opt);
      sel.disabled = true;
    } else {
      for (const p of state.providers) {
        const opt = document.createElement("option");
        opt.value = p.id;
        const model = imageModelForProvider(p);
        const suffix = model !== p.model_name ? ` → ${model}` : ` · ${model}`;
        opt.textContent = `${p.name}${suffix}`;
        sel.appendChild(opt);
      }
    }
    refreshGenerateButton();
    updateModelPickerVisibility();
  } catch (e) {
    setStatus(`Couldn't load BYOK providers: ${e.message}`, "error");
  }
  await consumePending();
}

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes[TOKEN_KEY]) bootstrap();
});

bootstrap();

// --- Link dialog ---
const linkDialog = document.getElementById("link-dialog");
document.getElementById("link-btn").addEventListener("click", () => linkDialog.showModal());
document.getElementById("link-cancel").addEventListener("click", () => linkDialog.close());
document.getElementById("link-save").addEventListener("click", async () => {
  const raw = document.getElementById("link-token").value;
  const tok = decodeBundle(raw);
  if (!tok) { setStatus("That token doesn't look right. Copy it again from readycode.ai/imagekit/connect.", "error"); return; }
  await chrome.storage.local.set({ [TOKEN_KEY]: tok });
  linkDialog.close();
  setStatus("Linked ✓", "success");
});

// --- Welcome tab CTAs ---
document.querySelectorAll(".welcome-cta[data-open]").forEach((btn) => {
  btn.addEventListener("click", () => {
    const url = btn.getAttribute("data-open");
    if (url) chrome.tabs.create({ url });
  });
});
const welcomePasteBtn = document.getElementById("welcome-paste");
if (welcomePasteBtn) welcomePasteBtn.addEventListener("click", () => linkDialog.showModal());
const welcomeGoRespin = document.getElementById("welcome-go-respin");
if (welcomeGoRespin) welcomeGoRespin.addEventListener("click", (e) => { e.preventDefault(); activateTab("respin"); });

// ============================================================
// UGC tab — guided multi-shot generator
// ============================================================

const UGC_TEMPLATES = {
  person: [
    "Full body composition, photorealistic portrait of a 25-year-old woman with long hair, natural realistic skin with visible pores and skin texture, streetwear vibe, wearing this exact black t-shirt with the precise white graphic logo from the reference image, fitted not oversized, black pants and all-black shoes, standing in confident pose with hand on hip, plain white seamless background, natural studio lighting, ultra realistic, high resolution, detailed",
    "Same subject and outfit, three-quarter pose, mid-shot framing, soft window light, neutral indoor background, candid expression, photorealistic skin texture.",
    "Same subject and outfit, outdoor urban sidewalk scene at golden hour, full body walking shot, shallow depth of field, lifestyle UGC vibe.",
    "Same subject and outfit, mirror selfie in a casual bedroom interior, phone partly visible, soft ambient light, authentic UGC feel.",
    "Same subject and outfit, motion action shot — walking briskly, slight motion blur in background, mid-day daylight.",
    "Same subject, close-up portrait, shallow depth of field, expressive natural smile, soft directional light, magazine quality.",
  ],
  product: [
    "Hero shot of the exact product from the reference image on a clean white seamless background, soft contact shadow, even studio lighting, ultra detailed, e-commerce quality.",
    "Same product in a natural lifestyle scene — in use in a real environment with soft daylight and clean composition.",
    "Same product in-hand, close-up showing scale and texture, shallow depth of field.",
    "Same product as a flat-lay on a styled surface with complementary props, top-down angle, soft even light.",
    "Same product detail macro shot, focus on material and craftsmanship, dramatic side lighting.",
    "Same product alternate angle, 3/4 view on a colored seamless background that complements the product palette.",
  ],
  food: [
    "Hero shot of the exact dish from the reference image on a styled plate, overhead 90-degree angle, natural daylight, fresh garnish, food magazine quality.",
    "Same dish, 45-degree angle, shallow depth of field, soft window light, rustic wooden surface.",
    "Same dish in a lifestyle context — being served at a table with hands and cutlery, candid restaurant vibe.",
    "Same dish close-up macro, steam rising, dramatic side lighting, glossy textures.",
    "Same dish flat-lay with ingredients arranged around it, neutral surface, even daylight.",
    "Same dish in-hand bite shot, vertical mobile framing, casual UGC food influencer vibe.",
  ],
  place: [
    "Wide establishing shot of the exact place from the reference image, golden hour, clean composition, high dynamic range, travel magazine quality.",
    "Same place, interior or detail shot showing character and atmosphere, soft natural light.",
    "Same place with a single person in the frame for scale, lifestyle UGC travel vibe, candid pose.",
    "Same place at night with practical lights on, long exposure feel, moody atmosphere.",
    "Same place close-up architectural detail or signature feature, soft directional light.",
    "Same place in a different season or weather (light rain or morning mist), atmospheric, cinematic.",
  ],
};

const UGC_CHAIN_SYSTEM = `You are a senior creative director writing image-generation prompts for a UGC content pack. Given a MASTER prompt (shot 1), write N follow-up prompts that:
- Keep the exact same subject, outfit, product, lighting style, and overall aesthetic locked.
- Vary ONLY pose, framing, angle, scene, or moment.
- Each prompt must be production-ready for image models (Grok Imagine, Gemini 3 Pro Image, Flux). Include lens, light, mood when relevant.
- Return ONLY a JSON array of strings, no commentary, no markdown.`;

const ugc = {
  subjectType: "person",
  sourceUrl: null,
  sourceDataUrl: null,
  shots: [],         // [{ prompt, status, result, lastModel, lastProviderId, selected, saved }]
  busy: false,
  sessionId: null,   // groups all shots from one pack into a library album
  albumName: null,
};

function newUgcSession() {
  const id = (crypto.randomUUID?.() || `ugc-${Date.now()}-${Math.random().toString(36).slice(2,8)}`);
  ugc.sessionId = id;
  const stamp = new Date().toISOString().slice(0,16).replace("T"," ");
  ugc.albumName = `UGC · ${ugc.subjectType} · ${stamp}`;
  return id;
}

function ugcStatus(msg, kind = "info") {
  const el = $("ugc-status");
  if (!msg) { el.classList.add("hidden"); return; }
  el.className = `status ${kind}`;
  el.textContent = msg;
  el.classList.remove("hidden");
}

function ugcSetSource({ url = null, dataUrl = null }) {
  ugc.sourceUrl = url;
  ugc.sourceDataUrl = dataUrl;
  const prev = $("ugc-source-preview");
  const src = dataUrl || url;
  if (src) {
    prev.classList.remove("empty");
    prev.innerHTML = "";
    const img = document.createElement("img");
    img.src = src;
    prev.appendChild(img);
  }
  refreshUgcPackButton();
}

function refreshUgcPackButton() {
  const ok = !!(ugc.sourceUrl || ugc.sourceDataUrl) && !!state.token && state.providers.length > 0 && $("ugc-master-prompt").value.trim().length > 10;
  $("ugc-generate-pack").disabled = !ok || ugc.busy;
}

function loadUgcTemplate(subject) {
  const pack = UGC_TEMPLATES[subject] || UGC_TEMPLATES.person;
  $("ugc-master-prompt").value = pack[0];
  ugc.shots = pack.map((p, i) => ({ prompt: p, status: "idle", result: null, selected: false, saved: false }));
  newUgcSession();
  renderUgcChain();
  refreshUgcPackButton();
}

// Subject chips
document.querySelectorAll("#ugc-subject-chips .chip").forEach((c) => {
  c.addEventListener("click", () => {
    document.querySelectorAll("#ugc-subject-chips .chip").forEach((x) => x.classList.toggle("active", x === c));
    ugc.subjectType = c.dataset.subject;
    loadUgcTemplate(ugc.subjectType);
  });
});

// Source widget
$("ugc-load-url").addEventListener("click", () => {
  const v = $("ugc-source-url").value.trim();
  if (!v) return;
  ugcSetSource({ url: v, dataUrl: v });
});
$("ugc-source-file").addEventListener("change", (e) => {
  const f = e.target.files?.[0];
  if (!f) return;
  const reader = new FileReader();
  reader.onload = () => ugcSetSource({ url: reader.result, dataUrl: reader.result });
  reader.readAsDataURL(f);
});
$("ugc-grab-tab").addEventListener("click", async () => {
  try {
    const tab = await chrome.tabs.query({ active: true, currentWindow: true });
    const dataUrl = await chrome.tabs.captureVisibleTab(tab[0].windowId, { format: "png" });
    ugcSetSource({ url: dataUrl, dataUrl });
  } catch (e) { ugcStatus(`Couldn't capture tab: ${e.message}`, "error"); }
});
$("ugc-pick-lib").addEventListener("click", () => openLibPicker("ugc-source"));

// Model presets — share state.modelOverride with Respin
function updateUgcModelChips() {
  document.querySelectorAll(".ugc-model-preset").forEach((b) => {
    b.classList.toggle("active", b.dataset.model === state.modelOverride);
  });
  $("ugc-model-input").value = state.modelOverride || "";
  const el = $("ugc-active-model");
  if (!el) return;
  const providerId = $("provider").value || null;
  const provider = state.providers.find((p) => p.id === providerId);
  const model = effectiveModelForProvider(provider);
  if (!provider) {
    el.textContent = "No provider selected — pick one in the Respin tab first.";
    el.style.color = "#c44";
  } else if (state.modelOverride && !isOpenRouterProvider(provider)) {
    el.textContent = `⚠ Next shot will use ${provider.name} → ${model}. Your "${state.modelOverride}" pick is ignored because ${provider.name} isn't an OpenRouter provider. Switch the Respin provider to an OpenRouter key to use Grok / custom models.`;
    el.style.color = "#c44";
  } else {
    el.textContent = `Next shot will use: ${provider.name} → ${model}`;
    el.style.color = "";
  }
}
document.querySelectorAll(".ugc-model-preset").forEach((b) => {
  b.addEventListener("click", () => {
    state.modelOverride = b.dataset.model;
    updateModelOverrideUI();
    updateUgcModelChips();
    ugcStatus(`Using ${b.dataset.model} for UGC and Respin.`, "success");
  });
});
$("ugc-model-apply").addEventListener("click", () => {
  const id = $("ugc-model-input").value.trim();
  if (!id || !/^[a-z0-9._-]+\/[a-z0-9._:-]+$/i.test(id)) {
    ugcStatus("Enter a valid OpenRouter model id, e.g. x-ai/grok-imagine", "error");
    return;
  }
  state.modelOverride = id;
  updateModelOverrideUI();
  updateUgcModelChips();
  ugcStatus(`Using ${id}.`, "success");
});
$("ugc-model-input").addEventListener("keydown", (e) => {
  if (e.key === "Enter") { e.preventDefault(); $("ugc-model-apply").click(); }
});

// Master prompt
$("ugc-master-prompt").addEventListener("input", () => {
  if (ugc.shots[0]) ugc.shots[0].prompt = $("ugc-master-prompt").value;
  refreshUgcPackButton();
});
$("ugc-reset-template").addEventListener("click", () => loadUgcTemplate(ugc.subjectType));

// Generate pack — AI-rewrites shots 2..6 based on master
$("ugc-generate-pack").addEventListener("click", async () => {
  const master = $("ugc-master-prompt").value.trim();
  if (!master) return;
  const providerId = $("provider").value || null;
  ugc.busy = true;
  refreshUgcPackButton();
  ugcStatus("AI is writing the follow-up prompts…", "info");
  try {
    const sys = `${UGC_CHAIN_SYSTEM}\nN = 5\nSubject category: ${ugc.subjectType}.`;
    const data = await api("imagekit-enhance-prompt", {
      provider_id: providerId,
      system: sys,
      prompt: `MASTER (shot 1):\n${master}\n\nReturn a JSON array of exactly 5 strings for shots 2 through 6.`,
      style: "ugc_chain",
    });
    const raw = (data?.enhanced_prompt || data?.text || "").trim();
    let arr = null;
    try {
      const match = raw.match(/\[[\s\S]*\]/);
      arr = match ? JSON.parse(match[0]) : JSON.parse(raw);
    } catch { /* fallback below */ }
    if (!Array.isArray(arr) || arr.length < 5) {
      // Fallback: split lines
      arr = raw.split(/\n+/).map((l) => l.replace(/^\s*[\d.\-)]+\s*/, "").trim()).filter(Boolean).slice(0, 5);
    }
    if (arr.length < 5) throw new Error("AI didn't return 5 follow-up prompts.");
    newUgcSession();
    ugc.shots = [
      { prompt: master, status: "idle", result: null, selected: false, saved: false },
      ...arr.slice(0, 5).map((p) => ({ prompt: String(p), status: "idle", result: null, selected: false, saved: false })),
    ];
    renderUgcChain();
    ugcStatus("Prompt pack ready. Generate shot 1 to start the chain.", "success");
  } catch (e) {
    ugcStatus(`Couldn't generate pack: ${e.message}. Using built-in template instead.`, "error");
    const pack = UGC_TEMPLATES[ugc.subjectType];
    newUgcSession();
    ugc.shots = pack.map((p, i) => ({ prompt: i === 0 ? master : p, status: "idle", result: null, selected: false, saved: false }));
    renderUgcChain();
  } finally {
    ugc.busy = false;
    refreshUgcPackButton();
  }
});

function renderUgcChain() {
  const root = $("ugc-chain");
  root.innerHTML = "";
  const anyReady = ugc.shots.some((s) => s.result);
  $("ugc-toolbar-top").classList.toggle("hidden", !anyReady);
  $("ugc-toolbar-bottom").classList.toggle("hidden", !anyReady);
  if (!ugc.shots.length) return;
  // Determine which shot is "live" — first non-approved
  const liveIdx = ugc.shots.findIndex((s) => s.status !== "approved");
  ugc.shots.forEach((shot, i) => {
    const card = document.createElement("div");
    card.className = "ugc-shot-card";
    if (shot.status === "done") card.classList.add("done");
    if (shot.status === "approved") card.classList.add("approved");
    if (shot.saved) card.classList.add("saved");
    // Lock future shots if a previous one isn't approved (except shot 0)
    if (i > 0 && ugc.shots[i - 1].status !== "approved") card.classList.add("locked");

    const header = document.createElement("div");
    header.className = "shot-header";
    const num = document.createElement("span");
    num.className = "shot-num";
    num.textContent = `Shot ${i + 1} of ${ugc.shots.length}`;
    const st = document.createElement("span");
    st.className = "shot-state";
    st.textContent = ({ idle: "Pending", running: "Generating…", done: "Ready — review or approve", approved: "Approved ✓" })[shot.status];
    header.appendChild(num);
    if (shot.result) {
      const sel = document.createElement("label");
      sel.className = "shot-select";
      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.checked = !!shot.selected;
      cb.addEventListener("change", () => { shot.selected = cb.checked; });
      sel.appendChild(cb);
      sel.appendChild(document.createTextNode("Select"));
      header.appendChild(sel);
    }
    header.appendChild(st);
    card.appendChild(header);

    const ta = document.createElement("textarea");
    ta.value = shot.prompt;
    ta.addEventListener("input", () => {
      shot.prompt = ta.value;
      if (i === 0) $("ugc-master-prompt").value = ta.value;
    });
    card.appendChild(ta);

    const actions = document.createElement("div");
    actions.className = "row";
    actions.style.marginTop = "6px";
    const genBtn = document.createElement("button");
    genBtn.type = "button";
    genBtn.className = "primary";
    genBtn.textContent = shot.result ? "Re-generate" : "Generate shot";
    genBtn.addEventListener("click", () => generateUgcShot(i));
    actions.appendChild(genBtn);

    if (shot.result) {
      if (shot.status === "done") {
      const approveBtn = document.createElement("button");
      approveBtn.type = "button";
      approveBtn.className = "secondary";
      approveBtn.textContent = i === ugc.shots.length - 1 ? "Approve" : "Approve & unlock next";
      approveBtn.addEventListener("click", () => approveUgcShot(i));
      actions.appendChild(approveBtn);
      }

      const saveBtn = document.createElement("button");
      saveBtn.type = "button";
      saveBtn.className = "secondary";
      saveBtn.textContent = shot.saved ? "Save again" : "Save";
      saveBtn.addEventListener("click", () => saveUgcShot(i));
      actions.appendChild(saveBtn);

      const dlBtn = document.createElement("button");
      dlBtn.type = "button";
      dlBtn.className = "secondary";
      dlBtn.textContent = "Download";
      dlBtn.addEventListener("click", () => downloadUgcShot(i));
      actions.appendChild(dlBtn);
    }
    card.appendChild(actions);

    if (shot.result) {
      const img = document.createElement("img");
      img.className = "shot-img";
      img.src = `data:${shot.result.mime_type};base64,${shot.result.image_base64}`;
      card.appendChild(img);
      const meta = document.createElement("div");
      meta.className = "shot-meta";
      meta.textContent = `${shot.result.provider_name} · ${shot.result.model_name} · ${(shot.result.duration_ms/1000).toFixed(1)}s`;
      card.appendChild(meta);

      // Per-shot refine
      const refineRow = document.createElement("div");
      refineRow.className = "refine-row";
      const refineInput = document.createElement("input");
      refineInput.type = "text";
      refineInput.placeholder = "Refine — e.g. 'warmer light, hair a bit longer'";
      const refineBtn = document.createElement("button");
      refineBtn.type = "button";
      refineBtn.className = "secondary";
      refineBtn.textContent = "Refine";
      refineBtn.addEventListener("click", () => refineUgcShot(i, refineInput.value.trim()));
      refineRow.appendChild(refineInput);
      refineRow.appendChild(refineBtn);
      card.appendChild(refineRow);
    }

    root.appendChild(card);
  });
}

async function generateUgcShot(i) {
  if (ugc.busy) return;
  const shot = ugc.shots[i];
  if (!shot) return;
  const providerId = $("provider").value || null;
  const provider = state.providers.find((p) => p.id === providerId);
  const model = effectiveModelForProvider(provider);
  const refs = [];
  if (ugc.sourceUrl) refs.push(ugc.sourceUrl);
  // Reference the most recently approved/done previous shot's image for identity lock
  for (let j = i - 1; j >= 0; j--) {
    const prev = ugc.shots[j];
    if (prev?.result) {
      refs.push(`data:${prev.result.mime_type};base64,${prev.result.image_base64}`);
      break;
    }
  }
  ugc.busy = true;
  shot.status = "running";
  renderUgcChain();
  ugcStatus(`Generating shot ${i + 1}…`, "info");
  try {
    const data = await api("imagekit-generate", {
      provider_id: providerId,
      model,
      mode: "lifestyle",
      prompt: shot.prompt,
      images: refs,
    });
    if (data.error) throw new Error(data.error);
    shot.result = data;
    shot.lastModel = model;
    shot.lastProviderId = providerId;
    shot.status = "done";
    ugcStatus(`Shot ${i + 1} ready — refine or approve.`, "success");
  } catch (e) {
    shot.status = "idle";
    ugcStatus(`Shot ${i + 1} failed: ${e.message}`, "error");
  } finally {
    ugc.busy = false;
    renderUgcChain();
  }
}

async function refineUgcShot(i, refineText) {
  if (!refineText) { ugcStatus("Type what to change.", "error"); return; }
  const shot = ugc.shots[i];
  if (!shot?.result || ugc.busy) return;
  ugc.busy = true;
  shot.status = "running";
  renderUgcChain();
  ugcStatus(`Refining shot ${i + 1}…`, "info");
  try {
    const currentDataUrl = `data:${shot.result.mime_type};base64,${shot.result.image_base64}`;
    const data = await api("imagekit-generate", {
      provider_id: shot.lastProviderId,
      model: shot.lastModel,
      mode: "refine",
      prompt: refineText,
      images: [currentDataUrl, ugc.sourceUrl].filter(Boolean),
    });
    if (data.error) throw new Error(data.error);
    shot.result = data;
    shot.status = "done";
    ugcStatus(`Shot ${i + 1} refined.`, "success");
  } catch (e) {
    shot.status = "done";
    ugcStatus(`Refine failed: ${e.message}`, "error");
  } finally {
    ugc.busy = false;
    renderUgcChain();
  }
}

function approveUgcShot(i) {
  const shot = ugc.shots[i];
  if (!shot?.result) return;
  shot.status = "approved";
  renderUgcChain();
  const next = ugc.shots[i + 1];
  if (next && next.status === "idle") {
    ugcStatus(`Shot ${i + 1} approved — edit shot ${i + 2}'s prompt, then click Generate shot.`, "info");
  } else {
    ugcStatus("Chain complete ✓ — save the shots you want to keep.", "success");
  }
}

async function saveUgcShot(i) {
  const shot = ugc.shots[i];
  if (!shot?.result) return;
  ugcStatus(`Saving shot ${i + 1}…`, "info");
  try {
    await api("imagekit-save", {
      image_base64: shot.result.image_base64,
      mime_type: shot.result.mime_type,
      kind: "ugc",
      album: ugc.albumName,
      session_id: ugc.sessionId,
      source_metadata: {
        prompt: shot.prompt,
        subject_type: ugc.subjectType,
        shot_index: i + 1,
        shot_count: ugc.shots.length,
        ugc_album: ugc.albumName,
        ugc_session_id: ugc.sessionId,
        provider: shot.result.provider_name,
        model: shot.result.model_name,
        source_urls: [ugc.sourceUrl].filter((s) => s && !s.startsWith("data:")),
      },
    });
    shot.saved = true;
    renderUgcChain();
    ugcStatus(`Shot ${i + 1} saved to library ✓`, "success");
  } catch (e) {
    ugcStatus(`Save failed: ${e.message}`, "error");
  }
}

function downloadUgcShot(i) {
  const shot = ugc.shots[i];
  if (!shot?.result) return;
  const a = document.createElement("a");
  a.href = `data:${shot.result.mime_type};base64,${shot.result.image_base64}`;
  const slug = (ugc.albumName || "ugc").replace(/[^a-z0-9]+/gi, "-").toLowerCase().slice(0, 40);
  a.download = `${slug}-shot-${i + 1}.png`;
  a.click();
}

// --- bulk actions ---
function ugcReadyShots() { return ugc.shots.map((s, i) => ({ s, i })).filter(({ s }) => !!s.result); }
function ugcSelectedShots() { return ugcReadyShots().filter(({ s }) => s.selected); }

async function downloadUgcMany(list, label) {
  if (!list.length) { ugcStatus(`No shots to ${label}.`, "error"); return; }
  for (const { i } of list) {
    downloadUgcShot(i);
    await new Promise((r) => setTimeout(r, 250)); // browsers throttle rapid downloads
  }
  ugcStatus(`${label}: ${list.length} shot(s) downloaded.`, "success");
}
async function saveUgcMany(list, label) {
  if (!list.length) { ugcStatus(`No shots to ${label}.`, "error"); return; }
  let ok = 0, fail = 0;
  for (const { i } of list) {
    try { await saveUgcShot(i); ok++; } catch (_) { fail++; }
  }
  ugcStatus(`${label}: ${ok} saved${fail ? `, ${fail} failed` : ""}.`, fail ? "error" : "success");
}

function wireUgcToolbars() {
  document.querySelectorAll(".ugc-select-all").forEach((b) =>
    b.addEventListener("click", () => {
      const ready = ugcReadyShots();
      const allSelected = ready.length > 0 && ready.every(({ s }) => s.selected);
      ready.forEach(({ s }) => { s.selected = !allSelected; });
      renderUgcChain();
    })
  );
  document.querySelectorAll(".ugc-download-selected").forEach((b) =>
    b.addEventListener("click", () => downloadUgcMany(ugcSelectedShots(), "Download selected"))
  );
  document.querySelectorAll(".ugc-save-selected").forEach((b) =>
    b.addEventListener("click", () => saveUgcMany(ugcSelectedShots(), "Save selected"))
  );
  document.querySelectorAll(".ugc-download-all").forEach((b) =>
    b.addEventListener("click", () => downloadUgcMany(ugcReadyShots(), "Download all"))
  );
  document.querySelectorAll(".ugc-save-all").forEach((b) =>
    b.addEventListener("click", () => saveUgcMany(ugcReadyShots(), "Save all"))
  );
}
wireUgcToolbars();

// Initialise default template
loadUgcTemplate("person");
updateUgcModelChips();

// ============================================================
// Image → Video tab
// ============================================================

// Tips reflect the structured prompt pattern from
// https://deevid.ai/blog/grok-imagine-video-review:
//   Subject → Motion → Camera → Environment → Style → Timing → Audio intent
const VIDEO_PROMPT_SYSTEM = `You are a senior motion director and prompt engineer for image-to-video AI models (Veo 3 / 3.1, Sora 2, Grok Imagine, Kling 2.1/3, Luma Ray, PixVerse, Hailuo, Wan).

Rewrite the user's rough idea into ONE production-ready image-to-video prompt that maximises motion fidelity and shot quality across these models. Follow this exact structure on a single paragraph, in this order:

1. SUBJECT — describe what is in the source image in concrete nouns and adjectives. Lock identity, wardrobe, product, logo, pose. Do NOT invent new objects or change colour, age, or branding.
2. MOTION — one primary motion verb (dolly-in, dolly-out, orbit-left, orbit-right, push-in, pull-back, pan-left, pan-right, tilt-up, tilt-down, parallax, crane-up, handheld float, rack-focus, rotate 360°, walk-cycle, gentle sway). Optionally one secondary micro-motion (hair drift, fabric flutter, steam rising, light flicker, liquid pour, particles).
3. CAMERA — focal length (24mm wide, 35mm, 50mm, 85mm portrait, macro), depth of field (shallow / deep), framing (close-up, medium, wide, over-the-shoulder), rig (locked-off, gimbal, handheld). Add intent ("subject stays centred, no cuts").
4. ENVIRONMENT — location, surface, lighting direction & quality (golden-hour rim, soft north window, neon street wet ground, studio softbox high-key), atmosphere (haze, dust motes, mist), time of day.
5. STYLE — visual reference ("premium commercial spot", "A24 cinematic", "Wes Anderson symmetry", "UGC iPhone vertical", "anime cel", "documentary 16mm grain"). Colour grade ("teal-orange", "warm desaturated", "high-contrast B&W").
6. TIMING — pacing matched to the target duration. 5s → snappy single beat, seamless loop friendly. 6–8s → one clean reveal with ease-in/ease-out. 10s+ → slow build, two beats max. State seconds explicitly ("over 8 seconds, ease-in 0–2s, hold 2–6s, ease-out 6–8s").
7. AUDIO — include ONLY if any target model supports synced audio (Veo, Sora, Wan 2.6). Describe diegetic sound design ("ambient room tone, subtle fabric rustle, no dialogue, no music"). Otherwise write exactly "Audio: n/a".
8. NEGATIVES — append "Avoid: morphing, identity drift, extra limbs, text artefacts, jump cuts, watermark, logo distortion."

Hard rules:
- Output ONLY the final prompt. No preamble, no headings, no bullets, no markdown, no quotes.
- 60–110 words. Dense, comma-separated clauses. Present tense.
- Never contradict the source image. If the user invents details not in the image, drop them.
- Exactly one primary motion verb. No "and then" sequences.
- Use concrete cinematography vocabulary, not vague adjectives ("beautiful", "amazing", "stunning" are banned).`;

// Provider is inferred from slug prefix: fal-ai/* → fal, anything else → openrouter.
// Backend (imagekit-video-generate) routes by the same rule.
function providerForSlug(slug) {
  return /^fal-ai\//i.test(slug) ? "fal" : "openrouter";
}

const VIDEO_MODELS = {
  // ── fal.ai ────────────────────────────────────────────────────────────────
  "fal-ai/veo3/image-to-video":                       { label: "Veo 3",            provider: "fal", durMin: 8, durMax: 8,  durDefault: 8, resolutions: ["720p","1080p"], aspects: ["16:9","9:16"],         audio: true,  pricePerSec: { "720p": 0.50, "1080p": 0.75 } },
  "fal-ai/veo3/fast/image-to-video":                  { label: "Veo 3 Fast",       provider: "fal", durMin: 8, durMax: 8,  durDefault: 8, resolutions: ["720p","1080p"], aspects: ["16:9","9:16"],         audio: true,  pricePerSec: { "720p": 0.25, "1080p": 0.40 } },
  "fal-ai/kling-video/v2.1/standard/image-to-video":  { label: "Kling 2.1 Std",    provider: "fal", durMin: 5, durMax: 10, durDefault: 5, resolutions: ["720p"],         aspects: ["16:9","9:16","1:1"],   audio: false, pricePerSec: { "720p": 0.05 } },
  "fal-ai/kling-video/v2.1/pro/image-to-video":       { label: "Kling 2.1 Pro",    provider: "fal", durMin: 5, durMax: 10, durDefault: 5, resolutions: ["720p","1080p"], aspects: ["16:9","9:16","1:1"],   audio: false, pricePerSec: { "720p": 0.09, "1080p": 0.09 } },
  "fal-ai/minimax/hailuo-02/standard/image-to-video": { label: "Hailuo-02",        provider: "fal", durMin: 6, durMax: 10, durDefault: 6, resolutions: ["768p"],         aspects: ["16:9","9:16","1:1"],   audio: false, pricePerSec: { "768p": 0.045 } },
  "fal-ai/luma-dream-machine/ray-2/image-to-video":   { label: "Luma Ray 2",       provider: "fal", durMin: 5, durMax: 9,  durDefault: 5, resolutions: ["720p","1080p"], aspects: ["16:9","9:16","1:1"],   audio: false, pricePerSec: { "720p": 0.12, "1080p": 0.18 } },
  "fal-ai/pixverse/v4.5/image-to-video":              { label: "PixVerse 4.5",     provider: "fal", durMin: 5, durMax: 8,  durDefault: 5, resolutions: ["540p","720p","1080p"], aspects: ["16:9","9:16","1:1"], audio: false, pricePerSec: { "540p": 0.03, "720p": 0.04, "1080p": 0.10 } },
  "fal-ai/wan-pro/image-to-video":                    { label: "Wan Pro",          provider: "fal", durMin: 6, durMax: 6,  durDefault: 6, resolutions: ["720p"],         aspects: ["16:9","9:16","1:1"],   audio: false, pricePerSec: { "720p": 0.08 } },
  // ── OpenRouter ───────────────────────────────────────────────────────────
  "x-ai/grok-imagine-video":   { label: "Grok Imagine",     provider: "openrouter", durMin: 1, durMax: 15, durDefault: 8, resolutions: ["480p","720p"],  aspects: ["16:9","9:16","1:1","4:3","3:4","3:2","2:3"], audio: false, pricePerSec: { "480p": 0.05, "720p": 0.07 } },
  "google/veo-3.1-fast":       { label: "Veo 3.1 Fast",     provider: "openrouter", durMin: 4, durMax: 8,  durDefault: 6, resolutions: ["720p","1080p"], aspects: ["16:9","9:16"],                               audio: true,  pricePerSec: { "720p": 0.10, "1080p": 0.10 } },
  "google/veo-3.1":            { label: "Veo 3.1",          provider: "openrouter", durMin: 4, durMax: 8,  durDefault: 6, resolutions: ["1080p"],        aspects: ["16:9","9:16"],                               audio: true,  pricePerSec: { "1080p": 0.20 } },
  "kwaivgi/kling-v3.0-std":    { label: "Kling v3 Std",     provider: "openrouter", durMin: 3, durMax: 15, durDefault: 5, resolutions: ["720p"],         aspects: ["16:9","9:16","1:1"],                         audio: false, pricePerSec: { "720p": 0.126 } },
  "minimax/hailuo-2.3":        { label: "MiniMax Hailuo",   provider: "openrouter", durMin: 5, durMax: 10, durDefault: 6, resolutions: ["720p","1080p"], aspects: ["16:9","9:16","1:1"],                         audio: false, pricePerSec: { "720p": 0.0817, "1080p": 0.0817 } },
  "alibaba/wan-2.6":           { label: "Wan 2.6",          provider: "openrouter", durMin: 4, durMax: 15, durDefault: 5, resolutions: ["720p","1080p"], aspects: ["16:9","9:16","1:1"],                         audio: true,  pricePerSec: { "720p": 0.04, "1080p": 0.04 } },
  "openai/sora-2-pro":         { label: "Sora 2 Pro",       provider: "openrouter", durMin: 4, durMax: 12, durDefault: 6, resolutions: ["720p","1080p"], aspects: ["16:9","9:16","1:1"],                         audio: true,  pricePerSec: { "720p": 0.30, "1080p": 0.30 } },
};

const VIDEO_SLOT_DEFAULTS = [
  { model: "fal-ai/veo3/image-to-video",                      resolution: "720p", aspect: "16:9" },
  { model: "fal-ai/kling-video/v2.1/standard/image-to-video", resolution: "720p", aspect: "16:9" },
  { model: "x-ai/grok-imagine-video",                         resolution: "720p", aspect: "16:9" },
];

const video = {
  sourceUrl: null,
  sourceDataUrl: null,
  slots: VIDEO_SLOT_DEFAULTS.map((d) => {
    const m = VIDEO_MODELS[d.model];
    return {
      model: d.model,
      resolution: d.resolution,
      aspect: d.aspect,
      duration: m.durDefault,
      prompt: "",
      status: "idle", // idle | queued | rendering | ready | failed
      progressMsg: "",
      jobId: null,
      result: null,   // { video_url, mime_type, provider_name, model_name, duration_s }
      saved: false,
      pollAbort: false,
    };
  }),
  sessionId: null,
  albumName: null,
};

function newVideoSession() {
  const id = (crypto.randomUUID?.() || `i2v-${Date.now()}-${Math.random().toString(36).slice(2,8)}`);
  video.sessionId = id;
  video.albumName = `I2V · ${new Date().toISOString().slice(0,16).replace("T"," ")}`;
  return id;
}

function videoStatus(msg, kind = "info") {
  const el = $("video-status");
  if (!msg) { el.classList.add("hidden"); return; }
  el.className = `status ${kind}`;
  el.textContent = msg;
  el.classList.remove("hidden");
}

function videoSetSource({ url = null, dataUrl = null }) {
  video.sourceUrl = url;
  video.sourceDataUrl = dataUrl;
  const prev = $("video-source-preview");
  const src = dataUrl || url;
  if (src) {
    prev.classList.remove("empty");
    prev.innerHTML = "";
    const img = document.createElement("img");
    img.src = src;
    prev.appendChild(img);
  }
  refreshVideoGenerateAll();
}

function refreshVideoGenerateAll() {
  const hasSrc = !!(video.sourceUrl || video.sourceDataUrl);
  const hasPrompt = video.slots.some((s) => (s.prompt || $("vp-master").value).trim().length > 4);
  const linked = !!state.token;
  const hasProvider = state.providers.length > 0;
  $("vp-generate-all").disabled = !(hasSrc && hasPrompt && linked && hasProvider);
  updateVideoCostTotal();
}

function updateVideoCostTotal() {
  let total = 0;
  for (const s of video.slots) {
    const m = VIDEO_MODELS[s.model];
    if (!m) continue;
    const p = m.pricePerSec[s.resolution] ?? Object.values(m.pricePerSec)[0] ?? 0;
    total += p * s.duration;
  }
  $("vp-cost-total").textContent = total > 0 ? `Est. total: $${total.toFixed(2)} across 3 slots` : "";
}

function composeMasterFromFields() {
  const parts = [
    $("vp-subject").value.trim(),
    $("vp-motion").value.trim() && `Motion: ${$("vp-motion").value.trim()}`,
    $("vp-camera").value.trim() && `Camera: ${$("vp-camera").value.trim()}`,
    $("vp-env").value.trim() && `Environment: ${$("vp-env").value.trim()}`,
    $("vp-style").value.trim() && `Style: ${$("vp-style").value.trim()}`,
    $("vp-timing").value.trim() && `Timing: ${$("vp-timing").value.trim()}`,
    $("vp-audio").value.trim() && `Audio: ${$("vp-audio").value.trim()}`,
  ].filter(Boolean);
  if (parts.length === 0) return "";
  return parts.join(". ");
}

function renderVideoSlots() {
  const root = $("video-slots");
  root.innerHTML = "";
  video.slots.forEach((slot, i) => {
    const m = VIDEO_MODELS[slot.model] || VIDEO_MODELS["fal-ai/veo3/image-to-video"];
    const card = document.createElement("div");
    card.className = `video-slot-card ${slot.status}`;

    const header = document.createElement("div");
    header.className = "slot-header";
    const title = document.createElement("span");
    title.className = "slot-title";
    const slotProvider = m.provider || providerForSlug(slot.model);
    title.innerHTML = `Slot ${i + 1} <span style="font-size:10px;padding:1px 5px;border-radius:3px;background:${slotProvider === "fal" ? "#dbeafe" : "#fce7f3"};color:${slotProvider === "fal" ? "#1e40af" : "#9d174d"};font-weight:600;text-transform:uppercase;letter-spacing:0.3px;">${slotProvider === "fal" ? "fal" : "OR"}</span>`;
    const st = document.createElement("span");
    st.className = "slot-state";
    st.textContent = ({ idle: "Ready", queued: "Queued…", rendering: slot.progressMsg || "Rendering…", ready: "Ready ✓", failed: "Failed" })[slot.status];
    const cost = document.createElement("span");
    cost.className = "cost-pill";
    const ps = m.pricePerSec[slot.resolution] ?? Object.values(m.pricePerSec)[0] ?? 0;
    cost.textContent = `≈ $${(ps * slot.duration).toFixed(2)}`;
    header.appendChild(title);
    header.appendChild(cost);
    header.appendChild(st);
    card.appendChild(header);

    // Model picker — grouped by provider so the source key is obvious
    const modelSel = document.createElement("select");
    const falGroup = document.createElement("optgroup"); falGroup.label = "fal.ai (uses fal BYOK key)";
    const orGroup  = document.createElement("optgroup"); orGroup.label  = "OpenRouter (uses OpenRouter BYOK key)";
    for (const [id, def] of Object.entries(VIDEO_MODELS)) {
      const opt = document.createElement("option");
      opt.value = id;
      opt.textContent = `${def.label} — ${id}`;
      if (id === slot.model) opt.selected = true;
      (def.provider === "fal" ? falGroup : orGroup).appendChild(opt);
    }
    modelSel.appendChild(falGroup);
    modelSel.appendChild(orGroup);
    modelSel.addEventListener("change", () => {
      slot.model = modelSel.value;
      const newDef = VIDEO_MODELS[slot.model];
      if (!newDef.resolutions.includes(slot.resolution)) slot.resolution = newDef.resolutions[0];
      if (!newDef.aspects.includes(slot.aspect)) slot.aspect = newDef.aspects[0];
      slot.duration = Math.max(newDef.durMin, Math.min(newDef.durMax, slot.duration));
      renderVideoSlots();
      updateVideoCostTotal();
    });
    card.appendChild(modelSel);

    // Custom slug row — accepts either fal.ai or OpenRouter format
    const customRow = document.createElement("div");
    customRow.className = "row";
    const customInput = document.createElement("input");
    customInput.type = "text";
    customInput.className = "custom-model-input";
    customInput.placeholder = "or paste a slug — fal-ai/… or org/model";
    customInput.value = VIDEO_MODELS[slot.model] ? "" : slot.model;
    const customBtn = document.createElement("button");
    customBtn.type = "button";
    customBtn.className = "secondary";
    customBtn.textContent = "Use";
    customBtn.addEventListener("click", () => {
      const id = customInput.value.trim();
      if (!/^[a-z0-9._-]+\/[a-z0-9._/:-]+$/i.test(id)) { videoStatus("Enter a valid slug, e.g. fal-ai/veo3/image-to-video or x-ai/grok-imagine-video", "error"); return; }
      // Register unknown model with permissive defaults so the UI works
      if (!VIDEO_MODELS[id]) {
        VIDEO_MODELS[id] = { label: id, provider: providerForSlug(id), durMin: 1, durMax: 15, durDefault: 6, resolutions: ["720p","1080p"], aspects: ["16:9","9:16","1:1"], audio: false, pricePerSec: { "720p": 0.10, "1080p": 0.10 } };
      }
      slot.model = id;
      renderVideoSlots();
    });
    customRow.appendChild(customInput);
    customRow.appendChild(customBtn);
    card.appendChild(customRow);

    // Controls grid: duration / resolution / aspect
    const controls = document.createElement("div");
    controls.className = "slot-controls";

    const durLbl = document.createElement("label");
    durLbl.innerHTML = `Duration <span class="muted" style="font-size:10px;">(${m.durMin}–${m.durMax}s)</span>`;
    const durIn = document.createElement("input");
    durIn.type = "number"; durIn.min = m.durMin; durIn.max = m.durMax; durIn.step = "1"; durIn.value = slot.duration;
    durIn.addEventListener("input", () => {
      const v = Math.max(m.durMin, Math.min(m.durMax, parseInt(durIn.value, 10) || m.durDefault));
      slot.duration = v;
      const newCost = (m.pricePerSec[slot.resolution] ?? 0) * v;
      cost.textContent = `≈ $${newCost.toFixed(2)}`;
      updateVideoCostTotal();
    });
    durLbl.appendChild(durIn);
    controls.appendChild(durLbl);

    const resLbl = document.createElement("label");
    resLbl.textContent = "Resolution";
    const resSel = document.createElement("select");
    for (const r of m.resolutions) {
      const o = document.createElement("option"); o.value = r; o.textContent = r; if (r === slot.resolution) o.selected = true; resSel.appendChild(o);
    }
    resSel.addEventListener("change", () => { slot.resolution = resSel.value; renderVideoSlots(); updateVideoCostTotal(); });
    resLbl.appendChild(resSel);
    controls.appendChild(resLbl);

    const aspLbl = document.createElement("label");
    aspLbl.textContent = "Aspect";
    const aspSel = document.createElement("select");
    for (const a of m.aspects) {
      const o = document.createElement("option"); o.value = a; o.textContent = a; if (a === slot.aspect) o.selected = true; aspSel.appendChild(o);
    }
    aspSel.addEventListener("change", () => { slot.aspect = aspSel.value; });
    aspLbl.appendChild(aspSel);
    controls.appendChild(aspLbl);

    if (m.audio) {
      const audLbl = document.createElement("label");
      audLbl.innerHTML = "Audio<span class='muted' style='font-size:10px;'>synced</span>";
      const audVal = document.createElement("div");
      audVal.style.fontSize = "11px"; audVal.style.color = "#2563eb"; audVal.textContent = "✓ supported";
      audLbl.appendChild(audVal);
      controls.appendChild(audLbl);
    }
    card.appendChild(controls);

    // Per-slot prompt (defaults to master)
    const ta = document.createElement("textarea");
    ta.value = slot.prompt || $("vp-master").value;
    ta.placeholder = "Slot prompt (defaults to master). Edit per-slot if needed.";
    ta.addEventListener("input", () => { slot.prompt = ta.value; refreshVideoGenerateAll(); });
    card.appendChild(ta);

    // Actions row
    const actions = document.createElement("div");
    actions.className = "row";
    const genBtn = document.createElement("button");
    genBtn.type = "button";
    genBtn.className = "primary";
    genBtn.disabled = !video.sourceUrl || !state.token || state.providers.length === 0;
    genBtn.textContent = slot.result ? "Re-generate" : "Generate";
    genBtn.addEventListener("click", () => generateVideoSlot(i));
    actions.appendChild(genBtn);

    if (slot.result) {
      const dl = document.createElement("button");
      dl.type = "button"; dl.className = "secondary"; dl.textContent = "Download";
      dl.addEventListener("click", () => downloadVideoSlot(i));
      actions.appendChild(dl);
      const sv = document.createElement("button");
      sv.type = "button"; sv.className = "secondary"; sv.textContent = slot.saved ? "Save again" : "Save to Library";
      sv.addEventListener("click", () => saveVideoSlot(i));
      actions.appendChild(sv);
    }
    if (slot.status === "rendering" || slot.status === "queued") {
      const cancel = document.createElement("button");
      cancel.type = "button"; cancel.className = "secondary"; cancel.textContent = "Cancel";
      cancel.addEventListener("click", () => { slot.pollAbort = true; slot.status = "idle"; renderVideoSlots(); });
      actions.appendChild(cancel);
    }
    card.appendChild(actions);

    if (slot.progressMsg && (slot.status === "rendering" || slot.status === "queued")) {
      const p = document.createElement("div");
      p.className = "video-progress";
      p.textContent = slot.progressMsg;
      card.appendChild(p);
    }

    if (slot.result?.video_url) {
      const v = document.createElement("video");
      v.src = slot.result.video_url;
      v.controls = true;
      v.loop = true;
      card.appendChild(v);
      const meta = document.createElement("div");
      meta.className = "shot-meta muted";
      meta.style.fontSize = "11px"; meta.style.marginTop = "4px";
      meta.textContent = `${slot.result.provider_name || ""} · ${slot.result.model_name || slot.model} · ${slot.result.duration_s || slot.duration}s`;
      card.appendChild(meta);
    }

    root.appendChild(card);
  });
}

async function generateVideoSlot(i) {
  const slot = video.slots[i];
  if (!slot) return;
  if (!video.sourceUrl) { videoStatus("Add a source image first.", "error"); return; }
  if (!video.sessionId) newVideoSession();
  const prompt = (slot.prompt || $("vp-master").value || "").trim();
  if (!prompt) { videoStatus(`Slot ${i + 1} needs a prompt.`, "error"); return; }
  const providerId = $("provider").value || null;
  slot.status = "queued";
  slot.progressMsg = "Submitting job…";
  slot.pollAbort = false;
  renderVideoSlots();
  try {
    const data = await api("imagekit-video-generate", {
      provider_id: providerId,
      model: slot.model,
      model_slug: slot.model,
      prompt,
      image_url: video.sourceUrl,
      duration_seconds: slot.duration,
      resolution: slot.resolution,
      aspect_ratio: slot.aspect,
    });
    if (data.error) throw new Error(data.error);
    // Two possible response shapes:
    //   { job_id, provider, provider_id, model_slug, status_url, response_url } — async
    //   { video_url, mime_type, ... }               — sync, finished already
    slot.providerName  = data.provider || providerForSlug(slot.model);
    slot.providerJobId = data.provider_id || null;
    slot.modelSlug     = data.model_slug || slot.model;
    slot.statusUrl     = data.status_url || null;
    slot.responseUrl   = data.response_url || null;
    if (data.video_url) {
      slot.result = data;
      slot.status = "ready";
      slot.progressMsg = "";
      videoStatus(`Slot ${i + 1} ready.`, "success");
    } else if (data.job_id) {
      slot.jobId = data.job_id;
      slot.status = "rendering";
      slot.progressMsg = `Submitted to ${slot.providerName} — waiting…`;
      await pollVideoJob(i);
    } else {
      throw new Error("Backend returned no job_id or video_url.");
    }
  } catch (e) {
    slot.status = "failed";
    slot.progressMsg = e.message || "Generation failed";
    videoStatus(`Slot ${i + 1} failed: ${e.message}`, "error");
  } finally {
    renderVideoSlots();
  }
}

async function pollVideoJob(i) {
  const slot = video.slots[i];
  const started = Date.now();
  const MAX_MS = 12 * 60 * 1000; // 12 minutes
  while (!slot.pollAbort) {
    await new Promise((r) => setTimeout(r, 5000));
    if (slot.pollAbort) return;
    if (Date.now() - started > MAX_MS) {
      slot.status = "failed";
      slot.progressMsg = "Timed out after 12 min. Check ReadyCode dashboard.";
      return;
    }
    try {
      const data = await api("imagekit-video-status", {
        job_id: slot.jobId,
        provider: slot.providerName || undefined,
        provider_id: slot.providerJobId || undefined,
        model_slug: slot.modelSlug || slot.model,
        status_url: slot.statusUrl || undefined,
        response_url: slot.responseUrl || undefined,
      });
      const st = (data?.status || "").toLowerCase();
      if (st === "queued" && data?.queue_position != null) {
        slot.progressMsg = `In queue (#${data.queue_position})…`;
      } else if (st === "in_progress" && data?.progress != null) {
        slot.progressMsg = `Rendering — ${data.progress}%`;
      } else if (data?.progress != null) {
        slot.progressMsg = `Rendering — ${data.progress}%`;
      } else if (Array.isArray(data?.logs) && data.logs.length) {
        slot.progressMsg = String(data.logs[data.logs.length - 1]).slice(0, 120);
      } else if (data?.message) {
        slot.progressMsg = data.message;
      } else if (st === "in_progress") {
        slot.progressMsg = "Rendering…";
      }
      renderVideoSlots();
      if (st === "completed" || st === "succeeded" || data?.video_url) {
        slot.result = data;
        slot.status = "ready";
        slot.progressMsg = "";
        renderVideoSlots();
        videoStatus(`Slot ${i + 1} ready.`, "success");
        return;
      }
      if (st === "failed" || st === "error") {
        slot.status = "failed";
        slot.progressMsg = data?.error || data?.message || "Render failed";
        return;
      }
    } catch (e) {
      slot.progressMsg = `Polling: ${e.message}`;
    }
  }
}

async function downloadVideoSlot(i) {
  const slot = video.slots[i];
  if (!slot?.result?.video_url) return;
  try {
    const res = await fetch(slot.result.video_url);
    const blob = await res.blob();
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    const slug = (video.albumName || "i2v").replace(/[^a-z0-9]+/gi, "-").toLowerCase().slice(0, 40);
    a.download = `${slug}-slot${i + 1}.mp4`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 10000);
  } catch (e) {
    videoStatus(`Download failed: ${e.message}`, "error");
  }
}

async function saveVideoSlot(i) {
  const slot = video.slots[i];
  if (!slot?.result?.video_url) return;
  videoStatus(`Saving slot ${i + 1} to library…`, "info");
  try {
    await api("imagekit-save", {
      video_url: slot.result.video_url,
      mime_type: slot.result.mime_type || "video/mp4",
      kind: "video",
      duration_seconds: slot.duration,
      album: video.albumName,
      session_id: video.sessionId,
      source_metadata: {
        prompt: slot.prompt || $("vp-master").value,
        model: slot.model,
        model_slug: slot.modelSlug || slot.model,
        provider: slot.providerName || providerForSlug(slot.model),
        duration_s: slot.duration,
        resolution: slot.resolution,
        aspect_ratio: slot.aspect,
        i2v_album: video.albumName,
        i2v_session_id: video.sessionId,
        source_urls: [video.sourceUrl].filter((s) => s && !s.startsWith("data:")),
      },
    });
    slot.saved = true;
    renderVideoSlots();
    videoStatus(`Slot ${i + 1} saved ✓`, "success");
  } catch (e) {
    videoStatus(`Save failed: ${e.message}`, "error");
  }
}

// --- video tab wiring ---
$("video-load-url").addEventListener("click", () => {
  const v = $("video-source-url").value.trim();
  if (!v) return;
  videoSetSource({ url: v, dataUrl: v });
});
$("video-source-file").addEventListener("change", (e) => {
  const f = e.target.files?.[0];
  if (!f) return;
  const reader = new FileReader();
  reader.onload = () => videoSetSource({ url: reader.result, dataUrl: reader.result });
  reader.readAsDataURL(f);
});
$("video-grab-tab").addEventListener("click", async () => {
  try {
    const tab = await chrome.tabs.query({ active: true, currentWindow: true });
    const dataUrl = await chrome.tabs.captureVisibleTab(tab[0].windowId, { format: "png" });
    videoSetSource({ url: dataUrl, dataUrl });
  } catch (e) { videoStatus(`Couldn't capture tab: ${e.message}`, "error"); }
});
$("video-pick-lib").addEventListener("click", () => openLibPicker("video-source"));

["vp-subject","vp-motion","vp-camera","vp-env","vp-style","vp-timing","vp-audio"].forEach((id) => {
  $(id).addEventListener("input", () => { /* user can hit Compose to flush */ });
});
$("vp-master").addEventListener("input", refreshVideoGenerateAll);

$("vp-compose").addEventListener("click", () => {
  const composed = composeMasterFromFields();
  if (!composed) { videoStatus("Fill at least one field above.", "error"); return; }
  $("vp-master").value = composed;
  refreshVideoGenerateAll();
  videoStatus("Master prompt composed.", "success");
});

$("vp-polish").addEventListener("click", async () => {
  const userPrompt = ($("vp-master").value || composeMasterFromFields()).trim();
  if (!userPrompt) { videoStatus("Compose or type a master prompt first.", "error"); return; }
  const providerId = $("provider").value || null;
  const longestDur = Math.max(...video.slots.map((s) => s.duration));
  const audioCapable = video.slots.some((s) => VIDEO_MODELS[s.model]?.audio);
  $("vp-polish").disabled = true;
  videoStatus("Polishing with your AI…", "info");
  try {
    const sys = `${VIDEO_PROMPT_SYSTEM}\nTarget duration: ${longestDur}s.\nAudio-capable slot present: ${audioCapable ? "yes" : "no"}.`;
    const data = await api("imagekit-enhance-prompt", {
      provider_id: providerId,
      system: sys,
      prompt: userPrompt,
      style: "video_prompt",
    });
    const out = (data?.enhanced_prompt || data?.text || "").trim();
    if (!out) throw new Error("No polished prompt returned.");
    $("vp-master").value = out;
    refreshVideoGenerateAll();
    videoStatus("Master prompt polished — Apply to all slots when ready.", "success");
  } catch (e) {
    videoStatus(`Couldn't polish: ${e.message}`, "error");
  } finally {
    $("vp-polish").disabled = false;
  }
});

$("vp-apply-all").addEventListener("click", () => {
  const master = $("vp-master").value.trim();
  if (!master) { videoStatus("Type or compose a master prompt first.", "error"); return; }
  for (const slot of video.slots) slot.prompt = master;
  renderVideoSlots();
  refreshVideoGenerateAll();
  videoStatus("Master prompt applied to all 3 slots.", "success");
});

$("vp-generate-all").addEventListener("click", async () => {
  if (!video.sessionId) newVideoSession();
  const master = $("vp-master").value.trim();
  if (master) for (const s of video.slots) if (!s.prompt) s.prompt = master;
  renderVideoSlots();
  // Fire all 3 in parallel
  await Promise.all(video.slots.map((_, i) => generateVideoSlot(i)));
});

// --- Send-to-Video helpers (exposed for cross-tab buttons) ---
function sendImageToVideo({ url, dataUrl, prompt }) {
  videoSetSource({ url: url || dataUrl, dataUrl: dataUrl || url });
  if (prompt) {
    $("vp-master").value = prompt;
    for (const s of video.slots) s.prompt = prompt;
  }
  newVideoSession();
  renderVideoSlots();
  activateTab("video");
  videoStatus("Source loaded. Adjust slots and hit Generate all 3.", "success");
}

// Respin "→ Video" button
$("send-to-video").addEventListener("click", () => {
  if (!state.result) return;
  const dataUrl = `data:${state.result.mime_type};base64,${state.result.image_base64}`;
  sendImageToVideo({ url: dataUrl, dataUrl, prompt: state.lastPrompt || "" });
});

// UGC bulk "→ Video (selected)" — loads the first selected shot as source
document.querySelectorAll(".ugc-send-video").forEach((b) =>
  b.addEventListener("click", () => {
    const sel = ugcSelectedShots();
    if (!sel.length) { ugcStatus("Select at least one shot first.", "error"); return; }
    const first = sel[0];
    const shot = first.s;
    const dataUrl = `data:${shot.result.mime_type};base64,${shot.result.image_base64}`;
    sendImageToVideo({ url: dataUrl, dataUrl, prompt: shot.prompt });
  })
);

// Patch UGC chain rendering to also add a per-shot "→ Video" button
// (we wrap the original renderUgcChain so existing behaviour stays intact)
const _origRenderUgcChain = renderUgcChain;
renderUgcChain = function patchedRenderUgcChain() {
  _origRenderUgcChain();
  document.querySelectorAll("#ugc-chain .ugc-shot-card").forEach((card, i) => {
    const shot = ugc.shots[i];
    if (!shot?.result) return;
    const actions = card.querySelector(".row");
    if (!actions || actions.querySelector(".ugc-shot-video-btn")) return;
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "secondary ugc-shot-video-btn";
    btn.textContent = "→ Video";
    btn.title = "Animate this shot on the Image → Video tab";
    btn.addEventListener("click", () => {
      const dataUrl = `data:${shot.result.mime_type};base64,${shot.result.image_base64}`;
      sendImageToVideo({ url: dataUrl, dataUrl, prompt: shot.prompt });
    });
    actions.appendChild(btn);
  });
};

// Initial render
renderVideoSlots();
refreshVideoGenerateAll();
