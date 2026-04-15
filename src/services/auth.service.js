const jwt = require('jsonwebtoken');
const Usuario = require('../models/usuario.model');

const generarToken = (usuario) => {
  return jwt.sign(
    { id: usuario._id, email: usuario.email, rol: usuario.rol },
    process.env.JWT_SECRET,
    { expiresIn: '15m' }
  );
};

const registro = async (email, password) => {
  const usuarioExistente = await Usuario.findOne({ email });
  
  if (usuarioExistente) {
    throw new Error('El correo ya está registrado');
  }

  const usuario = new Usuario({ email, password });
  await usuario.save();

  const token = generarToken(usuario);
  
  return { usuario: usuario.toJSON(), token };
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

  const token = generarToken(usuario);

  return { usuario: usuario.toJSON(), token };
};

module.exports = {
  generarToken,
  registro,
  login
};
