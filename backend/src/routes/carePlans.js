const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const { authenticate, orgAdminOrAbove, auditLog } = require('../middleware/auth');
const { CarePlan, ICD10Code } = require('../models');
const { Op } = require('sequelize');
const logger = require('../utils/logger');

/**
 * @swagger
 * /care-plans:
 *   get:
 *     summary: List care plans
 *     tags: [Care Plans]
 */
router.get('/', authenticate, async (req, res) => {
  try {
    const { category, search, includeTemplates } = req.query;
    
    const where = {
      [Op.or]: [
        { organizationId: req.organizationId },
        { isTemplate: true }
      ],
      isActive: true
    };

    if (category) {
      where.category = category;
    }

    if (search) {
      where.name = { [Op.iLike]: `%${search}%` };
    }

    if (includeTemplates === 'false') {
      where.organizationId = req.organizationId;
      delete where[Op.or];
    }

    const carePlans = await CarePlan.findAll({
      where,
      order: [['createdAt', 'DESC']]
    });

    res.json({ carePlans });
  } catch (error) {
    logger.error('List care plans error:', error);
    res.status(500).json({ error: 'Failed to list care plans' });
  }
});

/**
 * @swagger
 * /care-plans/{id}:
 *   get:
 *     summary: Get care plan by ID
 *     tags: [Care Plans]
 */
router.get('/:id', authenticate, async (req, res) => {
  try {
    const carePlan = await CarePlan.findOne({
      where: {
        id: req.params.id,
        [Op.or]: [
          { organizationId: req.organizationId },
          { isTemplate: true }
        ]
      }
    });

    if (!carePlan) {
      return res.status(404).json({ error: 'Care plan not found' });
    }

    // Fetch ICD-10 details
    let icd10Details = [];
    if (carePlan.icd10Codes && carePlan.icd10Codes.length > 0) {
      icd10Details = await ICD10Code.findAll({
        where: {
          code: { [Op.in]: carePlan.icd10Codes }
        }
      });
    }

    res.json({
      carePlan,
      icd10Details
    });
  } catch (error) {
    logger.error('Get care plan error:', error);
    res.status(500).json({ error: 'Failed to get care plan' });
  }
});

/**
 * @swagger
 * /care-plans:
 *   post:
 *     summary: Create a new care plan
 *     tags: [Care Plans]
 */
router.post('/', 
  authenticate, 
  orgAdminOrAbove,
  [
    body('name').trim().notEmpty().withMessage('Name is required'),
    body('description').optional().trim(),
    body('category').optional().trim(),
    body('icd10Codes').optional().isArray(),
    body('eligibilityCriteria').optional().isObject(),
    body('interventions').optional().isArray(),
    body('outcomes').optional().isArray(),
    body('costEstimate').optional().isNumeric(),
    body('duration').optional().trim()
  ],
  auditLog('CREATE_CARE_PLAN', 'care_plan'),
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const carePlan = await CarePlan.create({
        ...req.body,
        organizationId: req.organizationId,
        isTemplate: false
      });

      res.status(201).json({ carePlan });
    } catch (error) {
      logger.error('Create care plan error:', error);
      res.status(500).json({ error: 'Failed to create care plan' });
    }
  }
);

/**
 * @swagger
 * /care-plans/{id}:
 *   put:
 *     summary: Update a care plan
 *     tags: [Care Plans]
 */
router.put('/:id',
  authenticate,
  orgAdminOrAbove,
  auditLog('UPDATE_CARE_PLAN', 'care_plan'),
  async (req, res) => {
    try {
      const carePlan = await CarePlan.findOne({
        where: {
          id: req.params.id,
          organizationId: req.organizationId
        }
      });

      if (!carePlan) {
        return res.status(404).json({ error: 'Care plan not found' });
      }

      await carePlan.update(req.body);
      res.json({ carePlan });
    } catch (error) {
      logger.error('Update care plan error:', error);
      res.status(500).json({ error: 'Failed to update care plan' });
    }
  }
);

/**
 * @swagger
 * /care-plans/{id}:
 *   delete:
 *     summary: Delete a care plan
 *     tags: [Care Plans]
 */
router.delete('/:id',
  authenticate,
  orgAdminOrAbove,
  auditLog('DELETE_CARE_PLAN', 'care_plan'),
  async (req, res) => {
    try {
      const carePlan = await CarePlan.findOne({
        where: {
          id: req.params.id,
          organizationId: req.organizationId
        }
      });

      if (!carePlan) {
        return res.status(404).json({ error: 'Care plan not found' });
      }

      await carePlan.update({ isActive: false });
      res.json({ message: 'Care plan deleted' });
    } catch (error) {
      logger.error('Delete care plan error:', error);
      res.status(500).json({ error: 'Failed to delete care plan' });
    }
  }
);

/**
 * @swagger
 * /care-plans/{id}/duplicate:
 *   post:
 *     summary: Duplicate a care plan (including templates)
 *     tags: [Care Plans]
 */
router.post('/:id/duplicate',
  authenticate,
  orgAdminOrAbove,
  async (req, res) => {
    try {
      const original = await CarePlan.findOne({
        where: {
          id: req.params.id,
          [Op.or]: [
            { organizationId: req.organizationId },
            { isTemplate: true }
          ]
        }
      });

      if (!original) {
        return res.status(404).json({ error: 'Care plan not found' });
      }

      const duplicate = await CarePlan.create({
        name: `${original.name} (Copy)`,
        description: original.description,
        category: original.category,
        icd10Codes: original.icd10Codes,
        eligibilityCriteria: original.eligibilityCriteria,
        interventions: original.interventions,
        outcomes: original.outcomes,
        costEstimate: original.costEstimate,
        duration: original.duration,
        organizationId: req.organizationId,
        isTemplate: false
      });

      res.status(201).json({ carePlan: duplicate });
    } catch (error) {
      logger.error('Duplicate care plan error:', error);
      res.status(500).json({ error: 'Failed to duplicate care plan' });
    }
  }
);

/**
 * @swagger
 * /care-plans/templates:
 *   get:
 *     summary: Get pre-built care plan templates
 *     tags: [Care Plans]
 */
router.get('/templates/list', authenticate, async (req, res) => {
  try {
    const templates = await CarePlan.findAll({
      where: { isTemplate: true, isActive: true },
      order: [['category', 'ASC'], ['name', 'ASC']]
    });

    // Group by category
    const grouped = templates.reduce((acc, template) => {
      const category = template.category || 'Other';
      if (!acc[category]) acc[category] = [];
      acc[category].push(template);
      return acc;
    }, {});

    res.json({ templates, grouped });
  } catch (error) {
    logger.error('Get templates error:', error);
    res.status(500).json({ error: 'Failed to get templates' });
  }
});

/**
 * @swagger
 * /care-plans/categories:
 *   get:
 *     summary: Get care plan categories
 *     tags: [Care Plans]
 */
router.get('/categories/list', authenticate, async (req, res) => {
  try {
    const categories = [
      { id: 'chronic', name: 'Chronic Disease Management', description: 'Ongoing management of chronic conditions' },
      { id: 'preventive', name: 'Preventive Care', description: 'Screenings and preventive services' },
      { id: 'behavioral', name: 'Behavioral Health', description: 'Mental health and substance use' },
      { id: 'transitions', name: 'Care Transitions', description: 'Post-discharge and transitional care' },
      { id: 'wellness', name: 'Wellness Programs', description: 'Health improvement initiatives' },
      { id: 'specialty', name: 'Specialty Care', description: 'Disease-specific programs' }
    ];

    res.json({ categories });
  } catch (error) {
    logger.error('Get categories error:', error);
    res.status(500).json({ error: 'Failed to get categories' });
  }
});

module.exports = router;
