require('dotenv').config();
const bcrypt = require('bcryptjs');
const { sequelize, Organization, User, CarePlan, ICD10Code } = require('../models');
const icd10Codes = require('../data/icd10_codes.json');
const carePlanTemplates = require('../data/care_plan_templates.json');

async function seed() {
  try {
    console.log('Starting database seed...');
    
    // Sync database
    await sequelize.sync({ force: process.env.SEED_FORCE === 'true' });
    console.log('Database synced');

    // Seed ICD-10 codes
    console.log('Seeding ICD-10 codes...');
    for (const code of icd10Codes) {
      await ICD10Code.upsert(code);
    }
    console.log(`Seeded ${icd10Codes.length} ICD-10 codes`);

    // Create demo organization
    console.log('Creating demo organization...');
    const [demoOrg] = await Organization.findOrCreate({
      where: { slug: 'demo-healthcare' },
      defaults: {
        name: 'Demo Healthcare System',
        subscriptionTier: 'professional',
        settings: {
          branding: {
            primaryColor: '#0066cc',
            logo: null
          },
          notifications: {
            emailAlerts: true,
            weeklyReport: true
          }
        }
      }
    });
    console.log('Demo organization created:', demoOrg.id);

    // Create super admin user
    console.log('Creating super admin user...');
    const adminPassword = await bcrypt.hash('admin123!', 12);
    const [adminUser] = await User.findOrCreate({
      where: { email: 'admin@careflow.com' },
      defaults: {
        organizationId: demoOrg.id,
        password: adminPassword,
        firstName: 'System',
        lastName: 'Admin',
        role: 'super_admin'
      }
    });
    console.log('Super admin created:', adminUser.email);

    // Create demo org admin
    console.log('Creating demo org admin...');
    const orgAdminPassword = await bcrypt.hash('demo123!', 12);
    const [orgAdmin] = await User.findOrCreate({
      where: { email: 'demo@careflow.com' },
      defaults: {
        organizationId: demoOrg.id,
        password: orgAdminPassword,
        firstName: 'Demo',
        lastName: 'Admin',
        role: 'org_admin'
      }
    });
    console.log('Org admin created:', orgAdmin.email);

    // Create analyst user
    console.log('Creating analyst user...');
    const analystPassword = await bcrypt.hash('analyst123!', 12);
    const [analyst] = await User.findOrCreate({
      where: { email: 'analyst@careflow.com' },
      defaults: {
        organizationId: demoOrg.id,
        password: analystPassword,
        firstName: 'Data',
        lastName: 'Analyst',
        role: 'analyst'
      }
    });
    console.log('Analyst created:', analyst.email);

    // Seed care plan templates
    console.log('Seeding care plan templates...');
    for (const template of carePlanTemplates) {
      await CarePlan.findOrCreate({
        where: { 
          name: template.name,
          isTemplate: true
        },
        defaults: {
          ...template,
          organizationId: null
        }
      });
    }
    console.log(`Seeded ${carePlanTemplates.length} care plan templates`);

    // Create some org-specific care plans
    console.log('Creating organization care plans...');
    const orgCarePlans = [
      {
        name: 'Diabetes Intensive Management',
        description: 'Enhanced diabetes program with CGM and weekly check-ins',
        category: 'chronic',
        icd10Codes: ['E11.9', 'E11.65'],
        organizationId: demoOrg.id,
        costEstimate: 550,
        duration: '12 months',
        isTemplate: false
      },
      {
        name: 'Post-Surgery Recovery',
        description: 'Care coordination for patients after major surgery',
        category: 'transitions',
        icd10Codes: [],
        organizationId: demoOrg.id,
        costEstimate: 300,
        duration: '90 days',
        isTemplate: false
      }
    ];

    for (const plan of orgCarePlans) {
      await CarePlan.findOrCreate({
        where: { 
          name: plan.name,
          organizationId: demoOrg.id
        },
        defaults: plan
      });
    }
    console.log('Organization care plans created');

    console.log('\n=== Seed Complete ===');
    console.log('Demo credentials:');
    console.log('  Super Admin: admin@careflow.com / admin123!');
    console.log('  Org Admin: demo@careflow.com / demo123!');
    console.log('  Analyst: analyst@careflow.com / analyst123!');
    console.log('========================\n');

    process.exit(0);
  } catch (error) {
    console.error('Seed error:', error);
    process.exit(1);
  }
}

seed();
