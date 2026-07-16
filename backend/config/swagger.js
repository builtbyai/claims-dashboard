const swaggerJsdoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Supplement Dashboard API',
      version: '1.0.0',
      description: 'Comprehensive API documentation for the Supplement Dashboard - a roofing contractor management system with RoofLink CRM integration',
      contact: {
        name: 'API Support',
        url: 'https://github.com/builtbyai/supplement-dashboard',
      },
      license: {
        name: 'MIT',
        url: 'https://opensource.org/licenses/MIT',
      },
    },
    servers: [
      {
        url: 'http://localhost:5001/api',
        description: 'Development server',
      },
      {
        url: 'https://api.yourdomain.com/api',
        description: 'Production server',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
      schemas: {
        Customer: {
          type: 'object',
          properties: {
            id: { type: 'integer', example: 1 },
            name: { type: 'string', example: 'John Doe' },
            email: { type: 'string', format: 'email', example: 'john@example.com' },
            phone: { type: 'string', example: '555-1234' },
            property_address: { type: 'string', example: '123 Main St' },
            city: { type: 'string', example: 'Springfield' },
            state: { type: 'string', example: 'IL' },
            zip: { type: 'string', example: '62701' },
            job_id: { type: 'string', example: 'JOB-2025-001' },
            status: { type: 'string', example: 'Approved' },
            kanban_stage: { type: 'string', example: 'Needs Supplement' },
            insurance_company: { type: 'string', example: 'State Farm' },
            claim_number: { type: 'string', example: 'CLM123456' },
            policy_number: { type: 'string', example: 'POL789012' },
            adjuster_name: { type: 'string', example: 'Jane Smith' },
            date_created: { type: 'string', format: 'date-time' },
            date_roof_scheduled: { type: 'string', format: 'date' },
            date_roof_completed: { type: 'string', format: 'date' },
            supplement_sent_date: { type: 'string', format: 'date' },
            estimate_total: { type: 'number', format: 'float', example: 15000.00 },
            supplement_total: { type: 'number', format: 'float', example: 3500.00 },
            photo_count: { type: 'integer', example: 45 },
            roofing_crew: { type: 'string', example: 'Crew A' },
            last_email_date: { type: 'string', format: 'date-time' },
            last_email_subject: { type: 'string' },
            has_unread_email: { type: 'boolean', example: false },
            folder_path: { type: 'string' },
            created_at: { type: 'string', format: 'date-time' },
            updated_at: { type: 'string', format: 'date-time' },
          },
        },
        Error: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: false },
            message: { type: 'string', example: 'Error message' },
            errors: { type: 'array', items: { type: 'object' } },
          },
        },
        Success: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            message: { type: 'string', example: 'Operation successful' },
            data: { type: 'object' },
          },
        },
      },
    },
    tags: [
      { name: 'Customers', description: 'Customer management endpoints' },
      { name: 'Kanban', description: 'Kanban board operations' },
      { name: 'Calendar', description: 'Calendar and scheduling' },
      { name: 'Analytics', description: 'Dashboard analytics and reporting' },
      { name: 'RoofLink', description: 'RoofLink CRM integration' },
      { name: 'Photos', description: 'Photo management' },
      { name: 'Financials', description: 'Financial tracking' },
      { name: 'Detection', description: 'Automated supplement detection' },
      { name: 'Auth', description: 'Authentication' },
      { name: 'Health', description: 'System health checks' },
    ],
  },
  apis: ['./routes/*.js', './server.js'], // Path to the API routes
};

const swaggerSpec = swaggerJsdoc(options);

module.exports = swaggerSpec;
