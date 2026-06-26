const express = require('express');
const router = express.Router();
// Importamos el objeto completo
const organizationController = require('../controllers/organization.controller');
const { authentication } = require('../middleware/authentication');

router.use(authentication);

// AHORA: Accedemos mediante el objeto
router.get('/', organizationController.getMyOrganizations);
router.post('/', organizationController.createOrganization);

module.exports = router;