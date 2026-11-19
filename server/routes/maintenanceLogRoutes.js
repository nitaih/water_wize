import express from 'express';
import { verifyToken } from '../middleware/authMiddleware.js';
import { requireFarmRole } from '../middleware/farmAuthMiddleware.js';
import {
  createMaintenanceLog,
  getMaintenanceLogsByFarm,
  getMaintenanceLogById,
  updateMaintenanceLog,
  deleteMaintenanceLog
} from '../controllers/maintenanceLogController.js';

const router = express.Router({ mergeParams: true });

router.use(verifyToken);

// צפייה בתיעוד תקלות וטיפולים: CREATOR, EDITOR, VIEWER
router.get(
  '/',
  requireFarmRole(['CREATOR', 'EDITOR', 'VIEWER']),
  getMaintenanceLogsByFarm
);

router.get(
  '/:logId',
  requireFarmRole(['CREATOR', 'EDITOR', 'VIEWER']),
  getMaintenanceLogById
);

// יצירה ועדכון תיעוד תחזוקה: CREATOR ו-EDITOR
router.post(
  '/',
  requireFarmRole(['CREATOR', 'EDITOR']),
  createMaintenanceLog
);

router.put(
  '/:logId',
  requireFarmRole(['CREATOR', 'EDITOR']),
  updateMaintenanceLog
);

// מחיקת תיעוד תחזוקה: CREATOR בלבד
router.delete(
  '/:logId',
  requireFarmRole(['CREATOR']),
  deleteMaintenanceLog
);

export default router;