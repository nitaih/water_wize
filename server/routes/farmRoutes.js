import express from 'express';
import { 
  createFarm, 
  getMyFarms, 
  getFarmById, 
  updateFarm, 
  addMemberToFarm 
} from '../controllers/farmController.js';
import { verifyToken } from '../middleware/authMiddleware.js';
import { requireFarmRole } from '../middleware/farmAuthMiddleware.js';

const router = express.Router();

// כל הראוטים תחת קובץ זה דורשים אימות משתמש בסיסי (JWT)
router.use(verifyToken);

// יצירת חווה חדשה (אין עדיין farmId כי החווה נוצרת כרגע, המשתמש יהפוך אוטומטית ל-CREATOR בקונטרולר)
router.post('/', createFarm);

// קבלת רשימת החוות של המשתמש המחובר
router.get('/', getMyFarms);

// צפייה בפרטי חווה ספציפית - דורש היות חבר בחווה (כל שלושת התפקידים)
router.get('/:farmId', requireFarmRole(['CREATOR', 'EDITOR', 'VIEWER']), getFarmById);

// עדכון פרטי חווה - דורש CREATOR או EDITOR
router.put('/:farmId', requireFarmRole(['CREATOR', 'EDITOR']), updateFarm);

// הוספת חבר חדש לחווה - דורש הרשאת CREATOR בלבד
router.post('/:farmId/members', requireFarmRole(['CREATOR']), addMemberToFarm);

export default router;