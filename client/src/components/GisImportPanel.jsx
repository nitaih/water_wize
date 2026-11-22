import React, { useRef, useState } from 'react';
import { importGisFile } from '../services/farmService';

const ALLOWED_EXTENSIONS = ['.kml', '.geojson', '.json'];

function hasAllowedExtension(fileName = '') {
  const lower = fileName.toLowerCase();
  return ALLOWED_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

export default function GisImportPanel({ farmId, farmName, canEdit, onImported }) {
  const fileInputRef = useRef(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  if (!canEdit || !farmId) {
    return null;
  }

  const handleFileChange = (e) => {
    setStatusMessage('');
    setErrorMessage('');

    const file = e.target.files?.[0] || null;
    if (!file) {
      setSelectedFile(null);
      return;
    }

    if (!hasAllowedExtension(file.name)) {
      setSelectedFile(null);
      setErrorMessage('יש לבחור קובץ מסוג KML, GeoJSON או JSON בלבד.');
      e.target.value = '';
      return;
    }

    setSelectedFile(file);
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    setStatusMessage('');
    setErrorMessage('');

    if (!selectedFile) {
      setErrorMessage('בחר קובץ KML או GeoJSON לפני הייבוא.');
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', selectedFile);

      const response = await importGisFile(farmId, formData);

      setSelectedFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }

      const importedCount =
        response?.importedCount ??
        response?.data?.importedCount ??
        response?.count ??
        null;

      setStatusMessage(
        importedCount !== null
          ? `הקובץ יובא בהצלחה (${importedCount} ישויות). מרענן שכבות...`
          : 'הקובץ יובא בהצלחה. מרענן שכבות...'
      );

      if (typeof onImported === 'function') {
        await onImported();
      }

      setStatusMessage('הייבוא הושלם והשכבות במפה עודכנו.');
    } catch (err) {
      setErrorMessage(err?.message || 'ייבוא קובץ ה-GIS נכשל.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <form
      onSubmit={handleUpload}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        padding: '10px 12px',
        borderRadius: '8px',
        backgroundColor: '#f8fafc',
        border: '1px solid #e2e8f0',
        minWidth: '260px'
      }}
    >
      <div style={{ fontSize: '0.82rem', fontWeight: 600, color: '#0f172a' }}>
        ייבוא KML / GeoJSON לחווה: {farmName || farmId}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept=".kml,.geojson,.json,application/vnd.google-earth.kml+xml,application/geo+json,application/json"
        onChange={handleFileChange}
        disabled={uploading}
        style={{ fontSize: '0.78rem' }}
      />

      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <button
          type="submit"
          disabled={!selectedFile || uploading}
          style={{
            padding: '6px 12px',
            borderRadius: '6px',
            border: 'none',
            backgroundColor: !selectedFile || uploading ? '#94a3b8' : '#15803d',
            color: '#ffffff',
            fontSize: '0.82rem',
            fontWeight: 600,
            cursor: !selectedFile || uploading ? 'not-allowed' : 'pointer'
          }}
        >
          {uploading ? 'מייבא...' : 'ייבא למפה'}
        </button>

        {selectedFile && (
          <span
            style={{
              fontSize: '0.75rem',
              color: '#334155',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              maxWidth: '150px'
            }}
            title={selectedFile.name}
          >
            {selectedFile.name}
          </span>
        )}
      </div>

      {statusMessage && (
        <div
          role="status"
          style={{
            fontSize: '0.78rem',
            color: '#166534',
            backgroundColor: '#f0fdf4',
            padding: '6px 8px',
            borderRadius: '4px'
          }}
        >
          {statusMessage}
        </div>
      )}

      {errorMessage && (
        <div
          role="alert"
          style={{
            fontSize: '0.78rem',
            color: '#b91c1c',
            backgroundColor: '#fef2f2',
            padding: '6px 8px',
            borderRadius: '4px'
          }}
        >
          {errorMessage}
        </div>
      )}
    </form>
  );
}