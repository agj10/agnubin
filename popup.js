import { getSettings } from "./defaults.js";
import { applyTheme } from "./theme.js";

const $ = (selector) => document.querySelector(selector);
let activeUrl = null;
const setStatus = (message, error = false) => { $("#status").textContent = message; $("#status").classList.toggle("error", error); };
const setTheme = (theme) => {
  const resolved = applyTheme(theme);
  $("#brand-icon").src = `assets/agnubin-${resolved}-raw.png`;
};

const render = async () => {
  const settings = await getSettings();
  setTheme(settings.theme);
  $("#shortcut-label").textContent = settings.shortcutsEnabled ? "단축키 켜짐" : "단축키 꺼짐";
  $("#shortcut-toggle").classList.toggle("is-off", !settings.shortcutsEnabled);
  const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  if (tab?.url?.startsWith("http")) {
    activeUrl = tab.url;
    const hostname = new URL(tab.url).hostname.replace(/^www\./, "");
    $("#site-name").textContent = `현재 사이트 · ${hostname}`;
    $("#clear-site").disabled = false;
  } else {
    activeUrl = null;
    $("#site-name").textContent = "현재 사이트 정리 불가";
    $("#clear-site").disabled = true;
  }
};

const clear = async (type) => {
  const button = type === "clear-all" ? $("#clear-all") : $("#clear-site");
  button.disabled = true;
  const response = await chrome.runtime.sendMessage(type === "clear-all" ? { type: "request-confirmation", action: type } : { type: "request-confirmation", action: type, url: activeUrl });
  if (response.ok) setStatus("확인 창에서 계속해 주세요.");
  else setStatus(`확인 창을 열지 못했어요. ${response.error}`, true);
  button.disabled = type === "clear-site" && !activeUrl;
};

$("#clear-all").addEventListener("click", () => clear("clear-all"));
$("#clear-site").addEventListener("click", () => clear("clear-site"));
$("#shortcut-toggle").addEventListener("click", async () => { const { shortcutsEnabled } = await getSettings(); await chrome.storage.sync.set({ shortcutsEnabled: !shortcutsEnabled }); await render(); });
$("#open-settings").addEventListener("click", () => chrome.runtime.openOptionsPage());
render();
window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", async () => setTheme((await getSettings()).theme));
