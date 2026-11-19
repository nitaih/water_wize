import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

// 1. יצירת חווה חדשה ושיוך המשתמש היוצר אוטומטית כ-CREATOR
export const createFarm = async (req, res) => {
  try {
    const { name, description, location } = req.body;
    
    // בדיקה מאיפה מגיע ה-ID של המשתמש בהתאם ל-Middleware שלך
    const userId = req.user?.id || req.user?.userId || req.userId;

    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized: User ID not found in token.' });
    }

    if (!name) {
      return res.status(400).json({ success: false, error: 'Farm name is required.' });
    }

    const farm = await prisma.farm.create({
      data: {
        name,
        description,
        location,
        users: {
          create: {
            userId: userId,
            role: 'CREATOR'
          }
        }
      },
      include: {
        users: true
      }
    });

    res.status(201).json({ success: true, data: farm });
  } catch (error) {
    console.error('Error creating farm:', error);
    res.status(500).json({ success: false, error: 'Failed to create farm.' });
  }
};
// 2. קבלת כל החוות שהמשתמש מחובר אליהן
export const getMyFarms = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?.userId || req.userId;

    const userFarms = await prisma.userFarm.findMany({
      where: { userId },
      include: { farm: true }
    });

    const farms = userFarms.map(uf => ({
      ...uf.farm,
      role: uf.role
    }));

    res.json({ success: true, data: farms });
  } catch (error) {
    console.error('Error fetching farms:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch farms.' });
  }
};

// 3. קבלת חווה ספציפית לפי ID (כולל רשימת החברים והתפקידים שלהם)
export const getFarmById = async (req, res) => {
  try {
    const { farmId } = req.params;

    const farm = await prisma.farm.findUnique({
      where: { id: farmId },
      include: {
        userFarms: {
          include: {
            user: { select: { id: true, email: true } }
          }
        }
      }
    });

    if (!farm) {
      return res.status(404).json({ success: false, error: 'Farm not found.' });
    }

    res.json({ success: true, data: farm });
  } catch (error) {
    console.error('Error fetching farm by ID:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch farm details.' });
  }
};

// 4. עדכון פרטי חווה
export const updateFarm = async (req, res) => {
  try {
    const { farmId } = req.params;
    const { name, description, location } = req.body;

    const updatedFarm = await prisma.farm.update({
      where: { id: farmId },
      data: { name, description, location }
    });

    res.json({ success: true, data: updatedFarm });
  } catch (error) {
    console.error('Error updating farm:', error);
    res.status(500).json({ success: false, error: 'Failed to update farm.' });
  }
};

// 5. הוספת משתמש חדש לחווה עם תפקיד מוגדר (CREATOR / EDITOR / VIEWER)
export const addMemberToFarm = async (req, res) => {
  try {
    const { farmId } = req.params;
    const { email, role } = req.body;

    if (!email || !role) {
      return res.status(400).json({ success: false, error: 'Email and role are required.' });
    }

    // חיפוש המשתמש לפי אימייל במערכת
    const targetUser = await prisma.user.findUnique({
      where: { email }
    });

    if (!targetUser) {
      return res.status(404).json({ success: false, error: 'User with this email not found.' });
    }

    // יצירת הקשר בטבלת UserFarm
    const userFarm = await prisma.userFarm.create({
      data: {
        userId: targetUser.id,
        farmId: farmId,
        role: role.toUpperCase()
      }
    });

    res.status(201).json({ success: true, data: userFarm });
  } catch (error) {
    console.error('Error adding member to farm:', error);
    res.status(500).json({ success: false, error: 'Failed to add member to farm.' });
  }
};