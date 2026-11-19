import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function getUserId(req) {
  return req.user?.id || req.user?.userId || null;
}

function getFarmId(req) {
  return req.params.farmId || req.params.id;
}

async function validateTargetsInFarm(farmId, pipelineId, accessoryId) {
  if (pipelineId) {
    const pipeline = await prisma.pipeline.findFirst({
      where: { id: pipelineId, farmId },
      select: { id: true }
    });
    if (!pipeline) {
      return { ok: false, error: 'Specified pipelineId does not belong to this farm.' };
    }
  }

  if (accessoryId) {
    const accessory = await prisma.accessory.findFirst({
      where: { id: accessoryId, farmId },
      select: { id: true }
    });
    if (!accessory) {
      return { ok: false, error: 'Specified accessoryId does not belong to this farm.' };
    }
  }

  return { ok: true };
}

// POST /api/farms/:farmId/maintenance-logs
export const createMaintenanceLog = async (req, res) => {
  try {
    const farmId = getFarmId(req);
    const userId = getUserId(req);

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Authenticated user ID is missing.'
      });
    }

    const { description, date, pipelineId, accessoryId } = req.body;

    if (!description || typeof description !== 'string' || !description.trim()) {
      return res.status(400).json({
        success: false,
        error: 'Maintenance log description is required.'
      });
    }

    if (!pipelineId && !accessoryId) {
      return res.status(400).json({
        success: false,
        error: 'Either pipelineId or accessoryId must be provided.'
      });
    }

    const targetCheck = await validateTargetsInFarm(farmId, pipelineId, accessoryId);
    if (!targetCheck.ok) {
      return res.status(400).json({
        success: false,
        error: targetCheck.error
      });
    }

    let parsedDate;
    if (date !== undefined) {
      const d = new Date(date);
      if (Number.isNaN(d.getTime())) {
        return res.status(400).json({
          success: false,
          error: 'Invalid date format.'
        });
      }
      parsedDate = d;
    }

    const log = await prisma.maintenanceLog.create({
      data: {
        description: description.trim(),
        ...(parsedDate ? { date: parsedDate } : {}),
        userId,
        pipelineId: pipelineId || null,
        accessoryId: accessoryId || null
      },
      include: {
        user: {
          select: { id: true, name: true, email: true }
        },
        pipeline: {
          select: { id: true, name: true, waterType: true, farmId: true }
        },
        accessory: {
          select: { id: true, name: true, type: true, farmId: true }
        }
      }
    });

    return res.status(201).json({
      success: true,
      data: log
    });
  } catch (error) {
    console.error('createMaintenanceLog error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to create maintenance log.'
    });
  }
};

// GET /api/farms/:farmId/maintenance-logs
// תומך בפילטרים אופציונליים: ?pipelineId=... או ?accessoryId=...
export const getMaintenanceLogsByFarm = async (req, res) => {
  try {
    const farmId = getFarmId(req);
    const { pipelineId, accessoryId } = req.query;

    const logs = await prisma.maintenanceLog.findMany({
      where: {
        ...(pipelineId ? { pipelineId: String(pipelineId) } : {}),
        ...(accessoryId ? { accessoryId: String(accessoryId) } : {}),
        AND: [
          {
            OR: [
              { pipeline: { farmId } },
              { accessory: { farmId } }
            ]
          }
        ]
      },
      include: {
        user: {
          select: { id: true, name: true, email: true }
        },
        pipeline: {
          select: { id: true, name: true, waterType: true }
        },
        accessory: {
          select: { id: true, name: true, type: true }
        }
      },
      orderBy: { date: 'desc' }
    });

    return res.status(200).json({
      success: true,
      count: logs.length,
      data: logs
    });
  } catch (error) {
    console.error('getMaintenanceLogsByFarm error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch maintenance logs.'
    });
  }
};

// GET /api/farms/:farmId/maintenance-logs/:logId
export const getMaintenanceLogById = async (req, res) => {
  try {
    const farmId = getFarmId(req);
    const { logId } = req.params;

    const log = await prisma.maintenanceLog.findFirst({
      where: {
        id: logId,
        OR: [
          { pipeline: { farmId } },
          { accessory: { farmId } }
        ]
      },
      include: {
        user: {
          select: { id: true, name: true, email: true }
        },
        pipeline: {
          select: { id: true, name: true, waterType: true }
        },
        accessory: {
          select: { id: true, name: true, type: true }
        }
      }
    });

    if (!log) {
      return res.status(404).json({
        success: false,
        error: 'Maintenance log not found in this farm.'
      });
    }

    return res.status(200).json({
      success: true,
      data: log
    });
  } catch (error) {
    console.error('getMaintenanceLogById error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch maintenance log.'
    });
  }
};

// PUT /api/farms/:farmId/maintenance-logs/:logId
export const updateMaintenanceLog = async (req, res) => {
  try {
    const farmId = getFarmId(req);
    const { logId } = req.params;
    const { description, date, pipelineId, accessoryId } = req.body;

    const existing = await prisma.maintenanceLog.findFirst({
      where: {
        id: logId,
        OR: [
          { pipeline: { farmId } },
          { accessory: { farmId } }
        ]
      }
    });

    if (!existing) {
      return res.status(404).json({
        success: false,
        error: 'Maintenance log not found in this farm.'
      });
    }

    if (description !== undefined && (typeof description !== 'string' || !description.trim())) {
      return res.status(400).json({
        success: false,
        error: 'Description must be a non-empty string.'
      });
    }

    const nextPipelineId = pipelineId !== undefined ? (pipelineId || null) : existing.pipelineId;
    const nextAccessoryId = accessoryId !== undefined ? (accessoryId || null) : existing.accessoryId;

    if (!nextPipelineId && !nextAccessoryId) {
      return res.status(400).json({
        success: false,
        error: 'Maintenance log must remain linked to at least a pipeline or an accessory.'
      });
    }

    const targetCheck = await validateTargetsInFarm(farmId, nextPipelineId, nextAccessoryId);
    if (!targetCheck.ok) {
      return res.status(400).json({
        success: false,
        error: targetCheck.error
      });
    }

    let parsedDate;
    if (date !== undefined) {
      const d = new Date(date);
      if (Number.isNaN(d.getTime())) {
        return res.status(400).json({
          success: false,
          error: 'Invalid date format.'
        });
      }
      parsedDate = d;
    }

    const updated = await prisma.maintenanceLog.update({
      where: { id: logId },
      data: {
        ...(description !== undefined ? { description: description.trim() } : {}),
        ...(parsedDate ? { date: parsedDate } : {}),
        ...(pipelineId !== undefined ? { pipelineId: pipelineId || null } : {}),
        ...(accessoryId !== undefined ? { accessoryId: accessoryId || null } : {})
      },
      include: {
        user: {
          select: { id: true, name: true, email: true }
        },
        pipeline: {
          select: { id: true, name: true, waterType: true }
        },
        accessory: {
          select: { id: true, name: true, type: true }
        }
      }
    });

    return res.status(200).json({
      success: true,
      data: updated
    });
  } catch (error) {
    console.error('updateMaintenanceLog error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to update maintenance log.'
    });
  }
};

// DELETE /api/farms/:farmId/maintenance-logs/:logId
export const deleteMaintenanceLog = async (req, res) => {
  try {
    const farmId = getFarmId(req);
    const { logId } = req.params;

    const existing = await prisma.maintenanceLog.findFirst({
      where: {
        id: logId,
        OR: [
          { pipeline: { farmId } },
          { accessory: { farmId } }
        ]
      },
      select: { id: true }
    });

    if (!existing) {
      return res.status(404).json({
        success: false,
        error: 'Maintenance log not found in this farm.'
      });
    }

    await prisma.maintenanceLog.delete({
      where: { id: logId }
    });

    return res.status(200).json({
      success: true,
      message: 'Maintenance log deleted successfully.'
    });
  } catch (error) {
    console.error('deleteMaintenanceLog error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to delete maintenance log.'
    });
  }
};