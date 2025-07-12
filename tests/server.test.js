const request = require('supertest');
const app = require('../src/server');

describe('API Endpoints', () => {
  describe('GET /health', () => {
    it('should return health status', async () => {
      const res = await request(app)
        .get('/health')
        .expect(200);
      
      expect(res.body).toHaveProperty('status', 'healthy');
      expect(res.body).toHaveProperty('timestamp');
      expect(res.body).toHaveProperty('version');
    });
  });

  describe('GET /info', () => {
    it('should return system information', async () => {
      const res = await request(app)
        .get('/info')
        .expect(200);
      
      expect(res.body).toHaveProperty('name', 'Claude to Todoist API');
      expect(res.body).toHaveProperty('version');
      expect(res.body).toHaveProperty('features');
      expect(Array.isArray(res.body.features)).toBe(true);
    });
  });

  describe('POST /extract-actions', () => {
    it('should extract actions from text', async () => {
      const testText = `
        Meeting notes:
        - Create new API endpoint
        - Write documentation
        - Set up testing
      `;

      const res = await request(app)
        .post('/extract-actions')
        .send({ text: testText })
        .expect(200);
      
      expect(res.body).toHaveProperty('success', true);
      expect(res.body).toHaveProperty('actions');
      expect(Array.isArray(res.body.actions)).toBe(true);
      expect(res.body.actions.length).toBeGreaterThan(0);
    });

    it('should return error for missing text', async () => {
      const res = await request(app)
        .post('/extract-actions')
        .send({})
        .expect(400);
      
      expect(res.body).toHaveProperty('success', false);
      expect(res.body).toHaveProperty('error');
    });
  });

  describe('404 handler', () => {
    it('should return 404 for unknown endpoints', async () => {
      const res = await request(app)
        .get('/unknown-endpoint')
        .expect(404);
      
      expect(res.body).toHaveProperty('success', false);
      expect(res.body).toHaveProperty('error', 'Endpoint not found');
    });
  });
});
