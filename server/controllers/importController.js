import { PrismaClient } from '@prisma/client';
import { DOMParser } from '@xmldom/xmldom';
import * as toGeoJSON from '@tmcw/togeojson';

const prisma = new PrismaClient();

const ALLOWED_WATER_TYPES = ['POTABLE', 'RECLAIMED', 'BRACKISH', 'DRAINAGE'];
const ALLOWED_ACCESSORY_TYPES = ['VALVE', 'METER', 'BACKFLOW', 'PUMP', 'OTHER'];

function getUserId(req) {
  return req.user?.id || req.user?.userId || null;
}

function getFarmId(req) {
  return req.params.farmId || req.params.id;
}

// המרת קלט (קובץ או JSON/KML ב-body) ל-GeoJSON FeatureCollection
function parseInputToFeatureCollection(req) {
  let rawContent = null;
  let filename = (req.file?.originalname || '').toLowerCase();

  if (req.file && req.file.buffer) {
    rawContent = req.file.buffer.toString('utf8').trim();
  } else if (typeof req.body?.kml === 'string') {
    rawContent = req.body.kml.trim();
    filename = filename || 'input.kml';
  } else if (req.body?.geojson) {
    rawContent =
      typeof req.body.geojson === 'string'
        ? req.body.geojson.trim()
        : JSON.stringify(req.body.geojson);
    filename = filename || 'input.geojson';
  } else if (req.body && (req.body.type === 'FeatureCollection' || req.body.type === 'Feature')) {
    rawContent = JSON.stringify(req.body);
    filename = filename || 'input.geojson';
  }

  if (!rawContent) {
    throw new Error('Provide a GeoJSON/KML file in field "file" or JSON/KML in request body.');
  }

  const looksLikeKml =
    filename.endsWith('.kml') ||
    rawContent.startsWith('<?xml') ||
    rawContent.includes('<kml');

  if (looksLikeKml) {
    const xmlDoc = new DOMParser().parseFromString(rawContent, 'text/xml');
    const converted = toGeoJSON.kml(xmlDoc);
    if (!converted || converted.type !== 'FeatureCollection' || !Array.isArray(converted.features)) {
      throw new Error('Failed to parse KML into GeoJSON FeatureCollection.');
    }
    return converted;
  }

  const parsedJson = JSON.parse(rawContent);
  if (parsedJson.type === 'FeatureCollection' && Array.isArray(parsedJson.features)) {
    return parsedJson;
  }
  if (parsedJson.type === 'Feature' && parsedJson.geometry) {
    return { type: 'FeatureCollection', features: [parsedJson] };
  }

  throw new Error('Input must be a valid GeoJSON FeatureCollection, Feature, or KML document.');
}

function normalizePolygonGeometry(geometry) {
  if (!geometry || geometry.type !== 'Polygon' || !Array.isArray(geometry.coordinates)) {
    return null;
  }
  const rings = geometry.coordinates.map((ring) => {
    if (!Array.isArray(ring) || ring.length < 4) return null;
    const cleaned = ring.map((pt) => [Number(pt[0]), Number(pt[1])]);
    if (cleaned.some(([lng, lat]) => !Number.isFinite(lng) || !Number.isFinite(lat))) {
      return null;
    }
    const [firstLng, firstLat] = cleaned[0];
    const [lastLng, lastLat] = cleaned[cleaned.length - 1];
    if (firstLng !== lastLng || firstLat !== lastLat) {
      cleaned.push([firstLng, firstLat]);
    }
    return cleaned;
  });

  if (rings.some((r) => r === null)) return null;
  return { type: 'Polygon', coordinates: rings };
}

function normalizeLineStringGeometry(geometry) {
  if (!geometry || geometry.type !== 'LineString' || !Array.isArray(geometry.coordinates)) {
    return null;
  }
  const coords = geometry.coordinates.map((pt) => [Number(pt[0]), Number(pt[1])]);
  if (
    coords.length < 2 ||
    coords.some(([lng, lat]) => !Number.isFinite(lng) || !Number.isFinite(lat))
  ) {
    return null;
  }
  return { type: 'LineString', coordinates: coords };
}

function normalizePointGeometry(geometry) {
  if (!geometry || geometry.type !== 'Point' || !Array.isArray(geometry.coordinates)) {
    return null;
  }
  const lng = Number(geometry.coordinates[0]);
  const lat = Number(geometry.coordinates[1]);
  if (!Number.isFinite(lng) || !Number.isFinite(lat)) {
    return null;
  }
  return { type: 'Point', coordinates: [lng, lat] };
}

async function insertImportedField(farmId, name, polygonGeoJson) {
  const geoJsonStr = JSON.stringify(polygonGeoJson);
  const rows = await prisma.$queryRaw`
    INSERT INTO "Field" (
      "id", "name", "areaSize", "farmId", "geometry", "createdAt", "updatedAt"
    )
    VALUES (
      gen_random_uuid()::text,
      ${name},
      ST_Area(ST_SetSRID(ST_GeomFromGeoJSON(${geoJsonStr}), 4326)::geography),
      ${farmId},
      ST_SetSRID(ST_GeomFromGeoJSON(${geoJsonStr}), 4326),
      NOW(),
      NOW()
    )
    RETURNING "id", "name", "areaSize", "farmId", ST_AsGeoJSON("geometry")::json AS "geometry";
  `;
  return rows[0];
}

async function insertImportedPipeline(farmId, userId, name, props, lineGeoJson) {
  const geoJsonStr = JSON.stringify(lineGeoJson);
  const waterType = ALLOWED_WATER_TYPES.includes(props.waterType)
    ? props.waterType
    : 'POTABLE';
  const diameter =
    typeof props.diameter === 'number' && Number.isFinite(props.diameter)
      ? props.diameter
      : null;
  const material = typeof props.material === 'string' && props.material.trim()
    ? props.material.trim()
    : null;

  const rows = await prisma.$queryRaw`
    INSERT INTO "Pipeline" (
      "id", "name", "diameter", "material", "waterType",
      "farmId", "fieldId", "createdById", "geometry", "createdAt", "updatedAt"
    )
    VALUES (
      gen_random_uuid()::text,
      ${name},
      ${diameter}::double precision,
      ${material},
      ${waterType}::"WaterType",
      ${farmId},
      NULL,
      ${userId},
      ST_SetSRID(ST_GeomFromGeoJSON(${geoJsonStr}), 4326),
      NOW(),
      NOW()
    )
    RETURNING
      "id", "name", "diameter", "material", "waterType", "farmId", "createdById",
      ST_Length("geometry"::geography) AS "lengthMeters",
      ST_AsGeoJSON("geometry")::json AS "geometry";
  `;
  return rows[0];
}

async function insertImportedAccessory(farmId, name, props, pointGeoJson) {
  const geoJsonStr = JSON.stringify(pointGeoJson);
  const accType = ALLOWED_ACCESSORY_TYPES.includes(props.type)
    ? props.type
    : 'OTHER';

  const rows = await prisma.$queryRaw`
    INSERT INTO "Accessory" (
      "id", "name", "type", "farmId", "pipelineId", "geometry", "createdAt", "updatedAt"
    )
    VALUES (
      gen_random_uuid()::text,
      ${name},
      ${accType}::"AccessoryType",
      ${farmId},
      NULL,
      ST_SetSRID(ST_GeomFromGeoJSON(${geoJsonStr}), 4326),
      NOW(),
      NOW()
    )
    RETURNING "id", "name", "type", "farmId", "pipelineId", ST_AsGeoJSON("geometry")::json AS "geometry";
  `;
  return rows[0];
}

// POST /api/farms/:farmId/import
export const importGisData = async (req, res) => {
  try {
    const farmId = getFarmId(req);
    const userId = getUserId(req);

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Authenticated user ID is missing.'
      });
    }

    const featureCollection = parseInputToFeatureCollection(req);

    const summary = {
      fields: [],
      pipelines: [],
      accessories: [],
      skipped: []
    };

    for (let index = 0; index < featureCollection.features.length; index += 1) {
      const feature = featureCollection.features[index];
      const props = feature?.properties && typeof feature.properties === 'object'
        ? feature.properties
        : {};
      const baseName =
        (typeof props.name === 'string' && props.name.trim()) ||
        (typeof props.title === 'string' && props.title.trim()) ||
        `Imported Feature #${index + 1}`;

      const geom = feature?.geometry;
      if (!geom || !geom.type) {
        summary.skipped.push({ index, name: baseName, reason: 'Missing geometry.' });
        continue;
      }

      if (geom.type === 'Polygon') {
        const poly = normalizePolygonGeometry(geom);
        if (!poly) {
          summary.skipped.push({ index, name: baseName, reason: 'Invalid Polygon coordinates.' });
          continue;
        }
        const created = await insertImportedField(farmId, baseName, poly);
        summary.fields.push(created);
      } else if (geom.type === 'LineString') {
        const line = normalizeLineStringGeometry(geom);
        if (!line) {
          summary.skipped.push({ index, name: baseName, reason: 'Invalid LineString coordinates.' });
          continue;
        }
        const created = await insertImportedPipeline(farmId, userId, baseName, props, line);
        summary.pipelines.push(created);
      } else if (geom.type === 'Point') {
        const pt = normalizePointGeometry(geom);
        if (!pt) {
          summary.skipped.push({ index, name: baseName, reason: 'Invalid Point coordinates.' });
          continue;
        }
        const created = await insertImportedAccessory(farmId, baseName, props, pt);
        summary.accessories.push(created);
      } else {
        summary.skipped.push({
          index,
          name: baseName,
          reason: `Unsupported geometry type: ${geom.type}`
        });
      }
    }

    const totalImported =
      summary.fields.length + summary.pipelines.length + summary.accessories.length;

    return res.status(201).json({
      success: true,
      importedCount: totalImported,
      skippedCount: summary.skipped.length,
      data: summary
    });
  } catch (error) {
    console.error('importGisData error:', error);
    return res.status(400).json({
      success: false,
      error: error.message || 'Failed to import GIS data.'
    });
  }
};