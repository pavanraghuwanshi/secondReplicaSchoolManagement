let io; // Variable to hold the Socket.IO instance

// Function to set the Socket.IO instance
const setIO = (socketIOInstance) => {
    io = socketIOInstance; // Store the instance
};

// Function to get the Socket.IO instance
const getIO = () => {
    if (!io) {
        throw new Error('SocketIO not initialized!'); // Throw error if not initialized
    }
    return io; // Return the instance
};

// Export the functions for use in other modules
module.exports = { setIO, getIO };
