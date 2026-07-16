require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

// Initialize Express app
const app = express();
const server = http.createServer(app);

// Initialize Socket.IO
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'PUT']
  }
});

// Middleware
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));
app.use(compression());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));

// Serve customer photos statically
app.use('/customer_photos', express.static(path.join(__dirname, '..', 'frontend', 'public', 'customer_photos')));

// Serve synced data files statically
app.use('/data', express.static(path.join(__dirname, 'public', 'data')));

// Serve static dashboard
app.get('/static', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'static_dashboard.html'));
});

// Initialize WebSocket service
const websocketService = require('./services/websocketService');
websocketService.initializeWebSocket(io);

// Initialize Sync Scheduler
const syncScheduler = require('./services/syncScheduler');

// Initialize Data Sync Service (Roof.link + CSV)
const dataSyncService = require('./services/dataSync');
dataSyncService.start();

// Initialize Passport for JWT authentication
const { passport } = require('./middleware/auth');
app.use(passport.initialize());

// Initialize automated supplement detection (runs every 24 hours)
const supplementDetectionService = require('./services/supplementDetectionService');
supplementDetectionService.startAutomatedDetection(24);

// Routes
app.use('/api/health', require('./routes/health'));
app.use('/api/customers', require('./routes/customers'));
app.use('/api/calendar', require('./routes/calendar'));
app.use('/api/kanban', require('./routes/kanban'));
app.use('/api/sync', require('./routes/sync'));
app.use('/api/auth', require('./routes/auth'));
app.use('/api/analytics', require('./routes/analytics'));
app.use('/api/detection', require('./routes/detection'));
app.use('/api/financials', require('./routes/financials'));
app.use('/api/data-sync', require('./routes/dataSync'));
app.use('/api/activities', require('./routes/activities'));
app.use('/api/photos', require('./routes/photos'));

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'Supplement Dashboard API',
    version: '2.0.0',
    description: 'Full-featured roofing supplement management system with RoofLink integration, customer database, and photo gallery',
    endpoints: {
      health: '/api/health',
      customers: '/api/customers',
      calendar: '/api/calendar',
      kanban: '/api/kanban',
      sync: '/api/sync',
      auth: '/api/auth',
      analytics: '/api/analytics',
      detection: '/api/detection',
      financials: '/api/financials',
      activities: '/api/activities',
      photos: '/api/photos'
    },
    documentation: 'See README.md for complete API documentation'
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Route ${req.method} ${req.path} not found`,
    timestamp: new Date().toISOString()
  });
});

// Error handler (must be last)
app.use(require('./middleware/errorHandler'));

// Start server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log('='.repeat(50));
  console.log(`🚀 Supplement Dashboard Backend Server`);
  console.log('='.repeat(50));
  console.log(`📡 Server running on: http://localhost:${PORT}`);
  console.log(`🌐 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔌 WebSocket enabled on port ${PORT}`);
  console.log(`📊 Frontend URL: ${process.env.FRONTEND_URL || 'http://localhost:3000'}`);
  console.log('='.repeat(50));
  console.log('Available endpoints:');
  console.log('');
  console.log('HEALTH & CORE:');
  console.log(`  GET    /api/health - Health check`);
  console.log('');
  console.log('CUSTOMERS:');
  console.log(`  GET    /api/customers - List customers`);
  console.log(`  GET    /api/customers/:id - Get customer`);
  console.log(`  GET    /api/customers/:id/activities - Get activities`);
  console.log(`  GET    /api/customers/:id/folders - Get folders`);
  console.log(`  GET    /api/customers/search?q=query - Search`);
  console.log(`  GET    /api/customers/stats - Dashboard stats`);
  console.log(`  PATCH  /api/customers/:id - Update customer`);
  console.log(`  PATCH  /api/customers/:id/kanban - Update Kanban stage`);
  console.log('');
  console.log('CALENDAR & SCHEDULING:');
  console.log(`  GET    /api/calendar/events - Get all calendar events`);
  console.log(`  GET    /api/calendar/upcoming - Get upcoming installs`);
  console.log(`  GET    /api/calendar/completed - Get completed installs`);
  console.log(`  GET    /api/calendar/stats - Calendar statistics`);
  console.log(`  POST   /api/calendar/schedule - Schedule an install`);
  console.log(`  PATCH  /api/calendar/:customerId/complete - Mark as completed`);
  console.log('');
  console.log('KANBAN WORKFLOW:');
  console.log(`  GET    /api/kanban/board - Get full Kanban board`);
  console.log(`  GET    /api/kanban/stats - Kanban statistics`);
  console.log(`  PATCH  /api/kanban/:customerId/stage - Move to new stage`);
  console.log(`  POST   /api/kanban/bulk-move - Move multiple customers`);
  console.log(`  GET    /api/kanban/timeline/:customerId - Stage timeline`);
  console.log('');
  console.log('ROOFLINK SYNC:');
  console.log(`  GET    /api/sync/status - Sync status`);
  console.log(`  POST   /api/sync/trigger - Trigger manual sync`);
  console.log(`  GET    /api/sync/test - Test RoofLink connection`);
  console.log(`  GET    /api/sync/leads - Get all leads`);
  console.log('');
  console.log('JOB MANAGEMENT:');
  console.log(`  GET    /api/sync/jobs/:jobId/details - Full job details`);
  console.log(`  GET    /api/sync/jobs/:jobId/notes - Job notes/PM notes`);
  console.log(`  POST   /api/sync/jobs/:jobId/notes - Add note to job`);
  console.log(`  GET    /api/sync/jobs/:jobId/tasks - Job tasks`);
  console.log(`  GET    /api/sync/jobs/:jobId/documents - Job documents`);
  console.log(`  POST   /api/sync/jobs/:jobId/documents - Upload document`);
  console.log(`  GET    /api/sync/jobs/:jobId/timeline - Job timeline`);
  console.log(`  GET    /api/sync/jobs/status/:status - Jobs by status`);
  console.log(`  GET    /api/sync/jobs/supplements/needed - Jobs needing supplements`);
  console.log(`  GET    /api/sync/jobs/search/customer?name= - Search by customer`);
  console.log(`  GET    /api/sync/jobs/search/address?address= - Search by address`);
  console.log(`  GET    /api/sync/jobs/recent/:days - Recent jobs`);
  console.log(`  PATCH  /api/sync/jobs/:jobId/status - Update job status`);
  console.log(`  PATCH  /api/sync/jobs/:jobId/assign - Assign to team member`);
  console.log('');
  console.log('SUPPLEMENT LINE ITEMS:');
  console.log(`  GET    /api/sync/estimates/:estimateId/supplements - Get supplement items`);
  console.log(`  GET    /api/sync/supplements/fields - Get field configuration`);
  console.log(`  POST   /api/sync/estimates/:estimateId/supplements - Create supplement item`);
  console.log(`  POST   /api/sync/estimates/:estimateId/supplements/bulk - Bulk create`);
  console.log(`  PATCH  /api/sync/supplements/:itemId - Update supplement item`);
  console.log(`  DELETE /api/sync/supplements/:itemId - Delete supplement item`);
  console.log(`  POST   /api/sync/supplements/:itemId/approve - Approve item`);
  console.log(`  POST   /api/sync/supplements/:itemId/reject - Reject item`);
  console.log(`  GET    /api/sync/estimates/:estimateId/supplements/summary - Summary`);
  console.log(`  GET    /api/sync/estimates/:estimateId/full - Estimate with supplements`);
  console.log('');
  console.log('TEAM & DASHBOARD:');
  console.log(`  GET    /api/sync/team/members - Get team members`);
  console.log(`  GET    /api/sync/team/:userId/jobs - Jobs assigned to user`);
  console.log(`  GET    /api/sync/dashboard/stats - Dashboard statistics`);
  console.log('='.repeat(50));
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  server.close(() => {
    console.log('HTTP server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('\nSIGINT signal received: closing HTTP server');
  server.close(() => {
    console.log('HTTP server closed');
    process.exit(0);
  });
});
