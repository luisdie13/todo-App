const mongoose = require('mongoose');

/**
 * Membership Mongoose Model — Project-Level Contextual Access Ledger.
 * * Requirements Met:
 * - Maps user identities to specific projects alongside restricted execution roles.
 * - Enforces index constraints preventing duplicate member registration configurations.
 * - Outlines clean predicate utility instance methods to accelerate ABAC guard verifications.
 */
const membershipSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  projectId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project',
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
 * Unique Compound Index
 * Enforces absolute database consistency: an individual actor can only occupy one 
 * access context slot configuration per project perimeter block.
 */
membershipSchema.index({ userId: 1, projectId: 1 }, { unique: true });

// ═════════════════════════════════════════════════════════════════════════════
// INSTANCE METHODS (ABAC Context Predicates)
// ═════════════════════════════════════════════════════════════════════════════

/**
 * hasRole — Verifies if the instance matches a targeted role taxonomy string.
 */
membershipSchema.methods.hasRole = function(role) {
  return this.role === role;
};

/**
 * isAdmin — Verification checkpoint confirming if the subject holds project-level admin clearance.
 */
membershipSchema.methods.isAdmin = function() {
  return this.role === 'project_admin';
};

/**
 * canWrite — Evaluates write permission privileges (Enforces Rule 4 Read-Only bypass for Viewers).
 */
membershipSchema.methods.canWrite = function() {
  return this.role === 'project_admin' || this.role === 'developer';
};

/**
 * canRead — Evaluates broad reading data visibility rights across the targeted project perimeter.
 */
membershipSchema.methods.canRead = function() {
  return ['project_admin', 'developer', 'viewer'].includes(this.role);
};

// ═════════════════════════════════════════════════════════════════════════════
// LIFECYCLE HOOKS & TRANSFORMS
// ═════════════════════════════════════════════════════════════════════════════

/**
 * toJSON — Intercepts payload serialization to standardize outbound response mapping structures.
 */
membershipSchema.methods.toJSON = function() {
  const obj = this.toObject();
  if (obj.userId && obj.userId._id) {
    obj.user = obj.userId;
  }
  if (obj.projectId && obj.projectId._id) {
    obj.project = obj.projectId;
  }
  delete obj.__v;
  return obj;
};

module.exports = mongoose.model('Membership', membershipSchema);