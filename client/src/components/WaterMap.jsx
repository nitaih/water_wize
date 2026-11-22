import React, { useCallback, useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { useAuth } from '../context/AuthContext';
import { getAccessories, getFields, getPipelines } from '../services/farmService';
import GisImportPanel from './GisImportPanel';

mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN || '';

const EMPTY_FEATURE_COLLECTION = {
  type: 'FeatureCollection',
  features: []
};

function ensureFeatureCollection(payload) {
  const candidate =
    payload?.type === 'FeatureCollection'
      ? payload
      : payload?.data?.type === 'FeatureCollection'
        ? payload.data
        : payload?.geojson?.type === 'FeatureCollection'
          ? payload.geojson
          : null;

  if (candidate && Array.isArray(candidate.features)) {
    return candidate;
  }
  return EMPTY_FEATURE_COLLECTION;
}

function extendBoundsFromCollection(bounds, fc) {
  fc?.features?.forEach((feature) => {
    const coords = feature?.geometry?.coordinates;
    if (!coords) return;

    const visit = (node) => {
      if (!Array.isArray(node)) return;
      if (typeof node[0] === 'number' && typeof node[1] === 'number') {
        bounds.extend([node[0], node[1]]);
      } else {
        node.forEach(visit);
      }
    };

    visit(coords);
  });
}

export default function WaterMap() {
  const {
    activeFarmId,
    activeFarm,
    farms,
    selectFarm,
    role,
    canEdit,
    canDelete,
    logout
  } = useAuth();

  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const mapLoadedRef = useRef(false);
  const latestGeoDataRef = useRef({
    fields: EMPTY_FEATURE_COLLECTION,
    pipelines: EMPTY_FEATURE_COLLECTION,
    accessories: EMPTY_FEATURE_COLLECTION
  });

  const [geoData, setGeoData] = useState({
    fields: EMPTY_FEATURE_COLLECTION,
    pipelines: EMPTY_FEATURE_COLLECTION,
    accessories: EMPTY_FEATURE_COLLECTION
  });
  const [loadingLayers, setLoadingLayers] = useState(false);
  const [layerError, setLayerError] = useState('');
  const [selectedFeature, setSelectedFeature] = useState(null);

  const applyGeoDataToMap = (map, data, shouldFitBounds = false) => {
    if (!map || !mapLoadedRef.current) return;

    const fieldsSrc = map.getSource('fields-source');
    const pipelinesSrc = map.getSource('pipelines-source');
    const accessoriesSrc = map.getSource('accessories-source');

    if (fieldsSrc) fieldsSrc.setData(data.fields);
    if (pipelinesSrc) pipelinesSrc.setData(data.pipelines);
    if (accessoriesSrc) accessoriesSrc.setData(data.accessories);

    if (shouldFitBounds) {
      const bounds = new mapboxgl.LngLatBounds();
      extendBoundsFromCollection(bounds, data.fields);
      extendBoundsFromCollection(bounds, data.pipelines);
      extendBoundsFromCollection(bounds, data.accessories);

      if (!bounds.isEmpty()) {
        map.fitBounds(bounds, { padding: 60, maxZoom: 16, duration: 700 });
      }
    }
  };
  const loadFarmLayers = useCallback(async (farmId, { shouldFitBounds = true } = {}) => {
    if (!farmId) {
      const empty = {
        fields: EMPTY_FEATURE_COLLECTION,
        pipelines: EMPTY_FEATURE_COLLECTION,
        accessories: EMPTY_FEATURE_COLLECTION
      };
      latestGeoDataRef.current = empty;
      setGeoData(empty);
      setSelectedFeature(null);
      setLayerError('');
      applyGeoDataToMap(mapRef.current, empty, false);
      return;
    }

    setLoadingLayers(true);
    setLayerError('');
    setSelectedFeature(null);

    try {
      const [fieldsRes, pipelinesRes, accessoriesRes] = await Promise.all([
        getFields(farmId, { format: 'geojson' }),
        getPipelines(farmId, { format: 'geojson' }),
        getAccessories(farmId, { format: 'geojson' })
      ]);

      const nextData = {
        fields: ensureFeatureCollection(fieldsRes),
        pipelines: ensureFeatureCollection(pipelinesRes),
        accessories: ensureFeatureCollection(accessoriesRes)
      };

      latestGeoDataRef.current = nextData;
      setGeoData(nextData);
      applyGeoDataToMap(mapRef.current, nextData, shouldFitBounds);
    } catch (err) {
      setLayerError(err?.message || 'שגיאה בטעינת שכבות ה-GIS של החווה.');
    } finally {
      setLoadingLayers(false);
    }
  }, []);

  useEffect(() => {
    loadFarmLayers(activeFarmId, { shouldFitBounds: true });
  }, [activeFarmId, loadFarmLayers]);

  // 1. אתחול המפה והשכבות (פוליגונים, קווים, נקודות)
  useEffect(() => {
    if (mapRef.current || !mapContainerRef.current) return;

    const map = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: 'mapbox://styles/mapbox/satellite-streets-v12',
      center: [35.5, 32.5],
      zoom: 13
    });

    map.addControl(new mapboxgl.NavigationControl(), 'top-right');

    map.on('load', () => {
      mapLoadedRef.current = true;

      map.addSource('fields-source', {
        type: 'geojson',
        data: EMPTY_FEATURE_COLLECTION
      });

      map.addSource('pipelines-source', {
        type: 'geojson',
        data: EMPTY_FEATURE_COLLECTION
      });

      map.addSource('accessories-source', {
        type: 'geojson',
        data: EMPTY_FEATURE_COLLECTION
      });

      // פוליגונים - חלקות (Fields)
      map.addLayer({
        id: 'fields-fill',
        type: 'fill',
        source: 'fields-source',
        paint: {
          'fill-color': '#22c55e',
          'fill-opacity': 0.25
        }
      });

      map.addLayer({
        id: 'fields-outline',
        type: 'line',
        source: 'fields-source',
        paint: {
          'line-color': '#15803d',
          'line-width': 2
        }
      });

      // קווים - קווי מים (Pipelines) לפי waterType
      map.addLayer({
        id: 'pipelines-line',
        type: 'line',
        source: 'pipelines-source',
        paint: {
          'line-width': 3.5,
          'line-color': [
            'match',
            ['get', 'waterType'],
            'POTABLE', '#2563eb',
            'RECLAIMED', '#9333ea',
            'BRACKISH', '#d97706',
            'DRAINAGE', '#0891b2',
            '#334155'
          ]
        }
      });

      // נקודות - אביזרים (Accessories) לפי type / AccessoryType
      map.addLayer({
        id: 'accessories-circle',
        type: 'circle',
        source: 'accessories-source',
        paint: {
          'circle-radius': 7,
          'circle-stroke-width': 2,
          'circle-stroke-color': '#ffffff',
          'circle-color': [
            'match',
            ['coalesce', ['get', 'type'], ['get', 'accessoryType'], ''],
            'VALVE', '#ef4444',
            'METER', '#0ea5e9',
            'BACKFLOW', '#f59e0b',
            'PUMP', '#10b981',
            '#64748b'
          ]
        }
      });

      // לחיצה על פוליגון / קו / נקודה
      const clickableLayers = ['accessories-circle', 'pipelines-line', 'fields-fill'];
      clickableLayers.forEach((layerId) => {
        map.on('click', layerId, (e) => {
          const feature = e.features?.[0];
          if (!feature) return;
          setSelectedFeature({
            layerId,
            properties: feature.properties || {},
            geometry: feature.geometry || null
          });
        });

        map.on('mouseenter', layerId, () => {
          map.getCanvas().style.cursor = 'pointer';
        });

        map.on('mouseleave', layerId, () => {
          map.getCanvas().style.cursor = '';
        });
      });

      // אם נתונים כבר נטענו לפני סיום load - הצג אותם מיד
      applyGeoDataToMap(map, latestGeoDataRef.current, true);
    });

    mapRef.current = map;

    return () => {
      mapLoadedRef.current = false;
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // 2. טעינת שכבות GeoJSON לחווה הפעילה
  useEffect(() => {
    let cancelled = false;

    async function loadFarmLayers() {
      if (!activeFarmId) {
        const empty = {
          fields: EMPTY_FEATURE_COLLECTION,
          pipelines: EMPTY_FEATURE_COLLECTION,
          accessories: EMPTY_FEATURE_COLLECTION
        };
        latestGeoDataRef.current = empty;
        setGeoData(empty);
        setSelectedFeature(null);
        setLayerError('');
        applyGeoDataToMap(mapRef.current, empty, false);
        return;
      }

      setLoadingLayers(true);
      setLayerError('');
      setSelectedFeature(null);

      try {
        const [fieldsRes, pipelinesRes, accessoriesRes] = await Promise.all([
          getFields(activeFarmId, { format: 'geojson' }),
          getPipelines(activeFarmId, { format: 'geojson' }),
          getAccessories(activeFarmId, { format: 'geojson' })
        ]);

        if (cancelled) return;

        const nextData = {
          fields: ensureFeatureCollection(fieldsRes),
          pipelines: ensureFeatureCollection(pipelinesRes),
          accessories: ensureFeatureCollection(accessoriesRes)
        };

        latestGeoDataRef.current = nextData;
        setGeoData(nextData);
        applyGeoDataToMap(mapRef.current, nextData, true);
      } catch (err) {
        if (cancelled) return;
        setLayerError(err?.message || 'שגיאה בטעינת שכבות ה-GIS של החווה.');
      } finally {
        if (!cancelled) {
          setLoadingLayers(false);
        }
      }
    }

    loadFarmLayers();

    return () => {
      cancelled = true;
    };
  }, [activeFarmId]);

  // 3. סנכרון עדכוני geoData למפה
  useEffect(() => {
    latestGeoDataRef.current = geoData;
    applyGeoDataToMap(mapRef.current, geoData, false);
  }, [geoData]);

  const counts = {
    fields: geoData.fields.features.length,
    pipelines: geoData.pipelines.features.length,
    accessories: geoData.accessories.features.length
  };

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      {/* סרגל עליון: חווה, תפקיד, מונה שכבות והתנתקות */}
      <div
        style={{
          position: 'absolute',
          top: '12px',
          right: '12px',
          zIndex: 10,
          backgroundColor: 'rgba(255, 255, 255, 0.96)',
          padding: '10px 14px',
          borderRadius: '8px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.12)',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          flexWrap: 'wrap'
        }}

      >
        <GisImportPanel
        farmId={activeFarmId}
        farmName={activeFarm?.name}
        canEdit={canEdit}
        onImported={() => loadFarmLayers(activeFarmId, { shouldFitBounds: true })}
      />
        <label style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span>חווה:</span>
          <select
            value={activeFarmId || ''}
            onChange={(e) => selectFarm(e.target.value)}
            style={{ padding: '4px 8px', borderRadius: '4px' }}
          >
            {farms.map((farm) => (
              <option key={farm.id} value={farm.id}>
                {farm.name}
              </option>
            ))}
          </select>
        </label>

        {role && (
          <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>
            תפקיד: {role}
          </span>
        )}

        <span style={{ fontSize: '0.82rem', color: '#334155' }}>
          חלקות: {counts.fields} | קווים: {counts.pipelines} | אביזרים: {counts.accessories}
        </span>

        {loadingLayers && (
          <span style={{ fontSize: '0.85rem', color: '#475569' }}>
            טוען שכבות...
          </span>
        )}

        {layerError && (
          <span style={{ fontSize: '0.85rem', color: '#b91c1c' }}>
            {layerError}
          </span>
        )}

        <button type="button" onClick={logout} style={{ padding: '4px 10px', cursor: 'pointer' }}>
          התנתק
        </button>
      </div>

      {/* פאנל פרטי ישות שנבחרה */}
      {selectedFeature && (
        <div
          style={{
            position: 'absolute',
            bottom: '16px',
            right: '12px',
            zIndex: 10,
            maxWidth: '340px',
            backgroundColor: 'rgba(255, 255, 255, 0.97)',
            padding: '12px 14px',
            borderRadius: '8px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <strong>{selectedFeature.properties.name || 'ישות ללא שם'}</strong>
            <button type="button" onClick={() => setSelectedFeature(null)}>
              ✕
            </button>
          </div>
          <pre style={{ margin: '8px 0 0', fontSize: '0.78rem', overflowX: 'auto' }}>
            {JSON.stringify(selectedFeature.properties, null, 2)}
          </pre>
          <div style={{ marginTop: '8px', fontSize: '0.78rem', color: '#475569' }}>
            חווה: {activeFarm?.name || activeFarmId} | עריכה: {canEdit ? 'מותר' : 'אסור'} | מחיקה: {canDelete ? 'מותר' : 'אסור'}
          </div>
        </div>
      )}

      {/* מכל המפה */}
      <div ref={mapContainerRef} style={{ width: '100%', height: '100%' }} />
    </div>
  );
}