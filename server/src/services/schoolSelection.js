const mongoose = require("mongoose");
const School = require("../models/School");
const { fail } = require("./publishing");

const PRIVATE_STUDENT = "Private Student";

const text = value => typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";

// Turns what a student chose into the fields saved on their profile.
//  - schoolId "private": a private student, no school.
//  - schoolId "other" (or older clients that only send `school`): a school typed by the student.
//  - schoolId of a school an admin manages: its class and section must come from that school's lists.
async function resolveSchoolChoice(body = {}) {
    const choice = text(body.schoolId);

    if (choice === "private") return { school: PRIVATE_STUDENT };

    if (!choice || choice === "other") {
        const school = text(body.school);
        if (school.length < 2 || school.length > 160) fail('Enter your school name, or choose "Private Student".');
        return { school };
    }

    if (!mongoose.isValidObjectId(choice)) fail("Choose your school from the list.");
    const school = await School.findOne({ _id: choice, isActive: true }).lean();
    if (!school) fail("This school is no longer available. Please choose your school again.");

    const result = { school: school.name, schoolRef: school._id };
    if (!school.classes.length) return result;

    const classId = text(body.schoolClassId);
    const grade = mongoose.isValidObjectId(classId) ? school.classes.find(item => String(item._id) === classId) : null;
    if (!grade) fail("Select your class.");
    result.schoolClass = grade.name;

    if (!grade.sections.length) return result;
    const sectionId = text(body.schoolSectionId);
    const section = mongoose.isValidObjectId(sectionId) ? grade.sections.find(item => String(item._id) === sectionId) : null;
    if (!section) fail("Select your section.");
    result.schoolSection = section.name;
    return result;
}

// Profile fields to store (and to clear when the student moves to a school the admin does not manage).
function schoolFields(resolved) {
    return {
        set: {
            school: resolved.school,
            ...(resolved.schoolRef ? { schoolRef: resolved.schoolRef } : {}),
            ...(resolved.schoolClass ? { schoolClass: resolved.schoolClass } : {}),
            ...(resolved.schoolSection ? { schoolSection: resolved.schoolSection } : {}),
        },
        unset: Object.fromEntries(["schoolRef", "schoolClass", "schoolSection"].filter(key => !resolved[key]).map(key => [key, ""])),
    };
}

module.exports = { PRIVATE_STUDENT, resolveSchoolChoice, schoolFields };
