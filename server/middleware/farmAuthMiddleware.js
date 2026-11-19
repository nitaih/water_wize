import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

export const requireFarmRole = (allowedRoles = []) => {
  return async (req, res, next) => {
    try {
      // ה-ID של החווה יכול להגיע כ-Params (למשל /:farmId) או מתוך ה-Body
        const farmId = req.params.farmId || req.params.id || req.body.farmId;
        const userId = req.user?.id || req.user?.userId || req.userId;

        if (!farmId || !userId) {
        return res.status(400).json({
            success: false,
            error: 'Farm ID and User ID are required for authorization.',
            debug: { hasFarmId: Boolean(farmId), hasUserId: Boolean(userId) }
        });
        }

      // חיפוש הרשאת המשתמש בחווה הספציפית בטבלת החיבור UserFarm
      const userFarm = await prisma.userFarm.findFirst({
        where: {
          userId: userId,
          farmId: farmId
        }
      });

      if (!userFarm) {
        return res.status(403).json({ success: false, error: 'Access denied. You are not a member of this farm.' });
      }

      // בדיקה האם התפקיד של המשתמש נכלל ברשימת התפקידים המורשים
      if (!allowedRoles.includes(userFarm.role)) {
        return res.status(403).json({ 
          success: false, 
          error: `Access denied. Required roles: ${allowedRoles.join(', ')}. Your role: ${userFarm.role}` 
        });
      }

      // שמירת פרטי התפקיד ב-req למקרה שנצטרך בהמשך הקונטרולר
      req.userFarm = userFarm;
      next();
    } catch (error) {
      console.error('RBAC Middleware Error:', error);
      res.status(500).json({ success: false, error: 'Internal server error during authorization check.' });
    }
  };
};