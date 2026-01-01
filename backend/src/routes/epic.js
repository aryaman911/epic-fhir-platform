const express = require('express');
const router = express.Router();
const { authenticate, auditLog } = require('../middleware/auth');
const EpicFhirService = require('../services/epicFhirService');
const { User } = require('../models');
const logger = require('../utils/logger');

// Middleware to ensure EPIC connection
const requireEpicConnection = async (req, res, next) => {
  const user = await User.findByPk(req.user.id);
  
  if (!user.epicAccessToken) {
    return res.status(400).json({ 
      error: 'EPIC connection required',
      action: 'connect_epic'
    });
  }

  // Check token expiry
  if (user.epicTokenExpiry && new Date(user.epicTokenExpiry) < new Date()) {
    // Try to refresh token
    if (user.epicRefreshToken) {
      try {
        const epicService = new EpicFhirService();
        const tokens = await epicService.refreshToken(user.epicRefreshToken);
        
        await user.update({
          epicAccessToken: tokens.access_token,
          epicRefreshToken: tokens.refresh_token || user.epicRefreshToken,
          epicTokenExpiry: new Date(Date.now() + tokens.expires_in * 1000)
        });
        
        req.epicAccessToken = tokens.access_token;
      } catch (error) {
        logger.error('Token refresh failed:', error);
        return res.status(401).json({ 
          error: 'EPIC session expired',
          action: 'reconnect_epic'
        });
      }
    } else {
      return res.status(401).json({ 
        error: 'EPIC session expired',
        action: 'reconnect_epic'
      });
    }
  } else {
    req.epicAccessToken = user.epicAccessToken;
  }

  next();
};

/**
 * @swagger
 * /epic/connection-status:
 *   get:
 *     summary: Check EPIC connection status
 *     tags: [EPIC]
 *     security:
 *       - bearerAuth: []
 */
router.get('/connection-status', authenticate, async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id);
    
    const status = {
      connected: !!user.epicAccessToken,
      tokenExpiry: user.epicTokenExpiry,
      isExpired: user.epicTokenExpiry ? new Date(user.epicTokenExpiry) < new Date() : true
    };

    res.json(status);
  } catch (error) {
    logger.error('Connection status error:', error);
    res.status(500).json({ error: 'Failed to check connection status' });
  }
});

/**
 * @swagger
 * /epic/patients:
 *   get:
 *     summary: Get patients from EPIC
 *     tags: [EPIC]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: count
 *         schema:
 *           type: integer
 *         description: Number of patients to fetch
 */
router.get('/patients', 
  authenticate, 
  requireEpicConnection,
  auditLog('FETCH_PATIENTS', 'epic_patient'),
  async (req, res) => {
    try {
      const epicService = new EpicFhirService();
      epicService.setAccessToken(req.epicAccessToken);

      const params = {
        count: req.query.count || 50
      };

      if (req.query.name) params.name = req.query.name;
      if (req.query.birthdate) params.birthdate = req.query.birthdate;
      if (req.query.gender) params.gender = req.query.gender;

      const patients = await epicService.getPatients(params);
      
      // Transform for frontend
      const transformedPatients = (patients.entry || []).map(entry => {
        const patient = entry.resource;
        return {
          id: patient.id,
          ...epicService.extractPatientContactInfo(patient),
          birthDate: patient.birthDate,
          gender: patient.gender,
          active: patient.active
        };
      });

      res.json({
        total: patients.total,
        patients: transformedPatients,
        nextPageUrl: epicService.getNextPageUrl(patients)
      });
    } catch (error) {
      logger.error('Fetch patients error:', error);
      res.status(500).json({ error: 'Failed to fetch patients' });
    }
  }
);

/**
 * @swagger
 * /epic/patients/{id}:
 *   get:
 *     summary: Get single patient by ID
 *     tags: [EPIC]
 */
router.get('/patients/:id',
  authenticate,
  requireEpicConnection,
  auditLog('FETCH_PATIENT', 'epic_patient'),
  async (req, res) => {
    try {
      const epicService = new EpicFhirService();
      epicService.setAccessToken(req.epicAccessToken);

      const patient = await epicService.getPatientById(req.params.id);
      
      res.json({
        ...epicService.extractPatientContactInfo(patient),
        birthDate: patient.birthDate,
        gender: patient.gender,
        active: patient.active,
        raw: patient
      });
    } catch (error) {
      logger.error('Fetch patient error:', error);
      res.status(500).json({ error: 'Failed to fetch patient' });
    }
  }
);

/**
 * @swagger
 * /epic/patients/{id}/conditions:
 *   get:
 *     summary: Get conditions for a patient
 *     tags: [EPIC]
 */
router.get('/patients/:id/conditions',
  authenticate,
  requireEpicConnection,
  async (req, res) => {
    try {
      const epicService = new EpicFhirService();
      epicService.setAccessToken(req.epicAccessToken);

      const conditions = await epicService.getPatientConditions(req.params.id);
      const icd10Codes = epicService.extractICD10Codes(conditions);

      res.json({
        total: conditions.total,
        conditions: (conditions.entry || []).map(e => ({
          id: e.resource.id,
          code: e.resource.code?.coding?.[0]?.code,
          display: e.resource.code?.coding?.[0]?.display,
          clinicalStatus: e.resource.clinicalStatus?.coding?.[0]?.code,
          onsetDateTime: e.resource.onsetDateTime,
          recordedDate: e.resource.recordedDate
        })),
        icd10Codes
      });
    } catch (error) {
      logger.error('Fetch conditions error:', error);
      res.status(500).json({ error: 'Failed to fetch conditions' });
    }
  }
);

/**
 * @swagger
 * /epic/patients/{id}/everything:
 *   get:
 *     summary: Get all data for a patient
 *     tags: [EPIC]
 */
router.get('/patients/:id/everything',
  authenticate,
  requireEpicConnection,
  auditLog('FETCH_PATIENT_EVERYTHING', 'epic_patient'),
  async (req, res) => {
    try {
      const epicService = new EpicFhirService();
      epicService.setAccessToken(req.epicAccessToken);

      const everything = await epicService.getPatientEverything(req.params.id);
      
      // Categorize resources
      const categorized = {
        patient: null,
        conditions: [],
        observations: [],
        medications: [],
        encounters: [],
        procedures: [],
        immunizations: [],
        allergies: [],
        carePlans: [],
        other: []
      };

      for (const entry of (everything.entry || [])) {
        const resource = entry.resource;
        switch (resource.resourceType) {
          case 'Patient':
            categorized.patient = resource;
            break;
          case 'Condition':
            categorized.conditions.push(resource);
            break;
          case 'Observation':
            categorized.observations.push(resource);
            break;
          case 'MedicationRequest':
          case 'MedicationStatement':
            categorized.medications.push(resource);
            break;
          case 'Encounter':
            categorized.encounters.push(resource);
            break;
          case 'Procedure':
            categorized.procedures.push(resource);
            break;
          case 'Immunization':
            categorized.immunizations.push(resource);
            break;
          case 'AllergyIntolerance':
            categorized.allergies.push(resource);
            break;
          case 'CarePlan':
            categorized.carePlans.push(resource);
            break;
          default:
            categorized.other.push(resource);
        }
      }

      res.json(categorized);
    } catch (error) {
      logger.error('Fetch everything error:', error);
      res.status(500).json({ error: 'Failed to fetch patient data' });
    }
  }
);

/**
 * @swagger
 * /epic/conditions:
 *   get:
 *     summary: Get all conditions (for population analytics)
 *     tags: [EPIC]
 */
router.get('/conditions',
  authenticate,
  requireEpicConnection,
  async (req, res) => {
    try {
      const epicService = new EpicFhirService();
      epicService.setAccessToken(req.epicAccessToken);

      const conditions = await epicService.getConditions({
        count: req.query.count || 100,
        ...req.query
      });

      const icd10Codes = epicService.extractICD10Codes(conditions);

      // Aggregate by ICD-10 code
      const codeFrequency = {};
      for (const code of icd10Codes) {
        if (!codeFrequency[code.code]) {
          codeFrequency[code.code] = {
            code: code.code,
            display: code.display,
            count: 0,
            patients: []
          };
        }
        codeFrequency[code.code].count++;
        if (!codeFrequency[code.code].patients.includes(code.patientId)) {
          codeFrequency[code.code].patients.push(code.patientId);
        }
      }

      res.json({
        total: conditions.total,
        codeFrequency: Object.values(codeFrequency).sort((a, b) => b.count - a.count),
        raw: conditions
      });
    } catch (error) {
      logger.error('Fetch conditions error:', error);
      res.status(500).json({ error: 'Failed to fetch conditions' });
    }
  }
);

/**
 * @swagger
 * /epic/bulk-export:
 *   post:
 *     summary: Initiate bulk data export
 *     tags: [EPIC]
 */
router.post('/bulk-export',
  authenticate,
  requireEpicConnection,
  auditLog('INITIATE_BULK_EXPORT', 'epic_bulk'),
  async (req, res) => {
    try {
      const epicService = new EpicFhirService();
      epicService.setAccessToken(req.epicAccessToken);

      const resourceTypes = req.body.resourceTypes || ['Patient', 'Condition', 'Observation'];
      const result = await epicService.initiateBulkExport(resourceTypes);

      res.json(result);
    } catch (error) {
      logger.error('Bulk export error:', error);
      res.status(500).json({ error: 'Failed to initiate bulk export' });
    }
  }
);

/**
 * @swagger
 * /epic/bulk-export/status:
 *   get:
 *     summary: Check bulk export status
 *     tags: [EPIC]
 */
router.get('/bulk-export/status',
  authenticate,
  requireEpicConnection,
  async (req, res) => {
    try {
      const { statusUrl } = req.query;
      
      if (!statusUrl) {
        return res.status(400).json({ error: 'statusUrl required' });
      }

      const epicService = new EpicFhirService();
      epicService.setAccessToken(req.epicAccessToken);

      const status = await epicService.checkBulkExportStatus(statusUrl);
      res.json(status);
    } catch (error) {
      logger.error('Bulk export status error:', error);
      res.status(500).json({ error: 'Failed to check export status' });
    }
  }
);

/**
 * @swagger
 * /epic/search:
 *   post:
 *     summary: Advanced patient search
 *     tags: [EPIC]
 */
router.post('/search',
  authenticate,
  requireEpicConnection,
  async (req, res) => {
    try {
      const epicService = new EpicFhirService();
      epicService.setAccessToken(req.epicAccessToken);

      const patients = await epicService.searchPatients(req.body);
      
      const transformedPatients = (patients.entry || []).map(entry => {
        const patient = entry.resource;
        return {
          id: patient.id,
          ...epicService.extractPatientContactInfo(patient),
          birthDate: patient.birthDate,
          gender: patient.gender
        };
      });

      res.json({
        total: patients.total,
        patients: transformedPatients
      });
    } catch (error) {
      logger.error('Search error:', error);
      res.status(500).json({ error: 'Search failed' });
    }
  }
);

module.exports = router;
