const express = require('express');
const router = express.Router();
const { authenticate, auditLog } = require('../middleware/auth');
const EpicFhirService = require('../services/epicFhirService');
const aiService = require('../services/aiService');
const { User, CarePlan } = require('../models');
const logger = require('../utils/logger');

// Middleware to get EPIC service
const getEpicService = async (req, res, next) => {
  try {
    const user = await User.findByPk(req.user.id);
    
    if (!user.epicAccessToken) {
      return res.status(400).json({ error: 'EPIC connection required' });
    }

    const epicService = new EpicFhirService();
    epicService.setAccessToken(user.epicAccessToken);
    req.epicService = epicService;
    next();
  } catch (error) {
    logger.error('Epic service init error:', error);
    res.status(500).json({ error: 'Failed to initialize EPIC service' });
  }
};

/**
 * @swagger
 * /patients:
 *   get:
 *     summary: List patients with filtering
 *     tags: [Patients]
 */
router.get('/', authenticate, getEpicService, async (req, res) => {
  try {
    const { page = 1, limit = 50, search, condition, riskLevel } = req.query;
    
    const params = {
      count: parseInt(limit)
    };

    if (search) {
      params.name = search;
    }

    const patientsBundle = await req.epicService.getPatients(params);
    let patients = (patientsBundle.entry || []).map(entry => ({
      id: entry.resource.id,
      ...req.epicService.extractPatientContactInfo(entry.resource),
      birthDate: entry.resource.birthDate,
      gender: entry.resource.gender
    }));

    // If filtering by condition, fetch conditions for each patient
    if (condition) {
      const filtered = [];
      for (const patient of patients) {
        try {
          const conditions = await req.epicService.getPatientConditions(patient.id);
          const icd10Codes = req.epicService.extractICD10Codes(conditions);
          const hasCondition = icd10Codes.some(c => 
            c.code.startsWith(condition) || c.display.toLowerCase().includes(condition.toLowerCase())
          );
          if (hasCondition) {
            patient.conditions = icd10Codes;
            filtered.push(patient);
          }
        } catch (e) {
          // Skip patients with inaccessible conditions
        }
      }
      patients = filtered;
    }

    res.json({
      total: patientsBundle.total || patients.length,
      page: parseInt(page),
      limit: parseInt(limit),
      patients
    });
  } catch (error) {
    logger.error('List patients error:', error);
    res.status(500).json({ error: 'Failed to list patients' });
  }
});

/**
 * @swagger
 * /patients/{id}:
 *   get:
 *     summary: Get patient details with analysis
 *     tags: [Patients]
 */
router.get('/:id', authenticate, getEpicService, auditLog('VIEW_PATIENT', 'patient'), async (req, res) => {
  try {
    const patientId = req.params.id;
    
    // Fetch patient and all related data
    const [patient, conditions, observations, medications, encounters] = await Promise.all([
      req.epicService.getPatientById(patientId),
      req.epicService.getPatientConditions(patientId),
      req.epicService.getPatientObservations(patientId),
      req.epicService.getPatientMedications(patientId),
      req.epicService.getPatientEncounters(patientId)
    ]);

    const patientInfo = req.epicService.extractPatientContactInfo(patient);
    const icd10Codes = req.epicService.extractICD10Codes(conditions);

    res.json({
      patient: {
        ...patientInfo,
        birthDate: patient.birthDate,
        gender: patient.gender,
        active: patient.active
      },
      conditions: {
        total: conditions.total,
        items: (conditions.entry || []).map(e => ({
          id: e.resource.id,
          code: e.resource.code?.coding?.[0]?.code,
          display: e.resource.code?.coding?.[0]?.display,
          status: e.resource.clinicalStatus?.coding?.[0]?.code,
          onset: e.resource.onsetDateTime
        })),
        icd10Codes
      },
      observations: {
        total: observations.total,
        items: (observations.entry || []).slice(0, 20).map(e => ({
          id: e.resource.id,
          code: e.resource.code?.coding?.[0]?.display,
          value: e.resource.valueQuantity?.value,
          unit: e.resource.valueQuantity?.unit,
          date: e.resource.effectiveDateTime
        }))
      },
      medications: {
        total: medications.total,
        items: (medications.entry || []).map(e => ({
          id: e.resource.id,
          medication: e.resource.medicationCodeableConcept?.coding?.[0]?.display,
          status: e.resource.status,
          dateWritten: e.resource.authoredOn
        }))
      },
      encounters: {
        total: encounters.total,
        items: (encounters.entry || []).slice(0, 10).map(e => ({
          id: e.resource.id,
          type: e.resource.type?.[0]?.coding?.[0]?.display,
          status: e.resource.status,
          date: e.resource.period?.start
        }))
      }
    });
  } catch (error) {
    logger.error('Get patient error:', error);
    res.status(500).json({ error: 'Failed to get patient details' });
  }
});

/**
 * @swagger
 * /patients/{id}/analyze:
 *   post:
 *     summary: AI analysis of patient for care plan matching
 *     tags: [Patients]
 */
router.post('/:id/analyze', authenticate, getEpicService, async (req, res) => {
  try {
    const patientId = req.params.id;
    
    // Fetch patient data
    const [patient, conditions, observations] = await Promise.all([
      req.epicService.getPatientById(patientId),
      req.epicService.getPatientConditions(patientId),
      req.epicService.getPatientObservations(patientId)
    ]);

    const patientInfo = req.epicService.extractPatientContactInfo(patient);
    const icd10Codes = req.epicService.extractICD10Codes(conditions);

    // Get available care plans
    const carePlans = await CarePlan.findAll({
      where: {
        organizationId: req.organizationId,
        isActive: true
      }
    });

    const patientData = {
      id: patientId,
      name: patientInfo.name,
      age: patient.birthDate ? 
        Math.floor((new Date() - new Date(patient.birthDate)) / (365.25 * 24 * 60 * 60 * 1000)) : 
        null,
      gender: patient.gender,
      conditions: icd10Codes.map(c => ({
        code: c.code,
        display: c.display
      })),
      recentObservations: (observations.entry || []).slice(0, 10).map(e => ({
        type: e.resource.code?.coding?.[0]?.display,
        value: e.resource.valueQuantity?.value,
        unit: e.resource.valueQuantity?.unit,
        date: e.resource.effectiveDateTime
      }))
    };

    const availablePlans = carePlans.map(cp => ({
      id: cp.id,
      name: cp.name,
      description: cp.description,
      targetConditions: cp.icd10Codes,
      eligibilityCriteria: cp.eligibilityCriteria
    }));

    // Get AI analysis from both models
    const analysis = await aiService.analyzePatientForCarePlans(patientData, availablePlans);

    res.json({
      patient: patientData,
      analysis
    });
  } catch (error) {
    logger.error('Patient analysis error:', error);
    res.status(500).json({ error: 'Failed to analyze patient' });
  }
});

/**
 * @swagger
 * /patients/{id}/care-gaps:
 *   get:
 *     summary: Identify care gaps for patient
 *     tags: [Patients]
 */
router.get('/:id/care-gaps', authenticate, getEpicService, async (req, res) => {
  try {
    const patientId = req.params.id;
    
    // Fetch comprehensive patient data
    const everything = await req.epicService.getPatientEverything(patientId);
    
    // Standard quality measures to check
    const qualityMeasures = [
      { id: 'awv', name: 'Annual Wellness Visit', interval: '12 months' },
      { id: 'colorectal', name: 'Colorectal Cancer Screening', interval: '10 years', minAge: 45 },
      { id: 'mammogram', name: 'Breast Cancer Screening', interval: '2 years', minAge: 50, gender: 'female' },
      { id: 'flu', name: 'Flu Vaccination', interval: '12 months' },
      { id: 'a1c', name: 'HbA1c Test (Diabetics)', interval: '6 months', requiredCondition: 'E11' },
      { id: 'eye', name: 'Diabetic Eye Exam', interval: '12 months', requiredCondition: 'E11' }
    ];

    // Use AI to identify gaps
    const patientData = {
      resources: everything.entry?.map(e => ({
        type: e.resource.resourceType,
        data: e.resource
      })) || []
    };

    const gapAnalysis = await aiService.identifyCareGaps(patientData, qualityMeasures);

    res.json({
      patientId,
      qualityMeasures,
      analysis: gapAnalysis
    });
  } catch (error) {
    logger.error('Care gaps error:', error);
    res.status(500).json({ error: 'Failed to identify care gaps' });
  }
});

/**
 * @swagger
 * /patients/bulk-analyze:
 *   post:
 *     summary: Analyze multiple patients for care plan matching
 *     tags: [Patients]
 */
router.post('/bulk-analyze', authenticate, getEpicService, async (req, res) => {
  try {
    const { patientIds, carePlanId } = req.body;
    
    if (!patientIds || !Array.isArray(patientIds)) {
      return res.status(400).json({ error: 'patientIds array required' });
    }

    const carePlan = carePlanId ? 
      await CarePlan.findByPk(carePlanId) : 
      null;

    const results = [];
    
    for (const patientId of patientIds.slice(0, 50)) { // Limit to 50
      try {
        const [patient, conditions] = await Promise.all([
          req.epicService.getPatientById(patientId),
          req.epicService.getPatientConditions(patientId)
        ]);

        const icd10Codes = req.epicService.extractICD10Codes(conditions);
        
        // Simple matching based on ICD-10 codes
        let matchScore = 0;
        if (carePlan && carePlan.icd10Codes) {
          const patientCodes = icd10Codes.map(c => c.code);
          const matchedCodes = carePlan.icd10Codes.filter(code =>
            patientCodes.some(pc => pc.startsWith(code.slice(0, 3)))
          );
          matchScore = matchedCodes.length / carePlan.icd10Codes.length * 100;
        }

        results.push({
          patientId,
          name: req.epicService.formatPatientName(patient),
          conditions: icd10Codes.length,
          matchScore: Math.round(matchScore),
          eligible: matchScore > 50
        });
      } catch (error) {
        results.push({
          patientId,
          error: 'Failed to analyze'
        });
      }
    }

    res.json({
      analyzed: results.length,
      results: results.sort((a, b) => (b.matchScore || 0) - (a.matchScore || 0))
    });
  } catch (error) {
    logger.error('Bulk analyze error:', error);
    res.status(500).json({ error: 'Bulk analysis failed' });
  }
});

module.exports = router;
