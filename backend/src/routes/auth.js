const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const { v4: uuidv4 } = require('uuid');

const { User, Organization, AuditLog } = require('../models');
const { authenticate, auditLog } = require('../middleware/auth');
const EpicFhirService = require('../services/epicFhirService');
const logger = require('../utils/logger');

/**
 * @swagger
 * /auth/register:
 *   post:
 *     summary: Register a new organization and admin user
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - organizationName
 *               - email
 *               - password
 *             properties:
 *               organizationName:
 *                 type: string
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *               firstName:
 *                 type: string
 *               lastName:
 *                 type: string
 */
router.post('/register', [
  body('organizationName').trim().notEmpty().withMessage('Organization name is required'),
  body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
  body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
  body('firstName').optional().trim(),
  body('lastName').optional().trim()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { organizationName, email, password, firstName, lastName } = req.body;

    // Check if email exists
    const existingUser = await User.findOne({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    // Create organization
    const slug = organizationName.toLowerCase().replace(/[^a-z0-9]/g, '-');
    const organization = await Organization.create({
      name: organizationName,
      slug: `${slug}-${Date.now().toString(36)}`
    });

    // Hash password and create user
    const hashedPassword = await bcrypt.hash(password, 12);
    const user = await User.create({
      organizationId: organization.id,
      email,
      password: hashedPassword,
      firstName,
      lastName,
      role: 'org_admin'
    });

    // Generate JWT
    const token = jwt.sign(
      { userId: user.id, organizationId: organization.id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    // Audit log
    await AuditLog.create({
      userId: user.id,
      organizationId: organization.id,
      action: 'REGISTER',
      resource: 'organization',
      resourceId: organization.id,
      details: { email },
      ipAddress: req.ip
    });

    res.status(201).json({
      message: 'Registration successful',
      token,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role
      },
      organization: {
        id: organization.id,
        name: organization.name,
        slug: organization.slug
      }
    });
  } catch (error) {
    logger.error('Registration error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

/**
 * @swagger
 * /auth/login:
 *   post:
 *     summary: Login user
 *     tags: [Auth]
 */
router.post('/login', [
  body('email').isEmail().normalizeEmail(),
  body('password').notEmpty()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, password } = req.body;

    // Find user with organization
    const user = await User.findOne({
      where: { email },
      include: [Organization]
    });

    if (!user || !user.isActive) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Update last login
    await user.update({ lastLogin: new Date() });

    // Generate JWT
    const token = jwt.sign(
      { userId: user.id, organizationId: user.organizationId, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    // Audit log
    await AuditLog.create({
      userId: user.id,
      organizationId: user.organizationId,
      action: 'LOGIN',
      resource: 'user',
      resourceId: user.id,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent']
    });

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role
      },
      organization: {
        id: user.Organization.id,
        name: user.Organization.name,
        slug: user.Organization.slug,
        subscriptionTier: user.Organization.subscriptionTier
      }
    });
  } catch (error) {
    logger.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

/**
 * @swagger
 * /auth/me:
 *   get:
 *     summary: Get current user profile
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 */
router.get('/me', authenticate, async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id, {
      include: [Organization],
      attributes: { exclude: ['password'] }
    });

    res.json({
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        lastLogin: user.lastLogin,
        hasEpicConnection: !!user.epicAccessToken
      },
      organization: user.Organization
    });
  } catch (error) {
    logger.error('Get profile error:', error);
    res.status(500).json({ error: 'Failed to get profile' });
  }
});

/**
 * @swagger
 * /auth/epic/authorize:
 *   get:
 *     summary: Initiate EPIC OAuth flow
 *     tags: [Auth]
 */
router.get('/epic/authorize', authenticate, async (req, res) => {
  try {
    const state = uuidv4();
    const redirectUri = process.env.EPIC_REDIRECT_URI;
    
    // Store state in session/cache for verification
    // In production, use Redis or similar
    req.user.update({ 
      settings: { 
        ...req.user.settings, 
        epicOAuthState: state 
      } 
    });

    const epicService = new EpicFhirService();
    const authUrl = epicService.getAuthorizationUrl(redirectUri, state);

    res.json({ authorizationUrl: authUrl });
  } catch (error) {
    logger.error('EPIC auth initiation error:', error);
    res.status(500).json({ error: 'Failed to initiate EPIC authorization' });
  }
});

/**
 * @swagger
 * /auth/epic/callback:
 *   post:
 *     summary: Handle EPIC OAuth callback
 *     tags: [Auth]
 */
router.post('/epic/callback', authenticate, async (req, res) => {
  try {
    const { code, state } = req.body;

    // Verify state
    // In production, verify against stored state

    const epicService = new EpicFhirService();
    const tokens = await epicService.exchangeCodeForToken(
      code,
      process.env.EPIC_REDIRECT_URI
    );

    // Store tokens
    await req.user.update({
      epicAccessToken: tokens.access_token,
      epicRefreshToken: tokens.refresh_token,
      epicTokenExpiry: new Date(Date.now() + tokens.expires_in * 1000)
    });

    // Audit log
    await AuditLog.create({
      userId: req.user.id,
      organizationId: req.organizationId,
      action: 'EPIC_CONNECT',
      resource: 'epic_oauth',
      details: { scope: tokens.scope },
      ipAddress: req.ip
    });

    res.json({
      message: 'EPIC connection successful',
      scope: tokens.scope,
      expiresIn: tokens.expires_in
    });
  } catch (error) {
    logger.error('EPIC callback error:', error);
    res.status(500).json({ error: 'EPIC authentication failed' });
  }
});

/**
 * @swagger
 * /auth/epic/disconnect:
 *   post:
 *     summary: Disconnect EPIC integration
 *     tags: [Auth]
 */
router.post('/epic/disconnect', authenticate, async (req, res) => {
  try {
    await req.user.update({
      epicAccessToken: null,
      epicRefreshToken: null,
      epicTokenExpiry: null
    });

    await AuditLog.create({
      userId: req.user.id,
      organizationId: req.organizationId,
      action: 'EPIC_DISCONNECT',
      resource: 'epic_oauth',
      ipAddress: req.ip
    });

    res.json({ message: 'EPIC connection removed' });
  } catch (error) {
    logger.error('EPIC disconnect error:', error);
    res.status(500).json({ error: 'Failed to disconnect EPIC' });
  }
});

/**
 * @swagger
 * /auth/change-password:
 *   post:
 *     summary: Change user password
 *     tags: [Auth]
 */
router.post('/change-password', authenticate, [
  body('currentPassword').notEmpty(),
  body('newPassword').isLength({ min: 8 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { currentPassword, newPassword } = req.body;

    const user = await User.findByPk(req.user.id);
    const isValid = await bcrypt.compare(currentPassword, user.password);

    if (!isValid) {
      return res.status(400).json({ error: 'Current password is incorrect' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 12);
    await user.update({ password: hashedPassword });

    await AuditLog.create({
      userId: user.id,
      organizationId: req.organizationId,
      action: 'PASSWORD_CHANGE',
      resource: 'user',
      resourceId: user.id,
      ipAddress: req.ip
    });

    res.json({ message: 'Password updated successfully' });
  } catch (error) {
    logger.error('Password change error:', error);
    res.status(500).json({ error: 'Failed to change password' });
  }
});

/**
 * @swagger
 * /auth/logout:
 *   post:
 *     summary: Logout user
 *     tags: [Auth]
 */
router.post('/logout', authenticate, async (req, res) => {
  try {
    await AuditLog.create({
      userId: req.user.id,
      organizationId: req.organizationId,
      action: 'LOGOUT',
      resource: 'user',
      resourceId: req.user.id,
      ipAddress: req.ip
    });

    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    logger.error('Logout error:', error);
    res.status(500).json({ error: 'Logout failed' });
  }
});

module.exports = router;
