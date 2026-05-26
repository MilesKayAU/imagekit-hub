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

document.getElementById("provider").addEventListener("change", updateModelPickerVisibility);

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
      actions.appendChild(useBtn);
      actions.appendChild(addBtn);
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
    setSource({ url: rc_imagekit_pending.src, dataUrl: rc_imagekit_pending.src });
    await chrome.storage.local.remove("rc_imagekit_pending");
    // Switch to Respin tab so the grabbed image is visible
    const respinTab = document.querySelector('[data-tab="respin"]');
    if (respinTab) respinTab.click();
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
