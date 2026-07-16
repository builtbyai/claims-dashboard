let io;

// Initialize WebSocket server
const initializeWebSocket = (socketIo) => {
  io = socketIo;

  io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);

    // Join customer room for targeted updates
    socket.on('join:customer', (customerId) => {
      socket.join(`customer:${customerId}`);
      console.log(`Socket ${socket.id} joined customer:${customerId}`);
    });

    // Leave customer room
    socket.on('leave:customer', (customerId) => {
      socket.leave(`customer:${customerId}`);
      console.log(`Socket ${socket.id} left customer:${customerId}`);
    });

    // Join dashboard room for general updates
    socket.on('join:dashboard', () => {
      socket.join('dashboard');
      console.log(`Socket ${socket.id} joined dashboard`);
    });

    // Leave dashboard room
    socket.on('leave:dashboard', () => {
      socket.leave('dashboard');
      console.log(`Socket ${socket.id} left dashboard`);
    });

    // Handle disconnect
    socket.on('disconnect', () => {
      console.log('Client disconnected:', socket.id);
    });

    // Handle errors
    socket.on('error', (error) => {
      console.error('Socket error:', error);
    });
  });

  return io;
};

// Broadcast update to all connected clients
const broadcastUpdate = (event, data) => {
  if (io) {
    io.emit(event, data);
    console.log(`Broadcast event: ${event}`, data);
  }
};

// Send update to specific customer room
const sendToCustomerRoom = (customerId, event, data) => {
  if (io) {
    io.to(`customer:${customerId}`).emit(event, data);
    console.log(`Sent to customer:${customerId} - ${event}`, data);
  }
};

// Send update to dashboard room
const sendToDashboard = (event, data) => {
  if (io) {
    io.to('dashboard').emit(event, data);
    console.log(`Sent to dashboard - ${event}`, data);
  }
};

// Notify about customer update
const notifyCustomerUpdate = (customer) => {
  broadcastUpdate('customer:updated', customer);
  sendToCustomerRoom(customer.id, 'customer:updated', customer);
};

// Notify about new activity
const notifyNewActivity = (activity) => {
  broadcastUpdate('activity:new', activity);
  sendToCustomerRoom(activity.customer_id, 'activity:new', activity);
};

// Notify about supplement status change
const notifySupplementStatus = (customerId, status) => {
  const data = { customerId, status, timestamp: new Date().toISOString() };
  sendToCustomerRoom(customerId, 'supplement:status', data);
  sendToDashboard('supplement:status', data);
};

// Notify about hot job (80+ photos)
const notifyHotJob = (customer) => {
  const data = {
    customerId: customer.id,
    name: customer.name,
    photoCount: customer.photo_count,
    timestamp: new Date().toISOString()
  };
  broadcastUpdate('hotjob:alert', data);
  sendToDashboard('hotjob:alert', data);
};

// Get active connections count
const getActiveConnections = () => {
  if (io) {
    return io.sockets.sockets.size;
  }
  return 0;
};

module.exports = {
  initializeWebSocket,
  broadcastUpdate,
  sendToCustomerRoom,
  sendToDashboard,
  notifyCustomerUpdate,
  notifyNewActivity,
  notifySupplementStatus,
  notifyHotJob,
  getActiveConnections
};
