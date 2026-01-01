import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Auth API
export const authApi = {
  login: (email, password) => api.post('/auth/login', { email, password }),
  register: (data) => api.post('/auth/register', data),
  me: () => api.get('/auth/me'),
  changePassword: (currentPassword, newPassword) => 
    api.post('/auth/change-password', { currentPassword, newPassword }),
  epicAuthorize: () => api.get('/auth/epic/authorize'),
  epicCallback: (code, state) => api.post('/auth/epic/callback', { code, state }),
  epicDisconnect: () => api.post('/auth/epic/disconnect'),
};

// EPIC API
export const epicApi = {
  connectionStatus: () => api.get('/epic/connection-status'),
  getPatients: (params) => api.get('/epic/patients', { params }),
  getPatient: (id) => api.get(`/epic/patients/${id}`),
  getPatientConditions: (id) => api.get(`/epic/patients/${id}/conditions`),
  getPatientEverything: (id) => api.get(`/epic/patients/${id}/everything`),
  getConditions: (params) => api.get('/epic/conditions', { params }),
  searchPatients: (criteria) => api.post('/epic/search', criteria),
  initiateBulkExport: (resourceTypes) => api.post('/epic/bulk-export', { resourceTypes }),
  checkBulkExportStatus: (statusUrl) => api.get('/epic/bulk-export/status', { params: { statusUrl } }),
};

// Patients API
export const patientsApi = {
  list: (params) => api.get('/patients', { params }),
  get: (id) => api.get(`/patients/${id}`),
  analyze: (id) => api.post(`/patients/${id}/analyze`),
  getCareGaps: (id) => api.get(`/patients/${id}/care-gaps`),
  bulkAnalyze: (patientIds, carePlanId) => 
    api.post('/patients/bulk-analyze', { patientIds, carePlanId }),
};

// Analytics API
export const analyticsApi = {
  dashboard: () => api.get('/analytics/dashboard'),
  population: () => api.get('/analytics/population'),
  riskStratification: (sampleSize) => 
    api.post('/analytics/risk-stratification', { sampleSize }),
  icd10Patterns: () => api.get('/analytics/icd10-patterns'),
  carePlanOpportunities: () => api.get('/analytics/care-plan-opportunities'),
  campaignPerformance: (params) => api.get('/analytics/campaign-performance', { params }),
};

// Care Plans API
export const carePlansApi = {
  list: (params) => api.get('/care-plans', { params }),
  get: (id) => api.get(`/care-plans/${id}`),
  create: (data) => api.post('/care-plans', data),
  update: (id, data) => api.put(`/care-plans/${id}`, data),
  delete: (id) => api.delete(`/care-plans/${id}`),
  duplicate: (id) => api.post(`/care-plans/${id}/duplicate`),
  templates: () => api.get('/care-plans/templates/list'),
  categories: () => api.get('/care-plans/categories/list'),
};

// Campaigns API
export const campaignsApi = {
  list: (params) => api.get('/campaigns', { params }),
  get: (id) => api.get(`/campaigns/${id}`),
  create: (data) => api.post('/campaigns', data),
  targetPatients: (id) => api.post(`/campaigns/${id}/target-patients`),
  generateContent: (id, patientIds) => 
    api.post(`/campaigns/${id}/generate-content`, { patientIds }),
  send: (id) => api.post(`/campaigns/${id}/send`),
  getOutreach: (id, params) => api.get(`/campaigns/${id}/outreach`, { params }),
  pause: (id) => api.post(`/campaigns/${id}/pause`),
  complete: (id) => api.post(`/campaigns/${id}/complete`),
};

// AI API
export const aiApi = {
  analyze: (prompt, systemPrompt, selectBest) => 
    api.post('/ai/analyze', { prompt, systemPrompt, selectBest }),
  generateLetter: (data) => api.post('/ai/generate-letter', data),
  carePlanMatch: (patientData, carePlans) => 
    api.post('/ai/care-plan-match', { patientData, carePlans }),
  riskStratify: (patients) => api.post('/ai/risk-stratify', { patients }),
  icd10Analyze: (icd10Data) => api.post('/ai/icd10-analyze', { icd10Data }),
  careGaps: (patientData, qualityMeasures) => 
    api.post('/ai/care-gaps', { patientData, qualityMeasures }),
  compare: (prompt, systemPrompt) => api.post('/ai/compare', { prompt, systemPrompt }),
};

// Admin API
export const adminApi = {
  // Organizations
  listOrganizations: () => api.get('/admin/organizations'),
  getOrganization: (id) => api.get(`/admin/organizations/${id}`),
  updateOrganization: (id, data) => api.put(`/admin/organizations/${id}`, data),
  
  // Users
  listUsers: () => api.get('/admin/users'),
  createUser: (data) => api.post('/admin/users', data),
  updateUser: (id, data) => api.put(`/admin/users/${id}`, data),
  deleteUser: (id) => api.delete(`/admin/users/${id}`),
  resetPassword: (id, newPassword) => 
    api.post(`/admin/users/${id}/reset-password`, { newPassword }),
  
  // Settings
  getSettings: () => api.get('/admin/settings'),
  updateSettings: (data) => api.put('/admin/settings', data),
  
  // Audit Logs
  getAuditLogs: (params) => api.get('/admin/audit-logs', { params }),
};

export default api;
