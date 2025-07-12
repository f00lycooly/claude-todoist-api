const request = require('supertest');
const app = require('../src/server');

describe('Action Extraction', () => {
  const testCases = [
    {
      name: 'bullet points',
      text: '- Create API\n- Write tests\n- Deploy app',
      expectedCount: 3
    },
    {
      name: 'numbered lists',
      text: '1. Review code\n2. Fix bugs\n3. Update docs',
      expectedCount: 3
    },
    {
      name: 'action verbs',
      text: 'Create new endpoint\nImplement authentication\nTest the system',
      expectedCount: 3
    },
    {
      name: 'mixed formats',
      text: '- Setup CI/CD\n\nYou should also:\n1. Write documentation\n2. Create tests\n\nPlease review the code.',
      expectedCount: 4
    }
  ];

  testCases.forEach(({ name, text, expectedCount }) => {
    it(`should extract actions from ${name}`, async () => {
      const res = await request(app)
        .post('/extract-actions')
        .send({ text })
        .expect(200);
      
      expect(res.body.success).toBe(true);
      expect(res.body.actions).toHaveLength(expectedCount);
    });
  });

  it('should handle empty text', async () => {
    const res = await request(app)
      .post('/extract-actions')
      .send({ text: '' })
      .expect(400);
    
    expect(res.body.success).toBe(false);
  });
});
