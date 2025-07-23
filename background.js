// Keep-alive ping (every 30 seconds)
const keepAlive = () => setInterval(chrome.runtime.getPlatformInfo, 30000);
chrome.runtime.onStartup.addListener(keepAlive);
keepAlive(); // Also run on initial load

const DAILY_LIMIT = 10; // Adjust for your beta

// Message listener
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action !== "checkLimit") return;
  if (request.action === "checkLimit") {
    const today = new Date().toDateString();
    const fingerprint = request.traits;
    const storageKey = `limit_${fingerprint}_${today}`;

    chrome.storage.local.get([storageKey], (result) => {
      const usage = result[storageKey] || 0;
      if (usage >= DAILY_LIMIT) {
        sendResponse({ blocked: true, usage, DAILY_LIMIT });
      } else {
        chrome.storage.local.set({ [storageKey]: usage + 1 });
        sendResponse({ blocked: false, usage: usage + 1, DAILY_LIMIT });
      }
    });
    return true; // Keep message port open
  }
});
