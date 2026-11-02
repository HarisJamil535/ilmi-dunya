// The small markup used inside PBA text blocks: **bold**, *italic*, __underline__, "- " bullets and "1. " numbered lines.
// Keep this in step with server/src/services/pbaContent.js, which turns the same markup into PDF and Word text.
export function inline(text, style = {}) {
  const runs = [];
  const pattern = /(\*\*(?:[^*]|\*(?!\*))+\*\*|__[^_\n]+__|\*[^*\n]+\*)/g;
  let last = 0;
  for (const match of text.matchAll(pattern)) {
    if (match.index > last) runs.push({ text: text.slice(last, match.index), ...style });
    const token = match[0];
    if (token.startsWith("**")) runs.push(...inline(token.slice(2, -2), { ...style, bold: true }));
    else if (token.startsWith("__")) runs.push(...inline(token.slice(2, -2), { ...style, underline: true }));
    else runs.push(...inline(token.slice(1, -1), { ...style, italic: true }));
    last = match.index + token.length;
  }
  if (last < text.length) runs.push({ text: text.slice(last), ...style });
  return runs.filter((run) => run.text);
}

export function paragraphs(text) {
  const out = [];
  let list = null;
  for (const raw of String(text || "").split("\n")) {
    const bullet = /^\s*-\s+(.*)$/.exec(raw);
    const number = /^\s*(\d+)[.)]\s+(.*)$/.exec(raw);
    if (bullet || number) {
      const kind = bullet ? "ul" : "ol";
      if (!list || list.type !== kind) { list = { type: kind, items: [] }; out.push(list); }
      list.items.push({ runs: inline((bullet || number)[bullet ? 1 : 2]), number: number ? Number(number[1]) : undefined });
    } else if (raw.trim()) { list = null; out.push({ type: "p", runs: inline(raw.trim()) }); }
    else list = null;
  }
  return out;
}
