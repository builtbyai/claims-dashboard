const https = require('https');
const fs = require('fs').promises;
const path = require('path');

class CompanyCamService {
  constructor() {
    this.tokens = [
      process.env.COMPANYCAM_TOKEN_1,
      process.env.COMPANYCAM_TOKEN_2,
      process.env.COMPANYCAM_SALESRABBIT_TOKEN
    ].filter(Boolean);

    this.apiUrl = process.env.COMPANYCAM_API_URL || 'https://api.companycam.com';
    this.currentTokenIndex = 0;
  }

  // Rotate tokens to distribute API load
  getCurrentToken() {
    const token = this.tokens[this.currentTokenIndex];
    this.currentTokenIndex = (this.currentTokenIndex + 1) % this.tokens.length;
    return token;
  }

  // Make HTTP request to CompanyCam API
  async makeRequest(endpoint, method = 'GET', data = null, token = null) {
    return new Promise((resolve, reject) => {
      const url = new URL(endpoint, this.apiUrl);
      const authToken = token || this.getCurrentToken();

      const options = {
        hostname: url.hostname,
        port: url.port || 443,
        path: url.pathname + url.search,
        method: method,
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      };

      if (data && method !== 'GET') {
        const postData = JSON.stringify(data);
        options.headers['Content-Length'] = Buffer.byteLength(postData);
      }

      const req = https.request(options, (res) => {
        let responseData = '';

        res.on('data', (chunk) => {
          responseData += chunk;
        });

        res.on('end', () => {
          try {
            const parsed = responseData ? JSON.parse(responseData) : {};
            if (res.statusCode >= 200 && res.statusCode < 300) {
              resolve(parsed);
            } else {
              reject(new Error(`CompanyCam API error: ${res.statusCode} - ${responseData}`));
            }
          } catch (err) {
            reject(new Error(`Failed to parse CompanyCam response: ${err.message}`));
          }
        });
      });

      req.on('error', (error) => {
        reject(new Error(`CompanyCam request failed: ${error.message}`));
      });

      if (data && method !== 'GET') {
        req.write(JSON.stringify(data));
      }

      req.end();
    });
  }

  // Get all projects
  async getAllProjects() {
    try {
      console.log('Fetching projects from CompanyCam...');
      const response = await this.makeRequest('/v2/projects');
      console.log(`Retrieved ${response.data?.length || 0} projects from CompanyCam`);
      return response.data || [];
    } catch (error) {
      console.error('Error fetching CompanyCam projects:', error.message);
      return [];
    }
  }

  // Get project by ID
  async getProjectById(projectId) {
    try {
      const response = await this.makeRequest(`/v2/projects/${projectId}`);
      return response;
    } catch (error) {
      console.error(`Error fetching project ${projectId}:`, error.message);
      throw error;
    }
  }

  // Search projects by name or address
  async searchProjects(query) {
    try {
      const params = new URLSearchParams({ q: query });
      const response = await this.makeRequest(`/v2/projects?${params.toString()}`);
      return response.data || [];
    } catch (error) {
      console.error('Error searching CompanyCam projects:', error.message);
      return [];
    }
  }

  // Get photos for a project
  async getProjectPhotos(projectId) {
    try {
      console.log(`Fetching photos for project ${projectId}...`);
      const response = await this.makeRequest(`/v2/projects/${projectId}/photos`);
      const photos = response.data || [];
      console.log(`Found ${photos.length} photos for project ${projectId}`);
      return photos;
    } catch (error) {
      console.error(`Error fetching photos for project ${projectId}:`, error.message);
      return [];
    }
  }

  // Download photo to local storage
  async downloadPhoto(photoUrl, savePath) {
    return new Promise((resolve, reject) => {
      https.get(photoUrl, (res) => {
        if (res.statusCode !== 200) {
          reject(new Error(`Failed to download photo: ${res.statusCode}`));
          return;
        }

        const fileStream = require('fs').createWriteStream(savePath);
        res.pipe(fileStream);

        fileStream.on('finish', () => {
          fileStream.close();
          resolve(savePath);
        });

        fileStream.on('error', (err) => {
          require('fs').unlink(savePath, () => {});
          reject(err);
        });
      }).on('error', reject);
    });
  }

  // Sync photos for a customer
  async syncCustomerPhotos(customer, dbService) {
    try {
      // Search for project matching customer address or job ID
      const searchQuery = customer.property_address || customer.job_id;
      const projects = await this.searchProjects(searchQuery);

      if (!projects || projects.length === 0) {
        console.log(`No CompanyCam project found for customer: ${customer.name}`);
        return { photoCount: 0, downloaded: 0 };
      }

      const project = projects[0];
      console.log(`Found CompanyCam project for ${customer.name}: ${project.id}`);

      // Get photos from project
      const photos = await this.getProjectPhotos(project.id);

      if (!photos || photos.length === 0) {
        console.log(`No photos found for project ${project.id}`);
        return { photoCount: 0, downloaded: 0 };
      }

      // Create photo directory for customer
      const photoDir = path.join(customer.folder_path, '02_PHOTOS');
      try {
        await fs.mkdir(photoDir, { recursive: true });
      } catch (err) {
        console.error(`Error creating photo directory: ${err.message}`);
      }

      // Download photos
      let downloaded = 0;
      for (const photo of photos) {
        try {
          const photoName = `photo_${photo.id}_${Date.now()}.jpg`;
          const savePath = path.join(photoDir, photoName);

          // Check if photo already exists
          try {
            await fs.access(savePath);
            console.log(`Photo already exists: ${photoName}`);
            continue;
          } catch {
            // Photo doesn't exist, download it
          }

          await this.downloadPhoto(photo.uri, savePath);
          downloaded++;
          console.log(`Downloaded photo: ${photoName}`);
        } catch (error) {
          console.error(`Error downloading photo ${photo.id}:`, error.message);
        }
      }

      // Update customer photo count in database
      if (dbService) {
        await dbService.updateCustomer(customer.id, {
          photo_count: photos.length,
          companycam_project_id: project.id
        });
      }

      console.log(`Synced ${photos.length} photos for ${customer.name}, downloaded ${downloaded} new`);
      return {
        photoCount: photos.length,
        downloaded: downloaded,
        projectId: project.id
      };
    } catch (error) {
      console.error(`Error syncing photos for ${customer.name}:`, error.message);
      return { photoCount: 0, downloaded: 0, error: error.message };
    }
  }

  // Sync photos for all customers
  async syncAllPhotos(dbService) {
    try {
      console.log('Starting CompanyCam photo sync...');
      const customers = await dbService.getAllCustomers(1, 1000);

      let synced = 0;
      let totalPhotos = 0;
      let errors = 0;

      for (const customer of customers) {
        try {
          const result = await this.syncCustomerPhotos(customer, dbService);
          if (result.photoCount > 0) {
            synced++;
            totalPhotos += result.photoCount;
          }
        } catch (error) {
          console.error(`Error syncing photos for ${customer.name}:`, error.message);
          errors++;
        }

        // Rate limiting - wait 1 second between customers
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      console.log(`Photo sync complete: ${synced} customers, ${totalPhotos} total photos, ${errors} errors`);
      return { synced, totalPhotos, errors };
    } catch (error) {
      console.error('Error during photo sync:', error.message);
      throw error;
    }
  }

  // Test API connection
  async testConnection() {
    try {
      console.log('Testing CompanyCam API connection...');
      const projects = await this.getAllProjects();
      console.log('CompanyCam API connection successful!');
      return {
        success: true,
        message: 'Connected to CompanyCam API',
        projectCount: projects.length
      };
    } catch (error) {
      console.error('CompanyCam API connection failed:', error.message);
      return {
        success: false,
        message: error.message
      };
    }
  }
}

module.exports = new CompanyCamService();
