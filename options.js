import { DATA_TYPES, DEFAULTS, getSettings } from "./defaults.js";
import { applyTheme } from "./theme.js";

const $ = (selector) => document.querySelector(selector);
let settings;
const normalizeUrl = (value) => { const url = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`); return url.origin; };
const save = async () => chrome.storage.sync.set(settings);

const renderTypes = () => {
  $("#type-grid").innerHTML = DATA_TYPES.map(({ id, label, note, available }) => `<label class="type-card ${available === false ? "is-unavailable" : ""}"><input type="checkbox" value="${id}" ${settings.selectedTypes.includes(id) ? "checked" : ""} ${available === false ? "disabled" : ""}><span class="checkmark">✓</span><span><strong>${label}</strong><small>${note}</small></span></label>`).join("");
  document.querySelectorAll(".type-card input").forEach((input) => input.addEventListener("change", async () => { settings.selectedTypes = [...document.querySelectorAll(".type-card input:checked")].map((item) => item.value); await save(); }));
};
const renderSites = () => {
  $("#site-list").innerHTML = settings.savedSites.length
    ? settings.savedSites.map((site) => `<li><span class="site-mark">⌁</span><span>${site}</span><button class="site-clear" data-clear-site="${site}">지우기</button><button aria-label="${site} 삭제" data-site="${site}">×</button></li>`).join("")
    : `<li class="empty-site">아직 추가한 사이트가 없어요.</li>`;
  document.querySelectorAll("[data-site]").forEach((button) => button.addEventListener("click", async () => { settings.savedSites = settings.savedSites.filter((site) => site !== button.dataset.site); await save(); renderSites(); }));
  document.querySelectorAll("[data-clear-site]").forEach((button) => button.addEventListener("click", async () => {
    const site = button.dataset.clearSite;
    button.disabled = true;
    button.textContent = "정리 중";
    const result = await chrome.runtime.sendMessage({ type: "clear-site", url: site });
    button.textContent = result.ok ? "완료" : "실패";
    setTimeout(() => { button.disabled = false; button.textContent = "지우기"; }, 1500);
  }));
};
const renderCommands = async () => { const commands = await chrome.commands.getAll(); const names = { "clear-selected-data": "선택한 브라우저 데이터 지우기", "clear-current-site": "현재 사이트만 지우기" }; $("#command-list").innerHTML = commands.map((command) => `<div class="command-row"><span>${names[command.name]}</span><kbd>${command.shortcut || "아직 지정하지 않음"}</kbd></div>`).join(""); };
const renderIntervalClean = () => {
  const enabled = settings.autoCleanOnInterval;
  $("#interval-clean-toggle").checked = enabled;
  $("#interval-minutes").value = settings.autoCleanIntervalMinutes;
  $("#interval-minutes").disabled = !enabled;
  $("#interval-controls").classList.toggle("is-disabled", !enabled);
  $("#interval-note").textContent = enabled ? `켜짐 · ${settings.autoCleanIntervalMinutes}분마다 선택한 데이터를 정리합니다.` : "주기 정리는 꺼져 있어요.";
};
const renderTheme = () => {
  applyTheme(settings.theme);
  document.querySelectorAll("[data-theme-choice]").forEach((button) => {
    const selected = button.dataset.themeChoice === settings.theme;
    button.classList.toggle("is-selected", selected);
    button.setAttribute("aria-checked", String(selected));
  });
};

$("#time-range").addEventListener("change", async (event) => { settings.timeRange = event.target.value; await save(); });
$("#site-form").addEventListener("submit", async (event) => { event.preventDefault(); try { const site = normalizeUrl($("#site-input").value.trim()); if (!settings.savedSites.includes(site)) settings.savedSites.push(site); $("#site-input").value = ""; await save(); renderSites(); } catch { $("#site-input").setCustomValidity("올바른 웹사이트 주소를 입력해 주세요."); $("#site-input").reportValidity(); $("#site-input").setCustomValidity(""); } });
$("#open-shortcuts").addEventListener("click", () => {
  const scheme = navigator.userAgent.includes("Edg/") ? "edge" : "chrome";
  chrome.tabs.create({ url: `${scheme}://extensions/shortcuts` });
});
$("#auto-clean-toggle").addEventListener("change", async (event) => {
  settings.autoCleanOnClose = event.target.checked;
  await save();
  $("#automatic-note").textContent = settings.autoCleanOnClose ? "켜짐 · 마지막 창이 닫히면 선택한 데이터를 정리합니다." : "자동 정리는 꺼져 있어요.";
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

(async () => { settings = await getSettings(); $("#time-range").value = settings.timeRange || DEFAULTS.timeRange; $("#auto-clean-toggle").checked = settings.autoCleanOnClose; $("#automatic-note").textContent = settings.autoCleanOnClose ? "켜짐 · 마지막 창이 닫히면 선택한 데이터를 정리합니다." : "자동 정리는 꺼져 있어요."; renderTypes(); renderSites(); renderIntervalClean(); renderTheme(); renderCommands(); })();
window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => { if (settings?.theme === "system") renderTheme(); });
