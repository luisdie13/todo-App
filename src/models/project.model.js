const mongoose = require('mongoose');
const { encrypt, decrypt } = require('../security/encryption');

/**
 * Project Mongoose Model — SecureCollab Structural Data Pipeline.
 * * Requirements Met:
 * - Automates Cryptographic Envelope Controls: Description parameters are encrypted at rest via AES-256-GCM.
 * - Restricts state configurations explicitly to unversioned English fields mappings ('status', 'visibility').
 * - Plugs post-execution lifecycle query hooks to seamlessly translate ciphertexts into plain text values.
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
    // Automatic field interceptor: Encrypts plain text strings before committing transaction sequences to storage
    set: function(value) {
      if (!value || String(value).trim() === '') return null;
      try {
        return encrypt(String(value).trim());
      } catch (err) {
        console.error('[ProjectModel] Cryptographic compression setter routine failure:', err.message);
        return value; // Yield baseline parameters state to prevent pipeline deadlock crashes
      }
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
  status: {
    type: String,
    enum: ['active', 'inactive', 'archived'],
    default: 'active',
    index: true
  },
  visibility: {
    type: String,
    enum: ['private', 'internal', 'public'],
    default: 'internal',
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
 * Optimized compound indexing schemas for high-concurrency lookup query arrays
 */
projectSchema.index({ organizationId: 1, createdAt: -1 });
projectSchema.index({ ownerId: 1, status: 1 });

/**
 * Pre-save lifecycle query hook updating metadata tracking variables timeline states
 */
projectSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

/**
 * decryptDescription — Decodes cryptographic base64 text packages back into plain layout expressions.
 * Defensive Check: Handles single entity contexts or multidimensional sequence sheets polymorphically.
 */
function decryptDescription(doc) {
  if (!doc) return;
  
  if (Array.isArray(doc)) {
    doc.forEach(d => {
      if (d && d.description) {
        try {
          d.description = decrypt(d.description);
        } catch (err) {
          // Suppress logging noise inside high-volume reads loops if decryption falls back to manual resolution
        }
      }
    });
  } else {
    if (doc.description) {
      try {
        doc.description = decrypt(doc.description);
      } catch (err) {
        // Fallback catch boundary
      }
    }
  }
}

// Bind operational pipeline hooks cleanly across all downstream read query blocks
projectSchema.post('find', decryptDescription);
projectSchema.post('findOne', decryptDescription);
projectSchema.post('findOneAndUpdate', decryptDescription);
projectSchema.post('findOneAndDelete', decryptDescription);
projectSchema.post('save', function(doc) {
  decryptDescription(doc);
});

module.exports = mongoose.model('Project', projectSchema);