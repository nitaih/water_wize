import express from 'express';
import multer from 'multer';
import { verifyToken } from '../middleware/authMiddleware.js';
import { requireFarmRole } from '../middleware/farmAuthMiddleware.js';
import { importGisData } from '../controllers/importController.js';

const router = express.Router({ mergeParams: true });

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 } // עד 5MB לקובץ
});

router.use(verifyToken);

// ייבוא שכבות GIS: CREATOR ו-EDITOR
router.post(
  '/',
  requireFarmRole(['CREATOR', 'EDITOR']),
  upload.single('file'),
  importGisData
);

export default router;