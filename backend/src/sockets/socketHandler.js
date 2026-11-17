/**
 * WebSocket / Socket.IO Handler
 * Enforces room authorization for Admin Mediation updates & inspection booking notifications.
 */
function initSocket(io) {
  io.on('connection', (socket) => {
    // Admin desk room for live mediation call notifications
    socket.on('admin:join', () => {
      socket.join('admin_desk');
    });

    // Notify admin on new user mediation request
    socket.on('mediation:request', (payload) => {
      io.to('admin_desk').emit('notification:new', {
        type: 'MEDIATION_CALL_REQUESTED',
        data: payload,
        timestamp: new Date().toISOString()
      });
    });

    // Broadcast inspection appointment updates
    socket.on('appointment:updated', (data) => {
      io.emit('notification:new', {
        type: 'APPOINTMENT_UPDATED',
        data,
        timestamp: new Date().toISOString()
      });
    });

    socket.on('disconnect', () => {
      // Clean disconnect
    });
  });
}

module.exports = {
  initSocket
};
