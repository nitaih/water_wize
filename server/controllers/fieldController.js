import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// שליפת כל החלקות של המשתמש המחובר (או כל החלקות למנהל)
export const getFields = async (req, res) => {
  try {
    const fields = await prisma.field.findMany({
      where: { userId: req.user.userId }, // מניחים שה-JWT פושט את ה-userId לתוך req.user
    });
    res.status(200).json(fields);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch fields', details: error.message });
  }
};

// יצירת חלקה חדשה
export const createField = async (req, res) => {
  try {
    const { name, location, areaSize } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Field name is required' });
    }

    const newField = await prisma.field.create({
      data: {
        name,
        location,
        areaSize: areaSize ? parseFloat(areaSize) : null,
        userId: req.user.userId,
      },
    });

    res.status(201).json(newField);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create field', details: error.message });
  }
};

// שליפת חלקה בודדת לפי ID
export const getFieldById = async (req, res) => {
  try {
    const { id } = req.params;
    const field = await prisma.field.findUnique({
      where: { id },
    });

    if (!field) {
      return res.status(404).json({ error: 'Field not found' });
    }

    res.status(200).json(field);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch field', details: error.message });
  }
};

// מחיקת חלקה
export const deleteField = async (req, res) => {
  try {
    const { id } = req.params;
    
    await prisma.field.delete({
      where: { id },
    });

    res.status(200).json({ message: 'Field deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete field', details: error.message });
  }
};