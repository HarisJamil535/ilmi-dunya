// The record's boxes and columns (the same layout as the server's coordTemplate).
export const DAYS = [["mon", "Monday"], ["tue", "Tuesday"], ["wed", "Wednesday"], ["thu", "Thursday"], ["fri", "Friday"]];
export const COLUMNS = [["period", "Day / Period"], ["subTopics", "Sub-Topics"], ["methods", "Methodologies"], ["resources", "Resources"], ["afl", "AFL Strategies"], ["work", "CW / HW / Online Assignment & Project Work"]];
export const WIDTHS = [1390, 2280, 3300, 2500, 2560, 3368];
export const TOTAL = WIDTHS.reduce((a, b) => a + b, 0);
export const LABELS = {
  week: "Week", className: "Class", sections: "No. of Sections", subject: "Subject", topic: "Topic", periods: "Periods per week", broughtForward: "Topics brought forward (if any)",
  extraHelp: "Strategies for Learners requiring extra assistance", teacher: "Teacher Responsible for Preparing lesson Plan", attendee1: "Attendee 1", attendee2: "Attendee 2", attendee3: "Attendee 3", attendee4: "Attendee 4",
  submitDate: "Date of submission of the Lesson Plan to the Sec Head", distributeDate: "Date of distribution of the finalized Lesson Plan to the Teachers", coordinatorName: "Subject Coordinator name", sectionHeadName: "Section Head name",
};
for (const [d, dn] of DAYS) for (const [c, cn] of COLUMNS) LABELS[`${d}.${c}`] = `${dn} › ${c === "period" ? "Period" : cn}`;


// Urdu records (Urdu, Islamiyat, Tarjuma-tul-Quran): the school's Urdu form, right to left.
const UR_DAYS = { mon: "پیر", tue: "منگل", wed: "بدھ", thu: "جمعرات", fri: "جمعہ" };
const UR_COLUMNS = { period: "دن / پیریڈ", subTopics: "ذیلی موضوعات", methods: "طریقہ ہائے تدریس", resources: "وسائل", afl: "AFL حکمتِ عملیاں", work: "کلاس ورک / ہوم ورک / آن لائن اسائنمنٹ اور پراجیکٹ ورک" };
const UR_LABELS = {
  week: "ہفتہ", className: "جماعت", sections: "سیکشنز کی تعداد", subject: "مضمون", topic: "موضوع", periods: "ہفتہ وار پیریڈز", broughtForward: "گزشتہ ہفتے سے آگے آنے والے موضوعات (اگر کوئی ہوں)",
  extraHelp: "اضافی معاونت کے متقاضی طلبہ کے لیے حکمتِ عملیاں", teacher: "سبق منصوبہ تیار کرنے کے ذمہ دار استاد", attendee1: "شریک 1", attendee2: "شریک 2", attendee3: "شریک 3", attendee4: "شریک 4",
  submitDate: "سبق منصوبہ سیکشن ہیڈ کو جمع کرانے کی تاریخ", distributeDate: "حتمی سبق منصوبہ اساتذہ میں تقسیم کرنے کی تاریخ", coordinatorName: "سبجیکٹ کوآرڈینیٹر", sectionHeadName: "سیکشن ہیڈ",
};
for (const [d] of DAYS) for (const [c] of COLUMNS) UR_LABELS[`${d}.${c}`] = `${UR_DAYS[d]} › ${c === "period" ? "پیریڈ" : UR_COLUMNS[c]}`;

const EN_TEXT = {
  rtl: false, days: Object.fromEntries(DAYS), columns: Object.fromEntries(COLUMNS), labels: LABELS,
  week: "Week:", className: "Class:", sections: "No. of Sections:", subject: "Subject:", periods: "Periods per week", topic: "Topic:",
  broughtForward: "Topics brought forward (if any):", extraHelp: "Strategies for Learners requiring extra assistance:", teacher: "Teacher Responsible for Preparing lesson Plan:",
  attendees: "Attendees of Coordination Meeting:", sectionHead: "Section Head", submitDate: "Date of submission of the Lesson Plan to the Sec Head:", distributeDate: "Date of distribution of the finalized Lesson Plan to the Teachers:",
  signCoordinator: "Sign: Subject Coordinator:", signSectionHead: "SH Sign:", signPrincipal: "Principal Sign:", period: "Period…",
  weekDetails: "Week details", afterPlan: "After the plan", signatures: "Signatures", coordinator: "Subject Coordinator", principal: "Principal",
};
const UR_TEXT = {
  rtl: true, days: UR_DAYS, columns: UR_COLUMNS, labels: UR_LABELS,
  week: "ہفتہ:", className: "جماعت:", sections: "سیکشنز کی تعداد:", subject: "مضمون:", periods: "ہفتہ وار پیریڈز:", topic: "موضوع:",
  broughtForward: "گزشتہ ہفتے سے آگے آنے والے موضوعات (اگر کوئی ہوں):", extraHelp: "اضافی معاونت کے متقاضی طلبہ کے لیے حکمتِ عملیاں:", teacher: "سبق منصوبہ تیار کرنے کے ذمہ دار استاد:",
  attendees: "رابطہ اجلاس کے شرکاء:", sectionHead: "سیکشن ہیڈ", submitDate: "سبق منصوبہ سیکشن ہیڈ کو جمع کرانے کی تاریخ:", distributeDate: "حتمی سبق منصوبہ اساتذہ میں تقسیم کرنے کی تاریخ:",
  signCoordinator: "دستخط سبجیکٹ کوآرڈینیٹر:", signSectionHead: "دستخط سیکشن ہیڈ:", signPrincipal: "دستخط پرنسپل:", period: "پیریڈ…",
  weekDetails: "ہفتے کی تفصیل", afterPlan: "منصوبے کے بعد", signatures: "دستخط", coordinator: "سبجیکٹ کوآرڈینیٹر", principal: "پرنسپل",
};
export const textFor = (lang) => (lang === "ur" ? UR_TEXT : EN_TEXT);
