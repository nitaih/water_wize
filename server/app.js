// server/app.js
const express = require('express');
const cors = require('cors');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const app = express();

app.use(cors());
app.use(express.json());

// ה-Endpoint של הצנרת (מתאים בדיוק לבדיקת האינטגרציה)
app.get('/api/pipelines', async (req, res) => {
  try {
    // שליפה לדוגמה דרך Prisma (התאם לפי הטבלה שלך, למשל prisma.pipeline.findMany())
    // אם השליפה שלך כבר קיימת בתוך index.js, אפשר להעביר אותה לכאן או לייבא אותה
    const pipelines = await prisma.pipeline.findMany(); // או השאילתה הקיימת שלך

    res.json({
      success: true,
      data: pipelines
    });
  } catch (error) {
    console.error('Error fetching pipelines:', error);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
});

module.exports = app;