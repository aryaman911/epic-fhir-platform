const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { body, validationResult } = require('express-validator');
const { authenticate, superAdminOnly, orgAdminOrAbove, auditLog } = require('../middleware/auth');
const { Organization, User, AuditLog, CarePlan, Campaign } = require('../models');
const { Op } = require('sequelize');
const logger = require('../utils/logger');

// ==================== ORGANIZATION MANAGEMENT ====================

/**
 * @swagger
 * /admin/organizations:
 *   get:
 *     summary: List all organizations (super admin only)
 *     tags: [Admin]
 */
router.get('/organizations', authenticate, superAdminOnly, async (req, res) => {
  try {
    const organizations = await Organization.findAll({
      include: [{
        model: User,
        attributes: ['id', 'email', 'role']
      }],
      order: [['createdAt', 'DESC']]
    });

    res.json({ organizations });
  } catch (error) {
    logger.error('List organizations error:', error);
    res.status(500).json({ error: 'Failed to list organizations' });
  }
});

/**
 * @swagger
 * /admin/organizations/{id}:
 *   get:
 *     summary: Get organization details
 *     tags: [Admin]
 */
router.get('/organizations/:id', authenticate, superAdminOnly, async (req, res) => {
  try {
    const organization = await Organization.findByPk(req.params.id, {
      include: [{
        model: User,
        attributes: { exclude: ['password'] }
      }]
    });

    if (!organization) {
      return res.status(404).json({ error: 'Organization not found' });
    }

    // Get stats
    const [carePlans, campaigns] = await Promise.all([
      CarePlan.count({ where: { organizationId: organization.id } }),
      Campaign.count({ where: { organizationId: organization.id } })
    ]);

    res.json({
      organization,
      stats: { carePlans, campaigns, users: organization.Users?.length || 0 }
    });
  } catch (error) {
    logger.error('Get organization error:', error);
    res.status(500).json({ error: 'Failed to get organization' });
  }
});

/**
 * @swagger
 * /admin/organizations/{id}:
 *   put:
 *     summary: Update organization
 *     tags: [Admin]
 */
router.put('/organizations/:id',
  authenticate,
  superAdminOnly,
  auditLog('UPDATE_ORGANIZATION', 'organization'),
  async (req, res) => {
    try {
      const organization = await Organization.findByPk(req.params.id);
      
      if (!organization) {
        return res.status(404).json({ error: 'Organization not found' });
      }

      await organization.update(req.body);
      res.json({ organization });
    } catch (error) {
      logger.error('Update organization error:', error);
      res.status(500).json({ error: 'Failed to update organization' });
    }
  }
);

// ==================== USER MANAGEMENT ====================

/**
 * @swagger
 * /admin/users:
 *   get:
 *     summary: List users in organization
 *     tags: [Admin]
 */
router.get('/users', authenticate, orgAdminOrAbove, async (req, res) => {
  try {
    const where = req.user.role === 'super_admin' 
      ? {} 
      : { organizationId: req.organizationId };

    const users = await User.findAll({
      where,
      attributes: { exclude: ['password', 'epicAccessToken', 'epicRefreshToken'] },
      include: [Organization],
      order: [['createdAt', 'DESC']]
    });

    res.json({ users });
  } catch (error) {
    logger.error('List users error:', error);
    res.status(500).json({ error: 'Failed to list users' });
  }
});

/**
 * @swagger
 * /admin/users:
 *   post:
 *     summary: Create a new user
 *     tags: [Admin]
 */
router.post('/users',
  authenticate,
  orgAdminOrAbove,
  [
    body('email').isEmail().normalizeEmail(),
    body('password').isLength({ min: 8 }),
    body('firstName').optional().trim(),
    body('lastName').optional().trim(),
    body('role').isIn(['org_admin', 'analyst', 'viewer'])
  ],
  auditLog('CREATE_USER', 'user'),
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { email, password, firstName, lastName, role } = req.body;

      // Check if email exists
      const existing = await User.findOne({ where: { email } });
      if (existing) {
        return res.status(400).json({ error: 'Email already exists' });
      }

      // Only super admin can create super admins
      if (role === 'super_admin' && req.user.role !== 'super_admin') {
        return res.status(403).json({ error: 'Cannot create super admin' });
      }

      const hashedPassword = await bcrypt.hash(password, 12);
      const user = await User.create({
        email,
        password: hashedPassword,
        firstName,
        lastName,
        role,
        organizationId: req.organizationId
      });

      res.status(201).json({
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role
        }
      });
    } catch (error) {
      logger.error('Create user error:', error);
      res.status(500).json({ error: 'Failed to create user' });
    }
  }
);

/**
 * @swagger
 * /admin/users/{id}:
 *   put:
 *     summary: Update user
 *     tags: [Admin]
 */
router.put('/users/:id',
  authenticate,
  orgAdminOrAbove,
  auditLog('UPDATE_USER', 'user'),
  async (req, res) => {
    try {
      const where = { id: req.params.id };
      if (req.user.role !== 'super_admin') {
        where.organizationId = req.organizationId;
      }

      const user = await User.findOne({ where });
      
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      const updateData = { ...req.body };
      delete updateData.password; // Don't update password here
      delete updateData.email; // Don't change email

      if (updateData.role === 'super_admin' && req.user.role !== 'super_admin') {
        return res.status(403).json({ error: 'Cannot elevate to super admin' });
      }

      await user.update(updateData);

      res.json({
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
          isActive: user.isActive
        }
      });
    } catch (error) {
      logger.error('Update user error:', error);
      res.status(500).json({ error: 'Failed to update user' });
    }
  }
);

/**
 * @swagger
 * /admin/users/{id}:
 *   delete:
 *     summary: Deactivate user
 *     tags: [Admin]
 */
router.delete('/users/:id',
  authenticate,
  orgAdminOrAbove,
  auditLog('DEACTIVATE_USER', 'user'),
  async (req, res) => {
    try {
      const where = { id: req.params.id };
      if (req.user.role !== 'super_admin') {
        where.organizationId = req.organizationId;
      }

      const user = await User.findOne({ where });
      
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      if (user.id === req.user.id) {
        return res.status(400).json({ error: 'Cannot deactivate yourself' });
      }

      await user.update({ isActive: false });
      res.json({ message: 'User deactivated' });
    } catch (error) {
      logger.error('Deactivate user error:', error);
      res.status(500).json({ error: 'Failed to deactivate user' });
    }
  }
);

/**
 * @swagger
 * /admin/users/{id}/reset-password:
 *   post:
 *     summary: Reset user password
 *     tags: [Admin]
 */
router.post('/users/:id/reset-password',
  authenticate,
  orgAdminOrAbove,
  [body('newPassword').isLength({ min: 8 })],
  auditLog('RESET_PASSWORD', 'user'),
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const where = { id: req.params.id };
      if (req.user.role !== 'super_admin') {
        where.organizationId = req.organizationId;
      }

      const user = await User.findOne({ where });
      
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      const hashedPassword = await bcrypt.hash(req.body.newPassword, 12);
      await user.update({ password: hashedPassword });

      res.json({ message: 'Password reset successful' });
    } catch (error) {
      logger.error('Reset password error:', error);
      res.status(500).json({ error: 'Failed to reset password' });
    }
  }
);

// ==================== AUDIT LOGS ====================

/**
 * @swagger
 * /admin/audit-logs:
 *   get:
 *     summary: Get audit logs
 *     tags: [Admin]
 */
router.get('/audit-logs', authenticate, orgAdminOrAbove, async (req, res) => {
  try {
    const { action, resource, userId, startDate, endDate, page = 1, limit = 50 } = req.query;
    
    const where = {};
    if (req.user.role !== 'super_admin') {
      where.organizationId = req.organizationId;
    }
    if (action) where.action = action;
    if (resource) where.resource = resource;
    if (userId) where.userId = userId;
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt[Op.gte] = new Date(startDate);
      if (endDate) where.createdAt[Op.lte] = new Date(endDate);
    }

    const logs = await AuditLog.findAndCountAll({
      where,
      include: [{
        model: User,
        attributes: ['email', 'firstName', 'lastName']
      }],
      order: [['createdAt', 'DESC']],
      limit: parseInt(limit),
      offset: (parseInt(page) - 1) * parseInt(limit)
    });

    res.json({
      total: logs.count,
      page: parseInt(page),
      limit: parseInt(limit),
      logs: logs.rows
    });
  } catch (error) {
    logger.error('Get audit logs error:', error);
    res.status(500).json({ error: 'Failed to get audit logs' });
  }
});

// ==================== SETTINGS ====================

/**
 * @swagger
 * /admin/settings:
 *   get:
 *     summary: Get organization settings
 *     tags: [Admin]
 */
router.get('/settings', authenticate, orgAdminOrAbove, async (req, res) => {
  try {
    const organization = await Organization.findByPk(req.organizationId);
    
    res.json({
      settings: organization.settings || {},
      epicConfig: {
        clientId: organization.epicClientId ? '••••••' + organization.epicClientId.slice(-4) : null,
        fhirBaseUrl: organization.epicFhirBaseUrl
      }
    });
  } catch (error) {
    logger.error('Get settings error:', error);
    res.status(500).json({ error: 'Failed to get settings' });
  }
});

/**
 * @swagger
 * /admin/settings:
 *   put:
 *     summary: Update organization settings
 *     tags: [Admin]
 */
router.put('/settings',
  authenticate,
  orgAdminOrAbove,
  auditLog('UPDATE_SETTINGS', 'organization'),
  async (req, res) => {
    try {
      const organization = await Organization.findByPk(req.organizationId);
      
      const { settings, epicClientId, epicClientSecret, epicFhirBaseUrl } = req.body;

      const updateData = {};
      if (settings) {
        updateData.settings = { ...organization.settings, ...settings };
      }
      if (epicClientId) updateData.epicClientId = epicClientId;
      if (epicClientSecret) updateData.epicClientSecret = epicClientSecret;
      if (epicFhirBaseUrl) updateData.epicFhirBaseUrl = epicFhirBaseUrl;

      await organization.update(updateData);

      res.json({ message: 'Settings updated' });
    } catch (error) {
      logger.error('Update settings error:', error);
      res.status(500).json({ error: 'Failed to update settings' });
    }
  }
);

module.exports = router;
