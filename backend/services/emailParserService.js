// Real-time Email Parser Service
// Monitors Gmail for insurance estimates and supplement-related emails
const { google } = require('googleapis');
const db = require('./databaseService');
const { notifyCustomerUpdate } = require('./websocketService');

class EmailParserService {
  constructor() {
    this.gmail = null;
    this.isRunning = false;
    this.checkInterval = 2 * 60 * 1000; // 2 minutes
    this.checkTimer = null;
    this.lastCheckTime = null;
  }

  /**
   * Initialize Gmail API
   */
  async initialize() {
    try {
      // Create OAuth2 client
      const auth = new google.auth.OAuth2(
        process.env.GMAIL_CLIENT_ID,
        process.env.GMAIL_CLIENT_SECRET,
        process.env.GMAIL_REDIRECT_URI
      );

      // Set credentials if we have a refresh token
      if (process.env.GMAIL_REFRESH_TOKEN) {
        auth.setCredentials({
          refresh_token: process.env.GMAIL_REFRESH_TOKEN
        });
      }

      this.gmail = google.gmail({ version: 'v1', auth });
      console.log('✅ Gmail API initialized');
    } catch (error) {
      console.error('Gmail API initialization error:', error.message);
    }
  }

  /**
   * Start the real-time email monitoring service
   */
  async start() {
    if (this.isRunning) {
      console.log('Email parser service is already running');
      return;
    }

    console.log('📧 Starting email parser service...');
    await this.initialize();
    this.isRunning = true;
    this.lastCheckTime = new Date();

    // Initial check
    this.checkNewEmails().catch(err => console.error('Initial email check error:', err));

    // Schedule periodic checks
    this.checkTimer = setInterval(() => {
      this.checkNewEmails().catch(err => console.error('Email check error:', err));
    }, this.checkInterval);
  }

  /**
   * Stop the email monitoring service
   */
  stop() {
    if (this.checkTimer) {
      clearInterval(this.checkTimer);
      this.checkTimer = null;
    }
    this.isRunning = false;
    console.log('⏹️  Email parser service stopped');
  }

  /**
   * Check for new emails
   */
  async checkNewEmails() {
    if (!this.gmail) {
      console.log('Gmail not initialized, skipping email check');
      return;
    }

    try {
      console.log('📧 Checking for new emails...');

      // Search for emails from insurance companies and RoofLink
      const queries = [
        'subject:(estimate OR supplement OR claim) newer_than:1d',
        'from:(rooflink.com OR statefarm.com OR allstate.com OR travelers.com) newer_than:1d',
        'subject:(roof OR insurance OR damage) newer_than:1d'
      ];

      let totalProcessed = 0;

      for (const query of queries) {
        const messages = await this.searchEmails(query);
        console.log(`Found ${messages.length} messages for query: ${query}`);

        for (const message of messages) {
          const processed = await this.processEmail(message.id);
          if (processed) totalProcessed++;
        }
      }

      console.log(`✅ Processed ${totalProcessed} new emails`);
      this.lastCheckTime = new Date();

      return totalProcessed;
    } catch (error) {
      console.error('Email check error:', error.message);
      return 0;
    }
  }

  /**
   * Search for emails matching a query
   */
  async searchEmails(query) {
    try {
      const response = await this.gmail.users.messages.list({
        userId: 'me',
        q: query,
        maxResults: 50
      });

      return response.data.messages || [];
    } catch (error) {
      console.error('Email search error:', error.message);
      return [];
    }
  }

  /**
   * Get email details
   */
  async getEmailDetails(messageId) {
    try {
      const response = await this.gmail.users.messages.get({
        userId: 'me',
        id: messageId,
        format: 'full'
      });

      return response.data;
    } catch (error) {
      console.error('Get email error:', error.message);
      return null;
    }
  }

  /**
   * Process a single email
   */
  async processEmail(messageId) {
    try {
      const email = await this.getEmailDetails(messageId);
      if (!email) return false;

      // Extract email data
      const headers = email.payload.headers;
      const subject = headers.find(h => h.name === 'Subject')?.value || '';
      const from = headers.find(h => h.name === 'From')?.value || '';
      const date = headers.find(h => h.name === 'Date')?.value || '';
      const body = this.getEmailBody(email.payload);

      // Parse email content for customer info
      const parsedData = this.parseEmailContent(subject, body);

      // Try to match to existing customer
      const customer = await this.findMatchingCustomer(parsedData);

      if (customer) {
        // Create activity for this email
        await db.createActivity(
          customer.id,
          'email_received',
          `Email from ${from}: ${subject}`,
          email.snippet
        );

        // Update customer with any new info
        if (parsedData.estimate_amount) {
          await db.updateCustomer(customer.id, {
            estimate_total: parsedData.estimate_amount
          });
        }

        // Notify via WebSocket
        const updated = await db.getCustomerById(customer.id);
        notifyCustomerUpdate(updated);

        console.log(`✅ Processed email for customer: ${customer.name}`);
        return true;
      }

      return false;
    } catch (error) {
      console.error('Email processing error:', error.message);
      return false;
    }
  }

  /**
   * Get email body text
   */
  getEmailBody(payload) {
    let body = '';

    if (payload.body && payload.body.data) {
      body = Buffer.from(payload.body.data, 'base64').toString('utf8');
    }

    if (payload.parts) {
      payload.parts.forEach(part => {
        if (part.mimeType === 'text/plain' && part.body.data) {
          body += Buffer.from(part.body.data, 'base64').toString('utf8');
        }
      });
    }

    return body;
  }

  /**
   * Parse email content for relevant data
   */
  parseEmailContent(subject, body) {
    const data = {};

    // Extract job ID
    const jobIdMatch = body.match(/job[:\s#]*(\d{6,})/i) || subject.match(/job[:\s#]*(\d{6,})/i);
    if (jobIdMatch) data.job_id = jobIdMatch[1];

    // Extract claim number
    const claimMatch = body.match(/claim[:\s#]*([A-Z0-9-]+)/i) || subject.match(/claim[:\s#]*([A-Z0-9-]+)/i);
    if (claimMatch) data.claim_number = claimMatch[1];

    // Extract estimate amount
    const amountMatch = body.match(/\$?([\d,]+\.\d{2})/);
    if (amountMatch) {
      data.estimate_amount = parseFloat(amountMatch[1].replace(/,/g, ''));
    }

    // Extract customer name
    const nameMatch = body.match(/(?:for|customer|insured)[:\s]*([A-Z][a-z]+\s+[A-Z][a-z]+)/i);
    if (nameMatch) data.customer_name = nameMatch[1];

    // Extract address
    const addressMatch = body.match(/(\d+\s+[A-Za-z\s]+(?:Street|St|Avenue|Ave|Road|Rd|Drive|Dr|Lane|Ln|Circle|Cir|Court|Ct|Way)[,\s]+[A-Za-z\s]+,\s*[A-Z]{2}\s+\d{5})/i);
    if (addressMatch) data.address = addressMatch[1];

    // Check for supplement keywords
    data.is_supplement = /supplement|additional|revision|change order/i.test(subject + body);

    return data;
  }

  /**
   * Find matching customer in database
   */
  async findMatchingCustomer(parsedData) {
    try {
      // Try by job ID first
      if (parsedData.job_id) {
        const customer = await db.getCustomerByJobId(parsedData.job_id);
        if (customer) return customer;
      }

      // Try by claim number
      if (parsedData.claim_number) {
        const customers = await db.searchCustomers(parsedData.claim_number);
        if (customers.length > 0) return customers[0];
      }

      // Try by customer name
      if (parsedData.customer_name) {
        const customers = await db.searchCustomers(parsedData.customer_name);
        if (customers.length > 0) return customers[0];
      }

      // Try by address
      if (parsedData.address) {
        const customers = await db.searchCustomers(parsedData.address);
        if (customers.length > 0) return customers[0];
      }

      return null;
    } catch (error) {
      console.error('Customer matching error:', error.message);
      return null;
    }
  }

  /**
   * Download email attachments
   */
  async downloadAttachment(messageId, attachmentId) {
    try {
      const response = await this.gmail.users.messages.attachments.get({
        userId: 'me',
        messageId: messageId,
        id: attachmentId
      });

      return Buffer.from(response.data.data, 'base64');
    } catch (error) {
      console.error('Attachment download error:', error.message);
      return null;
    }
  }
}

// Singleton instance
const emailParser = new EmailParserService();

module.exports = emailParser;
