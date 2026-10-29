const express = require('express');
const cors = require('cors');
const { PrismaClient } = require('@prisma/client');
require('dotenv').config();

const app = require('./app');
const prisma = new PrismaClient();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'WaterWize API is running' });
});

app.get('/api/pipelines', async (req, res) => {
  try {
    const pipelines = await prisma.pipeline.findMany({
      include: { sensors: true } // כולל את החיישנים המקושרים לכל קו
    });
    res.json({ success: true, data: pipelines });
  } catch (error) {
    console.error('Error fetching pipelines:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch pipelines' });
  }
});

app.post('/api/pipelines', async (req, res) => {
  try {
    const { name, material, diameterMm, coordinates } = req.body;
    const newPipeline = await prisma.pipeline.create({
      data: {
        name,
        material,
        diameterMm: parseFloat(diameterMm),
        coordinates // מערך נקודות או GeoJSON למפה
      }
    });
    res.status(201).json({ success: true, data: newPipeline });
  } catch (error) {
    console.error('Error creating pipeline:', error);
    res.status(500).json({ success: false, error: 'Failed to create pipeline' });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port http://localhost:${PORT}/api/health`);
});
