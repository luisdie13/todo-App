const express = require('express');
const router = express.Router();
const Tarea = require('../models/tarea.model');
const autenticarToken = require('../middleware/autenticacion');
const validate = require('../middleware/validate');
const { createTareaSchema, updateTareaSchema } = require('../validators/tarea.validator');

// Aplicar autenticación a todas las rutas
router.use(autenticarToken);

// POST /api/tareas - Crear tarea
router.post('/', validate(createTareaSchema), async (req, res) => {
  try {
    const { title, completed } = req.body;

    if (!title || typeof title !== 'string' || title.trim().length === 0) {
      return res.status(400).json({ error: 'Title es requerido' });
    }

    const tarea = new Tarea({
      title: title.trim(),
      completed: completed || false,
      usuarioId: req.usuario.id
    });

    await tarea.save();
    return res.status(201).json(tarea);
  } catch (err) {
    console.error('Error al crear tarea:', err);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// GET /api/tareas - Obtener tareas del usuario
router.get('/', async (req, res) => {
  try {
    const tareas = await Tarea.find({ usuarioId: req.usuario.id }).lean();
    return res.json(tareas);
  } catch (err) {
    console.error('Error al obtener tareas:', err);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// GET /api/tareas/:id - Obtener una tarea
router.get('/:id', async (req, res) => {
  try {
    const tarea = await Tarea.findById(req.params.id).lean();

    if (!tarea) {
      return res.status(404).json({ error: 'Tarea no encontrada' });
    }

    // Validar que el usuario sea propietario
    if (tarea.usuarioId.toString() !== req.usuario.id) {
      return res.status(403).json({ error: 'No tienes permiso para acceder a esta tarea' });
    }

    return res.json(tarea);
  } catch (err) {
    console.error('Error al obtener tarea:', err);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// PUT /api/tareas/:id - Actualizar tarea
router.put('/:id', validate(updateTareaSchema), async (req, res) => {
  try {
    const { title, completed } = req.body;

    const tarea = await Tarea.findById(req.params.id);

    if (!tarea) {
      return res.status(404).json({ error: 'Tarea no encontrada' });
    }

    // Validar que el usuario sea propietario
    if (tarea.usuarioId.toString() !== req.usuario.id) {
      return res.status(403).json({ error: 'No tienes permiso para actualizar esta tarea' });
    }

    if (title) {
      tarea.title = title.trim();
    }

    if (completed !== undefined) {
      tarea.completed = completed;
    }

    await tarea.save();
    return res.json(tarea);
  } catch (err) {
    console.error('Error al actualizar tarea:', err);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// DELETE /api/tareas/:id - Eliminar tarea
router.delete('/:id', async (req, res) => {
  try {
    const tarea = await Tarea.findById(req.params.id);

    if (!tarea) {
      return res.status(404).json({ error: 'Tarea no encontrada' });
    }

    // Validar que el usuario sea propietario
    if (tarea.usuarioId.toString() !== req.usuario.id) {
      return res.status(403).json({ error: 'No tienes permiso para eliminar esta tarea' });
    }

    await Tarea.findByIdAndDelete(req.params.id);
    return res.status(204).send();
  } catch (err) {
    console.error('Error al eliminar tarea:', err);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
});

module.exports = router;
