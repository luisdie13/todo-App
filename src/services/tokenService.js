const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');

// In-memory store para refresh tokens
// En producción: usar Redis o base de datos
const refreshTokenStore = new Map();

const generateAccessToken = (usuario) => {
  return jwt.sign(
    { 
      id: usuario._id, 
      email: usuario.email, 
      rol: usuario.rol 
    },
    process.env.JWT_SECRET,
    { expiresIn: '15m' }
  );
};

const generateRefreshToken = (usuario, familyId = null) => {
  const familyIdentifier = familyId || uuidv4();
  
  const token = jwt.sign(
    { 
      id: usuario._id, 
      email: usuario.email,
      familyId: familyIdentifier
    },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d' }
  );

  refreshTokenStore.set(token, {
    userId: usuario._id,
    familyId: familyIdentifier,
    createdAt: new Date(),
    isRevoked: false
  });

  return { token, familyId: familyIdentifier };
};

const refreshAccessToken = (refreshToken) => {
  try {
    const tokenData = refreshTokenStore.get(refreshToken);

    if (!tokenData || tokenData.isRevoked) {
      throw new Error('Invalid or revoked refresh token');
    }

    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);

    // Marcar token viejo como revocado (rotación)
    refreshTokenStore.set(refreshToken, {
      ...tokenData,
      isRevoked: true
    });

    // Buscar usuario (en una app real, obtener de BD)
    // Por ahora, reconstruir usuario del payload del token
    const usuario = {
      _id: decoded.id,
      email: decoded.email,
      rol: decoded.rol || 'user'
    };

    // Generar nuevo par de tokens
    const newAccessToken = generateAccessToken(usuario);
    const { token: newRefreshToken, familyId } = generateRefreshToken(
      usuario,
      decoded.familyId
    );

    return {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken
    };
  } catch (err) {
    if (err.message === 'Invalid or revoked refresh token') {
      throw err;
    }
    throw new Error('Invalid or revoked refresh token');
  }
};

const revokeRefreshToken = (refreshToken) => {
  const tokenData = refreshTokenStore.get(refreshToken);

  if (!tokenData) {
    throw new Error('Token not found');
  }

  refreshTokenStore.set(refreshToken, {
    ...tokenData,
    isRevoked: true
  });
};

const revokeRefreshTokenFamily = (familyId) => {
  for (const [token, data] of refreshTokenStore) {
    if (data.familyId === familyId) {
      refreshTokenStore.set(token, {
        ...data,
        isRevoked: true
      });
    }
  }
};

module.exports = {
  generateAccessToken,
  generateRefreshToken,
  refreshAccessToken,
  revokeRefreshToken,
  revokeRefreshTokenFamily
};
