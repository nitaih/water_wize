import express from 'express';
import { verifyToken } from '../middleware/authMiddleware.js';
import { requireFarmRole } from '../middleware/farmAuthMiddleware.js';
import {
  createPipeline,
  getPipelinesByFarm,
  getPipelineById,
  updatePipeline,
  deletePipeline
} from '../controllers/pipelineController.js';

const router = express.Router({ mergeParams: true });

router.use(verifyToken);

// צפייה בקווים: CREATOR, EDITOR, VIEWER
router.get(
  '/',
  requireFarmRole(['CREATOR', 'EDITOR', 'VIEWER']),
  getPipelinesByFarm
);

router.get(
  '/:pipelineId',
  requireFarmRole(['CREATOR', 'EDITOR', 'VIEWER']),
  getPipelineById
);

// יצירה ועריכה של קו: CREATOR ו-EDITOR (תואם להרשאות העריכה של קווים)
router.post(
  '/',
  requireFarmRole(['CREATOR', 'EDITOR']),
  createPipeline
);

router.put(
  '/:pipelineId',
  requireFarmRole(['CREATOR', 'EDITOR']),
  updatePipeline
);

// מחיקת קו: CREATOR בלבד
router.delete(
  '/:pipelineId',
  requireFarmRole(['CREATOR']),
  deletePipeline
);

export default router;