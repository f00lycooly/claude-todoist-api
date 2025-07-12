const request = require('supertest');
const app = require('../src/server');

describe('Todoist Integration', () => {
  describe('POST /validate-token', () => {
    it('should return error for missing token', async () => {
      const res = await request(app)
        .post('/validate-token')
        .send({})
        .expect(400);
      
      expect(res.body).toHaveProperty('success', false);
      expect(res.body).toHaveProperty('error', 'API token is required');
    });

    it('should return error for invalid token', async () => {
      const res = await request(app)
        .post('/validate-token')
        .send({ token: 'invalid_token' })
        .expect(401);
      
      expect(res.body).toHaveProperty('success', false);
      expect(res.body).toHaveProperty('valid', false);
    });
  });

  describe('POST /quick-export', () => {
    it('should return error for missing required fields', async () => {
      const res = await request(app)
        .post('/quick-export')
        .send({})
        .expect(400);
      
      expect(res.body).toHaveProperty('success', false);
      expect(res.body).toHaveProperty('error', 'Token and text are required');
    });

    it('should return error for missing text', async () => {
      const res = await request(app)
        .post('/quick-export')
        .send({ token: 'test_token' })
        .expect(400);
      
      expect(res.body).toHaveProperty('success', false);
      expect(res.body).toHaveProperty('error', 'Token and text are required');
    });
  });
});
