import { apiClient } from "./api.js";
import { text, validationError } from "./activityApi.js";

// Format foto: WebP/JPG/JPEG, landscape 1200 x 600 piksel (2:1).
// Target ukuran 150–300 KB/foto; batas unggah 2 MB/foto dan 5 foto/kegiatan.
export const PHOTO_HINT = "WebP/JPG/JPEG · disarankan 1200 × 600 piksel (2:1) · target 150–300 KB/foto · maksimal 2 MB/foto dan 5 foto per kegiatan.";
export const MAX_ACTIVITY_PHOTOS = 5;
export const MAX_PHOTO_BYTES = 2 * 1024 * 1024;

export function validatePhotoFiles(files = []) {
  if (!Array.isArray(files) || files.length > MAX_ACTIVITY_PHOTOS) throw validationError({ foto: ["Pilih maksimal 5 foto per kegiatan."] });
  for (const file of files) {
    if (!(file instanceof Blob) || typeof file.name !== "string" || !["image/webp", "image/jpeg"].includes(file.type) || !/\.(webp|jpe?g)$/i.test(file.name)) {
      throw validationError({ foto: ["Format foto harus WebP, JPG, atau JPEG."] });
    }
    if (!file.size || file.size > MAX_PHOTO_BYTES) throw validationError({ foto: ["Foto harus berisi gambar dengan ukuran maksimal 2 MB per file."] });
  }
  return files;
}

export function resolvePhotoUrl(value) {
  const raw = text(value);
  if (!raw) return "";
  try {
    const origin = globalThis.location?.origin || "http://localhost";
    const base = new URL(`${(apiClient.defaults.baseURL || origin).replace(/\/+$/, "")}/`, origin);
    const url = new URL(raw, base);
    return ["http:", "https:"].includes(url.protocol) ? url.href : "";
  } catch { return ""; }
}

export function normalizePhotos(value, defaultCaption = "") {
  const items = Array.isArray(value) ? value : value == null ? [] : [value];
  return items.flatMap((item) => {
    const record = typeof item === "string" ? { url: item } : item;
    if (!record || typeof record !== "object" || Array.isArray(record)) return [];
    const url = resolvePhotoUrl(record.url ?? record.foto_url);
    if (!url) return [];
    return [{ id: text(record.id_foto ?? record.id), url, caption: text(record.caption ?? record.nama_ekstrakurikuler) || defaultCaption }];
  });
}

export function prepareExtracurricularWrite(payload, values, method) {
  const files = validatePhotoFiles(values?.foto ?? []);
  const removed = values?.hapus_foto ?? [];
  if (!Array.isArray(removed) || removed.length > MAX_ACTIVITY_PHOTOS || removed.some((id) => typeof id !== "string" || !id.trim())) {
    throw validationError({ foto: ["Daftar foto yang dihapus tidak valid."] });
  }
  if (!files.length && !removed.length) return { method, data: payload };
  const data = new FormData();
  for (const [field, value] of Object.entries(payload)) data.append(field, value ?? "");
  for (const file of files) data.append("foto[]", file, file.name);
  for (const id of new Set(removed.map((value) => value.trim()))) data.append("hapus_foto[]", id);
  // Laravel/PHP membaca file multipart pada POST; method spoofing menjalankan route PUT.
  if (method === "put") data.append("_method", "PUT");
  return { method: "post", data };
}
