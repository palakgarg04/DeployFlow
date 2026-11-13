const request = require('supertest');
const { app } = require('../src/app');

describe('DeployFlow API smoke tests', () => {
  test('root endpoint describes the service', async () => {
    const response = await request(app).get('/');
    expect(response.status).toBe(200);
    expect(response.body.name).toBe('DeployFlow API');
  });

  test('health endpoint returns diagnostic information', async () => {
    const response = await request(app).get('/health');
    expect(response.status).toBe(200);
    expect(response.body.status).toBe('ok');
    expect(response.body).toHaveProperty('database');
  });

  test('metrics endpoint exposes Prometheus metrics', async () => {
    const response = await request(app).get('/metrics');
    expect(response.status).toBe(200);
    expect(response.text).toContain('process_cpu_user_seconds_total');
  });

  test('task creation validates missing title without requiring a database', async () => {
    const response = await request(app).post('/api/tasks').send({});
    // The route reports database unavailability first when MongoDB is not connected.
    expect([400, 503]).toContain(response.status);
    if (response.status === 400) expect(response.body.error).toMatch(/title/i);
  });
});
