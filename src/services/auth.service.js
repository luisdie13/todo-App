const Usuario = require('../models/usuario.model');
const tokenService = require('./tokenService');

const registro = async (email, password) => {
  const usuarioExistente = await Usuario.findOne({ email });
  
  if (usuarioExistente) {
    throw new Error('El correo ya está registrado');
  }

  const usuario = new Usuario({ email, password });
  await usuario.save();

  const accessToken = tokenService.generateAccessToken(usuario);
  const { token: refreshToken } = tokenService.generateRefreshToken(usuario);

  return { 
    usuario: usuario.toJSON(), 
    accessToken,
    refreshToken
  };
};

const login = async (email, password) => {
  const usuario = await Usuario.findOne({ email });

  if (!usuario) {
    throw new Error('Credenciales inválidas');
  }

  const esValida = await usuario.compararPassword(password);

  if (!esValida) {
    throw new Error('Credenciales inválidas');
  }

  const accessToken = tokenService.generateAccessToken(usuario);
  const { token: refreshToken } = tokenService.generateRefreshToken(usuario);

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
