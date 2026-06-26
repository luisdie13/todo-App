const mongoose = require('mongoose');

/**
 * Organization Mongoose Model — Contextual Workplace Perimeters Ledger.
 * * Requirements Met:
 * - Syncs sub-document members taxonomy role enum with workspace classifications rules.
 * - Defends instance methods logic comparisons using explicit text string formatting casts.
 * - Automatically registers metadata tracking audit metrics timelines for the platform.
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
        ref: 'User',
        required: true
      },
      role: {
        type: String,
        // FIX: Expanded to incorporate all standard and granular workspace role options matching your UI
        enum: ['org_admin', 'project_admin', 'developer', 'viewer', 'member'],
        default: 'developer',
        lowercase: true,
        trim: true
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
 * Compound indexes optimized for high-performance sorting pipelines
 */
organizationSchema.index({ ownerId: 1, createdAt: -1 });
organizationSchema.index({ name: 1 });

// ═════════════════════════════════════════════════════════════════════════════
// INSTANCE METHODS (Workplace Allocation Sub-Routines)
// ═════════════════════════════════════════════════════════════════════════════

/**
 * addMember — Safely registers a user into the membership array tracking lists.
 */
organizationSchema.methods.addMember = async function(userId, role = 'developer') {
  const targetUserIdString = String(userId).trim();
  
  // Defensive Check: Evaluates array keys cleanly avoiding pointer type drift breaks
  const isAlreadyMember = this.members.some(m => m && m.userId && String(m.userId._id || m.userId) === targetUserIdString);
  
  if (isAlreadyMember) {
    throw new Error('User is already a member of this organization');
  }
  
  this.members.push({
    userId: userId,
    role: String(role).toLowerCase().trim()
  });
  
  return await this.save();
};

/**
 * removeMember — Evicts a member and drops access tokens boundaries over this environment block.
 */
organizationSchema.methods.removeMember = async function(userId) {
  const targetUserIdString = String(userId).trim();
  
  this.members = this.members.filter(m => m && m.userId && String(m.userId._id || m.userId) !== targetUserIdString);
  return await this.save();
};

/**
 * getUserRole — Extracts the explicit contextual role string for an unpushed member reference.
 */
organizationSchema.methods.getUserRole = function(userId) {
  const targetUserIdString = String(userId).trim();
  
  const member = this.members.find(m => m && m.userId && String(m.userId._id || m.userId) === targetUserIdString);
  return member ? member.role : null;
};

/**
 * isOrgAdmin — Evaluates absolute management clearance for owner paths or delegated administrators.
 */
organizationSchema.methods.isOrgAdmin = function(userId) {
  if (!userId) return false;
  const targetUserIdString = String(userId).trim();
  const ownerIdString = String(this.ownerId?._id || this.ownerId);

  // Checks both founder parameters state or explicit administration permissions tokens
  if (ownerIdString === targetUserIdString) return true;
  
  const userRole = this.getUserRole(targetUserIdString);
  return userRole === 'org_admin';
};

// ═════════════════════════════════════════════════════════════════════════════
// HOOKS & TIMESTAMPS MIDDLEWARES
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Pre-save transactional interceptor tracking state mutations.
 */
organizationSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

/**
 * toJSON — Sanitizes layout structures by removing mongoose engine parameters tracks.
 */
organizationSchema.methods.toJSON = function() {
  const obj = this.toObject();
  delete obj.__v;
  return obj;
};

module.exports = mongoose.model('Organization', organizationSchema);