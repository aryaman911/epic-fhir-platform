const sgMail = require('@sendgrid/mail');
const logger = require('../utils/logger');

class MailService {
  constructor() {
    if (process.env.SENDGRID_API_KEY) {
      sgMail.setApiKey(process.env.SENDGRID_API_KEY);
    }
    this.fromEmail = process.env.FROM_EMAIL || 'noreply@careflow.com';
    this.fromName = process.env.FROM_NAME || 'CareFlow Analytics';
  }

  // Send email via SendGrid
  async sendEmail(to, subject, htmlContent, textContent) {
    const msg = {
      to,
      from: {
        email: this.fromEmail,
        name: this.fromName
      },
      subject,
      text: textContent || this.htmlToText(htmlContent),
      html: htmlContent,
      trackingSettings: {
        clickTracking: { enable: true },
        openTracking: { enable: true }
      }
    };

    try {
      const response = await sgMail.send(msg);
      logger.info(`Email sent to ${to}: ${response[0].statusCode}`);
      return {
        success: true,
        messageId: response[0].headers['x-message-id'],
        statusCode: response[0].statusCode
      };
    } catch (error) {
      logger.error('SendGrid error:', error.response?.body || error.message);
      throw error;
    }
  }

  // Send batch emails
  async sendBatchEmails(emails) {
    const results = [];
    const batchSize = 100; // SendGrid limit

    for (let i = 0; i < emails.length; i += batchSize) {
      const batch = emails.slice(i, i + batchSize);
      
      try {
        await sgMail.send(batch.map(email => ({
          to: email.to,
          from: { email: this.fromEmail, name: this.fromName },
          subject: email.subject,
          html: email.html,
          text: email.text,
          customArgs: { campaignId: email.campaignId, patientId: email.patientId }
        })));

        results.push({ batch: i / batchSize, success: true, count: batch.length });
      } catch (error) {
        logger.error(`Batch ${i / batchSize} failed:`, error.message);
        results.push({ batch: i / batchSize, success: false, error: error.message });
      }

      // Rate limiting
      if (i + batchSize < emails.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    return results;
  }

  // Generate physical mail content (for printing/mailing service integration)
  generateMailContent(patientInfo, content, options = {}) {
    const date = new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    const letterhead = options.letterhead || {
      organizationName: 'Healthcare Organization',
      address: '123 Medical Center Drive',
      city: 'Healthcare City',
      state: 'HC',
      zip: '12345',
      phone: '(555) 123-4567'
    };

    const letter = `
${letterhead.organizationName}
${letterhead.address}
${letterhead.city}, ${letterhead.state} ${letterhead.zip}
Phone: ${letterhead.phone}

${date}

${patientInfo.name}
${patientInfo.address?.line || ''}
${patientInfo.address?.city || ''}, ${patientInfo.address?.state || ''} ${patientInfo.address?.postalCode || ''}

Dear ${patientInfo.name.split(' ')[0]},

${content}

Sincerely,

${options.senderName || 'Your Care Team'}
${options.senderTitle || 'Care Coordination'}
${letterhead.organizationName}

---
If you have questions, please call us at ${letterhead.phone}.
To opt out of future mailings, reply to this letter or call the number above.
`;

    return {
      plainText: letter,
      html: this.textToHtml(letter),
      recipient: patientInfo,
      date
    };
  }

  // Generate mail merge data for bulk physical mail
  generateMailMergeCSV(patients, content) {
    const headers = [
      'FirstName', 'LastName', 'AddressLine1', 'AddressLine2',
      'City', 'State', 'ZipCode', 'Content', 'Date'
    ];

    const rows = patients.map(patient => {
      const nameParts = patient.name.split(' ');
      return [
        nameParts[0] || '',
        nameParts.slice(1).join(' ') || '',
        patient.address?.line || '',
        '',
        patient.address?.city || '',
        patient.address?.state || '',
        patient.address?.postalCode || '',
        content.replace(/"/g, '""'),
        new Date().toLocaleDateString()
      ].map(field => `"${field}"`).join(',');
    });

    return [headers.join(','), ...rows].join('\n');
  }

  // Convert HTML to plain text
  htmlToText(html) {
    return html
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n\n')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  // Convert plain text to basic HTML
  textToHtml(text) {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\n\n/g, '</p><p>')
      .replace(/\n/g, '<br>')
      .replace(/^/, '<p>')
      .replace(/$/, '</p>');
  }

  // Email templates
  getTemplate(templateName, variables) {
    const templates = {
      carePlanInvitation: `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #0066cc; color: white; padding: 20px; text-align: center; }
    .content { padding: 20px; background: #f9f9f9; }
    .cta { text-align: center; margin: 20px 0; }
    .cta a { background: #0066cc; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; }
    .footer { text-align: center; padding: 20px; font-size: 12px; color: #666; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>${variables.organizationName || 'Healthcare Partner'}</h1>
    </div>
    <div class="content">
      <p>Dear ${variables.patientName},</p>
      <p>${variables.content}</p>
      <div class="cta">
        <a href="${variables.ctaUrl || '#'}">Learn More</a>
      </div>
    </div>
    <div class="footer">
      <p>${variables.organizationName} | ${variables.organizationAddress || ''}</p>
      <p><a href="${variables.unsubscribeUrl || '#'}">Unsubscribe</a></p>
    </div>
  </div>
</body>
</html>
`,
      reminderEmail: `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .alert { background: #fff3cd; border: 1px solid #ffc107; padding: 15px; border-radius: 4px; }
  </style>
</head>
<body>
  <div class="container">
    <h2>Reminder: ${variables.subject}</h2>
    <div class="alert">
      <p>${variables.reminderText}</p>
    </div>
    <p>${variables.content}</p>
    <p>Best regards,<br>${variables.senderName || 'Your Care Team'}</p>
  </div>
</body>
</html>
`
    };

    return templates[templateName] || templates.carePlanInvitation;
  }

  // Validate email address
  isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  // Schedule email for later
  async scheduleEmail(emailData, sendAt) {
    const sendTimestamp = Math.floor(new Date(sendAt).getTime() / 1000);
    
    const msg = {
      ...emailData,
      sendAt: sendTimestamp
    };

    try {
      const response = await sgMail.send(msg);
      return {
        success: true,
        scheduledFor: sendAt,
        messageId: response[0].headers['x-message-id']
      };
    } catch (error) {
      logger.error('Schedule email error:', error.message);
      throw error;
    }
  }
}

module.exports = new MailService();
