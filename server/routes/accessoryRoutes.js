import express from 'express';
import { verifyToken } from '../middleware/authMiddleware.js';
import { requireFarmRole } from '../middleware/farmAuthMiddleware.js';
import {
  createAccessory,
  getAccessoriesByFarm,
  getAccessoryById,
  updateAccessory,
  deleteAccessory
} from '../controllers/accessoryController.js';

const router = express.Router({ mergeParams: true });

router.use(verifyToken);

// צפייה באביזרים: CREATOR, EDITOR, VIEWER
router.get(
  '/',
  requireFarmRole(['CREATOR', 'EDITOR', 'VIEWER']),
  getAccessoriesByFarm
);

router.get(
  '/:accessoryId',
  requireFarmRole(['CREATOR', 'EDITOR', 'VIEWER']),
  getAccessoryById
);

// יצירה ועריכה של אביזר: CREATOR ו-EDITOR
router.post(
  '/',
  requireFarmRole(['CREATOR', 'EDITOR']),
  createAccessory
);

router.put(
  '/:accessoryId',
  requireFarmRole(['CREATOR', 'EDITOR']),
  updateAccessory
);

// מחיקת אביזר: CREATOR בלבד
router.delete(
  '/:accessoryId',
  requireFarmRole(['CREATOR']),
  deleteAccessory
);

export default router;