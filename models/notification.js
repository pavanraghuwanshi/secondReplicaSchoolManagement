const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
    branchId: { type: String, },
    childId: { type: String, },
    type: { type: String, },
    message: { type: String, },
    schoolId: { type: mongoose.Schema.Types.ObjectId, ref: 'School' },
    branchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch' },
    childId: { type: mongoose.Schema.Types.ObjectId, ref: 'Child' },
    parentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Parent' },
    createdAt: { type: Date, default: Date.now }
});

const Notification = mongoose.model('Notification', notificationSchema);
module.exports = Notification