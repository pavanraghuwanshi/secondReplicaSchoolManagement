const mongoose = require("mongoose");
const bcrypt = require('bcrypt');

const conductorSchema = new mongoose.Schema({
  conductorName: {
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
  busNo:{
    type: String,
    required: true,
  },
  phone: {
    type: Number,
    required: true,
  },
  conductorId:{
    type: String,
    required: true,
  }
});
conductorSchema.pre('save', async function (next) {
  const conductor = this;
  if (!conductor.isModified('password')) return next();
  try {
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(conductor.password, salt);
    conductor.password = hashedPassword;
    next();
  } catch (err) {
    return next(err);
  }
});

conductorSchema.methods.comparePassword = async function (password) {
  try {
    const isMatch = await bcrypt.compare(password, this.password);
    return isMatch;
  } catch (err) {
    throw err;
  }
};

const Driver = mongoose.model("conductorData", conductorSchema);
module.exports = Driver;
