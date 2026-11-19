/**
 * ממיר מערך רשומות מ-PostGIS (שבהן עמודת geometry חולצה כ-ST_AsGeoJSON(...)::json)
 * לאובייקט GeoJSON FeatureCollection תקני עבור Mapbox.
 */
export function toFeatureCollection(rows = [], buildProperties) {
  const features = rows
    .filter((row) => row && row.geometry && typeof row.geometry === 'object')
    .map((row) => ({
      type: 'Feature',
      id: row.id,
      geometry: row.geometry,
      properties: buildProperties(row)
    }));

  return {
    type: 'FeatureCollection',
    features
  };
}