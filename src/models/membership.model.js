const mongoose = require('mongoose');

/**
 * Schema de Membership
 * Representa la pertenencia de un usuario a un proyecto/organización con un rol específico
 */
const membershipSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Usuario',
    required: true,
    index: true
  },
  projectId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organization',
    required: true,
    index: true
  },
  role: {
    type: String,
    enum: ['project_admin', 'developer', 'viewer'],
    default: 'developer',
    index: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

/**
 * Índice compuesto único: {userId: 1, projectId: 1}
 * Asegura que un usuario no pueda tener múltiples membresías en el mismo proyecto
 */
membershipSchema.index({ userId: 1, projectId: 1 }, { unique: true });

/**
 * Método para verificar si el usuario tiene un rol específico
 */
membershipSchema.methods.hasRole = function(role) {
  return this.role === role;
};

/**
 * Método para verificar si el usuario tiene al menos un rol de administrador
 */
membershipSchema.methods.isAdmin = function() {
  return this.role === 'project_admin';
};

/**
 * Método para verificar si el usuario tiene permisos de escritura
 */
membershipSchema.methods.canWrite = function() {
  return this.role === 'project_admin' || this.role === 'developer';
};

/**
 * Método para verificar si el usuario tiene permisos de lectura
 */
membershipSchema.methods.canRead = function() {
  return this.role === 'project_admin' || this.role === 'developer' || this.role === 'viewer';
};

module.exports = mongoose.model('Membership', membershipSchema);
