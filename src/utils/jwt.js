const jwt = require('jsonwebtoken');

const getJwtSecret = () => {
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    const error = new Error('JWT_SECRET no configurado');
    error.code = 'JWT_SECRET_MISSING';
    throw error;
  }

  return secret;
};

const signToken = (payload, options = {}) => jwt.sign(payload, getJwtSecret(), options);

const verifyToken = (token) => jwt.verify(token, getJwtSecret());

module.exports = {
  getJwtSecret,
  signToken,
  verifyToken
};
