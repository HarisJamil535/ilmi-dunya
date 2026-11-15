// Formatting commands for the box being edited. They run on the current selection inside that box.
export const TEXT_COLOURS = [["#000000", "Black"], ["#dc2626", "Red"], ["#c2410c", "Orange"], ["#15803d", "Green"], ["#1d4ed8", "Blue"], ["#6d28d9", "Purple"], ["#be185d", "Pink"]];
export const HIGHLIGHTS = [["#fef08a", "Yellow"], ["#bbf7d0", "Green"], ["#bfdbfe", "Blue"], ["#fbcfe8", "Pink"], ["#fed7aa", "Orange"]];

export function run(command, value) {
  document.execCommand("styleWithCSS", false, command === "hiliteColor" || command === "foreColor");
  document.execCommand(command, false, value);
}
export const size = (value) => { document.execCommand("styleWithCSS", false, false); document.execCommand("fontSize", false, value === "s" ? "2" : value === "l" ? "5" : "3"); };
export const clearHighlight = () => { document.execCommand("styleWithCSS", false, true); document.execCommand("hiliteColor", false, "transparent"); };

// Adds a quick-pick item to a box: as a new bullet for lists, or after a comma for plain lines.
export function addPick(element, item, asList) {
  if (!element) return;
  const text = element.textContent.trim();
  if (asList) {
    let list = element.querySelector("ul:last-of-type, ol:last-of-type");
    if (!list) {
      list = document.createElement("ul");
      if (text) { const lines = element.innerText.split("\n").map((l) => l.trim()).filter(Boolean); element.innerHTML = ""; for (const line of lines) { const li = document.createElement("li"); li.textContent = line; list.appendChild(li); } }
      element.appendChild(list);
    }
    const li = document.createElement("li"); li.textContent = item; list.appendChild(li);
  } else {
    element.innerHTML = "";
    element.textContent = text ? `${text.replace(/[,\s]+$/, "")}, ${item}` : item;
  }
}
