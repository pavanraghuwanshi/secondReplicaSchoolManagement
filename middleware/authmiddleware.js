const jwt = require('jsonwebtoken');


const BranchGroupUser = require('../models/branchgroup.model')

 const authenticateBranchGroupUser = async (req, res, next) => {
  const token = req.headers['authorization']?.split(' ')[1];

  if (!token) {
    return res.status(401).json({ message: 'Access token is required' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const branchGroupUser = await BranchGroupUser.findById(decoded.id);
    if (branchGroupUser) {
      req.user = { id: decoded.id,school:decoded.schoolName, branches: decoded.branches, role: 'branchGroupUser' };
      return next(); 
    }

    return res.status(403).json({ message: 'Access restricted to BranchGroupUser only' });

  } catch (error) {
    return res.status(403).json({ message: 'Invalid token' });
  }
};



module.exports = {  authenticateBranchGroupUser };
