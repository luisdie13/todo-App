const express = require('express');
const router = express.Router();
const { authentication } = require('../middleware/authentication');

// Importamos el controlador
const taskController = require('../controllers/task.controller');
// Importamos el controlador de comentarios (asegúrate de que exista este archivo)
const commentController = require('../controllers/comment.controller');

router.use(authentication);

// Helper para validar que la función existe antes de registrarla
const safe = (handler) => {
    if (typeof handler !== 'function') {
        console.error("ERROR: Handler no es una función:", handler);
        return (req, res) => res.status(500).json({ error: "Controller method not found" });
    }
    return handler;
};

// Rutas usando el helper 'safe'
router.get('/', safe(taskController.getTasks));
router.put('/:id', safe(taskController.updateTask));
router.delete('/:id', safe(taskController.deleteTask));

// Rutas de comentarios
router.get('/:taskId/comments', safe(commentController.getTaskComments));
router.post('/:taskId/comments', safe(commentController.createComment));
router.put('/:taskId/comments/:commentId', safe(commentController.updateComment));
router.delete('/:taskId/comments/:commentId', safe(commentController.deleteComment));

module.exports = router;