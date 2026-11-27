// Coordination records in English (left to right) or Urdu (right to left).
// Urdu, Islamiyat and Tarjuma-tul-Quran departments keep their records in Urdu, in the school's Urdu form
// (Nastaleeq script, labels as in the printed Urdu record). The language is set on the department; a
// department named Urdu, Islamiyat or Quran starts in Urdu.
const URDU_DEPARTMENT = /urdu|اُ?ردو|islam|اسلام|quran|qur'?an|قرآن|tarjum|ترجم|nazira|ناظرہ/i;
const languageOf = (department) => (department?.language === "ur" || department?.language === "en" ? department.language : URDU_DEPARTMENT.test(department?.name || "") ? "ur" : "en");
const ARABIC_SCRIPT = /[؀-ۿݐ-ݿࢠ-ࣿﭐ-﷿ﹰ-﻿]/;
const isRtlText = (text) => ARABIC_SCRIPT.test(text || "");

const DAY_NAMES = {
    en: { mon: "Monday", tue: "Tuesday", wed: "Wednesday", thu: "Thursday", fri: "Friday" },
    ur: { mon: "پیر", tue: "منگل", wed: "بدھ", thu: "جمعرات", fri: "جمعہ" },
};
const COLUMN_NAMES = {
    en: { period: "Day / Period", subTopics: "Sub-Topics", methods: "Methodologies", resources: "Resources", afl: "AFL Strategies", work: "CW / HW / Online Assignment & Project Work" },
    ur: { period: "دن / پیریڈ", subTopics: "ذیلی موضوعات", methods: "طریقہ ہائے تدریس", resources: "وسائل", afl: "AFL حکمتِ عملیاں", work: "کلاس ورک / ہوم ورک / آن لائن اسائنمنٹ اور پراجیکٹ ورک" },
};
// The printed labels of the record.
const PRINT = {
    en: {
        week: "Week:", className: "Class:", sections: "No. of Sections:", subject: "Subject:", topic: "Topic:", periods: "Periods per week",
        broughtForward: "Topics brought forward (if any):", extraHelp: "Strategies for Learners requiring extra assistance:",
        teacher: "Teacher Responsible for Preparing lesson Plan:", attendees: "Attendees of Coordination Meeting:", sectionHead: "Section Head",
        submitDate: "Date of submission of the Lesson Plan to the Sec Head:", distributeDate: "Date of distribution of the finalized Lesson Plan to the Teachers:",
        signCoordinator: "Sign: Subject Coordinator:", signSectionHead: "SH Sign:", signPrincipal: "Principal Sign:",
        page: (n, m) => `Page ${n} of ${m}`, draft: "DRAFT — NOT YET SIGNED", submitted: "SUBMITTED — AWAITING SECTION HEAD APPROVAL",
    },
    ur: {
        week: "ہفتہ:", className: "جماعت:", sections: "سیکشنز کی تعداد:", subject: "مضمون:", topic: "موضوع:", periods: "ہفتہ وار پیریڈز:",
        broughtForward: "گزشتہ ہفتے سے آگے آنے والے موضوعات (اگر کوئی ہوں):", extraHelp: "اضافی معاونت کے متقاضی طلبہ کے لیے حکمتِ عملیاں:",
        teacher: "سبق منصوبہ تیار کرنے کے ذمہ دار استاد:", attendees: "رابطہ اجلاس کے شرکاء:", sectionHead: "سیکشن ہیڈ",
        submitDate: "سبق منصوبہ سیکشن ہیڈ کو جمع کرانے کی تاریخ:", distributeDate: "حتمی سبق منصوبہ اساتذہ میں تقسیم کرنے کی تاریخ:",
        signCoordinator: "دستخط سبجیکٹ کوآرڈینیٹر:", signSectionHead: "دستخط سیکشن ہیڈ:", signPrincipal: "دستخط پرنسپل:",
        page: (n, m) => `صفحہ ${n} از ${m}`, draft: "مسودہ — ابھی دستخط نہیں ہوئے", submitted: "جمع شدہ — سیکشن ہیڈ کی منظوری کا انتظار",
    },
};
// The Urdu record's title (the English one comes from the record settings).
const URDU_TITLE = "ہفتہ وار مضمونی رابطہ اجلاس ریکارڈ {session} (جماعت نہم – دہم)";

// Class and subject names as an Urdu record writes them ("9th" -> "نہم", "Islamiyat" -> "اسلامیات").
const URDU_CLASSES = { 6: "ششم", 7: "ہفتم", 8: "ہشتم", 9: "نہم", 10: "دہم", 11: "گیارہویں", 12: "بارہویں" };
const urduClass = (name) => { const n = Number(String(name || "").match(/\d+/)?.[0]); return URDU_CLASSES[n] || String(name || ""); };
const urduSubject = (name) => {
    const v = String(name || "");
    if (/urdu/i.test(v)) return "اُردو";
    if (/islam/i.test(v)) return "اسلامیات";
    if (/tarjum|quran|qur'?an/i.test(v)) return "ترجمۃ القرآن";
    if (/nazira/i.test(v)) return "ناظرہ قرآن";
    return v;
};

const printLabels = (lang) => PRINT[lang] || PRINT.en;
const dayName = (lang, day) => (DAY_NAMES[lang] || DAY_NAMES.en)[day];
const columnName = (lang, column) => (COLUMN_NAMES[lang] || COLUMN_NAMES.en)[column];

module.exports = { urduClass, urduSubject, languageOf, isRtlText, printLabels, dayName, columnName, DAY_NAMES, COLUMN_NAMES, URDU_TITLE, URDU_DEPARTMENT };
