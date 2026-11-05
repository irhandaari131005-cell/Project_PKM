import { useEffect, useState } from "react";
import { dashboardApi } from "../../services/api.js";
import { normalizeCollection } from "./dashboardData.js";

const loaders = {
  data_siswa: dashboardApi.getStudents,
  data_guru: dashboardApi.getTeachers,
};

function useCollection(resource, enabled = true) {
  const [page, setPage] = useState(1);
  const [revision, setRevision] = useState(0);
  const [state, setState] = useState({
    payload: null, items: [], total: null, currentPage: 1, lastPage: 1, loading: true, error: "",
  });

  useEffect(() => {
    if (!enabled) {
      setState({ payload: null, items: [], total: null, currentPage: 1, lastPage: 1, loading: false, error: "" });
      return;
    }
    const controller = new AbortController();
    setState((previous) => ({ ...previous, loading: true, error: "" }));

    async function load() {
      try {
        const payload = await loaders[resource]({ page, signal: controller.signal });
        const collection = normalizeCollection(payload, resource, page);
        if (!controller.signal.aborted) {
          setState({ ...collection, loading: false, error: "" });
        }
      } catch (error) {
        if (controller.signal.aborted) return;
        const label = resource === "data_siswa" ? "siswa" : "guru";
        const status = error.response?.status ?? error.status;
        const timedOut = error.code === "ECONNABORTED" || error.code === "ETIMEDOUT";
        const message = status === 401
          ? "Sesi berakhir. Silakan masuk kembali."
          : status === 403
            ? `Anda tidak memiliki akses ke data ${label}.`
            : timedOut
              ? `Waktu tunggu data ${label} habis. Silakan coba lagi.`
              : `Data ${label} belum dapat dimuat. Silakan coba lagi.`;
        setState((previous) => ({ ...previous, loading: false, error: message }));
      }
    }

    load();
    return () => controller.abort();
  }, [resource, page, revision, enabled]);

  function reload() {
    setRevision((previous) => previous + 1);
  }

  function goToPage(nextPage) {
    setPage(nextPage);
    reload();
  }

  return { ...state, setPage: goToPage, reload };
}

function useSummary() {
  const [state, setState] = useState({ data: null, loading: true, error: "" });
  useEffect(() => {
    const controller = new AbortController();
    dashboardApi.getSummary({ signal: controller.signal })
      .then((data) => { if (!controller.signal.aborted) setState({ data, loading: false, error: "" }); })
      .catch(() => { if (!controller.signal.aborted) setState({ data: null, loading: false, error: "Ringkasan belum dapat dimuat." }); });
    return () => controller.abort();
  }, []);
  return state;
}

export default function useDashboardData({ includeTeachers = false } = {}) {
  // Semuanya berjalan bersamaan; kegagalan satu endpoint tidak menghapus hasil lainnya.
  const students = useCollection("data_siswa");
  const teachers = useCollection("data_guru", includeTeachers);
  const summary = useSummary();
  return { students, teachers, summary };
}
