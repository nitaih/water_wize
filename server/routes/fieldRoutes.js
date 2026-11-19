import express from 'express';
import { verifyToken } from '../middleware/authMiddleware.js';
import { requireFarmRole } from '../middleware/farmAuthMiddleware.js';
import {
  createField,
  getFieldsByFarm,
  getFieldById,
  updateField,
  deleteField
} from '../controllers/fieldController.js';

const router = express.Router({ mergeParams: true });

// כל הראוטים של חלקות דורשים משתמש מאומת
router.use(verifyToken);

// צפייה בחלקות: CREATOR, EDITOR, VIEWER
router.get(
  '/',
  requireFarmRole(['CREATOR', 'EDITOR', 'VIEWER']),
  getFieldsByFarm
);

router.get(
  '/:fieldId',
  requireFarmRole(['CREATOR', 'EDITOR', 'VIEWER']),
  getFieldById
);

// יצירה ועריכה של חלקה: CREATOR ו-EDITOR
router.post(
  '/',
  requireFarmRole(['CREATOR', 'EDITOR']),
  createField
);

router.put(
  '/:fieldId',
  requireFarmRole(['CREATOR', 'EDITOR']),
  updateField
);

// מחיקת חלקה: CREATOR בלבד (אפשר להרחיב ל-EDITOR לפי מדיניות המערכת שלך)
router.delete(
  '/:fieldId',
  requireFarmRole(['CREATOR']),
  deleteField
);

export default router;