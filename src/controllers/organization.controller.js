const Organization = require('../models/organization.model');
const Usuario = require('../models/usuario.model');

/**
 * Controlador de Organizaciones
 */

/**
 * GET /api/organizations
 * Obtiene todas las organizaciones del usuario autenticado
 */
const getMyOrganizations = async (req, res, next) => {
  try {
    const userId = req.user.id;

    // Organizaciones creadas por el usuario
    const created = await Organization.find({ creador: userId })
      .populate('creador', 'email')
      .populate('miembros.usuario', 'email')
      .sort({ createdAt: -1 });

    // Organizaciones donde es miembro
    const memberOf = await Organization.find({
      'miembros.usuario': userId
    })
      .populate('creador', 'email')
      .populate('miembros.usuario', 'email')
      .sort({ createdAt: -1 });

    return res.status(200).json({
      created,
      memberOf
    });

  } catch (err) {
    console.error('Error al obtener organizaciones:', err.message);
    next(err);
  }
};

/**
 * POST /api/organizations
 * Crea una nueva organización
 */
const createOrganization = async (req, res, next) => {
  try {
    const { nombre, descripcion } = req.body;
    const userId = req.user.id;

    // Validación básica
    if (!nombre || nombre.trim().length < 3) {
      return res.status(400).json({
        error: 'El nombre debe tener al menos 3 caracteres'
      });
    }

    // Crear organización
    const organization = new Organization({
      nombre: nombre.trim(),
      descripcion: descripcion ? descripcion.trim() : null,
      creador: userId
    });

    await organization.save();
    await organization.populate('creador', 'email');

    return res.status(201).json({
      mensaje: 'Organización creada exitosamente',
      organization
    });

  } catch (err) {
    console.error('Error al crear organización:', err.message);
    next(err);
  }
};

/**
 * GET /api/organizations/:id
 * Obtiene los detalles de una organización
 */
const getOrganization = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const organization = await Organization.findById(id)
      .populate('creador', 'email')
      .populate('miembros.usuario', 'email');

    if (!organization) {
      return res.status(404).json({
        error: 'Organización no encontrada'
      });
    }

    // Verificar acceso
    const isCreator = organization.creador._id.toString() === userId;
    const isMember = organization.miembros.some(m => m.usuario._id.toString() === userId);

    if (!isCreator && !isMember) {
      return res.status(403).json({
        error: 'No tienes acceso a esta organización'
      });
    }

    return res.status(200).json(organization);

  } catch (err) {
    console.error('Error al obtener organización:', err.message);
    next(err);
  }
};

/**
 * PUT /api/organizations/:id
 * Actualiza una organización
 */
const updateOrganization = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { nombre, descripcion, estado } = req.body;
    const userId = req.user.id;

    const organization = await Organization.findById(id);

    if (!organization) {
      return res.status(404).json({
        error: 'Organización no encontrada'
      });
    }

    // Verificar que sea creador o admin
    if (organization.creador.toString() !== userId && !organization.esAdmin(userId)) {
      return res.status(403).json({
        error: 'No tienes permiso para actualizar esta organización'
      });
    }

    // Actualizar campos
    if (nombre) {
      if (nombre.trim().length < 3) {
        return res.status(400).json({
          error: 'El nombre debe tener al menos 3 caracteres'
        });
      }
      organization.nombre = nombre.trim();
    }

    if (descripcion !== undefined) {
      organization.descripcion = descripcion ? descripcion.trim() : null;
    }

    if (estado && organization.creador.toString() === userId) {
      organization.estado = estado;
    }

    await organization.save();
    await organization.populate('creador', 'email');
    await organization.populate('miembros.usuario', 'email');

    return res.status(200).json({
      mensaje: 'Organización actualizada exitosamente',
      organization
    });

  } catch (err) {
    console.error('Error al actualizar organización:', err.message);
    next(err);
  }
};

/**
 * DELETE /api/organizations/:id
 * Elimina una organización (solo creador)
 */
const deleteOrganization = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const organization = await Organization.findById(id);

    if (!organization) {
      return res.status(404).json({
        error: 'Organización no encontrada'
      });
    }

    // Solo el creador puede eliminar
    if (organization.creador.toString() !== userId) {
      return res.status(403).json({
        error: 'Solo el creador puede eliminar la organización'
      });
    }

    await Organization.findByIdAndDelete(id);

    return res.status(200).json({
      mensaje: 'Organización eliminada exitosamente'
    });

  } catch (err) {
    console.error('Error al eliminar organización:', err.message);
    next(err);
  }
};

/**
 * POST /api/organizations/:id/invite
 * Invita un miembro a la organización
 */
const inviteMember = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { email, rol = 'miembro' } = req.body;
    const userId = req.user.id;

    // Validación
    if (!email) {
      return res.status(400).json({
        error: 'Email es requerido'
      });
    }

    const organization = await Organization.findById(id);

    if (!organization) {
      return res.status(404).json({
        error: 'Organización no encontrada'
      });
    }

    // Verificar permiso (admin o creador)
    if (!organization.esAdmin(userId)) {
      return res.status(403).json({
        error: 'No tienes permisos para invitar miembros'
      });
    }

    // Buscar usuario por email
    const usuario = await Usuario.findOne({ email: email.toLowerCase() });

    if (!usuario) {
      return res.status(404).json({
        error: 'Usuario no encontrado'
      });
    }

    // Evitar auto-invitación
    if (usuario._id.toString() === userId) {
      return res.status(400).json({
        error: 'No puedes invitarte a ti mismo'
      });
    }

    // Agregar miembro
    try {
      await organization.agregarMiembro(usuario._id, rol);
    } catch (err) {
      if (err.message.includes('ya es miembro')) {
        return res.status(409).json({
          error: 'El usuario ya es miembro de esta organización'
        });
      }
      throw err;
    }

    await organization.populate('miembros.usuario', 'email');

    return res.status(200).json({
      mensaje: 'Miembro invitado exitosamente',
      organization
    });

  } catch (err) {
    console.error('Error al invitar miembro:', err.message);
    next(err);
  }
};

/**
 * DELETE /api/organizations/:id/members/:memberId
 * Remueve un miembro de la organización
 */
const removeMember = async (req, res, next) => {
  try {
    const { id, memberId } = req.params;
    const userId = req.user.id;

    const organization = await Organization.findById(id);

    if (!organization) {
      return res.status(404).json({
        error: 'Organización no encontrada'
      });
    }

    // Verificar permiso (admin o creador)
    if (!organization.esAdmin(userId)) {
      return res.status(403).json({
        error: 'No tienes permisos para remover miembros'
      });
    }

    // Evitar remover al creador
    if (organization.creador.toString() === memberId) {
      return res.status(400).json({
        error: 'No puedes remover al creador de la organización'
      });
    }

    await organization.removerMiembro(memberId);
    await organization.populate('miembros.usuario', 'email');

    return res.status(200).json({
      mensaje: 'Miembro removido exitosamente',
      organization
    });

  } catch (err) {
    console.error('Error al remover miembro:', err.message);
    next(err);
  }
};

module.exports = {
  getMyOrganizations,
  createOrganization,
  getOrganization,
  updateOrganization,
  deleteOrganization,
  inviteMember,
  removeMember
};
