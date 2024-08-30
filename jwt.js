const jwt = require('jsonwebtoken');
const School = require('./models/school');
const Superadmin = require('./models/superAdmin');



const jwtAuthMiddleware = (req, res, next) => {
  const authorization = req.headers.authorization;

  if (!authorization) {
    return res.status(401).json({ error: 'Token Not Found' });
  }

  const token = authorization.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    // Decode and verify the token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Attach the user and schoolId to the request object
    req.user = decoded;
    req.schoolId = decoded.schoolId;

    next(); // Proceed to the next middleware or route handler
  } catch (err) {
    console.error('Token verification failed:', err);
    res.status(401).json({ error: 'Invalid token' });
  }
};


const schoolAuthMiddleware = async (req, res, next) => {
  const authorization = req.headers.authorization;
  if (!authorization) {
    return res.status(401).json({ error: 'Token Not Found' });
  }

  const token = authorization.split(' ')[1];
  if (!token) {
    return res.status(401).json({ error: 'Unauthorized: Token missing' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const { id: schoolId, username } = decoded;

    const school = await School.findOne({ _id: schoolId, username });
    if (!school) {
      return res.status(401).json({ error: 'Unauthorized: Invalid token' });
    }

    req.schoolId = schoolId; // Attach schoolId to req for use in routes
    next(); // Call the next middleware or route handler
  } catch (err) {
    console.error('Token verification failed:', err);
    res.status(401).json({ error: 'Unauthorized: Invalid token' });
  }
};


const superadminMiddleware = async (req, res, next) => {
  const authorization = req.headers.authorization;
  if (!authorization) return res.status(401).json({ error: 'Token Not Found' });

  const token = authorization.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const superadmin = await Superadmin.findOne({ _id: decoded.id, username: decoded.username });
    if (!superadmin) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    req.superadmin = decoded;
    next();
  } catch (err) {
    console.error(err);
    res.status(401).json({ error: 'Invalid token' });
  }
};


const generateToken = (Data) => {
  return jwt.sign(Data, process.env.JWT_SECRET);
};

module.exports = { jwtAuthMiddleware, schoolAuthMiddleware,superadminMiddleware, generateToken };