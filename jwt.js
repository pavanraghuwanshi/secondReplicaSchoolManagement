const jwt = require('jsonwebtoken');

// Generic middleware for authentication
const authMiddleware = (Model, idField, roleName) => {
  return async (req, res, next) => {
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
      const { id, username } = decoded;

      // Find the user in the corresponding model
      const user = await Model.findOne({ _id: id, username });
      if (!user) {
        return res.status(401).json({ error: `Unauthorized: Invalid ${roleName} token` });
      }

      req[idField] = id; // Attach id (schoolId, superadminId, branchId) to req for use in routes
      next(); // Call the next middleware or route handler
    } catch (err) {
      console.error(`${roleName} token verification failed:`, err);
      res.status(401).json({ error: `Unauthorized: Invalid ${roleName} token` });
    }
  };
};

// Specific middlewares using the generic authMiddleware
const schoolAuthMiddleware = authMiddleware(require('./models/school'), 'schoolId', 'school');
const superadminMiddleware = authMiddleware(require('./models/superAdmin'), 'superadminId', 'superadmin');
const branchAuthMiddleware = authMiddleware(require('./models/branch'), 'branchId', 'branch');

// JWT authentication middleware (without model verification)
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

const generateToken = (Data) => {
  return jwt.sign(Data, process.env.JWT_SECRET);
};

module.exports = { jwtAuthMiddleware, schoolAuthMiddleware, superadminMiddleware, branchAuthMiddleware, generateToken };
