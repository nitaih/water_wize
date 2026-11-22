import express from 'express';
import { verifyToken } from '../middleware/authMiddleware.js';
const router = express.Router();
import {getMe, register, login } from '../controllers/authController.js';

router.post('/register', register);
router.post('/login', login);
router.get('/me', verifyToken, getMe);

export default router;