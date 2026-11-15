// The Weekly Subject Coordination Meeting Record (blank APSACS format, Class Pre–X), as named cells.
// Every renderer (editor, Word, PDF) and the Word importer read the layout from here.
const DAYS = [["mon", "Monday"], ["tue", "Tuesday"], ["wed", "Wednesday"], ["thu", "Thursday"], ["fri", "Friday"]];
const COLUMNS = [
    ["period", "Day / Period"],
    ["subTopics", "Sub-Topics"],
    ["methods", "Methodologies"],
    ["resources", "Resources"],
    ["afl", "AFL Strategies"],
    ["work", "CW / HW / Online Assignment & Project Work"],
];
// Column widths in twentieths of a point, for A4 landscape with 0.5" side margins (total 15398).
const WIDTHS = [1390, 2280, 3300, 2500, 2560, 3368];

const SINGLE_LINE = ["week", "className", "sections", "subject", "topic", "periods", "submitDate", "distributeDate", "coordinatorName", "sectionHeadName", "attendee1", "attendee2", "attendee3", "attendee4", "teacher"];
const keys = [
    ...SINGLE_LINE,
    "broughtForward", "extraHelp",
    ...DAYS.flatMap(([day]) => COLUMNS.map(([column]) => `${day}.${column}`)),
];
const KEYS = new Set(keys);

const labels = {
    week: "Week", className: "Class", sections: "No. of Sections", subject: "Subject", topic: "Topic", periods: "Periods per week",
    broughtForward: "Topics brought forward (if any)", extraHelp: "Strategies for Learners requiring extra assistance",
    teacher: "Teacher Responsible for Preparing lesson Plan", attendee1: "Attendee 1", attendee2: "Attendee 2", attendee3: "Attendee 3", attendee4: "Attendee 4",
    submitDate: "Date of submission of the Lesson Plan to the Sec Head", distributeDate: "Date of distribution of the finalized Lesson Plan to the Teachers",
    coordinatorName: "Subject Coordinator", sectionHeadName: "SH",
};
for (const [day, dayName] of DAYS) for (const [column, columnName] of COLUMNS) labels[`${day}.${column}`] = `${dayName} › ${columnName}`;

const labelOf = (key) => labels[key] || key;

module.exports = { DAYS, COLUMNS, WIDTHS, KEYS, SINGLE_LINE, labelOf, keys };
