import axiosInstance from "../api/axios";

// Downloads a picture from a pasted link (through the server, which checks the address) and returns it as a
// File, so it can go through the same upload as a picture chosen from the device.
export async function fileFromLink(link) {
  const url = String(link || "").trim();
  if (!/^https?:\/\/\S+$/i.test(url)) throw new Error("Paste a full picture link that starts with https://");
  try {
    const response = await axiosInstance.post("/media/fetch-image", { url }, { responseType: "blob", timeout: 30000 });
    const type = response.data.type || "image/jpeg";
    const extension = response.headers["x-image-extension"] || ".jpg";
    const name = (url.split("/").pop()?.split(/[?#]/)[0] || "picture").replace(/\.[a-z0-9]+$/i, "").slice(0, 60) || "picture";
    return new File([response.data], `${name}${extension}`, { type });
  } catch (error) {
    // Errors arrive as a Blob because of the response type; read the server's message from it.
    const blob = error.response?.data;
    if (blob instanceof Blob) {
      try { const body = JSON.parse(await blob.text()); throw new Error(body.message || "The picture could not be downloaded."); }
      catch (parsed) { if (parsed instanceof SyntaxError) throw new Error("The picture could not be downloaded."); throw parsed; }
    }
    throw new Error(error.message && !error.response ? "The picture could not be downloaded. Check your connection." : "The picture could not be downloaded.");
  }
}

