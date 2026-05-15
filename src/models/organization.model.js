const mongoose = require('mongoose');

/**
 * Schema de Organization
 * Representa una organización/workspace que puede tener múltiples usuarios
 */
const organizationSchema = new mongoose.Schema({
  nombre: {
    type: String,
    required: true,
    trim: true,
    minlength: 3,
    maxlength: 100,
    index: true
  },
  descripcion: {
    type: String,
    trim: true,
    maxlength: 500,
    default: null
  },
  creador: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Usuario',
    required: true,
    index: true
  },
  miembros: [
    {
      usuario: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Usuario'
      },
      rol: {
        type: String,
        enum: ['admin', 'miembro', 'visualizador'],
        default: 'miembro'
      },
      fechaUnirsio: {
        type: Date,
        default: Date.now
      }
    }
  ],
  estado: {
    type: String,
    enum: ['activa', 'inactiva', 'suspendida'],
    default: 'activa',
    index: true
  },
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
organizationSchema.index({ creador: 1, createdAt: -1 });
organizationSchema.index({ nombre: 1, estado: 1 });

/**
 * Método para agregar un miembro a la organización
 */
organizationSchema.methods.agregarMiembro = async function(usuarioId, rol = 'miembro') {
  // Verificar si el usuario ya es miembro
  const yaEsMiembro = this.miembros.some(m => m.usuario.toString() === usuarioId.toString());
  
  if (yaEsMiembro) {
    throw new Error('El usuario ya es miembro de esta organización');
  }
  
  this.miembros.push({
    usuario: usuarioId,
    rol
  });
  
  return await this.save();
};

/**
 * Método para remover un miembro de la organización
 */
organizationSchema.methods.removerMiembro = async function(usuarioId) {
  this.miembros = this.miembros.filter(m => m.usuario.toString() !== usuarioId.toString());
  return await this.save();
};

/**
 * Método para obtener el rol de un usuario en la organización
 */
organizationSchema.methods.obtenerRol = function(usuarioId) {
  const miembro = this.miembros.find(m => m.usuario.toString() === usuarioId.toString());
  return miembro ? miembro.rol : null;
};

/**
 * Método para verificar si un usuario es admin
 */
organizationSchema.methods.esAdmin = function(usuarioId) {
  return this.creador.toString() === usuarioId.toString() || 
         this.obtenerRol(usuarioId) === 'admin';
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
