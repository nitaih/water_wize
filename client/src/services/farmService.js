import { apiRequest } from './api';

// Auth & Farms
export const loginUser = (credentials) =>
  apiRequest('/auth/login', { method: 'POST', body: credentials });

export const getCurrentUser = () =>
  apiRequest('/auth/me');

export const getMyFarms = () =>
  apiRequest('/farms');

// Fields
export const getFields = (farmId, { format } = {}) => {
  const query = format ? `?format=${encodeURIComponent(format)}` : '';
  return apiRequest(`/farms/${farmId}/fields${query}`);
};

export const createField = (farmId, payload) =>
  apiRequest(`/farms/${farmId}/fields`, { method: 'POST', body: payload });

export const updateField = (farmId, fieldId, payload) =>
  apiRequest(`/farms/${farmId}/fields/${fieldId}`, { method: 'PUT', body: payload });

export const deleteField = (farmId, fieldId) =>
  apiRequest(`/farms/${farmId}/fields/${fieldId}`, { method: 'DELETE' });

// Pipelines
export const getPipelines = (farmId, { waterType, fieldId, format } = {}) => {
  const params = new URLSearchParams();
  if (waterType) params.set('waterType', waterType);
  if (fieldId) params.set('fieldId', fieldId);
  if (format) params.set('format', format);
  const qs = params.toString() ? `?${params.toString()}` : '';
  return apiRequest(`/farms/${farmId}/pipelines${qs}`);
};

export const createPipeline = (farmId, payload) =>
  apiRequest(`/farms/${farmId}/pipelines`, { method: 'POST', body: payload });

export const updatePipeline = (farmId, pipelineId, payload) =>
  apiRequest(`/farms/${farmId}/pipelines/${pipelineId}`, { method: 'PUT', body: payload });

export const deletePipeline = (farmId, pipelineId) =>
  apiRequest(`/farms/${farmId}/pipelines/${pipelineId}`, { method: 'DELETE' });

// Accessories
export const getAccessories = (farmId, { type, pipelineId, format } = {}) => {
  const params = new URLSearchParams();
  if (type) params.set('type', type);
  if (pipelineId) params.set('pipelineId', pipelineId);
  if (format) params.set('format', format);
  const qs = params.toString() ? `?${params.toString()}` : '';
  return apiRequest(`/farms/${farmId}/accessories${qs}`);
};

export const createAccessory = (farmId, payload) =>
  apiRequest(`/farms/${farmId}/accessories`, { method: 'POST', body: payload });

export const updateAccessory = (farmId, accessoryId, payload) =>
  apiRequest(`/farms/${farmId}/accessories/${accessoryId}`, { method: 'PUT', body: payload });

export const deleteAccessory = (farmId, accessoryId) =>
  apiRequest(`/farms/${farmId}/accessories/${accessoryId}`, { method: 'DELETE' });

// Maintenance Logs
export const getMaintenanceLogs = (farmId, { pipelineId, accessoryId } = {}) => {
  const params = new URLSearchParams();
  if (pipelineId) params.set('pipelineId', pipelineId);
  if (accessoryId) params.set('accessoryId', accessoryId);
  const qs = params.toString() ? `?${params.toString()}` : '';
  return apiRequest(`/farms/${farmId}/maintenance-logs${qs}`);
};

export const createMaintenanceLog = (farmId, payload) =>
  apiRequest(`/farms/${farmId}/maintenance-logs`, { method: 'POST', body: payload });

// Import GeoJSON / KML
export async function importGisFile(farmId, fileOrFormData) {
  const formData =
    fileOrFormData instanceof FormData
      ? fileOrFormData
      : (() => {
          const fd = new FormData();
          fd.append('file', fileOrFormData);
          return fd;
        })();

  return apiRequest(`/farms/${farmId}/import`, {
    method: 'POST',
    body: formData
  });
}

export const importGisGeoJson = (farmId, geojson) =>
  apiRequest(`/farms/${farmId}/import`, {
    method: 'POST',
    body: geojson
  });