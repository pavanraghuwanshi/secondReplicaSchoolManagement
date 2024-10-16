const Branch = require('../models/branch');
const Notification = require('../models/Notification');
const { getIO } = require('../socket/socket'); // Import getIO to access io instance


let branchSocketMap = {};

// Call this when a user connects
const onUserConnect = (socket, branchId) => {
    // console.log(`Socket Id: ${socket.id}`);
    branchSocketMap[branchId] = socket.id;
};

// Call this when a user disconnects
const onUserDisconnect = (socket) => {
    for (const branchId in branchSocketMap) {
        if (branchSocketMap[branchId] === socket.id) {
            delete branchSocketMap[branchId];
            break;
        }
    }
};

const getBranchSocketId = (branchId) => {
    // console.log(branchId)
    return branchSocketMap[branchId] || null; // Return null if the user is not connected
};


// Reusable function to create a notification
const createAndSendNotification = async (branchId, childId, reason, type = 'info') => {
    try {
        // Create and save the notification to the database
        const notification = new Notification({
            branchId,
            childId,
            reason,
            type,
            read: false,
            createdAt: new Date()
        });
        await notification.save();

        console.log(`Notification created for user ${branchId}: ${reason}`);

        // Emit the notification in real-time using Socket.IO
        const io = getIO(); // Access the Socket.IO instance

        const branchSocketId = getBranchSocketId(branchId); // Implement this function to get the user's socket ID
        if (branchSocketId) {
            io.to(branchSocketId).emit('notification', notification);
        }
        console.log(branchSocketId);

    } catch (error) {
        console.error('Error creating notification:', error);
        throw error; // Handle error appropriately
    }
};

module.exports = { createAndSendNotification, onUserConnect, onUserDisconnect };
