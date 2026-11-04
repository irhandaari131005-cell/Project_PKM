import axios from "axios";

const env = import.meta.env ?? {};
const API_BASE_URL = (env.VITE_API_BASE_URL || "").replace(/\/+$/, "");
const STUDENTS_ENDPOINT = env.VITE_DATA_SISWA_ENDPOINT || "/api/data_siswa";
const TEACHERS_ENDPOINT = env.VITE_DATA_GURU_ENDPOINT || "/api/data_guru";

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
  withCredentials: true,
  headers: { Accept: "application/json" },
  responseType: "json",
  transitional: { silentJSONParsing: false },
});

apiClient.interceptors.request.use((config) => {
  const token = globalThis.localStorage?.getItem("auth_token");
  if (token && !config.headers.has("Authorization")) {
    config.headers.set("Authorization", `Bearer ${token}`);
  }
  return config;
});

async function request(path, options = {}) {
  const response = await apiClient.request({ ...options, url: path });
  if (response.status === 204) return null;
  // response.data adalah payload JSON backend, termasuk pembungkus { data: ... }.
  return response.data;
}

function collectionRequest(endpoint, { page = 1, signal } = {}) {
  return request(endpoint, { method: "get", params: { page }, signal });
}

export const dashboardApi = {
  getStudents(options) {
    return collectionRequest(STUDENTS_ENDPOINT, options);
  },
  getTeachers(options) {
    return collectionRequest(TEACHERS_ENDPOINT, options);
  },
};

export { request };
