import { getSettings } from "./defaults.js";
import { applyTheme } from "./theme.js";

const $ = (selector) => document.querySelector(selector);
const params = new URLSearchParams(location.search);
const action = params.get("action");
const url = params.get("url");
const isSite = action === "clear-site" && url?.startsWith("http");

const render = async () => {
  applyTheme((await getSettings()).theme);
  if (isSite) {
    $("#confirm-title").textContent = "현재 사이트를 정리할까요?";
    $("#confirm-description").textContent = "현재 사이트의 선택한 데이터만 지웁니다.";
  }
};

$("#cancel").addEventListener("click", () => window.close());
$("#confirm").addEventListener("click", async () => {
  const button = $("#confirm");
  button.disabled = true;
  $("#confirm-status").textContent = "정리하고 있어요.";
  const response = await chrome.runtime.sendMessage(isSite ? { type: "clear-site", url } : { type: "clear-all" });
  $("#confirm-status").textContent = response.ok ? "정리했어요." : "정리하지 못했어요.";
  if (response.ok) setTimeout(() => window.close(), 750);
  else button.disabled = false;
});
render();
