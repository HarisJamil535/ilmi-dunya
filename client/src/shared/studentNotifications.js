export const showStudentToast = ({ type = "info", title, message, duration = 4200 }) => {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("student-toast", {
    detail: { type, title, message, duration },
  }));
};
