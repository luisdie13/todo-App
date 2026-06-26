const Organization = require('../models/organization.model');

exports.getMyOrganizations = async (req, res, next) => {
    try {
        const userId = req.user?.id || req.user?._id;
        if (!userId) return res.status(401).json({ error: 'Unauthorized' });

        // Buscamos organizaciones donde el usuario sea dueño o miembro
        const orgs = await Organization.find({
            $or: [
                { ownerId: userId },
                { 'members.userId': userId }
            ]
        }).lean();

        console.log(`DEBUG: [getMyOrganizations] Usuario ${userId} tiene ${orgs.length} orgs.`);
        
        // Respondemos con la estructura que el frontend espera
        return res.status(200).json({ 
            created: orgs.filter(o => String(o.ownerId) === String(userId)),
            memberOf: orgs.filter(o => String(o.ownerId) !== String(userId))
        });
    } catch (err) {
        console.error("DEBUG: [getMyOrganizations] Error:", err);
        next(err);
    }
};

exports.createOrganization = async (req, res, next) => {
    try {
        const { name, description } = req.body;
        const ownerId = req.user.id || req.user._id;

        const newOrg = new Organization({ name, description, ownerId });
        await newOrg.save();
        
        console.log(`DEBUG: [createOrganization] Org creada con ID: ${newOrg._id}`);
        return res.status(201).json(newOrg);
    } catch (err) {
        next(err);
    }
};