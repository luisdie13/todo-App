const Usuario = require('../models/usuario.model');
const tokenService = require('./tokenService');
const auditLogService = require('./auditLog.service');

const registro = async (email, password, req) => {
  const usuarioExistente = await Usuario.findOne({ email });
  
  if (usuarioExistente) {
    throw new Error('El correo ya está registrado');
  }

  const usuario = new Usuario({ email, password });
  await usuario.save();

  // Registrar evento de auditoría
  await auditLogService.log('auth.register', req, {
    email: usuario.email,
    userId: usuario._id,
    statusCode: 201
  });

  const accessToken = tokenService.generateAccessToken(usuario);
  const { token: refreshToken } = tokenService.generateRefreshToken(usuario);

  return { 
    usuario: usuario.toJSON(), 
    accessToken,
    refreshToken
  };
};

const login = async (email, password, req, isSuccess = false) => {
  const usuario = await Usuario.findOne({ email });

  if (!usuario) {
    // Registrar fallo de login
    await auditLogService.log('auth.login.failure', req, {
      email,
      statusCode: 401,
      detalles: 'Usuario no encontrado'
    });
    throw new Error('Credenciales inválidas');
  }

  const esValida = await usuario.compararPassword(password);

  if (!esValida) {
    // Registrar fallo de login
    await auditLogService.log('auth.login.failure', req, {
      email,
      statusCode: 401,
      detalles: 'Contraseña incorrecta'
    });
    throw new Error('Credenciales inválidas');
  }

  const accessToken = tokenService.generateAccessToken(usuario);
  const { token: refreshToken } = tokenService.generateRefreshToken(usuario);

  // Registrar login exitoso
  await auditLogService.log('auth.login.success', req, {
    email: usuario.email,
    userId: usuario._id,
    statusCode: 200
  });

  return { 
    usuario: usuario.toJSON(), 
    accessToken,
    refreshToken
  };
};

module.exports = {
  registro,
  login
};
