const express = require('express');
const bcrypt = require('bcrypt');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const Child = require('../models/child');
const { generateToken, jwtAuthMiddleware } = require('../jwt');

const router = express.Router();

const formatDateToDDMMYYYY = (dateStr) => {
  const [year, month, day] = dateStr.split('-');
  return `${day}-${month}-${year}`;
};

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir);
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${Date.now()}${ext}`);
  }
});

const upload = multer({ storage: storage });

router.post('/register', upload.single('profileImageUrl'), async (req, res) => {
  try {
    const data = req.body;
    const { email, dateOfBirth } = data;
    const { file } = req;

    console.log('Received registration data:', data);
    if (dateOfBirth && /^\d{4}-\d{2}-\d{2}$/.test(dateOfBirth)) {
      data.dateOfBirth = formatDateToDDMMYYYY(dateOfBirth);
    }
    if (file) {
      data.profileImageUrl = `${req.protocol}://${req.get('host')}/uploads/${file.filename}`;
    }

    const existingChild = await Child.findOne({ email });
    if (existingChild) {
      console.log('Email already exists');
      return res.status(400).json({ error: 'Email already exists' });
    }

    const newChild = new Child(data);
    const response = await newChild.save();
    console.log('Data saved:', response);

    const payload = {
      id: response.id,
      username: response.email,
    };

    console.log('JWT payload:', JSON.stringify(payload));
    const token = generateToken(payload);
    console.log('Generated token:', token);

    res.status(201).json({ response, token });
  } catch (error) {
    console.error('Error during registration:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const child = await Child.findOne({ email });
    if (!child) {
      return res.status(400).json({ error: 'Invalid email or password' });
    }
    const isMatch = await child.comparePassword(password);
    if (!isMatch) {
      return res.status(400).json({ error: 'Invalid email or password' });
    }
    const token = generateToken({ id: child._id, email: child.email });
    res.status(200).json({
      success: true,
      message: 'Login successful',
      token: token
    });
  } catch (err) {
    console.error('Error during login:', err);
    res.status(500).json({ error: 'Server error' });
  }
});



router.get('/getchilddata', jwtAuthMiddleware, async (req, res) => {
  try {
    const childData = req.user;
    const childId = childData.id;
    const child = await Child.findById(childId).lean(); 
    
    if (!child) {
      return res.status(404).json({ error: 'Child not found' });
    }
    if (child.profileImageUrl) {
      child.profileImageUrl = `${req.protocol}://${req.get('host')}/${child.profileImageUrl}`;
    }

    res.status(200).json({ child });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Get all children
router.get('/getAllChildren', async (req, res) => {
  try {
    const allChildren = await Child.find().lean();
    allChildren.forEach(child => {
      if (child.profileImageUrl) {
        child.profileImageUrl = `${req.protocol}://${req.get('host')}/${child.profileImageUrl}`;
      }
    });

    res.status(200).json({ children: allChildren });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

module.exports = router;
