const mongoose = require('mongoose');

const tareaSchema = new mongoose.Schema({
  title: { type: String, required: true },
  completed: { type: Boolean, default: false },
  usuarioId: { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario', required: true },
  projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', default: null },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Tarea', tareaSchema);
