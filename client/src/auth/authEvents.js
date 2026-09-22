export const STUDENT_AUTH_CHANGED = "ilmidunya:student-auth-changed";

export const notifyStudentAuthChanged = () => {
  window.dispatchEvent(new Event(STUDENT_AUTH_CHANGED));
};
