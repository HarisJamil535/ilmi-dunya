// "Ms. Sadaf Khan" — the person's title before their name, unless the name already starts with one.
const displayName = (p) => (p?.salutation && !/^(mr|ms|mrs|miss|dr|sir|madam)\.?\s/i.test(p.name || "") ? `${p.salutation} ${p.name}` : p?.name || "");
module.exports = { displayName };
