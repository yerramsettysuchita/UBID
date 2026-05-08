import axios from "axios";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

export const api = axios.create({
  baseURL: API_BASE,
  headers: { "Content-Type": "application/json" },
});

api.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("access_token");
    if (token) config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401 && typeof window !== "undefined") {
      localStorage.removeItem("access_token");
      window.location.href = "/login";
    }
    return Promise.reject(err);
  }
);

// Auth
export const login = (email: string, password: string) =>
  api.post("/auth/login", { email, password });

export const getMe = () => api.get("/auth/me");

// Search
export const searchBusinesses = (params: Record<string, unknown>) =>
  api.get("/search", { params });

// Business
export const getBusinessProfile = (ubid: string) =>
  api.get(`/business/${ubid}`);

export const getLinkedRecords = (ubid: string) =>
  api.get(`/business/${ubid}/linked-records`);

export const getReviewHistory = (ubid: string) =>
  api.get(`/business/${ubid}/review-history`);

// Timeline
export const getTimeline = (ubid: string, params?: Record<string, unknown>) =>
  api.get(`/timeline/${ubid}`, { params });

// Review
export const getReviewQueue = (params?: Record<string, unknown>) =>
  api.get("/review/queue", { params });

export const getReviewCase = (caseId: string) =>
  api.get(`/review/${caseId}`);

export const decideReviewCase = (
  caseId: string,
  body: { decision: string; reason: string; confidence_agreement?: boolean }
) => api.post(`/review/${caseId}/decide`, body);

// Dashboard
export const getDashboardSummary = () =>
  api.get("/dashboard/summary");

// Entity Resolution (Phase 2)
export const triggerERRun = () =>
  api.post("/er/run");

export const getERRuns = (params?: Record<string, unknown>) =>
  api.get("/er/runs", { params });

export const getERMetrics = () =>
  api.get("/er/metrics");

export const getERCandidates = (params?: Record<string, unknown>) =>
  api.get("/er/candidates", { params });

// Pincode
export const getPincodeSummary = (pincode: string) =>
  api.get(`/pincode/${pincode}`);

export const queryPincodeBusinesses = (params: Record<string, unknown>) =>
  api.get("/pincode/query", { params });

// Phase 3 — Review workflow
export const bulkDecideCases = (body: { case_ids: string[]; decision: string; reason: string }) =>
  api.post("/review/bulk-decide", body);

export const assignCase = (caseId: string, reviewer_id: string) =>
  api.post(`/review/${caseId}/assign`, { reviewer_id });

export const addCaseNote = (caseId: string, comment: string) =>
  api.post(`/review/${caseId}/note`, { comment });

export const runPrioritization = () =>
  api.post("/review/prioritize");

export const listReviewers = () =>
  api.get("/review/reviewers/list");

// Phase 3 — Operations
export const getOperationsMetrics = () =>
  api.get("/operations/metrics");

export const listClusters = (params?: Record<string, unknown>) =>
  api.get("/operations/clusters", { params });

export const getCluster = (clusterId: string) =>
  api.get(`/operations/clusters/${clusterId}`);

export const splitCluster = (
  clusterId: string,
  body: { group_a_record_ids: string[]; group_b_record_ids: string[]; reason: string }
) => api.post(`/operations/clusters/${clusterId}/split`, body);

export const mergeClusters = (clusterId: string, body: { target_cluster_id: string; reason: string }) =>
  api.post(`/operations/clusters/${clusterId}/merge`, body);

// Phase 4 — Analytics
export const getPincodeIntelligence = (code: string) =>
  api.get(`/analytics/pincode/${code}`);

export const getPincodeBusinesses = (code: string, params?: Record<string, unknown>) =>
  api.get(`/analytics/pincode/${code}/businesses`, { params });

export const comparePincodes = (codeA: string, codeB: string) =>
  api.get(`/analytics/pincode/${codeA}/compare/${codeB}`);

export const listDistricts = () =>
  api.get("/analytics/districts");

export const getDistrictDetail = (name: string) =>
  api.get(`/analytics/districts/${encodeURIComponent(name)}`);

export const getSupervisorOverview = () =>
  api.get("/analytics/overview");

export const getAnalyticsTrends = () =>
  api.get("/analytics/trends");

export const getDepartmentCoverage = () =>
  api.get("/analytics/departments");

export const getRiskHighlights = () =>
  api.get("/analytics/risks");

export const exportPincodeCSV = (code: string) =>
  api.get(`/analytics/export/pincode/${code}`, { responseType: "blob" });

export const exportDistrictsCSV = () =>
  api.get("/analytics/export/districts", { responseType: "blob" });

// Phase 5 — Graph Intelligence
export const getBusinessGraph = (ubid: string) =>
  api.get(`/graph/business/${ubid}`);

export const getSuspiciousSignals = (params?: Record<string, unknown>) =>
  api.get("/graph/suspicious", { params });

export const getNearbyBusinesses = (ubid: string, limit?: number) =>
  api.get(`/graph/business/${ubid}/nearby`, { params: limit ? { limit } : {} });

export const getBusinessHierarchy = (ubid: string) =>
  api.get(`/graph/business/${ubid}/hierarchy`);

// Cross-dept Intelligence Query
export const crossDeptQuery = (params: Record<string, unknown>) => api.get("/query/cross-dept", { params });
export const getQueryPresets = () => api.get("/query/presets");
export const getBusinessHealthScore = (ubid: string) => api.get(`/query/health-score/${ubid}`);
export const ubidLookup = (params: Record<string, unknown>) => api.post("/query/lookup", null, { params });
export const getDormancyRisk = (ubid: string) => api.get(`/query/dormancy-risk/${ubid}`);
export const getAtRiskBusinesses = (threshold?: number) => api.get("/query/at-risk-businesses", { params: threshold ? { threshold } : {} });
export const getSchedulerStatus = () => api.get("/admin/scheduler/status");
export const getSystemStatus = () => api.get("/admin/system/status");
export const triggerIngestion = () => api.post("/admin/ingestion/trigger");
export const getERModelEvaluation = () => api.get("/er/model-evaluation");

// Admin
export const listAdminUsers = () => api.get("/admin/users");
export const listAdminDepartments = () => api.get("/admin/departments");
export const listAuditLogs = (page?: number) => api.get("/admin/audit-logs", { params: { page: page ?? 1 } });

// ML Model
export const getERModelStats = () => api.get("/er/model-stats");
export const retrainERModel = () => api.post("/er/retrain");
