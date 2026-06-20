const mongoose = require('mongoose');

/**
 * Schema de Comentarios
 * Los comentarios se asocian a tareas y permiten colaboración
 * Se almacenan en texto plano (no sensibles por naturaleza)
 */
const commentSchema = new mongoose.Schema({
  taskId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Task',
    required: true,
    index: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  content: {
    type: String,
    required: true,
    trim: true,
    maxlength: 2000
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

commentSchema.index({ taskId: 1, createdAt: -1 });
commentSchema.index({ userId: 1, createdAt: -1 });

commentSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('Comment', commentSchema);
