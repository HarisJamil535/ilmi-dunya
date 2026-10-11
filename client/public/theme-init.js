(function () {
  var scope = window.location.pathname.indexOf("/admin") === 0 ? "admin" : "client";
  var saved;
  try { saved = window.localStorage.getItem("ilmidunya-" + scope + "-theme"); } catch { /* Default to light when storage is unavailable. */ }
  var dark = saved === "dark";
  document.documentElement.classList.toggle("dark", dark);
  document.documentElement.dataset.theme = dark ? "dark" : "light";
  document.documentElement.dataset.themeScope = scope;
  var color = document.querySelector('meta[name="theme-color"]');
  if (color) color.setAttribute("content", dark ? "#10111a" : "#623fcd");
})();
