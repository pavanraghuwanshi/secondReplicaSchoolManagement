const mongoose = require("mongoose");
const bcrypt = require('bcrypt');

const supervisorSchema = new mongoose.Schema({
  supervisorName: {
    type: String,
    required: true,
  },
  email:{
    type: String,
    required: true,
  },
  password:{
    type: String,
    required: true,
  },
  phone :{
    type: Number,
    required: true,
  },
  vehicleId: String
});
supervisorSchema.pre('save', async function (next) {
  const superVisor = this;
  if (!superVisor.isModified('password')) return next();
  try {
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(superVisor.password, salt);
    superVisor.password = hashedPassword;
    next();
  } catch (err) {
    return next(err);
  }
});

supervisorSchema.methods.comparePassword = async function (password) {
  try {
    const isMatch = await bcrypt.compare(password, this.password);
    return isMatch;
  } catch (err) {
    throw err;
  }
};

const Supervisor = mongoose.model("Supervisor", supervisorSchema);
module.exports = Supervisor;