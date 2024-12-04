const mongoose = require('mongoose');

const notificationTypesSchema = new mongoose.Schema({

     deviceId:{  type: String,     required: true,},
     schoolId:{   type: mongoose.Schema.Types.ObjectId,ref: 'School'},
        branchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch' },
      ignitionOn:{  type: Boolean,default: false },
      ignitionOff:{  type: Boolean, default: false},
      geofenceEnter:{  type: Boolean,default: false },
      geofenceExit:{  type: Boolean, default: false},
     studentPresent:{  type: Boolean,default: false },
     studentAbsent:{  type: Boolean,default: false },
     leaveRequestStatus:{  type: Boolean, default: false},

    createdAt: { type: Date, default: () => new Date(new Date().getTime() + (5.5 * 60 * 60 * 1000))}

});

const notificationTypes = mongoose.model('notificationTypes', notificationTypesSchema);
module.exports = notificationTypes