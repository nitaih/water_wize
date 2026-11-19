import { PrismaClient } from '@prisma/client';
import { toFeatureCollection } from '../utils/geojson.js';

const prisma = new PrismaClient();

// פונקציית עזר לוולידציה בסיסית של GeoJSON Polygon
function isValidGeoJsonPolygon(geom) {
  return (
    geom &&
    typeof geom === 'object' &&
    geom.type === 'Polygon' &&
    Array.isArray(geom.coordinates) &&
    geom.coordinates.length > 0
  );
}

// POST /api/farms/:farmId/fields
export const createField = async (req, res) => {
  try {
    const farmId = req.params.farmId || req.params.id;
    const { name, geometry, areaSize } = req.body;

    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({
        success: false,
        error: 'Field name is required.'
      });
    }

    if (geometry !== undefined && geometry !== null && !isValidGeoJsonPolygon(geometry)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid GeoJSON Polygon geometry.'
      });
    }

    const geoJsonString = geometry ? JSON.stringify(geometry) : null;

    // אם הגיעה גיאומטריה, נחשב שטח ב-PostGIS (במ"ר) אם לא הועבר areaSize במפורש
    const rows = await prisma.$queryRaw`
      INSERT INTO "Field" (
        "id",
        "name",
        "areaSize",
        "farmId",
        "geometry",
        "createdAt",
        "updatedAt"
      )
      VALUES (
        gen_random_uuid()::text,
        ${name.trim()},
        COALESCE(
          ${typeof areaSize === 'number' ? areaSize : null}::double precision,
          CASE
            WHEN ${geoJsonString}::text IS NOT NULL
            THEN ST_Area(ST_SetSRID(ST_GeomFromGeoJSON(${geoJsonString}), 4326)::geography)
            ELSE NULL
          END
        ),
        ${farmId},
        CASE
          WHEN ${geoJsonString}::text IS NOT NULL
          THEN ST_SetSRID(ST_GeomFromGeoJSON(${geoJsonString}), 4326)
          ELSE NULL
        END,
        NOW(),
        NOW()
      )
      RETURNING
        "id",
        "name",
        "areaSize",
        "farmId",
        ST_AsGeoJSON("geometry")::json AS "geometry",
        "createdAt",
        "updatedAt";
    `;

    return res.status(201).json({
      success: true,
      data: rows[0]
    });
  } catch (error) {
    console.error('createField error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to create field.'
    });
  }
};

// GET /api/farms/:farmId/fields
export const getFieldsByFarm = async (req, res) => {
  try {
    const farmId = req.params.farmId || req.params.id;
    const { format } = req.query;

    const fields = await prisma.$queryRaw`
      SELECT
        "id",
        "name",
        "areaSize",
        "farmId",
        ST_AsGeoJSON("geometry")::json AS "geometry",
        "createdAt",
        "updatedAt"
      FROM "Field"
      WHERE "farmId" = ${farmId}
      ORDER BY "createdAt" DESC;
    `;

    if (format === 'geojson') {
      const featureCollection = toFeatureCollection(fields, (field) => ({
        id: field.id,
        layer: 'field',
        name: field.name,
        areaSize: field.areaSize,
        farmId: field.farmId,
        createdAt: field.createdAt,
        updatedAt: field.updatedAt
      }));

      return res.status(200).json(featureCollection);
    }

    return res.status(200).json({
      success: true,
      count: fields.length,
      data: fields
    });
  } catch (error) {
    console.error('getFieldsByFarm error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch fields.'
    });
  }
};

// GET /api/farms/:farmId/fields/:fieldId
export const getFieldById = async (req, res) => {
  try {
    const farmId = req.params.farmId || req.params.id;
    const { fieldId } = req.params;

    const rows = await prisma.$queryRaw`
      SELECT
        "id",
        "name",
        "areaSize",
        "farmId",
        ST_AsGeoJSON("geometry")::json AS "geometry",
        "createdAt",
        "updatedAt"
      FROM "Field"
      WHERE "id" = ${fieldId} AND "farmId" = ${farmId}
      LIMIT 1;
    `;

    if (!rows.length) {
      return res.status(404).json({
        success: false,
        error: 'Field not found in this farm.'
      });
    }

    return res.status(200).json({
      success: true,
      data: rows[0]
    });
  } catch (error) {
    console.error('getFieldById error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch field.'
    });
  }
};

// PUT /api/farms/:farmId/fields/:fieldId
export const updateField = async (req, res) => {
  try {
    const farmId = req.params.farmId || req.params.id;
    const { fieldId } = req.params;
    const { name, geometry, areaSize } = req.body;

    if (geometry !== undefined && geometry !== null && !isValidGeoJsonPolygon(geometry)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid GeoJSON Polygon geometry.'
      });
    }

    const existing = await prisma.field.findFirst({
      where: { id: fieldId, farmId },
      select: { id: true }
    });

    if (!existing) {
      return res.status(404).json({
        success: false,
        error: 'Field not found in this farm.'
      });
    }

    const shouldUpdateGeom = geometry !== undefined;
    const geoJsonString = geometry ? JSON.stringify(geometry) : null;
    const hasExplicitArea = typeof areaSize === 'number';

    const rows = await prisma.$queryRaw`
      UPDATE "Field"
      SET
        "name" = COALESCE(${name ?? null}::text, "name"),
        "geometry" = CASE
          WHEN ${shouldUpdateGeom}::boolean THEN
            CASE
              WHEN ${geoJsonString}::text IS NOT NULL
              THEN ST_SetSRID(ST_GeomFromGeoJSON(${geoJsonString}), 4326)
              ELSE NULL
            END
          ELSE "geometry"
        END,
        "areaSize" = CASE
          WHEN ${hasExplicitArea}::boolean THEN ${areaSize ?? null}::double precision
          WHEN ${shouldUpdateGeom}::boolean AND ${geoJsonString}::text IS NOT NULL
            THEN ST_Area(ST_SetSRID(ST_GeomFromGeoJSON(${geoJsonString}), 4326)::geography)
          WHEN ${shouldUpdateGeom}::boolean AND ${geoJsonString}::text IS NULL
            THEN NULL
          ELSE "areaSize"
        END,
        "updatedAt" = NOW()
      WHERE "id" = ${fieldId} AND "farmId" = ${farmId}
      RETURNING
        "id",
        "name",
        "areaSize",
        "farmId",
        ST_AsGeoJSON("geometry")::json AS "geometry",
        "createdAt",
        "updatedAt";
    `;

    return res.status(200).json({
      success: true,
      data: rows[0]
    });
  } catch (error) {
    console.error('updateField error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to update field.'
    });
  }
};

// DELETE /api/farms/:farmId/fields/:fieldId
export const deleteField = async (req, res) => {
  try {
    const farmId = req.params.farmId || req.params.id;
    const { fieldId } = req.params;

    const deleted = await prisma.field.deleteMany({
      where: { id: fieldId, farmId }
    });

    if (deleted.count === 0) {
      return res.status(404).json({
        success: false,
        error: 'Field not found in this farm.'
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Field deleted successfully.'
    });
  } catch (error) {
    console.error('deleteField error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to delete field.'
    });
  }
};