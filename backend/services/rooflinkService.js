const https = require('https');
const http = require('http');

class RoofLinkService {
  constructor() {
    this.apiKey = process.env.ROOFLINK_API_KEY;
    this.apiUrl = 'https://integrate.rooflink.com';
    this.companyId = process.env.COMPANY_ID || '0000';
    this.companyName = process.env.COMPANY_NAME || 'demo';
  }

  // Make HTTP request to RoofLink API
  async makeRequest(endpoint, method = 'GET', data = null) {
    return new Promise((resolve, reject) => {
      const url = new URL(endpoint, this.apiUrl);

      const options = {
        hostname: url.hostname,
        port: url.port || 443,
        path: url.pathname + url.search,
        method: method,
        headers: {
          'X-API-KEY': this.apiKey,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      };

      if (data && method !== 'GET') {
        const postData = JSON.stringify(data);
        options.headers['Content-Length'] = Buffer.byteLength(postData);
      }

      const protocol = url.protocol === 'https:' ? https : http;

      const req = protocol.request(options, (res) => {
        let responseData = '';

        res.on('data', (chunk) => {
          responseData += chunk;
        });

        res.on('end', () => {
          try {
            const parsed = JSON.parse(responseData);
            if (res.statusCode >= 200 && res.statusCode < 300) {
              resolve(parsed);
            } else {
              reject(new Error(`RoofLink API error: ${res.statusCode} - ${responseData}`));
            }
          } catch (err) {
            reject(new Error(`Failed to parse RoofLink response: ${err.message}`));
          }
        });
      });

      req.on('error', (error) => {
        reject(new Error(`RoofLink request failed: ${error.message}`));
      });

      if (data && method !== 'GET') {
        req.write(JSON.stringify(data));
      }

      req.end();
    });
  }

  // Get all jobs (customers) from RoofLink
  async getAllLeads() {
    try {
      console.log('Fetching jobs from RoofLink...');
      // Use the jobs endpoint from the API
      const endpoint = `/roof_link_endpoints/api/light/jobs/?page_size=100`;
      const response = await this.makeRequest(endpoint);
      const results = response.results || response;
      console.log(`Retrieved ${results.length || 0} jobs from RoofLink`);
      return results;
    } catch (error) {
      console.error('Error fetching RoofLink jobs:', error.message);
      throw error;
    }
  }

  // Get specific lead by ID
  async getLeadById(leadId) {
    try {
      const endpoint = `/api/leads/${leadId}?company_id=${this.companyId}`;
      const response = await this.makeRequest(endpoint);
      return response.data || response;
    } catch (error) {
      console.error(`Error fetching lead ${leadId}:`, error.message);
      throw error;
    }
  }

  // Search leads by criteria
  async searchLeads(criteria) {
    try {
      const params = new URLSearchParams({
        company_id: this.companyId,
        ...criteria
      });
      const endpoint = `/api/leads/search?${params.toString()}`;
      const response = await this.makeRequest(endpoint);
      return response.data || response;
    } catch (error) {
      console.error('Error searching RoofLink leads:', error.message);
      throw error;
    }
  }

  // Get lead activities/timeline
  async getLeadActivities(leadId) {
    try {
      const endpoint = `/api/leads/${leadId}/activities?company_id=${this.companyId}`;
      const response = await this.makeRequest(endpoint);
      return response.data || response;
    } catch (error) {
      console.error(`Error fetching activities for lead ${leadId}:`, error.message);
      return [];
    }
  }

  // Add new lead to RoofLink
  async addLead(leadData) {
    try {
      const endpoint = `/api/guest/add_lead?company_id=${this.companyId}&company_abr=${this.companyName}`;
      const response = await this.makeRequest(endpoint, 'POST', leadData);
      console.log('Lead added to RoofLink:', response);
      return response;
    } catch (error) {
      console.error('Error adding lead to RoofLink:', error.message);
      throw error;
    }
  }

  // Update lead in RoofLink
  async updateLead(leadId, updateData) {
    try {
      const endpoint = `/api/leads/${leadId}?company_id=${this.companyId}`;
      const response = await this.makeRequest(endpoint, 'PUT', updateData);
      console.log(`Lead ${leadId} updated in RoofLink`);
      return response;
    } catch (error) {
      console.error(`Error updating lead ${leadId}:`, error.message);
      throw error;
    }
  }

  // Get lead photos/attachments
  async getLeadPhotos(leadId) {
    try {
      const endpoint = `/api/leads/${leadId}/photos?company_id=${this.companyId}`;
      const response = await this.makeRequest(endpoint);
      return response.data || response;
    } catch (error) {
      console.error(`Error fetching photos for lead ${leadId}:`, error.message);
      return [];
    }
  }

  // Transform RoofLink lead to our customer format
  transformLeadToCustomer(lead) {
    return {
      name: lead.name || `${lead.first_name || ''} ${lead.last_name || ''}`.trim(),
      property_address: lead.address || lead.property_address || '',
      city: lead.city || '',
      state: lead.state || '',
      zip: lead.zip || lead.zip_code || '',
      claim_number: lead.claim_number || lead.claim_id || null,
      insurance_company: lead.insurance_company || null,
      adjuster_name: lead.adjuster_name || null,
      job_id: lead.id || lead.job_id || '',
      contact_phone: lead.phone || lead.contact_phone || null,
      contact_email: lead.email || lead.contact_email || 'supplement@summit-roofing.example',
      status: lead.status || 'active',
      rooflink_id: lead.id || null,
      rooflink_data: JSON.stringify(lead)
    };
  }

  // Sync all leads from RoofLink to local database
  async syncAllLeads(dbService) {
    try {
      console.log('Starting RoofLink sync...');
      const leads = await this.getAllLeads();

      if (!leads || !Array.isArray(leads)) {
        console.log('No leads returned from RoofLink');
        return { synced: 0, errors: 0 };
      }

      let synced = 0;
      let errors = 0;

      for (const lead of leads) {
        try {
          const customer = this.transformLeadToCustomer(lead);

          // Check if customer already exists by rooflink_id or job_id
          const existing = await dbService.getCustomerByRoofLinkId(lead.id);

          if (existing) {
            // Update existing customer
            await dbService.updateCustomer(existing.id, customer);
            console.log(`Updated customer: ${customer.name}`);
          } else {
            // Create new customer
            await dbService.createCustomer(customer);
            console.log(`Created customer: ${customer.name}`);
          }

          synced++;
        } catch (error) {
          console.error(`Error syncing lead ${lead.id}:`, error.message);
          errors++;
        }
      }

      console.log(`RoofLink sync complete: ${synced} synced, ${errors} errors`);
      return { synced, errors, total: leads.length };
    } catch (error) {
      console.error('Error during RoofLink sync:', error.message);
      throw error;
    }
  }

  // Test API connection
  async testConnection() {
    try {
      console.log('Testing RoofLink API connection...');
      const leads = await this.getAllLeads();
      console.log('RoofLink API connection successful!');
      return {
        success: true,
        message: 'Connected to RoofLink API',
        leadCount: Array.isArray(leads) ? leads.length : 0
      };
    } catch (error) {
      console.error('RoofLink API connection failed:', error.message);
      return {
        success: false,
        message: error.message
      };
    }
  }

  // ========== ENHANCED ENDPOINTS ==========

  // Get all PM (Project Manager) notes for a job
  async getJobNotes(jobId) {
    try {
      console.log(`Fetching notes for job ${jobId}...`);
      const endpoint = `/roof_link_endpoints/api/light/jobs/${jobId}/notes/`;
      const response = await this.makeRequest(endpoint);
      const notes = response.results || response;
      console.log(`Retrieved ${Array.isArray(notes) ? notes.length : 0} notes for job ${jobId}`);
      return notes;
    } catch (error) {
      console.error(`Error fetching notes for job ${jobId}:`, error.message);
      return [];
    }
  }

  // Add a note to a job (PM Notes)
  async addJobNote(jobId, noteData) {
    try {
      console.log(`Adding note to job ${jobId}...`);
      const endpoint = `/roof_link_endpoints/api/light/jobs/${jobId}/notes/`;
      const response = await this.makeRequest(endpoint, 'POST', {
        message: noteData.message || noteData.note,
        note_type: noteData.note_type || 'general',
        created_by: noteData.created_by || 'system'
      });
      console.log(`Note added to job ${jobId}`);
      return response;
    } catch (error) {
      console.error(`Error adding note to job ${jobId}:`, error.message);
      throw error;
    }
  }

  // Get job tasks/checklist
  async getJobTasks(jobId) {
    try {
      console.log(`Fetching tasks for job ${jobId}...`);
      const endpoint = `/roof_link_endpoints/api/light/jobs/${jobId}/tasks/`;
      const response = await this.makeRequest(endpoint);
      return response.results || response;
    } catch (error) {
      console.error(`Error fetching tasks for job ${jobId}:`, error.message);
      return [];
    }
  }

  // Get job documents/attachments
  async getJobDocuments(jobId) {
    try {
      console.log(`Fetching documents for job ${jobId}...`);
      const endpoint = `/roof_link_endpoints/api/light/jobs/${jobId}/documents/`;
      const response = await this.makeRequest(endpoint);
      return response.results || response;
    } catch (error) {
      console.error(`Error fetching documents for job ${jobId}:`, error.message);
      return [];
    }
  }

  // Upload document to job
  async uploadJobDocument(jobId, documentData) {
    try {
      console.log(`Uploading document to job ${jobId}...`);
      const endpoint = `/roof_link_endpoints/api/light/jobs/${jobId}/documents/`;
      const response = await this.makeRequest(endpoint, 'POST', documentData);
      console.log(`Document uploaded to job ${jobId}`);
      return response;
    } catch (error) {
      console.error(`Error uploading document to job ${jobId}:`, error.message);
      throw error;
    }
  }

  // Get job timeline/history
  async getJobTimeline(jobId) {
    try {
      console.log(`Fetching timeline for job ${jobId}...`);
      const endpoint = `/roof_link_endpoints/api/light/jobs/${jobId}/timeline/`;
      const response = await this.makeRequest(endpoint);
      return response.results || response;
    } catch (error) {
      console.error(`Error fetching timeline for job ${jobId}:`, error.message);
      return [];
    }
  }

  // Get jobs with specific status
  async getJobsByStatus(status) {
    try {
      console.log(`Fetching jobs with status: ${status}...`);
      const endpoint = `/roof_link_endpoints/api/light/jobs/?status=${encodeURIComponent(status)}&page_size=100`;
      const response = await this.makeRequest(endpoint);
      return response.results || response;
    } catch (error) {
      console.error(`Error fetching jobs by status ${status}:`, error.message);
      return [];
    }
  }

  // Get jobs needing supplements (custom filter)
  async getJobsNeedingSupplements() {
    try {
      console.log('Fetching jobs needing supplements...');
      // Get all jobs and filter for those with supplement tags or specific criteria
      const endpoint = `/roof_link_endpoints/api/light/jobs/?page_size=100`;
      const response = await this.makeRequest(endpoint);
      const allJobs = response.results || response;

      // Filter jobs that have supplement-related tags or notes
      const supplementJobs = allJobs.filter(job => {
        const jobStr = JSON.stringify(job).toLowerCase();
        return jobStr.includes('supplement') ||
               jobStr.includes('additional') ||
               jobStr.includes('80+') ||
               job.tags?.some(tag => tag.toLowerCase().includes('supplement'));
      });

      console.log(`Found ${supplementJobs.length} jobs needing supplements`);
      return supplementJobs;
    } catch (error) {
      console.error('Error fetching jobs needing supplements:', error.message);
      return [];
    }
  }

  // Get job estimate/pricing
  async getJobEstimate(jobId) {
    try {
      console.log(`Fetching estimate for job ${jobId}...`);
      const endpoint = `/roof_link_endpoints/api/light/jobs/${jobId}/estimate/`;
      const response = await this.makeRequest(endpoint);
      return response;
    } catch (error) {
      console.error(`Error fetching estimate for job ${jobId}:`, error.message);
      return null;
    }
  }

  // Get job invoices
  async getJobInvoices(jobId) {
    try {
      console.log(`Fetching invoices for job ${jobId}...`);
      const endpoint = `/roof_link_endpoints/api/light/jobs/${jobId}/invoices/`;
      const response = await this.makeRequest(endpoint);
      return response.results || response;
    } catch (error) {
      console.error(`Error fetching invoices for job ${jobId}:`, error.message);
      return [];
    }
  }

  // Get job contacts (additional contacts beyond primary)
  async getJobContacts(jobId) {
    try {
      console.log(`Fetching contacts for job ${jobId}...`);
      const endpoint = `/roof_link_endpoints/api/light/jobs/${jobId}/contacts/`;
      const response = await this.makeRequest(endpoint);
      return response.results || response;
    } catch (error) {
      console.error(`Error fetching contacts for job ${jobId}:`, error.message);
      return [];
    }
  }

  // Search jobs by customer name
  async searchJobsByCustomer(customerName) {
    try {
      console.log(`Searching jobs for customer: ${customerName}...`);
      const endpoint = `/roof_link_endpoints/api/light/jobs/?search=${encodeURIComponent(customerName)}&page_size=100`;
      const response = await this.makeRequest(endpoint);
      return response.results || response;
    } catch (error) {
      console.error(`Error searching jobs for customer ${customerName}:`, error.message);
      return [];
    }
  }

  // Search jobs by address
  async searchJobsByAddress(address) {
    try {
      console.log(`Searching jobs for address: ${address}...`);
      const endpoint = `/roof_link_endpoints/api/light/jobs/?address=${encodeURIComponent(address)}&page_size=100`;
      const response = await this.makeRequest(endpoint);
      return response.results || response;
    } catch (error) {
      console.error(`Error searching jobs for address ${address}:`, error.message);
      return [];
    }
  }

  // Get team members/users
  async getTeamMembers() {
    try {
      console.log('Fetching team members...');
      const endpoint = `/roof_link_endpoints/api/light/users/`;
      const response = await this.makeRequest(endpoint);
      return response.results || response;
    } catch (error) {
      console.error('Error fetching team members:', error.message);
      return [];
    }
  }

  // Get jobs assigned to specific team member
  async getJobsByAssignee(userId) {
    try {
      console.log(`Fetching jobs assigned to user ${userId}...`);
      const endpoint = `/roof_link_endpoints/api/light/jobs/?assigned_to=${userId}&page_size=100`;
      const response = await this.makeRequest(endpoint);
      return response.results || response;
    } catch (error) {
      console.error(`Error fetching jobs for assignee ${userId}:`, error.message);
      return [];
    }
  }

  // Update job status
  async updateJobStatus(jobId, newStatus) {
    try {
      console.log(`Updating job ${jobId} status to: ${newStatus}...`);
      const endpoint = `/roof_link_endpoints/api/light/jobs/${jobId}/`;
      const response = await this.makeRequest(endpoint, 'PATCH', {
        status: newStatus
      });
      console.log(`Job ${jobId} status updated to ${newStatus}`);
      return response;
    } catch (error) {
      console.error(`Error updating job ${jobId} status:`, error.message);
      throw error;
    }
  }

  // Assign job to team member
  async assignJob(jobId, userId) {
    try {
      console.log(`Assigning job ${jobId} to user ${userId}...`);
      const endpoint = `/roof_link_endpoints/api/light/jobs/${jobId}/`;
      const response = await this.makeRequest(endpoint, 'PATCH', {
        assigned_to: userId
      });
      console.log(`Job ${jobId} assigned to user ${userId}`);
      return response;
    } catch (error) {
      console.error(`Error assigning job ${jobId}:`, error.message);
      throw error;
    }
  }

  // Get dashboard statistics
  async getDashboardStats() {
    try {
      console.log('Fetching dashboard statistics...');
      const endpoint = `/roof_link_endpoints/api/light/dashboard/stats/`;
      const response = await this.makeRequest(endpoint);
      return response;
    } catch (error) {
      console.error('Error fetching dashboard stats:', error.message);
      // Return fallback stats if API doesn't support this endpoint
      const allJobs = await this.getAllLeads();
      return {
        total_jobs: allJobs.length,
        active_jobs: allJobs.filter(j => j.status === 'active').length,
        completed_jobs: allJobs.filter(j => j.status === 'completed').length,
        pending_jobs: allJobs.filter(j => j.status === 'pending').length
      };
    }
  }

  // Get jobs created within date range
  async getJobsByDateRange(startDate, endDate) {
    try {
      console.log(`Fetching jobs from ${startDate} to ${endDate}...`);
      const endpoint = `/roof_link_endpoints/api/light/jobs/?created_after=${encodeURIComponent(startDate)}&created_before=${encodeURIComponent(endDate)}&page_size=100`;
      const response = await this.makeRequest(endpoint);
      return response.results || response;
    } catch (error) {
      console.error('Error fetching jobs by date range:', error.message);
      return [];
    }
  }

  // Get recent jobs (last N days)
  async getRecentJobs(days = 30) {
    try {
      const endDate = new Date().toISOString();
      const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
      return await this.getJobsByDateRange(startDate, endDate);
    } catch (error) {
      console.error(`Error fetching recent jobs (${days} days):`, error.message);
      return [];
    }
  }

  // Get full job details (consolidated information)
  async getFullJobDetails(jobId) {
    try {
      console.log(`Fetching full details for job ${jobId}...`);

      // Fetch all relevant data in parallel
      const [job, notes, tasks, documents, timeline, estimate, invoices, contacts] = await Promise.all([
        this.getLeadById(jobId),
        this.getJobNotes(jobId),
        this.getJobTasks(jobId),
        this.getJobDocuments(jobId),
        this.getJobTimeline(jobId),
        this.getJobEstimate(jobId),
        this.getJobInvoices(jobId),
        this.getJobContacts(jobId)
      ]);

      return {
        job,
        notes,
        tasks,
        documents,
        timeline,
        estimate,
        invoices,
        contacts,
        fetched_at: new Date().toISOString()
      };
    } catch (error) {
      console.error(`Error fetching full job details for ${jobId}:`, error.message);
      throw error;
    }
  }

  // ========== SUPPLEMENT LINE ITEMS ENDPOINTS ==========

  // Get all supplemental line items for an estimate
  async getEstimateSupplementalItems(estimateId, params = {}) {
    try {
      console.log(`Fetching supplemental line items for estimate ${estimateId}...`);

      const queryParams = new URLSearchParams({
        estimate: estimateId,
        ...params
      });

      const endpoint = `/roof_link_endpoints/api/light/estimate-supplineitems/?${queryParams.toString()}`;
      const response = await this.makeRequest(endpoint);
      const items = response.results || response;

      console.log(`Retrieved ${Array.isArray(items) ? items.length : 0} supplemental line items for estimate ${estimateId}`);
      return items;
    } catch (error) {
      console.error(`Error fetching supplemental items for estimate ${estimateId}:`, error.message);
      return [];
    }
  }

  // Get supplemental line item field configuration
  async getSupplementalItemFieldsConfig() {
    try {
      console.log('Fetching supplemental line item fields configuration...');
      const endpoint = `/roof_link_endpoints/api/light/estimate-supplineitems/fields/`;
      const response = await this.makeRequest(endpoint);
      return response;
    } catch (error) {
      console.error('Error fetching supplemental item fields config:', error.message);
      return null;
    }
  }

  // Create a new supplemental line item
  async createSupplementalItem(estimateId, itemData) {
    try {
      console.log(`Creating supplemental line item for estimate ${estimateId}...`);

      const endpoint = `/roof_link_endpoints/api/light/estimate-supplineitems/`;
      const data = {
        estimate: estimateId,
        description: itemData.description,
        quantity: itemData.quantity || 1,
        unit_price: itemData.unit_price || 0,
        total: itemData.total || (itemData.quantity * itemData.unit_price),
        approved: itemData.approved || false,
        ...itemData
      };

      const response = await this.makeRequest(endpoint, 'POST', data);
      console.log(`Supplemental line item created for estimate ${estimateId}`);
      return response;
    } catch (error) {
      console.error(`Error creating supplemental item for estimate ${estimateId}:`, error.message);
      throw error;
    }
  }

  // Update a supplemental line item
  async updateSupplementalItem(itemId, itemData) {
    try {
      console.log(`Updating supplemental line item ${itemId}...`);
      const endpoint = `/roof_link_endpoints/api/light/estimate-supplineitems/${itemId}/`;
      const response = await this.makeRequest(endpoint, 'PATCH', itemData);
      console.log(`Supplemental line item ${itemId} updated`);
      return response;
    } catch (error) {
      console.error(`Error updating supplemental item ${itemId}:`, error.message);
      throw error;
    }
  }

  // Delete a supplemental line item
  async deleteSupplementalItem(itemId) {
    try {
      console.log(`Deleting supplemental line item ${itemId}...`);
      const endpoint = `/roof_link_endpoints/api/light/estimate-supplineitems/${itemId}/`;
      const response = await this.makeRequest(endpoint, 'DELETE');
      console.log(`Supplemental line item ${itemId} deleted`);
      return response;
    } catch (error) {
      console.error(`Error deleting supplemental item ${itemId}:`, error.message);
      throw error;
    }
  }

  // Approve a supplemental line item
  async approveSupplementalItem(itemId) {
    try {
      console.log(`Approving supplemental line item ${itemId}...`);
      return await this.updateSupplementalItem(itemId, { approved: true });
    } catch (error) {
      console.error(`Error approving supplemental item ${itemId}:`, error.message);
      throw error;
    }
  }

  // Reject/Unapprove a supplemental line item
  async rejectSupplementalItem(itemId) {
    try {
      console.log(`Rejecting supplemental line item ${itemId}...`);
      return await this.updateSupplementalItem(itemId, { approved: false });
    } catch (error) {
      console.error(`Error rejecting supplemental item ${itemId}:`, error.message);
      throw error;
    }
  }

  // Bulk create supplemental line items
  async createBulkSupplementalItems(estimateId, itemsArray) {
    try {
      console.log(`Creating ${itemsArray.length} supplemental line items for estimate ${estimateId}...`);

      const createdItems = [];
      const errors = [];

      for (const item of itemsArray) {
        try {
          const created = await this.createSupplementalItem(estimateId, item);
          createdItems.push(created);
        } catch (error) {
          errors.push({ item, error: error.message });
        }
      }

      console.log(`Created ${createdItems.length} items, ${errors.length} errors`);
      return {
        created: createdItems,
        errors,
        success: createdItems.length,
        failed: errors.length
      };
    } catch (error) {
      console.error(`Error in bulk create supplemental items:`, error.message);
      throw error;
    }
  }

  // Get summary of supplemental items for an estimate
  async getSupplementalItemsSummary(estimateId) {
    try {
      const items = await this.getEstimateSupplementalItems(estimateId);

      if (!Array.isArray(items) || items.length === 0) {
        return {
          total_items: 0,
          approved_items: 0,
          pending_items: 0,
          total_amount: 0,
          approved_amount: 0,
          pending_amount: 0
        };
      }

      const summary = {
        total_items: items.length,
        approved_items: items.filter(i => i.approved).length,
        pending_items: items.filter(i => !i.approved).length,
        total_amount: items.reduce((sum, i) => sum + (parseFloat(i.total) || 0), 0),
        approved_amount: items.filter(i => i.approved).reduce((sum, i) => sum + (parseFloat(i.total) || 0), 0),
        pending_amount: items.filter(i => !i.approved).reduce((sum, i) => sum + (parseFloat(i.total) || 0), 0),
        items: items
      };

      return summary;
    } catch (error) {
      console.error(`Error getting supplemental items summary for estimate ${estimateId}:`, error.message);
      return null;
    }
  }

  // Get estimate with all supplemental items
  async getEstimateWithSupplements(estimateId) {
    try {
      console.log(`Fetching estimate ${estimateId} with supplemental items...`);

      const [estimate, supplementalItems] = await Promise.all([
        this.getJobEstimate(estimateId),
        this.getEstimateSupplementalItems(estimateId)
      ]);

      return {
        estimate,
        supplemental_items: supplementalItems,
        supplemental_summary: await this.getSupplementalItemsSummary(estimateId),
        fetched_at: new Date().toISOString()
      };
    } catch (error) {
      console.error(`Error fetching estimate with supplements ${estimateId}:`, error.message);
      throw error;
    }
  }
}

module.exports = new RoofLinkService();
