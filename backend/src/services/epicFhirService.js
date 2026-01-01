const axios = require('axios');
const logger = require('../utils/logger');

class EpicFhirService {
  constructor(config = {}) {
    this.baseUrl = config.baseUrl || process.env.EPIC_FHIR_BASE_URL;
    this.clientId = config.clientId || process.env.EPIC_CLIENT_ID;
    this.clientSecret = config.clientSecret || process.env.EPIC_CLIENT_SECRET;
    this.accessToken = config.accessToken || null;
  }

  setAccessToken(token) {
    this.accessToken = token;
  }

  getAuthHeaders() {
    if (!this.accessToken) {
      throw new Error('No access token set');
    }
    return {
      'Authorization': `Bearer ${this.accessToken}`,
      'Accept': 'application/fhir+json',
      'Content-Type': 'application/fhir+json'
    };
  }

  // Get OAuth authorization URL
  getAuthorizationUrl(redirectUri, state, scope) {
    const authUrl = process.env.EPIC_AUTH_URL;
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: this.clientId,
      redirect_uri: redirectUri,
      scope: scope || 'openid fhirUser patient/*.read user/*.read launch',
      state: state,
      aud: this.baseUrl
    });
    
    return `${authUrl}?${params.toString()}`;
  }

  // Exchange authorization code for tokens
  async exchangeCodeForToken(code, redirectUri) {
    const tokenUrl = process.env.EPIC_TOKEN_URL;
    
    const params = new URLSearchParams({
      grant_type: 'authorization_code',
      code: code,
      redirect_uri: redirectUri,
      client_id: this.clientId
    });

    // Add client secret for confidential apps
    if (this.clientSecret) {
      params.append('client_secret', this.clientSecret);
    }

    try {
      const response = await axios.post(tokenUrl, params.toString(), {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      });

      return response.data;
    } catch (error) {
      logger.error('Token exchange failed:', error.response?.data || error.message);
      throw error;
    }
  }

  // Refresh access token
  async refreshToken(refreshToken) {
    const tokenUrl = process.env.EPIC_TOKEN_URL;
    
    const params = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: this.clientId
    });

    if (this.clientSecret) {
      params.append('client_secret', this.clientSecret);
    }

    try {
      const response = await axios.post(tokenUrl, params.toString(), {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      });

      return response.data;
    } catch (error) {
      logger.error('Token refresh failed:', error.response?.data || error.message);
      throw error;
    }
  }

  // Generic FHIR resource fetch
  async getResource(resourceType, params = {}) {
    try {
      const url = `${this.baseUrl}/${resourceType}`;
      const response = await axios.get(url, {
        headers: this.getAuthHeaders(),
        params
      });
      return response.data;
    } catch (error) {
      logger.error(`Failed to fetch ${resourceType}:`, error.response?.data || error.message);
      throw error;
    }
  }

  // Get single resource by ID
  async getResourceById(resourceType, id) {
    try {
      const url = `${this.baseUrl}/${resourceType}/${id}`;
      const response = await axios.get(url, {
        headers: this.getAuthHeaders()
      });
      return response.data;
    } catch (error) {
      logger.error(`Failed to fetch ${resourceType}/${id}:`, error.response?.data || error.message);
      throw error;
    }
  }

  // Get all patients with pagination
  async getPatients(params = {}) {
    const searchParams = {
      _count: params.count || 100,
      ...params
    };
    
    return this.getResource('Patient', searchParams);
  }

  // Get patient by ID
  async getPatientById(patientId) {
    return this.getResourceById('Patient', patientId);
  }

  // Search patients by criteria
  async searchPatients(criteria) {
    const params = {};
    
    if (criteria.name) params.name = criteria.name;
    if (criteria.birthdate) params.birthdate = criteria.birthdate;
    if (criteria.gender) params.gender = criteria.gender;
    if (criteria.identifier) params.identifier = criteria.identifier;
    if (criteria.address) params.address = criteria.address;
    if (criteria.email) params.email = criteria.email;
    if (criteria.phone) params.phone = criteria.phone;
    
    return this.getResource('Patient', params);
  }

  // Get conditions for a patient
  async getPatientConditions(patientId) {
    return this.getResource('Condition', { patient: patientId });
  }

  // Get all conditions (for population analytics)
  async getConditions(params = {}) {
    return this.getResource('Condition', {
      _count: params.count || 100,
      ...params
    });
  }

  // Get observations for a patient
  async getPatientObservations(patientId, category) {
    const params = { patient: patientId };
    if (category) params.category = category;
    return this.getResource('Observation', params);
  }

  // Get medications for a patient
  async getPatientMedications(patientId) {
    return this.getResource('MedicationRequest', { patient: patientId });
  }

  // Get care plans for a patient
  async getPatientCarePlans(patientId) {
    return this.getResource('CarePlan', { patient: patientId });
  }

  // Get encounters for a patient
  async getPatientEncounters(patientId, params = {}) {
    return this.getResource('Encounter', { patient: patientId, ...params });
  }

  // Get all encounters
  async getEncounters(params = {}) {
    return this.getResource('Encounter', {
      _count: params.count || 100,
      ...params
    });
  }

  // Get procedures for a patient
  async getPatientProcedures(patientId) {
    return this.getResource('Procedure', { patient: patientId });
  }

  // Get immunizations for a patient
  async getPatientImmunizations(patientId) {
    return this.getResource('Immunization', { patient: patientId });
  }

  // Get allergies for a patient
  async getPatientAllergies(patientId) {
    return this.getResource('AllergyIntolerance', { patient: patientId });
  }

  // Get diagnostic reports
  async getPatientDiagnosticReports(patientId) {
    return this.getResource('DiagnosticReport', { patient: patientId });
  }

  // Bulk data export (for large datasets)
  async initiateBulkExport(resourceTypes = ['Patient', 'Condition', 'Observation']) {
    try {
      const url = `${this.baseUrl}/$export`;
      const response = await axios.get(url, {
        headers: {
          ...this.getAuthHeaders(),
          'Prefer': 'respond-async'
        },
        params: {
          _type: resourceTypes.join(',')
        }
      });

      // Return the Content-Location header for status polling
      return {
        statusUrl: response.headers['content-location'],
        status: 'initiated'
      };
    } catch (error) {
      logger.error('Bulk export initiation failed:', error.response?.data || error.message);
      throw error;
    }
  }

  // Check bulk export status
  async checkBulkExportStatus(statusUrl) {
    try {
      const response = await axios.get(statusUrl, {
        headers: this.getAuthHeaders()
      });

      if (response.status === 202) {
        return { status: 'in_progress', progress: response.headers['x-progress'] };
      }

      return {
        status: 'complete',
        output: response.data.output
      };
    } catch (error) {
      logger.error('Bulk export status check failed:', error.response?.data || error.message);
      throw error;
    }
  }

  // Get patient everything (comprehensive data)
  async getPatientEverything(patientId) {
    try {
      const url = `${this.baseUrl}/Patient/${patientId}/$everything`;
      const response = await axios.get(url, {
        headers: this.getAuthHeaders()
      });
      return response.data;
    } catch (error) {
      logger.error(`Failed to fetch everything for patient ${patientId}:`, error.response?.data || error.message);
      throw error;
    }
  }

  // Helper to paginate through all results
  async getAllPages(initialBundle) {
    const allEntries = [...(initialBundle.entry || [])];
    let nextUrl = this.getNextPageUrl(initialBundle);

    while (nextUrl) {
      try {
        const response = await axios.get(nextUrl, {
          headers: this.getAuthHeaders()
        });
        const bundle = response.data;
        
        if (bundle.entry) {
          allEntries.push(...bundle.entry);
        }
        
        nextUrl = this.getNextPageUrl(bundle);
      } catch (error) {
        logger.error('Pagination error:', error.message);
        break;
      }
    }

    return allEntries;
  }

  getNextPageUrl(bundle) {
    const nextLink = bundle.link?.find(l => l.relation === 'next');
    return nextLink?.url || null;
  }

  // Extract ICD-10 codes from conditions
  extractICD10Codes(conditions) {
    const codes = [];
    
    for (const entry of (conditions.entry || [])) {
      const condition = entry.resource;
      if (condition.code?.coding) {
        for (const coding of condition.code.coding) {
          if (coding.system?.includes('icd-10') || coding.system?.includes('ICD')) {
            codes.push({
              code: coding.code,
              display: coding.display,
              patientId: condition.subject?.reference?.split('/')[1]
            });
          }
        }
      }
    }
    
    return codes;
  }

  // Get patient contact info for outreach
  extractPatientContactInfo(patient) {
    const info = {
      id: patient.id,
      name: this.formatPatientName(patient),
      email: null,
      phone: null,
      address: null
    };

    // Extract email
    const emailTelecom = patient.telecom?.find(t => t.system === 'email');
    if (emailTelecom) {
      info.email = emailTelecom.value;
    }

    // Extract phone
    const phoneTelecom = patient.telecom?.find(t => t.system === 'phone');
    if (phoneTelecom) {
      info.phone = phoneTelecom.value;
    }

    // Extract address
    if (patient.address?.[0]) {
      const addr = patient.address[0];
      info.address = {
        line: addr.line?.join(', '),
        city: addr.city,
        state: addr.state,
        postalCode: addr.postalCode,
        country: addr.country
      };
    }

    return info;
  }

  formatPatientName(patient) {
    if (!patient.name?.[0]) return 'Unknown';
    const name = patient.name[0];
    const given = name.given?.join(' ') || '';
    const family = name.family || '';
    return `${given} ${family}`.trim();
  }
}

module.exports = EpicFhirService;
