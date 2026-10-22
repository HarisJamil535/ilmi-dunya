const mongoose = require("mongoose");
const School = require("../models/School");
const Student = require("../models/Student");
const { fail } = require("../services/publishing");

const MAX_CLASSES = 40;
const MAX_SECTIONS = 40;

// The public list is read by every signup page view, so keep it in memory briefly.
let publicCache = null;
const invalidatePublicSchools = () => { publicCache = null; };

const wrap = handler => async (req, res, next) => {
    try { await handler(req, res); }
    catch (error) {
        if (error?.name === "VersionError") return next(Object.assign(new Error("Someone else changed this school. Refresh the page and try again."), { status: 409 }));
        next(error);
    }
};

const sameName = (left, right) => School.normalizeName(left) === School.normalizeName(right);

// Accepts `name` or `names`, so an admin can add "A, B, C" in one step.
function readNames(body, label, max) {
    const raw = Array.isArray(body.names) ? body.names : [body.name];
    const names = [];
    for (const value of raw) {
        if (typeof value !== "string") fail(`Enter a ${label} name.`);
        const name = value.replace(/\s+/g, " ").trim();
        if (!name) continue;
        if (name.length > max) fail(`A ${label} name must be ${max} characters or fewer.`);
        if (!names.some(existing => sameName(existing, name))) names.push(name);
    }
    if (!names.length) fail(`Enter a ${label} name.`);
    return names;
}

async function findSchool(id) {
    if (!mongoose.isValidObjectId(id)) fail("Choose a valid school.");
    const school = await School.findById(id);
    if (!school) fail("School not found.", 404);
    return school;
}

function findClass(school, classId) {
    const grade = mongoose.isValidObjectId(classId) ? school.classes.id(classId) : null;
    if (!grade) fail("Class not found.", 404);
    return grade;
}

function findSection(grade, sectionId) {
    const section = mongoose.isValidObjectId(sectionId) ? grade.sections.id(sectionId) : null;
    if (!section) fail("Section not found.", 404);
    return section;
}

const view = (school, studentCount) => ({
    _id: school._id,
    name: school.name,
    isActive: school.isActive,
    ...(studentCount === undefined ? {} : { studentCount }),
    classes: school.classes.map(grade => ({
        _id: grade._id,
        name: grade.name,
        sections: grade.sections.map(section => ({ _id: section._id, name: section.name })),
    })),
});

const naturalSort = (left, right) => String(left.name).localeCompare(String(right.name), undefined, { numeric: true, sensitivity: "base" });

// Students choose from this list, so it only contains active schools.
const getPublicSchools = wrap(async (req, res) => {
    if (!publicCache || publicCache.expires < Date.now()) {
        const schools = await School.find({ isActive: true }).sort({ name: 1 }).lean();
        publicCache = {
            expires: Date.now() + 30000,
            value: schools.map(school => view({
                ...school,
                classes: [...school.classes].sort(naturalSort).map(grade => ({ ...grade, sections: [...grade.sections].sort(naturalSort) })),
            })),
        };
    }
    res.set("Cache-Control", "public, max-age=30, stale-while-revalidate=30").json({ success: true, schools: publicCache.value });
});

const getManagedSchools = wrap(async (req, res) => {
    const [schools, counts] = await Promise.all([
        School.find().sort({ name: 1 }).lean(),
        Student.aggregate([{ $match: { schoolRef: { $exists: true } } }, { $group: { _id: "$schoolRef", total: { $sum: 1 } } }]),
    ]);
    const totals = new Map(counts.map(item => [String(item._id), item.total]));
    res.json({
        success: true,
        schools: schools.map(school => view({
            ...school,
            classes: [...school.classes].sort(naturalSort).map(grade => ({ ...grade, sections: [...grade.sections].sort(naturalSort) })),
        }, totals.get(String(school._id)) || 0)),
    });
});

const createSchool = wrap(async (req, res) => {
    const [name] = readNames(req.body, "school", 120);
    if (await School.exists({ nameKey: School.normalizeName(name) })) fail("A school with this name already exists.", 409);
    const school = await School.create({ name });
    invalidatePublicSchools();
    res.status(201).json({ success: true, school: view(school, 0) });
});

const updateSchool = wrap(async (req, res) => {
    const school = await findSchool(req.params.id);
    const previousName = school.name;
    if (req.body.name !== undefined) {
        const [name] = readNames(req.body, "school", 120);
        const duplicate = await School.exists({ _id: { $ne: school._id }, nameKey: School.normalizeName(name) });
        if (duplicate) fail("A school with this name already exists.", 409);
        school.name = name;
    }
    if (req.body.isActive !== undefined) {
        if (typeof req.body.isActive !== "boolean") fail("Active must be true or false.");
        school.isActive = req.body.isActive;
    }
    await school.save();
    // Students keep the school name they see on their result cards, so renames reach them too.
    if (school.name !== previousName) await Student.updateMany({ schoolRef: school._id }, { $set: { school: school.name } });
    invalidatePublicSchools();
    res.json({ success: true, school: view(school) });
});

const deleteSchool = wrap(async (req, res) => {
    const school = await findSchool(req.params.id);
    if (await Student.exists({ schoolRef: school._id })) fail("Students belong to this school. Disable it instead, so it no longer appears in signup but keeps its records.", 409);
    await school.deleteOne();
    invalidatePublicSchools();
    res.json({ success: true });
});

const addClasses = wrap(async (req, res) => {
    const school = await findSchool(req.params.id);
    const names = readNames(req.body, "class", 40);
    const duplicates = names.filter(name => school.classes.some(grade => sameName(grade.name, name)));
    if (duplicates.length) fail(`Already added: ${duplicates.join(", ")}.`, 409);
    if (school.classes.length + names.length > MAX_CLASSES) fail(`A school can have at most ${MAX_CLASSES} classes.`);
    names.forEach(name => school.classes.push({ name }));
    await school.save();
    invalidatePublicSchools();
    res.status(201).json({ success: true, school: view(school) });
});

const updateClass = wrap(async (req, res) => {
    const school = await findSchool(req.params.id);
    const grade = findClass(school, req.params.classId);
    const [name] = readNames(req.body, "class", 40);
    if (school.classes.some(item => item !== grade && sameName(item.name, name))) fail("This class already exists in the school.", 409);
    const previousName = grade.name;
    grade.name = name;
    await school.save();
    if (name !== previousName) await Student.updateMany({ schoolRef: school._id, schoolClass: previousName }, { $set: { schoolClass: name } });
    invalidatePublicSchools();
    res.json({ success: true, school: view(school) });
});

const deleteClass = wrap(async (req, res) => {
    const school = await findSchool(req.params.id);
    const grade = findClass(school, req.params.classId);
    if (await Student.exists({ schoolRef: school._id, schoolClass: grade.name })) fail("Students are in this class, so it cannot be removed.", 409);
    school.classes.pull(grade._id);
    await school.save();
    invalidatePublicSchools();
    res.json({ success: true, school: view(school) });
});

const addSections = wrap(async (req, res) => {
    const school = await findSchool(req.params.id);
    const grade = findClass(school, req.params.classId);
    const names = readNames(req.body, "section", 30);
    const duplicates = names.filter(name => grade.sections.some(section => sameName(section.name, name)));
    if (duplicates.length) fail(`Already added: ${duplicates.join(", ")}.`, 409);
    if (grade.sections.length + names.length > MAX_SECTIONS) fail(`A class can have at most ${MAX_SECTIONS} sections.`);
    names.forEach(name => grade.sections.push({ name }));
    await school.save();
    invalidatePublicSchools();
    res.status(201).json({ success: true, school: view(school) });
});

const updateSection = wrap(async (req, res) => {
    const school = await findSchool(req.params.id);
    const grade = findClass(school, req.params.classId);
    const section = findSection(grade, req.params.sectionId);
    const [name] = readNames(req.body, "section", 30);
    if (grade.sections.some(item => item !== section && sameName(item.name, name))) fail("This section already exists in the class.", 409);
    const previousName = section.name;
    section.name = name;
    await school.save();
    if (name !== previousName) await Student.updateMany({ schoolRef: school._id, schoolClass: grade.name, schoolSection: previousName }, { $set: { schoolSection: name } });
    invalidatePublicSchools();
    res.json({ success: true, school: view(school) });
});

const deleteSection = wrap(async (req, res) => {
    const school = await findSchool(req.params.id);
    const grade = findClass(school, req.params.classId);
    const section = findSection(grade, req.params.sectionId);
    if (await Student.exists({ schoolRef: school._id, schoolClass: grade.name, schoolSection: section.name })) fail("Students are in this section, so it cannot be removed.", 409);
    grade.sections.pull(section._id);
    await school.save();
    invalidatePublicSchools();
    res.json({ success: true, school: view(school) });
});

module.exports = {
    getPublicSchools,
    getManagedSchools,
    createSchool,
    updateSchool,
    deleteSchool,
    addClasses,
    updateClass,
    deleteClass,
    addSections,
    updateSection,
    deleteSection,
    invalidatePublicSchools,
};
