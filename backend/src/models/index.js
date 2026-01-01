const { Sequelize, DataTypes } = require('sequelize');

const sequelize = new Sequelize(process.env.DATABASE_URL, {
  dialect: 'postgres',
  logging: process.env.NODE_ENV === 'development' ? console.log : false,
  dialectOptions: {
    ssl: process.env.NODE_ENV === 'production' ? {
      require: true,
      rejectUnauthorized: false
    } : false
  },
  pool: {
    max: 5,
    min: 0,
    acquire: 30000,
    idle: 10000
  }
});

// Organization Model (B2B Tenants)
const Organization = sequelize.define('Organization', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false
  },
  slug: {
    type: DataTypes.STRING,
    unique: true,
    allowNull: false
  },
  epicClientId: {
    type: DataTypes.STRING,
    field: 'epic_client_id'
  },
  epicClientSecret: {
    type: DataTypes.STRING,
    field: 'epic_client_secret'
  },
  epicFhirBaseUrl: {
    type: DataTypes.STRING,
    field: 'epic_fhir_base_url',
    defaultValue: 'https://fhir.epic.com/interconnect-fhir-oauth/api/FHIR/R4'
  },
  subscriptionTier: {
    type: DataTypes.ENUM('free', 'starter', 'professional', 'enterprise'),
    field: 'subscription_tier',
    defaultValue: 'free'
  },
  settings: {
    type: DataTypes.JSONB,
    defaultValue: {}
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    field: 'is_active',
    defaultValue: true
  }
}, {
  tableName: 'organizations',
  timestamps: true,
  underscored: true
});

// User Model
const User = sequelize.define('User', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  organizationId: {
    type: DataTypes.UUID,
    field: 'organization_id',
    references: {
      model: 'organizations',
      key: 'id'
    }
  },
  email: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
    validate: {
      isEmail: true
    }
  },
  password: {
    type: DataTypes.STRING,
    allowNull: false
  },
  firstName: {
    type: DataTypes.STRING,
    field: 'first_name'
  },
  lastName: {
    type: DataTypes.STRING,
    field: 'last_name'
  },
  role: {
    type: DataTypes.ENUM('super_admin', 'org_admin', 'analyst', 'viewer'),
    defaultValue: 'viewer'
  },
  epicAccessToken: {
    type: DataTypes.TEXT,
    field: 'epic_access_token'
  },
  epicRefreshToken: {
    type: DataTypes.TEXT,
    field: 'epic_refresh_token'
  },
  epicTokenExpiry: {
    type: DataTypes.DATE,
    field: 'epic_token_expiry'
  },
  lastLogin: {
    type: DataTypes.DATE,
    field: 'last_login'
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    field: 'is_active',
    defaultValue: true
  }
}, {
  tableName: 'users',
  timestamps: true,
  underscored: true
});

// Care Plan Model
const CarePlan = sequelize.define('CarePlan', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  organizationId: {
    type: DataTypes.UUID,
    field: 'organization_id',
    references: {
      model: 'organizations',
      key: 'id'
    }
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false
  },
  description: {
    type: DataTypes.TEXT
  },
  category: {
    type: DataTypes.STRING
  },
  icd10Codes: {
    type: DataTypes.ARRAY(DataTypes.STRING),
    field: 'icd10_codes',
    defaultValue: []
  },
  eligibilityCriteria: {
    type: DataTypes.JSONB,
    field: 'eligibility_criteria',
    defaultValue: {}
  },
  interventions: {
    type: DataTypes.JSONB,
    defaultValue: []
  },
  outcomes: {
    type: DataTypes.JSONB,
    defaultValue: []
  },
  costEstimate: {
    type: DataTypes.DECIMAL(10, 2),
    field: 'cost_estimate'
  },
  duration: {
    type: DataTypes.STRING
  },
  isTemplate: {
    type: DataTypes.BOOLEAN,
    field: 'is_template',
    defaultValue: false
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    field: 'is_active',
    defaultValue: true
  }
}, {
  tableName: 'care_plans',
  timestamps: true,
  underscored: true
});

// Campaign Model
const Campaign = sequelize.define('Campaign', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  organizationId: {
    type: DataTypes.UUID,
    field: 'organization_id',
    references: {
      model: 'organizations',
      key: 'id'
    }
  },
  carePlanId: {
    type: DataTypes.UUID,
    field: 'care_plan_id',
    references: {
      model: 'care_plans',
      key: 'id'
    }
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false
  },
  description: {
    type: DataTypes.TEXT
  },
  type: {
    type: DataTypes.ENUM('email', 'mail', 'sms', 'phone'),
    defaultValue: 'mail'
  },
  status: {
    type: DataTypes.ENUM('draft', 'scheduled', 'in_progress', 'completed', 'paused', 'cancelled'),
    defaultValue: 'draft'
  },
  targetCriteria: {
    type: DataTypes.JSONB,
    field: 'target_criteria',
    defaultValue: {}
  },
  patientCount: {
    type: DataTypes.INTEGER,
    field: 'patient_count',
    defaultValue: 0
  },
  sentCount: {
    type: DataTypes.INTEGER,
    field: 'sent_count',
    defaultValue: 0
  },
  responseCount: {
    type: DataTypes.INTEGER,
    field: 'response_count',
    defaultValue: 0
  },
  enrollmentCount: {
    type: DataTypes.INTEGER,
    field: 'enrollment_count',
    defaultValue: 0
  },
  scheduledAt: {
    type: DataTypes.DATE,
    field: 'scheduled_at'
  },
  completedAt: {
    type: DataTypes.DATE,
    field: 'completed_at'
  },
  createdBy: {
    type: DataTypes.UUID,
    field: 'created_by'
  }
}, {
  tableName: 'campaigns',
  timestamps: true,
  underscored: true
});

// Outreach History Model
const OutreachHistory = sequelize.define('OutreachHistory', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  campaignId: {
    type: DataTypes.UUID,
    field: 'campaign_id',
    references: {
      model: 'campaigns',
      key: 'id'
    }
  },
  patientFhirId: {
    type: DataTypes.STRING,
    field: 'patient_fhir_id',
    allowNull: false
  },
  patientName: {
    type: DataTypes.STRING,
    field: 'patient_name'
  },
  patientEmail: {
    type: DataTypes.STRING,
    field: 'patient_email'
  },
  patientAddress: {
    type: DataTypes.JSONB,
    field: 'patient_address'
  },
  contentOpenAI: {
    type: DataTypes.TEXT,
    field: 'content_openai'
  },
  contentClaude: {
    type: DataTypes.TEXT,
    field: 'content_claude'
  },
  selectedContent: {
    type: DataTypes.TEXT,
    field: 'selected_content'
  },
  aiAnalysis: {
    type: DataTypes.JSONB,
    field: 'ai_analysis'
  },
  status: {
    type: DataTypes.ENUM('pending', 'sent', 'delivered', 'opened', 'responded', 'bounced', 'failed'),
    defaultValue: 'pending'
  },
  sentAt: {
    type: DataTypes.DATE,
    field: 'sent_at'
  },
  deliveredAt: {
    type: DataTypes.DATE,
    field: 'delivered_at'
  },
  openedAt: {
    type: DataTypes.DATE,
    field: 'opened_at'
  },
  respondedAt: {
    type: DataTypes.DATE,
    field: 'responded_at'
  }
}, {
  tableName: 'outreach_history',
  timestamps: true,
  underscored: true
});

// ICD10 Codes Reference Model
const ICD10Code = sequelize.define('ICD10Code', {
  code: {
    type: DataTypes.STRING,
    primaryKey: true
  },
  description: {
    type: DataTypes.TEXT
  },
  category: {
    type: DataTypes.STRING
  },
  chapter: {
    type: DataTypes.STRING
  },
  isChronicCondition: {
    type: DataTypes.BOOLEAN,
    field: 'is_chronic_condition',
    defaultValue: false
  },
  riskWeight: {
    type: DataTypes.DECIMAL(3, 2),
    field: 'risk_weight',
    defaultValue: 1.0
  }
}, {
  tableName: 'icd10_codes',
  timestamps: false
});

// Audit Log Model
const AuditLog = sequelize.define('AuditLog', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  userId: {
    type: DataTypes.UUID,
    field: 'user_id'
  },
  organizationId: {
    type: DataTypes.UUID,
    field: 'organization_id'
  },
  action: {
    type: DataTypes.STRING,
    allowNull: false
  },
  resource: {
    type: DataTypes.STRING
  },
  resourceId: {
    type: DataTypes.STRING,
    field: 'resource_id'
  },
  details: {
    type: DataTypes.JSONB,
    defaultValue: {}
  },
  ipAddress: {
    type: DataTypes.STRING,
    field: 'ip_address'
  },
  userAgent: {
    type: DataTypes.TEXT,
    field: 'user_agent'
  }
}, {
  tableName: 'audit_logs',
  timestamps: true,
  underscored: true,
  updatedAt: false
});

// Define relationships
Organization.hasMany(User, { foreignKey: 'organizationId' });
User.belongsTo(Organization, { foreignKey: 'organizationId' });

Organization.hasMany(CarePlan, { foreignKey: 'organizationId' });
CarePlan.belongsTo(Organization, { foreignKey: 'organizationId' });

Organization.hasMany(Campaign, { foreignKey: 'organizationId' });
Campaign.belongsTo(Organization, { foreignKey: 'organizationId' });

CarePlan.hasMany(Campaign, { foreignKey: 'carePlanId' });
Campaign.belongsTo(CarePlan, { foreignKey: 'carePlanId' });

Campaign.hasMany(OutreachHistory, { foreignKey: 'campaignId' });
OutreachHistory.belongsTo(Campaign, { foreignKey: 'campaignId' });

module.exports = {
  sequelize,
  Organization,
  User,
  CarePlan,
  Campaign,
  OutreachHistory,
  ICD10Code,
  AuditLog
};
