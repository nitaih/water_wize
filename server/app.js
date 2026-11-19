import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import fs from 'fs';
import { PrismaClient } from '@prisma/client';

import authRoutes from './routes/authRoutes.js';
import farmRoutes from './routes/farmRoutes.js';
import fieldRoutes from './routes/fieldRoutes.js';
import pipelineRoutes from './routes/pipelineRoutes.js';
import accessoryRoutes from './routes/accessoryRoutes.js';
import maintenanceLogRoutes from './routes/maintenanceLogRoutes.js';
import importRoutes from './routes/importRoutes.js';

// יצירת __dirname מחדש עבור ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const prisma = new PrismaClient();
const app = express();

app.use(express.json());
app.use(cors());

// --- הגדרות הלוגים (Morgan) ---

// 1. כתיבת לוגים לטרמינל בזמן אמת (מצב פיתוח)
app.use(morgan('dev'));

// 2. כתיבת לוגים אוטומטית לקובץ access.log בתיקיית logs
const logsDir = path.join(__dirname, 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}
const accessLogStream = fs.createWriteStream(
  path.join(logsDir, 'access.log'),
  { flags: 'a' }
);
app.use(morgan('combined', { stream: accessLogStream }));

// ראוטים
app.use('/api/auth', authRoutes);
app.use('/api/farms', farmRoutes);
app.use('/api/farms/:farmId/fields', fieldRoutes);
app.use('/api/farms/:farmId/pipelines', pipelineRoutes);
app.use('/api/farms/:farmId/accessories', accessoryRoutes);
app.use('/api/farms/:farmId/maintenance-logs', maintenanceLogRoutes);
app.use('/api/farms/:farmId/import', importRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'WaterWize API is running' });
});

// GET Pipelines (כולל חיישנים)
app.get('/api/pipelines', async (req, res) => {
  try {
    const pipelines = await prisma.pipeline.findMany({
      include: { sensors: true }
    });
    res.json({ success: true, data: pipelines });
  } catch (error) {
    console.error('Error fetching pipelines:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch pipelines' });
  }
});

// POST Pipeline
app.post('/api/pipelines', async (req, res) => {
  try {
    const { name, material, diameterMm, coordinates } = req.body;
    const newPipeline = await prisma.pipeline.create({
      data: {
        name,
        material,
        diameterMm: parseFloat(diameterMm),
        coordinates
      }
    });
    res.status(201).json({ success: true, data: newPipeline });
  } catch (error) {
    console.error('Error creating pipeline:', error);
    res.status(500).json({ success: false, error: 'Failed to create pipeline' });
  }
});

export default app;