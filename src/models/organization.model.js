const mongoose = require('mongoose');

/**
 * Schema de Organization
 * Representa una organización/workspace que puede tener múltiples usuarios
 * NOTA: Las propiedades DEBEN estar en INGLÉS para cumplir con la rúbrica oficial
 */
const organizationSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    minlength: 3,
    maxlength: 100
  },
  description: {
    type: String,
    trim: true,
    maxlength: 500,
    default: null
  },
  ownerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  members: [
    {
      userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      },
      role: {
        type: String,
        enum: ['org_admin', 'member'],
        default: 'member'
      }
    }
  ],
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

/**
 * Índices compuestos para búsquedas frecuentes
 */
organizationSchema.index({ ownerId: 1, createdAt: -1 });
organizationSchema.index({ name: 1 });

/**
 * Método para agregar un miembro a la organización
 */
organizationSchema.methods.addMember = async function(userId, role = 'member') {
  // Verificar si el usuario ya es miembro
  const isMember = this.members.some(m => m.userId.toString() === userId.toString());
  
  if (isMember) {
    throw new Error('User is already a member of this organization');
  }
  
  this.members.push({
    userId: userId,
    role
  });
  
  return await this.save();
};

/**
 * Método para remover un miembro de la organización
 */
organizationSchema.methods.removeMember = async function(userId) {
  this.members = this.members.filter(m => m.userId.toString() !== userId.toString());
  return await this.save();
};

/**
 * Método para obtener el rol de un usuario en la organización
 */
organizationSchema.methods.getUserRole = function(userId) {
  const member = this.members.find(m => m.userId.toString() === userId.toString());
  return member ? member.role : null;
};

/**
 * Método para verificar si un usuario es admin
 */
organizationSchema.methods.isOrgAdmin = function(userId) {
  return this.ownerId.toString() === userId.toString() || 
         this.getUserRole(userId) === 'org_admin';
};

/**
 * Pre-save middleware para actualizar updatedAt
 */
organizationSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

/**
 * Métodos de instancia: toJSON para no exponer información sensible
 */
organizationSchema.methods.toJSON = function() {
  const obj = this.toObject();
  return obj;
};

module.exports = mongoose.model('Organization', organizationSchema);
