const jwt = require('jsonwebtoken');
const crypto = require('crypto');

// In-memory store para refresh tokens
// En producción: usar Redis o base de datos
const refreshTokenStore = new Map();

const generateAccessToken = (user) => {
  return jwt.sign(
    {
      id: user._id,
      email: user.email,
      role: user.role
    },
    process.env.JWT_SECRET,
    { expiresIn: '15m' }
  );
};

const generateRefreshToken = (user, familyId = null) => {
  const familyIdentifier = familyId || crypto.randomUUID();
  
  const token = jwt.sign(
    { 
      id: user._id, 
      email: user.email,
      familyId: familyIdentifier
    },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d' }
  );

  refreshTokenStore.set(token, {
    userId: user._id,
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

    // Mark old token as revoked (rotation)
    refreshTokenStore.set(refreshToken, {
      ...tokenData,
      isRevoked: true
    });

    // Get user (in a real app, fetch from DB)
    // For now, reconstruct user from token payload
    const user = {
      _id: decoded.id,
      email: decoded.email,
      role: decoded.role || 'user'
    };

    // Generate new pair of tokens
    const newAccessToken = generateAccessToken(user);
    const { token: newRefreshToken, familyId } = generateRefreshToken(
      user,
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

const verifyAccessToken = (token) => {
  return jwt.verify(token, process.env.JWT_SECRET);
};

const verifyRefreshToken = (token) => {
  return jwt.verify(token, process.env.JWT_REFRESH_SECRET);
};

module.exports = {
  generateAccessToken,
  generateRefreshToken,
  refreshAccessToken,
  revokeRefreshToken,
  revokeRefreshTokenFamily,
  verifyAccessToken,
  verifyRefreshToken
};
