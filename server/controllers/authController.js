import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// מפתח סודי לחתום על הטוקן (מומלץ לקחת מתוך משתני סביבה process.env.JWT_SECRET)
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-key';

// פונקציית הרשמה (Register)
async function register(req, res) {
  try {
    const { email, password, name, role } = req.body;

    // 1. בדיקה אם המשתמש כבר קיים
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ error: 'User with this email already exists' });
    }

    // 2. הצפנת הסיסמה (Hashing)
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // 3. יצירת המשתמש בבסיס הנתונים
    const newUser = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name
      },
      select: {
        id: true,
        email: true,
        name: true,
        createdAt: true
      }
    });

    res.status(201).json({
      message: 'User registered successfully',
      user: newUser
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// פונקציית התחברות (Login)
async function login(req, res) {
  try {
    const { email, password } = req.body;

    // 1. חיפוש המשתמש לפי אימייל
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return res.status(400).json({ error: 'Invalid email or password' });
    }

    // 2. השוואת הסיסמה שהוזנה מול הסיסמה המוצפנת במסד
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(400).json({ error: 'Invalid email or password' });
    }

    // 3. יצירת JWT Token שכולל את ה-ID וה-Role של המשתמש (תקף ל-24 שעות)
    const token = jwt.sign(
      { userId: user.id, role: user.role },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.status(200).json({
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
export { register, login };