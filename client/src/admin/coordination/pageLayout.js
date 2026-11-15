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

