const mongoose = require('mongoose');

const tareaSchema = new mongoose.Schema({
  title: { type: String, required: true },
  completed: { type: Boolean, default: false },
  usuarioId: { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario', required: true },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Tarea', tareaSchema);
