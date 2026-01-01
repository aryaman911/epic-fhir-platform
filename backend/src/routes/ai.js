const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const { authenticate, auditLog } = require('../middleware/auth');
const aiService = require('../services/aiService');
const logger = require('../utils/logger');

/**
 * @swagger
 * /ai/analyze:
 *   post:
 *     summary: Get dual AI analysis
 *     tags: [AI]
 */
router.post('/analyze',
  authenticate,
  [body('prompt').notEmpty(), body('systemPrompt').optional()],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { prompt, systemPrompt, selectBest } = req.body;

      const analysis = await aiService.getDualAnalysis(
        prompt,
        systemPrompt || 'You are a helpful healthcare analytics assistant.',
        { selectBest: selectBest !== false }
      );

      res.json(analysis);
    } catch (error) {
      logger.error('AI analyze error:', error);
      res.status(500).json({ error: 'AI analysis failed' });
    }
  }
);

/**
 * @swagger
 * /ai/generate-letter:
 *   post:
 *     summary: Generate patient outreach letter
 *     tags: [AI]
 */
router.post('/generate-letter',
  authenticate,
  [
    body('patientName').notEmpty(),
    body('carePlanName').notEmpty(),
    body('carePlanDescription').optional(),
    body('type').optional().isIn(['mail', 'email'])
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { patientName, carePlanName, carePlanDescription, benefits, type } = req.body;

      const content = await aiService.generateOutreachContent(
        { name: patientName },
        { name: carePlanName, description: carePlanDescription, benefits },
        type || 'mail'
      );

      res.json(content);
    } catch (error) {
      logger.error('Generate letter error:', error);
      res.status(500).json({ error: 'Letter generation failed' });
    }
  }
);

/**
 * @swagger
 * /ai/care-plan-match:
 *   post:
 *     summary: Match patient to care plans using AI
 *     tags: [AI]
 */
router.post('/care-plan-match',
  authenticate,
  [
    body('patientData').isObject(),
    body('carePlans').isArray()
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { patientData, carePlans } = req.body;

      const analysis = await aiService.analyzePatientForCarePlans(patientData, carePlans);

      res.json(analysis);
    } catch (error) {
      logger.error('Care plan match error:', error);
      res.status(500).json({ error: 'Care plan matching failed' });
    }
  }
);

/**
 * @swagger
 * /ai/risk-stratify:
 *   post:
 *     summary: Risk stratify patient population
 *     tags: [AI]
 */
router.post('/risk-stratify',
  authenticate,
  [body('patients').isArray()],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { patients } = req.body;

      const stratification = await aiService.performRiskStratification(patients);

      res.json(stratification);
    } catch (error) {
      logger.error('Risk stratify error:', error);
      res.status(500).json({ error: 'Risk stratification failed' });
    }
  }
);

/**
 * @swagger
 * /ai/icd10-analyze:
 *   post:
 *     summary: Analyze ICD-10 patterns
 *     tags: [AI]
 */
router.post('/icd10-analyze',
  authenticate,
  [body('icd10Data').isObject()],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const analysis = await aiService.analyzeICD10Patterns(req.body.icd10Data);

      res.json(analysis);
    } catch (error) {
      logger.error('ICD10 analyze error:', error);
      res.status(500).json({ error: 'ICD-10 analysis failed' });
    }
  }
);

/**
 * @swagger
 * /ai/care-gaps:
 *   post:
 *     summary: Identify care gaps for patient
 *     tags: [AI]
 */
router.post('/care-gaps',
  authenticate,
  [
    body('patientData').isObject(),
    body('qualityMeasures').optional().isArray()
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { patientData, qualityMeasures } = req.body;

      const defaultMeasures = [
        { id: 'awv', name: 'Annual Wellness Visit', interval: '12 months' },
        { id: 'flu', name: 'Flu Vaccination', interval: '12 months' },
        { id: 'a1c', name: 'HbA1c Test (Diabetics)', interval: '6 months' }
      ];

      const gaps = await aiService.identifyCareGaps(
        patientData,
        qualityMeasures || defaultMeasures
      );

      res.json(gaps);
    } catch (error) {
      logger.error('Care gaps error:', error);
      res.status(500).json({ error: 'Care gap identification failed' });
    }
  }
);

/**
 * @swagger
 * /ai/embedding:
 *   post:
 *     summary: Create text embedding
 *     tags: [AI]
 */
router.post('/embedding',
  authenticate,
  [body('text').notEmpty()],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const embedding = await aiService.createEmbedding(req.body.text);

      res.json({
        embedding,
        dimensions: embedding.length
      });
    } catch (error) {
      logger.error('Embedding error:', error);
      res.status(500).json({ error: 'Embedding creation failed' });
    }
  }
);

/**
 * @swagger
 * /ai/compare:
 *   post:
 *     summary: Compare OpenAI and Claude responses side by side
 *     tags: [AI]
 */
router.post('/compare',
  authenticate,
  [body('prompt').notEmpty()],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { prompt, systemPrompt } = req.body;

      const [openaiResult, claudeResult] = await Promise.allSettled([
        aiService.getOpenAIResponse(
          prompt,
          systemPrompt || 'You are a helpful healthcare assistant.'
        ),
        aiService.getClaudeResponse(
          prompt,
          systemPrompt || 'You are a helpful healthcare assistant.'
        )
      ]);

      res.json({
        openai: openaiResult.status === 'fulfilled' ? openaiResult.value : { error: openaiResult.reason.message },
        claude: claudeResult.status === 'fulfilled' ? claudeResult.value : { error: claudeResult.reason.message }
      });
    } catch (error) {
      logger.error('Compare error:', error);
      res.status(500).json({ error: 'Comparison failed' });
    }
  }
);

module.exports = router;
