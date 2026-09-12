import { dataObject, getSettings, sinceFor } from "./defaults.js";

const PERIODIC_CLEAN_ALARM = "agnubin-periodic-clean";
const notificationIcon = chrome.runtime.getURL("assets/agnubin-dark-raw.png");

const notify = async (message) => {
  try {
    await chrome.notifications.create({ type: "basic", iconUrl: notificationIcon, title: "agnubin", message });
  } catch (error) {
    console.warn("agnubin notification failed", error);
  }
};

const openConfirmation = async ({ action, url }) => {
  const query = new URLSearchParams({ action });
  if (url) query.set("url", url);
  await chrome.windows.create({
    url: `confirm.html?${query.toString()}`,
    type: "popup",
    width: 350,
    height: 210
  });
};

const getDataSummary = async () => {
  const { timeRange } = await getSettings();
  const since = sinceFor(timeRange);
  const [history, downloads, cookies] = await Promise.all([
    chrome.history.search({ text: "", startTime: since, maxResults: 100000 }),
    chrome.downloads.search(since ? { startedAfter: new Date(since).toISOString(), limit: 100000 } : { limit: 100000 }),
    chrome.cookies.getAll({})
  ]);
  const cookieBytes = cookies.reduce((total, cookie) => total + new TextEncoder().encode(`${cookie.name}=${cookie.value}`).byteLength, 0);
  return {
    history: { label: `${history.length.toLocaleString()}개`, detail: "선택한 기간의 방문 페이지 수" },
    downloads: { label: `${downloads.length.toLocaleString()}개`, detail: "선택한 기간의 다운로드 기록 수" },
    cookies: { bytes: cookieBytes, label: `${cookies.length.toLocaleString()}개`, detail: "쿠키의 이름과 값 기준 대략적인 용량" }
  };
};

const clearAll = async () => {
  const settings = await getSettings();
  const types = dataObject(settings.selectedTypes);
  if (!Object.keys(types).length) return { label: "먼저 설정에서 지울 항목을 골라 주세요." };
  await chrome.browsingData.remove({ since: sinceFor(settings.timeRange) }, types);
  const label = "선택한 브라우저 데이터를 정리했어요.";
  void notify(label);
  return { label };
};

const runAutomaticClear = async () => {
  await chrome.storage.local.set({ autoCleanPending: Date.now() });
  try {
    await clearAll();
    await chrome.storage.local.remove("autoCleanPending");
  } catch (error) {
    // Keep the flag. If Chrome exits before deletion finishes, onStartup
    // retries before the next browsing session continues.
    console.warn("agnubin automatic cleanup will retry on startup", error);
  }
};

const syncPeriodicCleanAlarm = async () => {
  const { autoCleanOnInterval, autoCleanIntervalMinutes } = await getSettings();
  await chrome.alarms.clear(PERIODIC_CLEAN_ALARM);
  if (!autoCleanOnInterval) return;
  const minutes = Math.min(10080, Math.max(1, Number(autoCleanIntervalMinutes) || 60));
  await chrome.alarms.create(PERIODIC_CLEAN_ALARM, { periodInMinutes: minutes });
};

const clearSite = async (url) => {
  const settings = await getSettings();
  const selected = new Set(settings.selectedTypes);
  const origin = new URL(url).origin;
  // Origin filtering is only reliable for these site-scoped stores. Passing a
  // global-only type here could unintentionally clear it for every website.
  const siteTypes = settings.selectedTypes.filter((type) => ["cache", "cookies", "cacheStorage", "fileSystems", "indexedDB", "localStorage", "serviceWorkers"].includes(type));

  if (!siteTypes.length && !settings.selectedTypes.includes("history")) {
    return { label: "현재 사이트에서 지울 수 있는 항목을 먼저 골라 주세요." };
  }

  if (siteTypes.length) {
    await chrome.browsingData.remove({ since: sinceFor(settings.timeRange), origins: [origin] }, dataObject(siteTypes));
  }
  if (selected.has("history")) {
    const entries = await chrome.history.search({ text: origin, startTime: sinceFor(settings.timeRange), maxResults: 10000 });
    await Promise.all(entries.filter((entry) => {
      try { return entry.url && new URL(entry.url).origin === origin; } catch { return false; }
    }).map((entry) => chrome.history.deleteUrl({ url: entry.url })));
  }
  const label = `${new URL(url).hostname}의 선택한 데이터를 정리했어요.`;
  void notify(label);
  return { label, skipped: settings.selectedTypes.filter((type) => !siteTypes.includes(type) && type !== "history") };
};

chrome.commands.onCommand.addListener(async (command) => {
  const { shortcutsEnabled } = await getSettings();
  if (!shortcutsEnabled) return;
  if (command === "clear-selected-data") await clearAll();
  if (command === "clear-current-site") {
    const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    if (tab?.url?.startsWith("http")) await clearSite(tab.url);
  }
});

// Closing a window should not clear data while another normal browser window
// remains open. Closing the final one preserves session-restored tabs because
// the extension removes browsing data only, never tabs or session data.
chrome.windows.onRemoved.addListener(async () => {
  const { autoCleanOnClose } = await getSettings();
  if (!autoCleanOnClose) return;
  const windows = await chrome.windows.getAll({ windowTypes: ["normal"] });
  if (windows.length === 0) await runAutomaticClear();
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name !== PERIODIC_CLEAN_ALARM) return;
  const { autoCleanOnInterval } = await getSettings();
  if (autoCleanOnInterval) await runAutomaticClear();
});

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === "sync" && (changes.autoCleanOnInterval || changes.autoCleanIntervalMinutes)) {
    void syncPeriodicCleanAlarm();
  }
});

// Browser shutdown can interrupt a Manifest V3 service worker. A pending mark
// makes the cleanup reliable across a session-restoring restart as well.
chrome.runtime.onStartup.addListener(async () => {
  await syncPeriodicCleanAlarm();
  const { autoCleanOnClose, autoCleanOnInterval } = await getSettings();
  const { autoCleanPending } = await chrome.storage.local.get("autoCleanPending");
  if ((autoCleanOnClose || autoCleanOnInterval) && autoCleanPending) await runAutomaticClear();
});

chrome.runtime.onInstalled.addListener(async (details) => {
  if (details.reason === "update") {
    const previousDefault = ["history", "downloads", "cookies", "cache", "formData", "localStorage", "indexedDB", "serviceWorkers", "cacheStorage"];
    const { selectedTypes, selectedTypesCustomized } = await chrome.storage.sync.get(["selectedTypes", "selectedTypesCustomized"]);
    if (!selectedTypesCustomized && Array.isArray(selectedTypes) && selectedTypes.length === previousDefault.length && selectedTypes.every((type, index) => type === previousDefault[index])) {
      await chrome.storage.sync.set({ selectedTypes: ["history"] });
    }
  }
  void syncPeriodicCleanAlarm();
});
void syncPeriodicCleanAlarm();

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  (async () => {
    if (message.type === "clear-all") sendResponse({ ok: true, ...(await clearAll()) });
    if (message.type === "clear-site") sendResponse({ ok: true, ...(await clearSite(message.url)) });
    if (message.type === "request-confirmation") {
      await openConfirmation({ action: message.action, url: message.url });
      sendResponse({ ok: true });
    }
    if (message.type === "get-data-summary") sendResponse({ ok: true, summary: await getDataSummary() });
  })().catch((error) => sendResponse({ ok: false, error: error.message }));
  return true;
});
