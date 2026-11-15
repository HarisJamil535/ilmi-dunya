import axiosInstance from "../../api/axios";

export const api = {
  get: (path, config) => axiosInstance.get(`/coordination${path}`, config).then((r) => r.data),
  post: (path, body, config) => axiosInstance.post(`/coordination${path}`, body, config).then((r) => r.data),
  put: (path, body) => axiosInstance.put(`/coordination${path}`, body).then((r) => r.data),
  patch: (path, body) => axiosInstance.patch(`/coordination${path}`, body).then((r) => r.data),
  del: (path) => axiosInstance.delete(`/coordination${path}`).then((r) => r.data),
};

export const messageOf = (error, fallback = "Something went wrong. Please try again.") => error?.response?.data?.message || error?.message || fallback;

// Downloads a Word or PDF file from the API and saves it with the name the server gives.
export async function download(path) {
  const response = await axiosInstance.get(`/coordination${path}`, { responseType: "blob", timeout: 120000 });
  const name = /filename="([^"]+)"/.exec(response.headers["content-disposition"] || "")?.[1] || "coordination";
  const url = URL.createObjectURL(response.data);
  const link = Object.assign(document.createElement("a"), { href: url, download: name });
  document.body.appendChild(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export const ROLE_LABEL = { viewer: "Viewer", editor: "Teacher (editor)", coordinator: "Subject Coordinator", sectionHead: "Section Head", principal: "Principal", manager: "Manager" };
export const ROLE_HINT = {
  viewer: "Can read, download and comment.",
  editor: "Can also edit the weekly records.",
  coordinator: "Can also submit a week and sign as Subject Coordinator.",
  sectionHead: "Can also approve a week and sign as Section Head.",
};
export const STATUS = {
  draft: { label: "Draft", tone: "bg-amber-50 text-amber-700 ring-amber-200" },
  submitted: { label: "Awaiting approval", tone: "bg-sky-50 text-sky-700 ring-sky-200" },
  approved: { label: "Approved", tone: "bg-emerald-50 text-emerald-700 ring-emerald-200" },
};
export const timeAgo = (date) => {
  if (!date) return "";
  const s = Math.round((Date.now() - new Date(date).getTime()) / 1000);
  if (s < 45) return "just now";
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} h ago`;
  return new Date(date).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
};
export const initials = (name = "") => name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join("") || "?";
