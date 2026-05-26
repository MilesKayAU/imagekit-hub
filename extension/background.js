// ReadyCode ImageKit — background service worker.
// Handles:
//   - opening the side panel from the toolbar icon
//   - context-menu "Grab this image with ReadyCode ImageKit"
//   - receiving the ReadyCode JWT from the web app (SET_TOKEN / CLEAR_TOKEN)
//   - storing the JWT in chrome.storage.local for the side panel to consume

const TOKEN_KEY = "rc_imagekit_token";

chrome.runtime.onInstalled.addListener(() => {
  try {
    chrome.contextMenus.create({
      id: "rc-imagekit-grab",
      title: "Grab this image with ReadyCode ImageKit",
      contexts: ["image"],
    });
  } catch (_) { /* already exists */ }
});

chrome.action.onClicked.addListener(async (tab) => {
  if (!tab?.windowId) return;
  try {
    await chrome.sidePanel.open({ windowId: tab.windowId });
  } catch (e) { console.warn("[imagekit] open side panel failed", e); }
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId !== "rc-imagekit-grab" || !info.srcUrl) return;
  // Open side panel SYNCHRONOUSLY to preserve the user-gesture token,
  // then persist the pending grab. If we await storage first, Chrome
  // rejects sidePanel.open() with "must be called from a user gesture".
  if (tab?.windowId) {
    try { chrome.sidePanel.open({ windowId: tab.windowId }); } catch (_) {}
  }
  chrome.storage.local.set({
    rc_imagekit_pending: {
      kind: "grab",
      src: info.srcUrl,
      page_url: info.pageUrl || tab?.url || null,
      ts: Date.now(),
    },
  });
});

// Token handshake from the ReadyCode web app
chrome.runtime.onMessageExternal.addListener((message, sender, sendResponse) => {
  if (!sender?.origin) { sendResponse({ ok: false }); return; }
  const okOrigin = /^https:\/\/(www\.)?readycode\.ai$/.test(sender.origin)
    || /^https:\/\/[a-z0-9-]+\.lovable\.app$/.test(sender.origin);
  if (!okOrigin) { sendResponse({ ok: false }); return; }
  if (message?.type === "SET_TOKEN" && typeof message.token === "string") {
    chrome.storage.local.set({ [TOKEN_KEY]: message.token }).then(() => sendResponse({ ok: true }));
    return true;
  }
  if (message?.type === "CLEAR_TOKEN") {
    chrome.storage.local.remove(TOKEN_KEY).then(() => sendResponse({ ok: true }));
    return true;
  }
  sendResponse({ ok: false });
});
