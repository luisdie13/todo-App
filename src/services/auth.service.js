const User = require('../models/user.model');
const tokenService = require('./tokenService');
const auditLogService = require('./auditLog.service');

const register = async (email, password, req) => {
  const existingUser = await User.findOne({ email });
  
  if (existingUser) {
    throw new Error('Email is already registered');
  }

  const user = new User({ email, password });
  await user.save();

  // Registrar evento de auditoría
  await auditLogService.log('auth.register', req, {
    email: user.email,
    userId: user._id,
    statusCode: 201
  });

  const accessToken = tokenService.generateAccessToken(user);
  const { token: refreshToken } = tokenService.generateRefreshToken(user);

  return { 
    user: user.toJSON(), 
    accessToken,
    refreshToken
  };
};

const login = async (email, password, req, isSuccess = false) => {
  const user = await User.findOne({ email });

  if (!user) {
    // Registrar fallo de login
    await auditLogService.log('auth.login.failure', req, {
      email,
      statusCode: 401,
      details: 'User not found'
    });
    throw new Error('Invalid credentials');
  }

  // Verificar si el usuario está activo
  if (!user.isActive) {
    // Registrar fallo de login
    await auditLogService.log('auth.login.failure', req, {
      email,
      statusCode: 401,
      details: 'User account is inactive'
    });
    throw new Error('User account is inactive');
  }

  const isValid = await user.comparePassword(password);

  if (!isValid) {
    // Registrar fallo de login
    await auditLogService.log('auth.login.failure', req, {
      email,
      statusCode: 401,
      details: 'Invalid password'
    });
    throw new Error('Invalid credentials');
  }

  const accessToken = tokenService.generateAccessToken(user);
  const { token: refreshToken } = tokenService.generateRefreshToken(user);

  // Registrar login exitoso
  await auditLogService.log('auth.login.success', req, {
    email: user.email,
    userId: user._id,
    statusCode: 200
  });

  return { 
    user: user.toJSON(), 
    accessToken,
    refreshToken
  };
};

module.exports = {
  register,
  login
};
