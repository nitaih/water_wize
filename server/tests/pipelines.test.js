const request = require('supertest');
const app = require('../app');

describe('API Integration Tests', () => {
  it('GET /api/pipelines should return 200 and an array of pipelines', async () => {
    const res = await request(app).get('/api/pipelines');
    
    expect(res.statusCode).toEqual(200);
    expect(res.body).toHaveProperty('success', true);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('GET /api/non-existent-route should return 404', async () => {
    const res = await request(app).get('/api/non-existent-route');
    expect(res.statusCode).toEqual(404);
  });
});