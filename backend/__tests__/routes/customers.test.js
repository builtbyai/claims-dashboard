const request = require('supertest');
const express = require('express');
const customersRouter = require('../../routes/customers');

const app = express();
app.use(express.json());
app.use('/api/customers', customersRouter);

describe('Customers API', () => {
  describe('GET /api/customers', () => {
    it('should return 200 and array of customers', async () => {
      const response = await request(app)
        .get('/api/customers')
        .expect('Content-Type', /json/)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });
  });

  describe('GET /api/customers/:id', () => {
    it('should return 404 for non-existent customer', async () => {
      await request(app)
        .get('/api/customers/999999')
        .expect(404);
    });

    it('should return 400 for invalid customer ID', async () => {
      await request(app)
        .get('/api/customers/invalid')
        .expect(400);
    });
  });

  describe('POST /api/customers', () => {
    it('should create a new customer with valid data', async () => {
      const newCustomer = {
        name: 'John Doe',
        email: 'john@example.com',
        phone: '555-1234',
        property_address: '123 Main St',
      };

      const response = await request(app)
        .post('/api/customers')
        .send(newCustomer)
        .expect('Content-Type', /json/)
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.name).toBe(newCustomer.name);
    });

    it('should return 400 for missing required fields', async () => {
      await request(app)
        .post('/api/customers')
        .send({})
        .expect(400);
    });
  });

  describe('PATCH /api/customers/:id', () => {
    it('should update customer with valid data', async () => {
      const updates = { name: 'Updated Name' };

      // First create a customer
      const createResponse = await request(app)
        .post('/api/customers')
        .send({ name: 'Test Customer', email: 'test@example.com' });

      const customerId = createResponse.body.id;

      const response = await request(app)
        .patch(`/api/customers/${customerId}`)
        .send(updates)
        .expect(200);

      expect(response.body.name).toBe('Updated Name');
    });

    it('should return 404 for non-existent customer', async () => {
      await request(app)
        .patch('/api/customers/999999')
        .send({ name: 'Test' })
        .expect(404);
    });
  });

  describe('DELETE /api/customers/:id', () => {
    it('should delete existing customer', async () => {
      // First create a customer
      const createResponse = await request(app)
        .post('/api/customers')
        .send({ name: 'To Delete', email: 'delete@example.com' });

      const customerId = createResponse.body.id;

      await request(app)
        .delete(`/api/customers/${customerId}`)
        .expect(200);

      // Verify deletion
      await request(app)
        .get(`/api/customers/${customerId}`)
        .expect(404);
    });

    it('should return 404 for non-existent customer', async () => {
      await request(app)
        .delete('/api/customers/999999')
        .expect(404);
    });
  });
});
