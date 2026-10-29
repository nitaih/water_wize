import React, { useState, useEffect } from 'react';
import Map, { Source, Layer } from 'react-map-gl';
import 'mapbox-gl/dist/mapbox-gl.css';

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;

const pipelineLayerStyle = {
  id: 'pipeline-layer',
  type: 'line',
  paint: {
    'line-color': '#007cbf',
    'line-width': 4
  }
};

export default function WaterMap() {
  const [viewState, setViewState] = useState({
    longitude: 35.5,
    latitude: 32.5,
    zoom: 11
  });

  const [pipelinesGeoJSON, setPipelinesGeoJSON] = useState({
    type: 'FeatureCollection',
    features: []
  });

  useEffect(() => {
    fetch('http://localhost:5000/api/pipelines')
      .then(res => res.json())
      .then(data => {
        if (data.success && data.data) {
          const features = data.data.map(pipe => ({
            type: 'Feature',
            geometry: {
              type: 'LineString',
              coordinates: pipe.coordinates
            },
            properties: {
              id: pipe.id,
              name: pipe.name,
              material: pipe.material,
              diameter: pipe.diameterMm
            }
          }));

          setPipelinesGeoJSON({
            type: 'FeatureCollection',
            features: features
          });
        }
      })
      .catch(err => console.error('Failed to fetch pipelines:', err));
  }, []);

  // אם אין עדיין טוקן, נציג הודעה ברורה במקום מסך ריק לגמרי
  if (!MAPBOX_TOKEN) {
    return <div style={{ padding: '20px', color: 'red' }}>Error: VITE_MAPBOX_TOKEN is missing in .env file!</div>;
  }

  return (
    <div style={{ width: '100vw', height: '100vh', margin: 0, padding: 0, overflow: 'hidden' }}>
      <Map
        {...viewState}
        onMove={evt => setViewState(evt.viewState)}
        style={{ width: '100%', height: '100%' }}
        mapStyle="mapbox://styles/mapbox/streets-v12"
        mapboxAccessToken={MAPBOX_TOKEN}
      >
        {pipelinesGeoJSON.features.length > 0 && (
          <Source id="pipelines-source" type="geojson" data={pipelinesGeoJSON}>
            <Layer {...pipelineLayerStyle} />
          </Source>
        )}
      </Map>
    </div>
  );
}