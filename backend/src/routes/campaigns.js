const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const { authenticate, orgAdminOrAbove, auditLog } = require('../middleware/auth');
const { Campaign, CarePlan, OutreachHistory, User } = require('../models');
const EpicFhirService = require('../services/epicFhirService');
const aiService = require('../services/aiService');
const mailService = require('../services/mailService');
const { Op } = require('sequelize');
const logger = require('../utils/logger');

/**
 * @swagger
 * /campaigns:
 *   get:
 *     summary: List campaigns
 *     tags: [Campaigns]
 */
router.get('/', authenticate, async (req, res) => {
  try {
    const { status, carePlanId } = req.query;
    
    const where = { organizationId: req.organizationId };
    if (status) where.status = status;
    if (carePlanId) where.carePlanId = carePlanId;

    const campaigns = await Campaign.findAll({
      where,
      include: [CarePlan],
      order: [['createdAt', 'DESC']]
    });

    res.json({ campaigns });
  } catch (error) {
    logger.error('List campaigns error:', error);
    res.status(500).json({ error: 'Failed to list campaigns' });
  }
});

/**
 * @swagger
 * /campaigns/{id}:
 *   get:
 *     summary: Get campaign details
 *     tags: [Campaigns]
 */
router.get('/:id', authenticate, async (req, res) => {
  try {
    const campaign = await Campaign.findOne({
      where: {
        id: req.params.id,
        organizationId: req.organizationId
      },
      include: [CarePlan]
    });

    if (!campaign) {
      return res.status(404).json({ error: 'Campaign not found' });
    }

    // Get outreach stats
    const outreachStats = await OutreachHistory.findAll({
      where: { campaignId: campaign.id },
      attributes: ['status'],
      group: ['status']
    });

    res.json({
      campaign,
      outreachStats
    });
  } catch (error) {
    logger.error('Get campaign error:', error);
    res.status(500).json({ error: 'Failed to get campaign' });
  }
});

/**
 * @swagger
 * /campaigns:
 *   post:
 *     summary: Create a new campaign
 *     tags: [Campaigns]
 */
router.post('/',
  authenticate,
  orgAdminOrAbove,
  [
    body('name').trim().notEmpty(),
    body('carePlanId').isUUID(),
    body('type').isIn(['email', 'mail', 'sms', 'phone']),
    body('targetCriteria').optional().isObject()
  ],
  auditLog('CREATE_CAMPAIGN', 'campaign'),
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      // Verify care plan exists
      const carePlan = await CarePlan.findOne({
        where: {
          id: req.body.carePlanId,
          [Op.or]: [
            { organizationId: req.organizationId },
            { isTemplate: true }
          ]
        }
      });

      if (!carePlan) {
        return res.status(400).json({ error: 'Invalid care plan' });
      }

      const campaign = await Campaign.create({
        ...req.body,
        organizationId: req.organizationId,
        createdBy: req.user.id,
        status: 'draft'
      });

      res.status(201).json({ campaign });
    } catch (error) {
      logger.error('Create campaign error:', error);
      res.status(500).json({ error: 'Failed to create campaign' });
    }
  }
);

/**
 * @swagger
 * /campaigns/{id}/target-patients:
 *   post:
 *     summary: Find and add target patients to campaign
 *     tags: [Campaigns]
 */
router.post('/:id/target-patients',
  authenticate,
  orgAdminOrAbove,
  async (req, res) => {
    try {
      const campaign = await Campaign.findOne({
        where: {
          id: req.params.id,
          organizationId: req.organizationId
        },
        include: [CarePlan]
      });

      if (!campaign) {
        return res.status(404).json({ error: 'Campaign not found' });
      }

      const user = await User.findByPk(req.user.id);
      if (!user.epicAccessToken) {
        return res.status(400).json({ error: 'EPIC connection required' });
      }

      const epicService = new EpicFhirService();
      epicService.setAccessToken(user.epicAccessToken);

      // Find patients matching care plan criteria
      const conditions = await epicService.getConditions({ count: 500 });
      const icd10Codes = epicService.extractICD10Codes(conditions);

      const eligiblePatientIds = new Set();
      const carePlanCodes = campaign.CarePlan.icd10Codes || [];

      for (const code of icd10Codes) {
        const matches = carePlanCodes.some(cpCode => 
          code.code.startsWith(cpCode.slice(0, 3))
        );
        if (matches && code.patientId) {
          eligiblePatientIds.add(code.patientId);
        }
      }

      // Fetch patient details
      const patients = [];
      for (const patientId of Array.from(eligiblePatientIds).slice(0, 100)) {
        try {
          const patient = await epicService.getPatientById(patientId);
          const contactInfo = epicService.extractPatientContactInfo(patient);
          
          // Only include patients with contact info
          if (contactInfo.email || contactInfo.address) {
            patients.push({
              id: patientId,
              ...contactInfo
            });
          }
        } catch (e) {
          // Skip inaccessible patients
        }
      }

      // Update campaign patient count
      await campaign.update({ patientCount: patients.length });

      res.json({
        campaignId: campaign.id,
        patientsFound: patients.length,
        patients
      });
    } catch (error) {
      logger.error('Target patients error:', error);
      res.status(500).json({ error: 'Failed to find target patients' });
    }
  }
);

/**
 * @swagger
 * /campaigns/{id}/generate-content:
 *   post:
 *     summary: Generate AI outreach content for campaign patients
 *     tags: [Campaigns]
 */
router.post('/:id/generate-content',
  authenticate,
  orgAdminOrAbove,
  async (req, res) => {
    try {
      const { patientIds } = req.body;

      const campaign = await Campaign.findOne({
        where: {
          id: req.params.id,
          organizationId: req.organizationId
        },
        include: [CarePlan]
      });

      if (!campaign) {
        return res.status(404).json({ error: 'Campaign not found' });
      }

      const user = await User.findByPk(req.user.id);
      if (!user.epicAccessToken) {
        return res.status(400).json({ error: 'EPIC connection required' });
      }

      const epicService = new EpicFhirService();
      epicService.setAccessToken(user.epicAccessToken);

      const generatedContent = [];

      for (const patientId of (patientIds || []).slice(0, 20)) {
        try {
          const patient = await epicService.getPatientById(patientId);
          const patientInfo = epicService.extractPatientContactInfo(patient);

          // Generate content using dual AI
          const aiContent = await aiService.generateOutreachContent(
            patientInfo,
            {
              name: campaign.CarePlan.name,
              description: campaign.CarePlan.description,
              benefits: campaign.CarePlan.outcomes
            },
            campaign.type
          );

          // Save to outreach history
          const outreach = await OutreachHistory.create({
            campaignId: campaign.id,
            patientFhirId: patientId,
            patientName: patientInfo.name,
            patientEmail: patientInfo.email,
            patientAddress: patientInfo.address,
            contentOpenAI: aiContent.openai?.content,
            contentClaude: aiContent.claude?.content,
            selectedContent: aiContent.selected?.content,
            aiAnalysis: {
              winner: aiContent.selected?.winner,
              scores: aiContent.selected?.scores
            },
            status: 'pending'
          });

          generatedContent.push({
            patientId,
            patientName: patientInfo.name,
            outreachId: outreach.id,
            content: {
              openai: aiContent.openai?.content?.substring(0, 200) + '...',
              claude: aiContent.claude?.content?.substring(0, 200) + '...',
              selected: aiContent.selected?.winner
            }
          });
        } catch (e) {
          logger.error(`Content generation failed for patient ${patientId}:`, e);
          generatedContent.push({
            patientId,
            error: 'Content generation failed'
          });
        }
      }

      res.json({
        campaignId: campaign.id,
        generated: generatedContent.length,
        content: generatedContent
      });
    } catch (error) {
      logger.error('Generate content error:', error);
      res.status(500).json({ error: 'Content generation failed' });
    }
  }
);

/**
 * @swagger
 * /campaigns/{id}/send:
 *   post:
 *     summary: Send campaign outreach
 *     tags: [Campaigns]
 */
router.post('/:id/send',
  authenticate,
  orgAdminOrAbove,
  auditLog('SEND_CAMPAIGN', 'campaign'),
  async (req, res) => {
    try {
      const campaign = await Campaign.findOne({
        where: {
          id: req.params.id,
          organizationId: req.organizationId
        },
        include: [CarePlan]
      });

      if (!campaign) {
        return res.status(404).json({ error: 'Campaign not found' });
      }

      // Get pending outreach items
      const pendingOutreach = await OutreachHistory.findAll({
        where: {
          campaignId: campaign.id,
          status: 'pending'
        }
      });

      if (pendingOutreach.length === 0) {
        return res.status(400).json({ error: 'No pending outreach to send' });
      }

      let sentCount = 0;
      let failedCount = 0;

      if (campaign.type === 'email') {
        // Send emails
        for (const outreach of pendingOutreach) {
          if (!outreach.patientEmail) continue;

          try {
            await mailService.sendEmail(
              outreach.patientEmail,
              `Important: ${campaign.CarePlan.name} Program`,
              mailService.getTemplate('carePlanInvitation', {
                patientName: outreach.patientName,
                organizationName: 'Your Healthcare Provider',
                content: outreach.selectedContent || outreach.contentClaude
              })
            );

            await outreach.update({
              status: 'sent',
              sentAt: new Date()
            });
            sentCount++;
          } catch (e) {
            await outreach.update({ status: 'failed' });
            failedCount++;
          }
        }
      } else if (campaign.type === 'mail') {
        // Generate mail merge file
        const mailData = pendingOutreach
          .filter(o => o.patientAddress)
          .map(o => ({
            name: o.patientName,
            address: o.patientAddress,
            content: o.selectedContent || o.contentClaude
          }));

        // Mark as sent (in production, integrate with mail vendor)
        for (const outreach of pendingOutreach) {
          if (outreach.patientAddress) {
            await outreach.update({
              status: 'sent',
              sentAt: new Date()
            });
            sentCount++;
          }
        }

        // Return mail merge data
        res.json({
          campaignId: campaign.id,
          type: 'mail',
          sent: sentCount,
          failed: failedCount,
          mailMerge: mailService.generateMailMergeCSV(
            pendingOutreach.map(o => ({
              name: o.patientName,
              address: o.patientAddress
            })),
            campaign.CarePlan.description
          )
        });
        return;
      }

      // Update campaign status
      await campaign.update({
        status: 'in_progress',
        sentCount: campaign.sentCount + sentCount
      });

      res.json({
        campaignId: campaign.id,
        sent: sentCount,
        failed: failedCount,
        status: campaign.status
      });
    } catch (error) {
      logger.error('Send campaign error:', error);
      res.status(500).json({ error: 'Failed to send campaign' });
    }
  }
);

/**
 * @swagger
 * /campaigns/{id}/outreach:
 *   get:
 *     summary: Get campaign outreach history
 *     tags: [Campaigns]
 */
router.get('/:id/outreach', authenticate, async (req, res) => {
  try {
    const { status, page = 1, limit = 50 } = req.query;
    
    const campaign = await Campaign.findOne({
      where: {
        id: req.params.id,
        organizationId: req.organizationId
      }
    });

    if (!campaign) {
      return res.status(404).json({ error: 'Campaign not found' });
    }

    const where = { campaignId: campaign.id };
    if (status) where.status = status;

    const outreach = await OutreachHistory.findAndCountAll({
      where,
      order: [['createdAt', 'DESC']],
      limit: parseInt(limit),
      offset: (parseInt(page) - 1) * parseInt(limit)
    });

    res.json({
      total: outreach.count,
      page: parseInt(page),
      limit: parseInt(limit),
      outreach: outreach.rows
    });
  } catch (error) {
    logger.error('Get outreach error:', error);
    res.status(500).json({ error: 'Failed to get outreach history' });
  }
});

/**
 * @swagger
 * /campaigns/{id}/pause:
 *   post:
 *     summary: Pause a campaign
 *     tags: [Campaigns]
 */
router.post('/:id/pause', authenticate, orgAdminOrAbove, async (req, res) => {
  try {
    const campaign = await Campaign.findOne({
      where: {
        id: req.params.id,
        organizationId: req.organizationId
      }
    });

    if (!campaign) {
      return res.status(404).json({ error: 'Campaign not found' });
    }

    await campaign.update({ status: 'paused' });
    res.json({ message: 'Campaign paused', campaign });
  } catch (error) {
    logger.error('Pause campaign error:', error);
    res.status(500).json({ error: 'Failed to pause campaign' });
  }
});

/**
 * @swagger
 * /campaigns/{id}/complete:
 *   post:
 *     summary: Mark campaign as complete
 *     tags: [Campaigns]
 */
router.post('/:id/complete', authenticate, orgAdminOrAbove, async (req, res) => {
  try {
    const campaign = await Campaign.findOne({
      where: {
        id: req.params.id,
        organizationId: req.organizationId
      }
    });

    if (!campaign) {
      return res.status(404).json({ error: 'Campaign not found' });
    }

    await campaign.update({
      status: 'completed',
      completedAt: new Date()
    });

    res.json({ message: 'Campaign completed', campaign });
  } catch (error) {
    logger.error('Complete campaign error:', error);
    res.status(500).json({ error: 'Failed to complete campaign' });
  }
});

module.exports = router;
