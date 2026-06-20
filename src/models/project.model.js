const mongoose = require('mongoose');
const { encrypt, decrypt } = require('../security/encryption');

/**
 * Schema de Proyecto
 * La descripción SIEMPRE se cifra con AES-256-GCM antes de guardar
 * Al leer, se descifra automáticamente
 */
const projectSchema = new mongoose.Schema({
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
    maxlength: 5000,
    default: null,
    // Almacenado en base64 (cifrado)
    set: function(value) {
      if (!value) return null;
      return encrypt(value);
    }
  },
  organizationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organization',
    required: true,
    index: true
  },
  ownerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  estado: {
    type: String,
    enum: ['activo', 'inactivo', 'archivado'],
    default: 'activo',
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
 * Índices compuestos
 */
projectSchema.index({ organizationId: 1, createdAt: -1 });
projectSchema.index({ ownerId: 1, estado: 1 });

/**
 * Pre-save middleware para actualizar updatedAt
 */
projectSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

/**
 * Post-find hooks para desencriptar automáticamente
 * Aplica a: findOne, find, findOneAndUpdate, etc.
 */
function decryptDescription(doc) {
  if (!doc) return;
  
  if (Array.isArray(doc)) {
    doc.forEach(d => {
      if (d.description) {
        try {
          d.description = decrypt(d.description);
        } catch (err) {
          console.error('Error al desencriptar descripción:', err.message);
        }
      }
    });
  } else {
    if (doc.description) {
      try {
        doc.description = decrypt(doc.description);
      } catch (err) {
        console.error('Error al desencriptar descripción:', err.message);
      }
    }
  }
}

projectSchema.post('find', decryptDescription);
projectSchema.post('findOne', decryptDescription);
projectSchema.post('findOneAndUpdate', decryptDescription);
projectSchema.post('findOneAndDelete', decryptDescription);
projectSchema.post('save', function(doc) {
  decryptDescription(doc);
});

module.exports = mongoose.model('Project', projectSchema);
