export const resolvedTheme = (theme) => theme === "system"
  ? (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light")
  : theme;

export const applyTheme = (theme) => {
  const resolved = resolvedTheme(theme);
  document.documentElement.dataset.theme = resolved;
  return resolved;
};
