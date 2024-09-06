const mongoose = require('mongoose');
const { encrypt, decrypt } = require('./cryptoUtils'); 

// Define the schema for the School model
const schoolSchema = new mongoose.Schema({
  schoolName: {
    type: String,
    required: true
  },
  username: {
    type: String,
    required: true,
    unique: true,
    lowercase: true 
  },
  password: {
    type: String,
    required: true
  },
  email:{
    type: String,
    required: true
  },
  mobileNo:{
    type: Number,
    required: true
  },
<<<<<<< HEAD
  branches: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Branch' }]
=======
  mainBranch:{type:String},
  branches: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Branch' }],
  defaultBranchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch'},
>>>>>>> b6536b20111e396bb1e323dd3a5cceff47e8aff1
});

schoolSchema.pre('save', async function(next) {
  if (this.isModified('password')) {
    this.password = encrypt(this.password);
  }
  next();
});

schoolSchema.methods.comparePassword = function(candidatePassword) {
  const decryptedPassword = decrypt(this.password);
  return candidatePassword === decryptedPassword;
};

const School = mongoose.model('School', schoolSchema);

module.exports = School;