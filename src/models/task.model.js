const mongoose = require('mongoose');
const { encrypt, decrypt } = require('../security/encryption');

/**
 * Schema de Tarea
 * Si sensitive=true, la descripción se cifra con AES-256-GCM
 * Si sensitive=false, la descripción se almacena en plano
 */
const taskSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true,
    default: null
  },
  sensitive: {
    type: Boolean,
    default: false,
    index: true
  },
  completed: {
    type: Boolean,
    default: false,
    index: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  assignee: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
    index: true
  },
  projectId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project',
    default: null,
    index: true
  },
  status: {
    type: String,
    enum: ['backlog', 'in_progress', 'review', 'done'],
    default: 'backlog',
    index: true
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'critical'],
    default: 'medium',
    index: true
  },
  dueDate: {
    type: Date,
    default: null,
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
taskSchema.index({ projectId: 1, createdAt: -1 });
taskSchema.index({ userId: 1, completed: 1 });

/**
 * Pre-save middleware para cifrar descripción si sensitive=true y actualizar updatedAt
 */
taskSchema.pre('save', function(next) {
  // Cifrar descripción si sensitive=true
  if (this.sensitive && this.description && !this.description.startsWith('base64:')) {
    try {
      this.description = encrypt(this.description);
    } catch (err) {
      console.error('Error al encriptar descripción:', err.message);
    }
  }
  
  this.updatedAt = Date.now();
  next();
});

/**
 * Post-find hooks para desencriptar automáticamente
 * Solo desencripta si sensitive=true
 */
function decryptDescriptionIfSensitive(doc) {
  if (!doc) return;
  
  if (Array.isArray(doc)) {
    doc.forEach(d => {
      if (d.description && d.sensitive) {
        try {
          d.description = decrypt(d.description);
        } catch (err) {
          console.error('Error al desencriptar descripción de tarea:', err.message);
        }
      }
    });
  } else {
    if (doc.description && doc.sensitive) {
      try {
        doc.description = decrypt(doc.description);
      } catch (err) {
        console.error('Error al desencriptar descripción de tarea:', err.message);
      }
    }
  }
}

taskSchema.post('find', decryptDescriptionIfSensitive);
taskSchema.post('findOne', decryptDescriptionIfSensitive);
taskSchema.post('findOneAndUpdate', decryptDescriptionIfSensitive);
taskSchema.post('findOneAndDelete', decryptDescriptionIfSensitive);
taskSchema.post('save', function(doc) {
  decryptDescriptionIfSensitive(doc);
});

module.exports = mongoose.model('Task', taskSchema);
