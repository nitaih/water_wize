import { PrismaClient } from '@prisma/client';
import { toFeatureCollection } from '../utils/geojson.js';

const prisma = new PrismaClient();

const ALLOWED_WATER_TYPES = ['POTABLE', 'RECLAIMED', 'BRACKISH', 'DRAINAGE'];

function isValidGeoJsonLineString(geom) {
  return (
    geom &&
    typeof geom === 'object' &&
    geom.type === 'LineString' &&
    Array.isArray(geom.coordinates) &&
    geom.coordinates.length >= 2
  );
}

// POST /api/farms/:farmId/pipelines
export const createPipeline = async (req, res) => {
  try {
    const farmId = req.params.farmId || req.params.id;
    const userId = req.user?.id || req.user?.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Authenticated user ID is missing.'
      });
    }

    const {
      name,
      diameter,
      material,
      waterType,
      fieldId,
      geometry
    } = req.body;

    const resolvedWaterType = waterType || 'POTABLE';
    if (!ALLOWED_WATER_TYPES.includes(resolvedWaterType)) {
      return res.status(400).json({
        success: false,
        error: `Invalid waterType. Allowed values: ${ALLOWED_WATER_TYPES.join(', ')}`
      });
    }

    if (diameter !== undefined && diameter !== null && (typeof diameter !== 'number' || !Number.isFinite(diameter))) {
      return res.status(400).json({
        success: false,
        error: 'Invalid diameter value.'
      });
    }

    if (geometry !== undefined && geometry !== null && !isValidGeoJsonLineString(geometry)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid GeoJSON LineString geometry (must have at least 2 points).'
      });
    }

    if (fieldId) {
      const field = await prisma.field.findFirst({
        where: { id: fieldId, farmId },
        select: { id: true }
      });

      if (!field) {
        return res.status(400).json({
          success: false,
          error: 'Specified fieldId does not belong to this farm.'
        });
      }
    }

    const geoJsonString = geometry ? JSON.stringify(geometry) : null;

    const rows = await prisma.$queryRaw`
      INSERT INTO "Pipeline" (
        "id",
        "name",
        "diameter",
        "material",
        "waterType",
        "farmId",
        "fieldId",
        "createdById",
        "geometry",
        "createdAt",
        "updatedAt"
      )
      VALUES (
        gen_random_uuid()::text,
        ${name ? name.trim() : null},
        ${typeof diameter === 'number' ? diameter : null}::double precision,
        ${material ? material.trim() : null},
        ${resolvedWaterType}::"WaterType",
        ${farmId},
        ${fieldId || null},
        ${userId},
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
        "diameter",
        "material",
        "waterType",
        "farmId",
        "fieldId",
        "createdById",
        ST_AsGeoJSON("geometry")::json AS "geometry",
        CASE
          WHEN "geometry" IS NOT NULL
          THEN ST_Length("geometry"::geography)
          ELSE NULL
        END AS "lengthMeters",
        "createdAt",
        "updatedAt";
    `;

    return res.status(201).json({
      success: true,
      data: rows[0]
    });
  } catch (error) {
    console.error('createPipeline error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to create pipeline.'
    });
  }
};

// GET /api/farms/:farmId/pipelines
export const getPipelinesByFarm = async (req, res) => {
  try {
    const farmId = req.params.farmId || req.params.id;
    const { waterType, fieldId, format } = req.query;

    const pipelines = await prisma.$queryRaw`
      SELECT
        "id",
        "name",
        "diameter",
        "material",
        "waterType",
        "farmId",
        "fieldId",
        "createdById",
        ST_AsGeoJSON("geometry")::json AS "geometry",
        CASE
          WHEN "geometry" IS NOT NULL
          THEN ST_Length("geometry"::geography)
          ELSE NULL
        END AS "lengthMeters",
        "createdAt",
        "updatedAt"
      FROM "Pipeline"
      WHERE "farmId" = ${farmId}
        AND (${waterType || null}::text IS NULL OR "waterType"::text = ${waterType || null})
        AND (${fieldId || null}::text IS NULL OR "fieldId" = ${fieldId || null})
      ORDER BY "createdAt" DESC;
    `;

    if (format === 'geojson') {
      const featureCollection = toFeatureCollection(pipelines, (pipe) => ({
        id: pipe.id,
        layer: 'pipeline',
        name: pipe.name,
        diameter: pipe.diameter,
        material: pipe.material,
        waterType: pipe.waterType,
        fieldId: pipe.fieldId,
        farmId: pipe.farmId,
        createdById: pipe.createdById,
        lengthMeters: pipe.lengthMeters,
        createdAt: pipe.createdAt,
        updatedAt: pipe.updatedAt
      }));

      return res.status(200).json(featureCollection);
    }

    return res.status(200).json({
      success: true,
      count: pipelines.length,
      data: pipelines
    });
  } catch (error) {
    console.error('getPipelinesByFarm error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch pipelines.'
    });
  }
};

// GET /api/farms/:farmId/pipelines/:pipelineId
export const getPipelineById = async (req, res) => {
  try {
    const farmId = req.params.farmId || req.params.id;
    const { pipelineId } = req.params;

    const rows = await prisma.$queryRaw`
      SELECT
        "id",
        "name",
        "diameter",
        "material",
        "waterType",
        "farmId",
        "fieldId",
        "createdById",
        ST_AsGeoJSON("geometry")::json AS "geometry",
        CASE
          WHEN "geometry" IS NOT NULL
          THEN ST_Length("geometry"::geography)
          ELSE NULL
        END AS "lengthMeters",
        "createdAt",
        "updatedAt"
      FROM "Pipeline"
      WHERE "id" = ${pipelineId} AND "farmId" = ${farmId}
      LIMIT 1;
    `;

    if (!rows.length) {
      return res.status(404).json({
        success: false,
        error: 'Pipeline not found in this farm.'
      });
    }

    return res.status(200).json({
      success: true,
      data: rows[0]
    });
  } catch (error) {
    console.error('getPipelineById error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch pipeline.'
    });
  }
};

// PUT /api/farms/:farmId/pipelines/:pipelineId
export const updatePipeline = async (req, res) => {
  try {
    const farmId = req.params.farmId || req.params.id;
    const { pipelineId } = req.params;
    const {
      name,
      diameter,
      material,
      waterType,
      fieldId,
      geometry
    } = req.body;

    if (waterType !== undefined && !ALLOWED_WATER_TYPES.includes(waterType)) {
      return res.status(400).json({
        success: false,
        error: `Invalid waterType. Allowed values: ${ALLOWED_WATER_TYPES.join(', ')}`
      });
    }

    if (diameter !== undefined && diameter !== null && (typeof diameter !== 'number' || !Number.isFinite(diameter))) {
      return res.status(400).json({
        success: false,
        error: 'Invalid diameter value.'
      });
    }

    if (geometry !== undefined && geometry !== null && !isValidGeoJsonLineString(geometry)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid GeoJSON LineString geometry.'
      });
    }

    if (fieldId) {
      const field = await prisma.field.findFirst({
        where: { id: fieldId, farmId },
        select: { id: true }
      });

      if (!field) {
        return res.status(400).json({
          success: false,
          error: 'Specified fieldId does not belong to this farm.'
        });
      }
    }

    const existing = await prisma.pipeline.findFirst({
      where: { id: pipelineId, farmId },
      select: { id: true }
    });

    if (!existing) {
      return res.status(404).json({
        success: false,
        error: 'Pipeline not found in this farm.'
      });
    }

    const shouldUpdateGeom = geometry !== undefined;
    const geoJsonString = geometry ? JSON.stringify(geometry) : null;
    const shouldUpdateField = fieldId !== undefined;
    const shouldUpdateDiameter = diameter !== undefined;

    const rows = await prisma.$queryRaw`
      UPDATE "Pipeline"
      SET
        "name" = COALESCE(${name !== undefined ? (name ? name.trim() : null) : null}::text, "name"),
        "diameter" = CASE
          WHEN ${shouldUpdateDiameter}::boolean THEN ${diameter ?? null}::double precision
          ELSE "diameter"
        END,
        "material" = COALESCE(${material !== undefined ? (material ? material.trim() : null) : null}::text, "material"),
        "waterType" = COALESCE(${waterType ?? null}::"WaterType", "waterType"),
        "fieldId" = CASE
          WHEN ${shouldUpdateField}::boolean THEN ${fieldId || null}
          ELSE "fieldId"
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
      WHERE "id" = ${pipelineId} AND "farmId" = ${farmId}
      RETURNING
        "id",
        "name",
        "diameter",
        "material",
        "waterType",
        "farmId",
        "fieldId",
        "createdById",
        ST_AsGeoJSON("geometry")::json AS "geometry",
        CASE
          WHEN "geometry" IS NOT NULL
          THEN ST_Length("geometry"::geography)
          ELSE NULL
        END AS "lengthMeters",
        "createdAt",
        "updatedAt";
    `;

    return res.status(200).json({
      success: true,
      data: rows[0]
    });
  } catch (error) {
    console.error('updatePipeline error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to update pipeline.'
    });
  }
};

// DELETE /api/farms/:farmId/pipelines/:pipelineId
export const deletePipeline = async (req, res) => {
  try {
    const farmId = req.params.farmId || req.params.id;
    const { pipelineId } = req.params;

    const deleted = await prisma.pipeline.deleteMany({
      where: { id: pipelineId, farmId }
    });

    if (deleted.count === 0) {
      return res.status(404).json({
        success: false,
        error: 'Pipeline not found in this farm.'
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Pipeline deleted successfully.'
    });
  } catch (error) {
    console.error('deletePipeline error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to delete pipeline.'
    });
  }
};