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
    $("#site-name").textContent = hostname;
    $("#site-state").textContent = "";
    $("#clear-site").disabled = false;
  } else {
    $("#site-name").textContent = "이 페이지에서는 사용할 수 없어요";
    $("#site-state").textContent = "웹사이트를 열면 이 사이트만 정리할 수 있어요";
  }
};

const clear = async (type) => {
  const button = type === "clear-all" ? $("#clear-all") : $("#clear-site");
  button.disabled = true;
  setStatus("정리하고 있어요…");
  const response = await chrome.runtime.sendMessage(type === "clear-all" ? { type } : { type, url: activeUrl });
  if (response.ok) setStatus(response.label);
  else setStatus(`정리하지 못했어요. ${response.error}`, true);
  button.disabled = type === "clear-site" && !activeUrl;
};

$("#clear-all").addEventListener("click", () => clear("clear-all"));
$("#clear-site").addEventListener("click", () => clear("clear-site"));
$("#shortcut-toggle").addEventListener("click", async () => { const { shortcutsEnabled } = await getSettings(); await chrome.storage.sync.set({ shortcutsEnabled: !shortcutsEnabled }); await render(); });
$("#open-settings").addEventListener("click", () => chrome.runtime.openOptionsPage());
render();
window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", async () => setTheme((await getSettings()).theme));
