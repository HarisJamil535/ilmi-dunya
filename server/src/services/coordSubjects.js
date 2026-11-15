const mongoose = require("mongoose");

// Adds the board, class and group names to subjects without Mongoose populate, which fails outright when an
// older subject has an empty or malformed reference. Bad references simply come back without a name.
async function attachNames(subjects) {
    const list = subjects.filter(Boolean);
    const ids = (field) => [...new Set(list.map((s) => s[field]?._id || s[field]).filter((v) => mongoose.isValidObjectId(v)).map(String))];
    const lookup = async (model, field) => new Map((await mongoose.model(model).find({ _id: { $in: ids(field) } }).select("name").lean()).map((r) => [String(r._id), r]));
    const [boards, classes, groups] = await Promise.all([lookup("Board", "board"), lookup("Class", "class"), lookup("Group", "group")]);
    for (const s of list) {
        const pick = (map, value) => map.get(String(value?._id || value)) || { _id: value || null, name: "" };
        const values = { board: pick(boards, s.board), class: pick(classes, s.class), group: pick(groups, s.group) };
        // Plain objects get the values directly. On a Mongoose document the reference paths would be cast back
        // to ids, so the named values are placed on the instance itself instead.
        for (const [k, v] of Object.entries(values)) {
            if (typeof s.set === "function") Object.defineProperty(s, k, { value: v, writable: true, configurable: true, enumerable: true });
            else s[k] = v;
        }
    }
    return subjects;
}

module.exports = { attachNames };
