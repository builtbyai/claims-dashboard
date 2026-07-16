const databaseService = require('../../services/databaseService');

describe('Database Service', () => {
  describe('getAllCustomers', () => {
    it('should return an array of customers', async () => {
      const customers = await databaseService.getAllCustomers();
      expect(Array.isArray(customers)).toBe(true);
    });

    it('should return customers with required properties', async () => {
      const customers = await databaseService.getAllCustomers();
      if (customers.length > 0) {
        const customer = customers[0];
        expect(customer).toHaveProperty('id');
        expect(customer).toHaveProperty('name');
      }
    });
  });

  describe('getCustomerById', () => {
    it('should return null for non-existent customer', async () => {
      const customer = await databaseService.getCustomerById(999999);
      expect(customer).toBeNull();
    });

    it('should return customer object for valid ID', async () => {
      const customers = await databaseService.getAllCustomers();
      if (customers.length > 0) {
        const customer = await databaseService.getCustomerById(customers[0].id);
        expect(customer).toBeTruthy();
        expect(customer.id).toBe(customers[0].id);
      }
    });
  });

  describe('createCustomer', () => {
    it('should create a new customer', async () => {
      const newCustomer = {
        name: 'Test Customer',
        email: 'test@example.com',
        phone: '555-1234',
        property_address: '123 Test St',
      };

      const result = await databaseService.createCustomer(newCustomer);
      expect(result).toHaveProperty('id');
      expect(result.name).toBe(newCustomer.name);
    });

    it('should throw error for invalid customer data', async () => {
      await expect(databaseService.createCustomer({})).rejects.toThrow();
    });
  });

  describe('updateCustomer', () => {
    it('should update existing customer', async () => {
      const customers = await databaseService.getAllCustomers();
      if (customers.length > 0) {
        const updates = { name: 'Updated Name' };
        const result = await databaseService.updateCustomer(customers[0].id, updates);
        expect(result.name).toBe('Updated Name');
      }
    });

    it('should return null for non-existent customer', async () => {
      const result = await databaseService.updateCustomer(999999, { name: 'Test' });
      expect(result).toBeNull();
    });
  });
});
