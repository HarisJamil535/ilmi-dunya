// How many questions the paper needs of each kind (an OR question uses two from the bank).
export const requiredFor = (sections) => {
  const need = { mcq: 0, short: 0, long: 0 };
  for (const s of sections) need[s.kind] += s.kind === "mcq" ? s.total : s.total * (s.choice ? 2 : 1);
  return need;
};

// Splits `total` as evenly as possible across chapters, never above what a chapter has.
export function spreadEvenly(total, caps) {
  const result = caps.map(() => 0);
  let left = total;
  while (left > 0) {
    const open = caps.map((cap, i) => i).filter((i) => result[i] < caps[i]);
    if (!open.length) break;
    const share = Math.max(1, Math.floor(left / open.length));
    for (const i of open) { const give = Math.min(share, caps[i] - result[i], left); result[i] += give; left -= give; if (!left) break; }
  }
  return result;
}
