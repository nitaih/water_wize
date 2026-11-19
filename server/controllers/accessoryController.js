import { PrismaClient } from '@prisma/client';
import { toFeatureCollection } from '../utils/geojson.js';

const prisma = new PrismaClient();

const ALLOWED_ACCESSORY_TYPES = ['VALVE', 'METER', 'BACKFLOW', 'PUMP', 'OTHER'];

function isValidGeoJsonPoint(geom) {
  return (
    geom &&
    typeof geom === 'object' &&
    geom.type === 'Point' &&
    Array.isArray(geom.coordinates) &&
    geom.coordinates.length >= 2 &&
    typeof geom.coordinates[0] === 'number' &&
    typeof geom.coordinates[1] === 'number' &&
    Number.isFinite(geom.coordinates[0]) &&
    Number.isFinite(geom.coordinates[1])
  );
}

// POST /api/farms/:farmId/accessories
export const createAccessory = async (req, res) => {
  try {
    const farmId = req.params.farmId || req.params.id;
    const { name, type, pipelineId, geometry } = req.body;

    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({
        success: false,
        error: 'Accessory name is required.'
      });
    }

    if (!type || !ALLOWED_ACCESSORY_TYPES.includes(type)) {
      return res.status(400).json({
        success: false,
        error: `Invalid accessory type. Allowed values: ${ALLOWED_ACCESSORY_TYPES.join(', ')}`
      });
    }

    if (geometry !== undefined && geometry !== null && !isValidGeoJsonPoint(geometry)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid GeoJSON Point geometry ([longitude, latitude]).'
      });
    }

    if (pipelineId) {
      const pipeline = await prisma.pipeline.findFirst({
        where: { id: pipelineId, farmId },
        select: { id: true }
      });

      if (!pipeline) {
        return res.status(400).json({
          success: false,
          error: 'Specified pipelineId does not belong to this farm.'
        });
      }
    }

    const geoJsonString = geometry ? JSON.stringify(geometry) : null;

    const rows = await prisma.$queryRaw`
      INSERT INTO "Accessory" (
        "id",
        "name",
        "type",
        "farmId",
        "pipelineId",
        "geometry",
        "createdAt",
        "updatedAt"
      )
      VALUES (
        gen_random_uuid()::text,
        ${name.trim()},
        ${type}::"AccessoryType",
        ${farmId},
        ${pipelineId || null},
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
        "type",
        "farmId",
        "pipelineId",
        ST_AsGeoJSON("geometry")::json AS "geometry",
        "createdAt",
        "updatedAt";
    `;

    return res.status(201).json({
      success: true,
      data: rows[0]
    });
  } catch (error) {
    console.error('createAccessory error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to create accessory.'
    });
  }
};

// GET /api/farms/:farmId/accessories
export const getAccessoriesByFarm = async (req, res) => {
  try {
    const farmId = req.params.farmId || req.params.id;
    const { type, pipelineId, format } = req.query;

    const accessories = await prisma.$queryRaw`
      SELECT
        "id",
        "name",
        "type",
        "farmId",
        "pipelineId",
        ST_AsGeoJSON("geometry")::json AS "geometry",
        "createdAt",
        "updatedAt"
      FROM "Accessory"
      WHERE "farmId" = ${farmId}
        AND (${type || null}::text IS NULL OR "type"::text = ${type || null})
        AND (${pipelineId || null}::text IS NULL OR "pipelineId" = ${pipelineId || null})
      ORDER BY "createdAt" DESC;
    `;

    if (format === 'geojson') {
      const featureCollection = toFeatureCollection(accessories, (acc) => ({
        id: acc.id,
        layer: 'accessory',
        name: acc.name,
        type: acc.type,
        pipelineId: acc.pipelineId,
        farmId: acc.farmId,
        createdAt: acc.createdAt,
        updatedAt: acc.updatedAt
      }));

      return res.status(200).json(featureCollection);
    }

    return res.status(200).json({
      success: true,
      count: accessories.length,
      data: accessories
    });
  } catch (error) {
    console.error('getAccessoriesByFarm error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch accessories.'
    });
  }
};

// GET /api/farms/:farmId/accessories/:accessoryId
export const getAccessoryById = async (req, res) => {
  try {
    const farmId = req.params.farmId || req.params.id;
    const { accessoryId } = req.params;

    const rows = await prisma.$queryRaw`
      SELECT
        "id",
        "name",
        "type",
        "farmId",
        "pipelineId",
        ST_AsGeoJSON("geometry")::json AS "geometry",
        "createdAt",
        "updatedAt"
      FROM "Accessory"
      WHERE "id" = ${accessoryId} AND "farmId" = ${farmId}
      LIMIT 1;
    `;

    if (!rows.length) {
      return res.status(404).json({
        success: false,
        error: 'Accessory not found in this farm.'
      });
    }

    return res.status(200).json({
      success: true,
      data: rows[0]
    });
  } catch (error) {
    console.error('getAccessoryById error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch accessory.'
    });
  }
};

// PUT /api/farms/:farmId/accessories/:accessoryId
export const updateAccessory = async (req, res) => {
  try {
    const farmId = req.params.farmId || req.params.id;
    const { accessoryId } = req.params;
    const { name, type, pipelineId, geometry } = req.body;

    if (name !== undefined && (typeof name !== 'string' || !name.trim())) {
      return res.status(400).json({
        success: false,
        error: 'Accessory name must be a non-empty string.'
      });
    }

    if (type !== undefined && !ALLOWED_ACCESSORY_TYPES.includes(type)) {
      return res.status(400).json({
        success: false,
        error: `Invalid accessory type. Allowed values: ${ALLOWED_ACCESSORY_TYPES.join(', ')}`
      });
    }

    if (geometry !== undefined && geometry !== null && !isValidGeoJsonPoint(geometry)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid GeoJSON Point geometry ([longitude, latitude]).'
      });
    }

    if (pipelineId) {
      const pipeline = await prisma.pipeline.findFirst({
        where: { id: pipelineId, farmId },
        select: { id: true }
      });

      if (!pipeline) {
        return res.status(400).json({
          success: false,
          error: 'Specified pipelineId does not belong to this farm.'
        });
      }
    }

    const existing = await prisma.accessory.findFirst({
      where: { id: accessoryId, farmId },
      select: { id: true }
    });

    if (!existing) {
      return res.status(404).json({
        success: false,
        error: 'Accessory not found in this farm.'
      });
    }

    const shouldUpdateGeom = geometry !== undefined;
    const geoJsonString = geometry ? JSON.stringify(geometry) : null;
    const shouldUpdatePipeline = pipelineId !== undefined;

    const rows = await prisma.$queryRaw`
      UPDATE "Accessory"
      SET
        "name" = COALESCE(${name !== undefined ? name.trim() : null}::text, "name"),
        "type" = COALESCE(${type ?? null}::"AccessoryType", "type"),
        "pipelineId" = CASE
          WHEN ${shouldUpdatePipeline}::boolean THEN ${pipelineId || null}
          ELSE "pipelineId"
        END,
        "geometry" = CASE
          WHEN ${shouldUpdateGeom}::boolean THEN
            CASE
              WHEN ${geoJsonString}::text IS NOT NULL
              THEN ST_SetSRID(ST_GeomFromGeoJSON(${geoJsonString}), 4326)
              ELSE NULL
            END
          ELSE "geometry"
        END,
        "updatedAt" = NOW()
      WHERE "id" = ${accessoryId} AND "farmId" = ${farmId}
      RETURNING
        "id",
        "name",
        "type",
        "farmId",
        "pipelineId",
        ST_AsGeoJSON("geometry")::json AS "geometry",
        "createdAt",
        "updatedAt";
    `;

    return res.status(200).json({
      success: true,
      data: rows[0]
    });
  } catch (error) {
    console.error('updateAccessory error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to update accessory.'
    });
  }
};

// DELETE /api/farms/:farmId/accessories/:accessoryId
export const deleteAccessory = async (req, res) => {
  try {
    const farmId = req.params.farmId || req.params.id;
    const { accessoryId } = req.params;

    const deleted = await prisma.accessory.deleteMany({
      where: { id: accessoryId, farmId }
    });

    if (deleted.count === 0) {
      return res.status(404).json({
        success: false,
        error: 'Accessory not found in this farm.'
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Accessory deleted successfully.'
    });
  } catch (error) {
    console.error('deleteAccessory error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to delete accessory.'
    });
  }
};