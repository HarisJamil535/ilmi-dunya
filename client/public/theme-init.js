(function () {
  var scope = window.location.pathname.indexOf("/admin") === 0 ? "admin" : "client";
  var saved = window.localStorage.getItem("ilmidunya-" + scope + "-theme");
  var dark = saved === "dark" || (saved !== "light" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", dark);
  document.documentElement.dataset.theme = dark ? "dark" : "light";
  document.documentElement.dataset.themeScope = scope;
  var color = document.querySelector('meta[name="theme-color"]');
  if (color) color.setAttribute("content", dark ? "#10111a" : "#623fcd");
})();
