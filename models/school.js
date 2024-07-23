const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

// Define the schema for the School model
const schoolSchema = new mongoose.Schema({
  schoolName: {
    type: String,
    required: true
  },
  username: {
    type: String,
    required: true,
    unique: true // Ensure usernames are unique
  },
  password: {
    type: String,
    required: true
  }
});

// Middleware to hash the password before saving
schoolSchema.pre('save', async function (next) {
  const school = this;
  
  // Check if the password is being modified
  if (!school.isModified('password')) return next();

  try {
    // Generate salt
    const salt = await bcrypt.genSalt(10);
    
    // Hash the password with the salt
    const hashedPassword = await bcrypt.hash(school.password, salt);
    
    // Set the hashed password
    school.password = hashedPassword;
    next();
  } catch (err) {
    return next(err);
  }
});

// Method to compare the provided password with the hashed password
schoolSchema.methods.comparePassword = async function (password) {
  try {
    // Compare the password with the hashed password
    const isMatch = await bcrypt.compare(password, this.password);
    return isMatch;
  } catch (err) {
    throw err;
  }
};

// Create and export the School model
const School = mongoose.model('School', schoolSchema);

module.exports = School;
