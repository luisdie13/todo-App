const express = require('express');
const router = express.Router();

// 1. Cambiar al middleware en inglés desestructurando la propiedad
const { authentication } = require('../middleware/authentication');

const taskController = require('../controllers/task.controller');
const commentController = require('../controllers/comment.controller');

// 2. Aplicar el middleware correcto a todas las rutas de este archivo
router.use(authentication);

// GET /api/tasks - Obtener tareas del usuario
router.get('/', taskController.getTasks);

// PUT /api/tasks/:id - Actualizar tarea (ruta plana)
router.put('/:id', taskController.updateTask);

// DELETE /api/tasks/:id - Eliminar tarea (ruta plana)
router.delete('/:id', taskController.deleteTask);

// Rutas de comentarios (anidadas bajo la tarea)
router.get('/:tareaId/comments', commentController.getTaskComments);
router.post('/:tareaId/comments', commentController.createComment);
router.put('/:tareaId/comments/:commentId', commentController.updateComment);
router.delete('/:tareaId/comments/:commentId', commentController.deleteComment);

module.exports = router;
