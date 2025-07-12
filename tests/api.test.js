// Set test environment BEFORE any imports
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'error';

const request = require('supertest');
const app = require('../src/server');

describe('API Endpoints', () => {
  test('GET /health should return 200', async () => {
    const response = await request(app)
      .get('/health')
      .expect(200);

    expect(response.body).toHaveProperty('status', 'healthy');
    expect(response.body).toHaveProperty('timestamp');
  });

  test('GET /info should return system info', async () => {
    const response = await request(app)
      .get('/info')
      .expect(200);

    expect(response.body).toHaveProperty('name');
    expect(response.body.name).toContain('Claude');
  });

  test('POST /extract-actions should work', async () => {
    const response = await request(app)
      .post('/extract-actions')
      .send({ text: '- Create API\n- Write tests' })
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(Array.isArray(response.body.actions)).toBe(true);
  });

  test('POST /extract-actions should fail without text', async () => {
    const response = await request(app)
      .post('/extract-actions')
      .send({})
      .expect(400);

    expect(response.body.success).toBe(false);
    expect(response.body.error).toContain('Text is required');
  });

  test('GET /unknown should return 404', async () => {
    const response = await request(app)
      .get('/unknown')
      .expect(404);

    expect(response.body.success).toBe(false);
  });
});
