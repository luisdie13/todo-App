const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

/**
 * User Mongoose Model — SecureCollab Central Identity Register.
 * * Requirements Met:
 * - Expands the core role enum to support polymorphic framework and workspace taxonomies.
 * - Prevents schema validation crashes when mutating roles from the Super Admin Console.
 * - Enforces strict pre-save hooks utilizing high-entropy salt factors for password hashing.
 */
const userSchema = new mongoose.Schema({
  name: {
    type: String,
    trim: true,
    default: 'Workspace Collaborator'
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  password: {
    type: String,
    required: true,
    minlength: 8
  },
  role: {
    type: String,
    // FIX: Expanded to match all dynamic systemic and workspace contextual roles deployed in your app
    enum: ['member', 'super_admin', 'org_admin', 'project_admin', 'developer', 'viewer', 'user', 'admin'],
    default: 'member'
  },
  isActive: {
    type: Boolean,
    default: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

/**
 * Pre-save Middleware Hook
 * Intercepts password mutations to automatically apply clean asynchronous bcrypt hashing.
 */
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  try {
    // 12 rounds factor ensures a solid high-entropy baseline parameter barrier against brute force
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (err) {
    next(err);
  }
});

/**
 * comparePassword — Secure instance method wrapper comparing plaintext inputs against hashes.
 */
userSchema.methods.comparePassword = async function(passwordProvided) {
  try {
    return await bcrypt.compare(passwordProvided, this.password);
  } catch (err) {
    return false;
  }
};

/**
 * toJSON — Interceptor mutating output payloads behavior to explicitly hide high-value hashes.
 */
userSchema.methods.toJSON = function() {
  const obj = this.toObject();
  delete obj.password;
  delete obj.__v; // Purges internal mongoose tracking version numbers
  return obj;
};

module.exports = mongoose.model('User', userSchema);