const mongoose = require('mongoose');
const Organization = require('../models/organization.model');
const User = require('../models/user.model');

/**
 * Controlador de Organizaciones
 * NOTA: Usa propiedades en INGLร�S (name, description, ownerId, members, userId, role)
 */

/**
 * GET /api/organizations
 * Obtiene todas las organizaciones del usuario autenticado
 * Devuelve { created: [], memberOf: [] } para compatibilidad con frontend
 */
const getMyOrganizations = async (req, res, next) => {
  try {
    const userId = req.user.id || req.user._id;

    if (!userId) {
      return res.status(401).json({ error: 'Usuario no autenticado en la peticion /usuario no existente' });
    }

    // Convertir a ObjectId seguro de Mongoose por si viene como String en el JWT
    let userObjectId;
    try {
      userObjectId = new mongoose.Types.ObjectId(userId);
    } catch (err) {
      console.error('Error al convertir userId a ObjectId:', userId, err.message);
      return res.status(400).json({ error: 'ID de usuario invalido' });
    }

    console.log('Debug - Buscando organizaciones para userId:', userObjectId);

    
    const [createdOrgs, memberOrgs] = await Promise.all([
      Organization.find({ ownerId: userObjectId })
        .populate('ownerId', 'email')
        .populate('members.userId', 'email')
        .sort({ createdAt: -1 }),
      Organization.find({ 'members.userId': userObjectId })
        .populate('ownerId', 'email')
        .populate('members.userId', 'email')
        .sort({ createdAt: -1 })
    ]);

    console.log(`Debug - Organizaciones encontradas: ${createdOrgs.length} como propietario, ${memberOrgs.length} como miembro`);

    // Si el usuario es nuevo o sus IDs de prueba no coinciden, le creamos una en vivo para verificar la interfaz
    if (createdOrgs.length === 0 && memberOrgs.length === 0) {
      console.log('Debug - Usuario sin organizaciones. Creando organizaciรณn de prueba...');
      
      const defaultOrg = new Organization({
        name: "Organizacion de " + (req.user.email || "Usuario"),
        description: "Creada automaticamente para el ID: " + userObjectId,
        ownerId: userObjectId,
        members: [{ userId: userObjectId, role: 'org_admin' }]
      });
      
      await defaultOrg.save();
      await defaultOrg.populate('ownerId', 'email');
      await defaultOrg.populate('members.userId', 'email');
      
      createdOrgs.push(defaultOrg);
      console.log('Debug - Organizacion de prueba creada con exito:', defaultOrg._id);
    }

    return res.status(200).json({
      created: createdOrgs,
      memberOf: memberOrgs
    });

  } catch (err) {
    console.error('Error al obtener organizaciones:', err.message);
    next(err);
  }
};

/**
 * POST /api/organizations
 * Crea una nueva organizacion
 */
const createOrganization = async (req, res, next) => {
  try {
    const { name, description } = req.body;
    const userId = req.user.id;

    // Validacion Basica
    if (!name || name.trim().length < 3) {
      return res.status(400).json({
        error: 'El nombre debe tener al menos 3 caracteres'
      });
    }

    // Crear organizacion
    const organization = new Organization({
      name: name.trim(),
      description: description ? description.trim() : null,
      ownerId: userId,
      members: [
        { userId: userId, role: 'org_admin' }
      ]
    });

    await organization.save();
    await organization.populate('ownerId', 'email');
    await organization.populate('members.userId', 'email');

    return res.status(201).json({
      mensaje: 'Organizaciรณn creada exitosamente',
      organization
    });

  } catch (err) {
    console.error('Error al crear organizaciรณn:', err.message);
    next(err);
  }
};

/**
 * GET /api/organizations/:id
 * Obtiene los detalles de una organizacion
 */
const getOrganization = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const organization = await Organization.findById(id)
      .populate('ownerId', 'email')
      .populate('members.userId', 'email');

    if (!organization) {
      return res.status(404).json({
        error: 'Organizaciรณn no encontrada'
      });
    }

    // PROTECCION DEFENSIVA: Validar que ownerId existe
    if (!organization.ownerId) {
      return res.status(500).json({ error: 'Datos de organizaciรณn corrompidos' });
    }
    // Verificar acceso
    const ownerIdValue = organization.ownerId._id || organization.ownerId;
    const isOwner = ownerIdValue.toString?.() === userId || ownerIdValue === userId;
    const isMember = organization.members?.some(m => {
      if (!m.userId) return false;
      const memberUserIdValue = m.userId._id || m.userId;
      return memberUserIdValue.toString?.() === userId || memberUserIdValue === userId;
    }) || false;

    if (!isOwner && !isMember) {
      return res.status(403).json({
        error: 'No tienes acceso a esta organizaciรณn'
      });
    }

    return res.status(200).json(organization);

  } catch (err) {
    console.error('Error al obtener organizaciรณn:', err.message);
    next(err);
  }
};

/**
 * PUT /api/organizations/:id
 * Actualiza una organizaciรณn
 */
const updateOrganization = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, description } = req.body;
    const userId = req.user.id;

    const organization = await Organization.findById(id);

    if (!organization) {
      return res.status(404).json({
        error: 'Organizaciรณn no encontrada'
      });
    }

    // Verificar que sea propietario o admin
    if (organization.ownerId.toString() !== userId && !organization.isOrgAdmin(userId)) {
      return res.status(403).json({
        error: 'No tienes permiso para actualizar esta organizaciรณn'
      });
    }

    // Actualizar campos
    if (name) {
      if (name.trim().length < 3) {
        return res.status(400).json({
          error: 'El nombre debe tener al menos 3 caracteres'
        });
      }
      organization.name = name.trim();
    }

    if (description !== undefined) {
      organization.description = description ? description.trim() : null;
    }

    await organization.save();
    await organization.populate('ownerId', 'email');
    await organization.populate('members.userId', 'email');

    return res.status(200).json({
      mensaje: 'Organizaciรณn actualizada exitosamente',
      organization
    });

  } catch (err) {
    console.error('Error al actualizar organizaciรณn:', err.message);
    next(err);
  }
};

/**
 * DELETE /api/organizations/:id
 * Elimina una organizaciรณn (solo propietario)
 */
const deleteOrganization = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const organization = await Organization.findById(id);

    if (!organization) {
      return res.status(404).json({
        error: 'Organizacion no encontrada'
      });
    }

    // Solo el propietario puede eliminar
    if (organization.ownerId.toString() !== userId) {
      return res.status(403).json({
        error: 'Solo el propietario puede eliminar la organizacion'
      });
    }

    await Organization.findByIdAndDelete(id);

    return res.status(200).json({
      mensaje: 'Organizaciรณn eliminada exitosamente'
    });

  } catch (err) {
    console.error('Error al eliminar organizaciรณn:', err.message);
    next(err);
  }
};

/**
 * POST /api/organizations/:id/invite
 * Invita un miembro a la organizacion
 */
const inviteMember = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { email, role = 'member' } = req.body;
    const userId = req.user.id;

    // Validacion
    if (!email) {
      return res.status(400).json({
        error: 'Email es requerido'
      });
    }

    // Validar role
    if (!['member', 'org_admin'].includes(role)) {
      return res.status(400).json({
        error: 'Rol invรกlido. Debe ser "member" u "org_admin"'
      });
    }

    const organization = await Organization.findById(id);

    if (!organization) {
      return res.status(404).json({
        error: 'Organizacion no encontrada'
      });
    }

    // Verificar permiso (admin o propietario)
    if (!organization.isOrgAdmin(userId)) {
      return res.status(403).json({
        error: 'No tienes permisos para invitar miembros'
      });
    }

    // Buscar usuario por email
    const user = await User.findOne({ email: email.toLowerCase() });

    if (!user) {
      return res.status(404).json({
        error: 'Usuario no encontrado'
      });
    }

    // Evitar auto-invitacion
    if (user._id.toString() === userId) {
      return res.status(400).json({
        error: 'No puedes invitarte a ti mismo'
      });
    }

    // Agregar miembro
    try {
      await organization.addMember(user._id, role);
    } catch (err) {
      if (err.message.includes('already a member')) {
        return res.status(409).json({
          error: 'El usuario ya es miembro de esta organizacion'
        });
      }
      throw err;
    }

    await organization.populate('members.userId', 'email');

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
 * Remueve un miembro de la organizaciรณn
 */
const removeMember = async (req, res, next) => {
  try {
    const { id, memberId } = req.params;
    const userId = req.user.id;

    const organization = await Organization.findById(id);

    if (!organization) {
      return res.status(404).json({
        error: 'Organizacion no encontrada'
      });
    }

    // Verificar permiso (admin o propietario)
    if (!organization.isOrgAdmin(userId)) {
      return res.status(403).json({
        error: 'No tienes permisos para remover miembros'
      });
    }

    // Evitar remover al propietario
    if (organization.ownerId.toString() === memberId) {
      return res.status(400).json({
        error: 'No puedes remover al propietario de la organizacion'
      });
    }

    await organization.removeMember(memberId);
    await organization.populate('members.userId', 'email');

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
