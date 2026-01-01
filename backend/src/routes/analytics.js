const express = require('express');
const router = express.Router();
const { authenticate, auditLog } = require('../middleware/auth');
const EpicFhirService = require('../services/epicFhirService');
const aiService = require('../services/aiService');
const { User, CarePlan, Campaign, OutreachHistory, ICD10Code } = require('../models');
const { Op } = require('sequelize');
const logger = require('../utils/logger');

/**
 * @swagger
 * /analytics/population:
 *   get:
 *     summary: Get population health analytics
 *     tags: [Analytics]
 */
router.get('/population', authenticate, async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id);
    
    if (!user.epicAccessToken) {
      return res.status(400).json({ error: 'EPIC connection required' });
    }

    const epicService = new EpicFhirService();
    epicService.setAccessToken(user.epicAccessToken);

    // Fetch conditions for population analysis
    const conditions = await epicService.getConditions({ count: 500 });
    const icd10Codes = epicService.extractICD10Codes(conditions);

    // Aggregate statistics
    const codeStats = {};
    const patientSet = new Set();

    for (const code of icd10Codes) {
      patientSet.add(code.patientId);
      
      // Group by chapter (first letter + first 2 digits)
      const chapter = code.code.slice(0, 3);
      if (!codeStats[chapter]) {
        codeStats[chapter] = {
          code: chapter,
          display: code.display,
          count: 0,
          patients: new Set()
        };
      }
      codeStats[chapter].count++;
      codeStats[chapter].patients.add(code.patientId);
    }

    // Convert to array and calculate percentages
    const totalPatients = patientSet.size;
    const topConditions = Object.values(codeStats)
      .map(stat => ({
        code: stat.code,
        display: stat.display,
        occurrences: stat.count,
        patientCount: stat.patients.size,
        prevalence: ((stat.patients.size / totalPatients) * 100).toFixed(1)
      }))
      .sort((a, b) => b.patientCount - a.patientCount)
      .slice(0, 20);

    res.json({
      totalPatients,
      totalConditions: icd10Codes.length,
      uniqueConditions: Object.keys(codeStats).length,
      topConditions
    });
  } catch (error) {
    logger.error('Population analytics error:', error);
    res.status(500).json({ error: 'Failed to get population analytics' });
  }
});

/**
 * @swagger
 * /analytics/risk-stratification:
 *   post:
 *     summary: Perform AI risk stratification on patient population
 *     tags: [Analytics]
 */
router.post('/risk-stratification', authenticate, async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id);
    
    if (!user.epicAccessToken) {
      return res.status(400).json({ error: 'EPIC connection required' });
    }

    const epicService = new EpicFhirService();
    epicService.setAccessToken(user.epicAccessToken);

    // Fetch patient sample
    const patients = await epicService.getPatients({ count: req.body.sampleSize || 100 });
    
    // Collect patient data with conditions
    const patientPopulation = [];
    
    for (const entry of (patients.entry || []).slice(0, 50)) {
      const patient = entry.resource;
      try {
        const conditions = await epicService.getPatientConditions(patient.id);
        const icd10Codes = epicService.extractICD10Codes(conditions);
        
        patientPopulation.push({
          id: patient.id,
          age: patient.birthDate ? 
            Math.floor((new Date() - new Date(patient.birthDate)) / (365.25 * 24 * 60 * 60 * 1000)) : 
            null,
          gender: patient.gender,
          conditionCount: icd10Codes.length,
          conditions: icd10Codes.map(c => c.code).slice(0, 10),
          hasChronicCondition: icd10Codes.some(c => 
            ['E11', 'I10', 'J44', 'I50', 'N18'].some(chronic => c.code.startsWith(chronic))
          )
        });
      } catch (e) {
        // Skip patients with inaccessible data
      }
    }

    // Get AI risk stratification
    const stratification = await aiService.performRiskStratification(patientPopulation);

    res.json({
      sampleSize: patientPopulation.length,
      stratification
    });
  } catch (error) {
    logger.error('Risk stratification error:', error);
    res.status(500).json({ error: 'Risk stratification failed' });
  }
});

/**
 * @swagger
 * /analytics/icd10-patterns:
 *   get:
 *     summary: Analyze ICD-10 code patterns
 *     tags: [Analytics]
 */
router.get('/icd10-patterns', authenticate, async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id);
    
    if (!user.epicAccessToken) {
      return res.status(400).json({ error: 'EPIC connection required' });
    }

    const epicService = new EpicFhirService();
    epicService.setAccessToken(user.epicAccessToken);

    const conditions = await epicService.getConditions({ count: 500 });
    const icd10Codes = epicService.extractICD10Codes(conditions);

    // Group by ICD-10 chapters
    const chapters = {
      'A00-B99': { name: 'Infectious Diseases', count: 0 },
      'C00-D49': { name: 'Neoplasms', count: 0 },
      'D50-D89': { name: 'Blood Diseases', count: 0 },
      'E00-E89': { name: 'Endocrine/Metabolic', count: 0 },
      'F01-F99': { name: 'Mental Disorders', count: 0 },
      'G00-G99': { name: 'Nervous System', count: 0 },
      'H00-H59': { name: 'Eye Diseases', count: 0 },
      'H60-H95': { name: 'Ear Diseases', count: 0 },
      'I00-I99': { name: 'Circulatory System', count: 0 },
      'J00-J99': { name: 'Respiratory System', count: 0 },
      'K00-K95': { name: 'Digestive System', count: 0 },
      'L00-L99': { name: 'Skin Diseases', count: 0 },
      'M00-M99': { name: 'Musculoskeletal', count: 0 },
      'N00-N99': { name: 'Genitourinary', count: 0 },
      'O00-O9A': { name: 'Pregnancy', count: 0 },
      'P00-P96': { name: 'Perinatal', count: 0 },
      'Q00-Q99': { name: 'Congenital', count: 0 },
      'R00-R99': { name: 'Symptoms/Signs', count: 0 },
      'S00-T88': { name: 'Injury/Poisoning', count: 0 },
      'V00-Y99': { name: 'External Causes', count: 0 },
      'Z00-Z99': { name: 'Health Status', count: 0 }
    };

    for (const code of icd10Codes) {
      const firstChar = code.code.charAt(0);
      const num = parseInt(code.code.substring(1, 3));
      
      for (const [range, data] of Object.entries(chapters)) {
        const [start, end] = range.split('-');
        const startChar = start.charAt(0);
        const startNum = parseInt(start.substring(1, 3));
        const endChar = end.charAt(0);
        const endNum = parseInt(end.substring(1, 3));
        
        if (
          (firstChar > startChar || (firstChar === startChar && num >= startNum)) &&
          (firstChar < endChar || (firstChar === endChar && num <= endNum))
        ) {
          data.count++;
          break;
        }
      }
    }

    // Get AI insights
    const icd10Data = {
      totalCodes: icd10Codes.length,
      chapters: Object.entries(chapters)
        .map(([range, data]) => ({ range, ...data }))
        .filter(c => c.count > 0)
        .sort((a, b) => b.count - a.count),
      topCodes: icd10Codes
        .reduce((acc, code) => {
          acc[code.code] = (acc[code.code] || 0) + 1;
          return acc;
        }, {})
    };

    const aiAnalysis = await aiService.analyzeICD10Patterns(icd10Data);

    res.json({
      ...icd10Data,
      aiInsights: aiAnalysis
    });
  } catch (error) {
    logger.error('ICD10 patterns error:', error);
    res.status(500).json({ error: 'Failed to analyze ICD-10 patterns' });
  }
});

/**
 * @swagger
 * /analytics/care-plan-opportunities:
 *   get:
 *     summary: Identify care plan opportunities based on population data
 *     tags: [Analytics]
 */
router.get('/care-plan-opportunities', authenticate, async (req, res) => {
  try {
    // Get organization's care plans
    const carePlans = await CarePlan.findAll({
      where: {
        organizationId: req.organizationId,
        isActive: true
      }
    });

    const user = await User.findByPk(req.user.id);
    
    if (!user.epicAccessToken) {
      // Return mock data if no EPIC connection
      return res.json({
        opportunities: carePlans.map(cp => ({
          carePlan: cp,
          estimatedEligible: 0,
          potentialRevenue: 0,
          note: 'Connect EPIC to see patient counts'
        }))
      });
    }

    const epicService = new EpicFhirService();
    epicService.setAccessToken(user.epicAccessToken);

    // Analyze each care plan
    const opportunities = [];
    
    for (const carePlan of carePlans) {
      let eligibleCount = 0;
      
      // Search for patients with matching conditions
      if (carePlan.icd10Codes && carePlan.icd10Codes.length > 0) {
        // Fetch conditions matching care plan ICD-10 codes
        const conditions = await epicService.getConditions({ count: 200 });
        const icd10Codes = epicService.extractICD10Codes(conditions);
        
        const matchingPatients = new Set();
        for (const code of icd10Codes) {
          const matches = carePlan.icd10Codes.some(cpCode => 
            code.code.startsWith(cpCode.slice(0, 3))
          );
          if (matches && code.patientId) {
            matchingPatients.add(code.patientId);
          }
        }
        eligibleCount = matchingPatients.size;
      }

      opportunities.push({
        carePlan: {
          id: carePlan.id,
          name: carePlan.name,
          category: carePlan.category,
          icd10Codes: carePlan.icd10Codes
        },
        estimatedEligible: eligibleCount,
        potentialRevenue: eligibleCount * (parseFloat(carePlan.costEstimate) || 500),
        matchRate: eligibleCount > 0 ? 'Available' : 'No matches found'
      });
    }

    res.json({
      opportunities: opportunities.sort((a, b) => b.estimatedEligible - a.estimatedEligible)
    });
  } catch (error) {
    logger.error('Care plan opportunities error:', error);
    res.status(500).json({ error: 'Failed to identify opportunities' });
  }
});

/**
 * @swagger
 * /analytics/campaign-performance:
 *   get:
 *     summary: Get campaign performance metrics
 *     tags: [Analytics]
 */
router.get('/campaign-performance', authenticate, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    const where = { organizationId: req.organizationId };
    
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt[Op.gte] = new Date(startDate);
      if (endDate) where.createdAt[Op.lte] = new Date(endDate);
    }

    const campaigns = await Campaign.findAll({
      where,
      include: [CarePlan]
    });

    const outreachStats = await OutreachHistory.findAll({
      where: {
        campaignId: campaigns.map(c => c.id)
      },
      attributes: [
        'campaignId',
        'status',
        [sequelize.fn('COUNT', sequelize.col('id')), 'count']
      ],
      group: ['campaignId', 'status']
    });

    const performance = campaigns.map(campaign => {
      const stats = outreachStats.filter(s => s.campaignId === campaign.id);
      const sent = stats.find(s => s.status === 'sent')?.getDataValue('count') || 0;
      const delivered = stats.find(s => s.status === 'delivered')?.getDataValue('count') || 0;
      const opened = stats.find(s => s.status === 'opened')?.getDataValue('count') || 0;
      const responded = stats.find(s => s.status === 'responded')?.getDataValue('count') || 0;

      return {
        id: campaign.id,
        name: campaign.name,
        carePlan: campaign.CarePlan?.name,
        status: campaign.status,
        metrics: {
          targeted: campaign.patientCount,
          sent: parseInt(sent),
          delivered: parseInt(delivered),
          opened: parseInt(opened),
          responded: parseInt(responded),
          enrolled: campaign.enrollmentCount
        },
        rates: {
          deliveryRate: sent > 0 ? ((delivered / sent) * 100).toFixed(1) : 0,
          openRate: delivered > 0 ? ((opened / delivered) * 100).toFixed(1) : 0,
          responseRate: opened > 0 ? ((responded / opened) * 100).toFixed(1) : 0,
          conversionRate: campaign.patientCount > 0 ? 
            ((campaign.enrollmentCount / campaign.patientCount) * 100).toFixed(1) : 0
        }
      };
    });

    // Aggregate totals
    const totals = performance.reduce((acc, p) => ({
      campaigns: acc.campaigns + 1,
      targeted: acc.targeted + p.metrics.targeted,
      sent: acc.sent + p.metrics.sent,
      delivered: acc.delivered + p.metrics.delivered,
      opened: acc.opened + p.metrics.opened,
      responded: acc.responded + p.metrics.responded,
      enrolled: acc.enrolled + p.metrics.enrolled
    }), { campaigns: 0, targeted: 0, sent: 0, delivered: 0, opened: 0, responded: 0, enrolled: 0 });

    res.json({
      totals,
      campaigns: performance
    });
  } catch (error) {
    logger.error('Campaign performance error:', error);
    res.status(500).json({ error: 'Failed to get campaign performance' });
  }
});

/**
 * @swagger
 * /analytics/dashboard:
 *   get:
 *     summary: Get dashboard summary metrics
 *     tags: [Analytics]
 */
router.get('/dashboard', authenticate, async (req, res) => {
  try {
    const [carePlans, campaigns, outreach] = await Promise.all([
      CarePlan.count({ where: { organizationId: req.organizationId, isActive: true } }),
      Campaign.findAll({
        where: { organizationId: req.organizationId },
        attributes: ['status', 'patientCount', 'enrollmentCount']
      }),
      OutreachHistory.count({
        include: [{
          model: Campaign,
          where: { organizationId: req.organizationId }
        }]
      })
    ]);

    const activeCampaigns = campaigns.filter(c => c.status === 'in_progress').length;
    const totalPatients = campaigns.reduce((sum, c) => sum + (c.patientCount || 0), 0);
    const totalEnrollments = campaigns.reduce((sum, c) => sum + (c.enrollmentCount || 0), 0);

    res.json({
      carePlansActive: carePlans,
      campaignsActive: activeCampaigns,
      campaignsTotal: campaigns.length,
      patientsTargeted: totalPatients,
      outreachSent: outreach,
      enrollments: totalEnrollments,
      conversionRate: totalPatients > 0 ? 
        ((totalEnrollments / totalPatients) * 100).toFixed(1) : 0
    });
  } catch (error) {
    logger.error('Dashboard error:', error);
    res.status(500).json({ error: 'Failed to get dashboard data' });
  }
});

module.exports = router;
