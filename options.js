import { DATA_TYPES, DEFAULTS, getSettings } from "./defaults.js";
import { applyTheme } from "./theme.js";

const $ = (selector) => document.querySelector(selector);
let settings;
const normalizeUrl = (value) => { const url = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`); return url.origin; };
const save = async () => chrome.storage.sync.set(settings);
const formatBytes = (bytes) => {
  if (!Number.isFinite(bytes)) return "용량 정보 없음";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
};

const renderTypes = () => {
  $("#type-grid").innerHTML = DATA_TYPES.filter(({ available }) => available !== false).map(({ id, label, note }) => `<label class="type-card"><input type="checkbox" value="${id}" ${settings.selectedTypes.includes(id) ? "checked" : ""}><span class="checkmark">✓</span><span><strong>${label}</strong><small>${note}</small><em class="data-summary" data-summary-for="${id}">집계 중</em></span></label>`).join("");
  document.querySelectorAll(".type-card input").forEach((input) => input.addEventListener("change", async () => { settings.selectedTypes = [...document.querySelectorAll(".type-card input:checked")].map((item) => item.value); settings.selectedTypesCustomized = true; await save(); }));
};
const renderDataSummary = async () => {
  try {
    const response = await chrome.runtime.sendMessage({ type: "get-data-summary" });
    if (!response?.ok) throw new Error(response?.error);
    document.querySelectorAll("[data-summary-for]").forEach((element) => {
      const summary = response.summary[element.dataset.summaryFor];
      element.textContent = summary?.bytes !== undefined ? `${formatBytes(summary.bytes)}${summary.label ? ` · ${summary.label}` : ""}` : summary?.label || "용량 정보 없음";
      element.title = summary?.detail || "Chrome에서 항목별 용량을 제공하지 않습니다.";
    });
  } catch {
    document.querySelectorAll("[data-summary-for]").forEach((element) => { element.textContent = "집계 불가"; });
  }
};
const renderSites = () => {
  $("#site-list").innerHTML = settings.savedSites.length
    ? settings.savedSites.map((site) => `<li><span>${site}</span><button class="site-clear" data-clear-site="${site}">지우기</button><button aria-label="${site} 삭제" data-site="${site}">×</button></li>`).join("")
    : `<li class="empty-site">등록한 사이트 없음</li>`;
  document.querySelectorAll("[data-site]").forEach((button) => button.addEventListener("click", async () => { settings.savedSites = settings.savedSites.filter((site) => site !== button.dataset.site); await save(); renderSites(); }));
  document.querySelectorAll("[data-clear-site]").forEach((button) => button.addEventListener("click", async () => {
    const site = button.dataset.clearSite;
    button.disabled = true;
    button.textContent = "정리 중";
    const result = await chrome.runtime.sendMessage({ type: "request-confirmation", action: "clear-site", url: site });
    button.textContent = result.ok ? "확인" : "실패";
    setTimeout(() => { button.disabled = false; button.textContent = "지우기"; }, 1500);
  }));
};
const renderCommands = async () => { const commands = await chrome.commands.getAll(); const names = { "clear-selected-data": "전체 정리", "clear-current-site": "현재 사이트 정리" }; $("#command-list").innerHTML = commands.filter((command) => names[command.name]).map((command) => `<div class="command-row"><span>${names[command.name]}</span><kbd>${command.shortcut || "지정 안 함"}</kbd></div>`).join(""); };
const renderIntervalClean = () => {
  const enabled = settings.autoCleanOnInterval;
  $("#interval-clean-toggle").checked = enabled;
  $("#interval-minutes").value = settings.autoCleanIntervalMinutes;
  $("#interval-minutes").disabled = !enabled;
  $("#interval-controls").classList.toggle("is-disabled", !enabled);
};
const renderTheme = () => {
  const resolved = applyTheme(settings.theme);
  $("#settings-brand-icon").src = `assets/agnubin-${resolved}-raw.png`;
  document.querySelectorAll("[data-theme-choice]").forEach((button) => {
    const selected = button.dataset.themeChoice === settings.theme;
    button.classList.toggle("is-selected", selected);
    button.setAttribute("aria-checked", String(selected));
  });
};

$("#time-range").addEventListener("change", async (event) => { settings.timeRange = event.target.value; await save(); renderDataSummary(); });
$("#site-form").addEventListener("submit", async (event) => { event.preventDefault(); try { const site = normalizeUrl($("#site-input").value.trim()); if (!settings.savedSites.includes(site)) settings.savedSites.push(site); $("#site-input").value = ""; await save(); renderSites(); } catch { $("#site-input").setCustomValidity("올바른 웹사이트 주소를 입력해 주세요."); $("#site-input").reportValidity(); $("#site-input").setCustomValidity(""); } });
$("#open-shortcuts").addEventListener("click", () => {
  const scheme = navigator.userAgent.includes("Edg/") ? "edge" : "chrome";
  chrome.tabs.create({ url: `${scheme}://extensions/shortcuts` });
});
$("#auto-clean-toggle").addEventListener("change", async (event) => {
  settings.autoCleanOnClose = event.target.checked;
  await save();
});
$("#interval-clean-toggle").addEventListener("change", async (event) => {
  settings.autoCleanOnInterval = event.target.checked;
  await save();
  renderIntervalClean();
});
$("#interval-minutes").addEventListener("change", async (event) => {
  const minutes = Math.round(Number(event.target.value));
  settings.autoCleanIntervalMinutes = Number.isFinite(minutes) ? Math.min(10080, Math.max(1, minutes)) : DEFAULTS.autoCleanIntervalMinutes;
  await save();
  renderIntervalClean();
});
document.querySelectorAll("[data-theme-choice]").forEach((button) => button.addEventListener("click", async () => {
  settings.theme = button.dataset.themeChoice;
  await save();
  renderTheme();
}));

(async () => { settings = await getSettings(); $("#time-range").value = settings.timeRange || DEFAULTS.timeRange; $("#auto-clean-toggle").checked = settings.autoCleanOnClose; renderTypes(); renderSites(); renderIntervalClean(); renderTheme(); renderCommands(); renderDataSummary(); })();
window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => { if (settings?.theme === "system") renderTheme(); });
