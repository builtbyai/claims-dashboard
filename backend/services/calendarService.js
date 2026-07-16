// Calendar Service for Roof Installs
// Manages upcoming and past roof installation dates
const db = require('./databaseService');

class CalendarService {
  /**
   * Get upcoming roof installs
   */
  async getUpcomingInstalls(days = 30) {
    try {
      const today = new Date();
      const futureDate = new Date();
      futureDate.setDate(today.getDate() + days);

      const query = `
        SELECT * FROM customers
        WHERE date_roof_scheduled IS NOT NULL
        AND date_roof_scheduled >= date('now')
        AND date_roof_scheduled <= date('now', '+${days} days')
        ORDER BY date_roof_scheduled ASC
      `;

      return new Promise((resolve, reject) => {
        db.db.all(query, [], (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        });
      });
    } catch (error) {
      console.error('Get upcoming installs error:', error.message);
      return [];
    }
  }

  /**
   * Get past installs
   */
  async getPastInstalls(days = 90) {
    try {
      const query = `
        SELECT * FROM customers
        WHERE date_roof_completed IS NOT NULL
        AND date_roof_completed >= date('now', '-${days} days')
        AND date_roof_completed <= date('now')
        ORDER BY date_roof_completed DESC
      `;

      return new Promise((resolve, reject) => {
        db.db.all(query, [], (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        });
      });
    } catch (error) {
      console.error('Get past installs error:', error.message);
      return [];
    }
  }

  /**
   * Get installs for a specific month
   */
  async getInstallsByMonth(year, month) {
    try {
      const query = `
        SELECT * FROM customers
        WHERE (
          (date_roof_scheduled IS NOT NULL AND strftime('%Y-%m', date_roof_scheduled) = ?)
          OR (date_roof_completed IS NOT NULL AND strftime('%Y-%m', date_roof_completed) = ?)
        )
        ORDER BY COALESCE(date_roof_scheduled, date_roof_completed) ASC
      `;

      const yearMonth = `${year}-${String(month).padStart(2, '0')}`;

      return new Promise((resolve, reject) => {
        db.db.all(query, [yearMonth, yearMonth], (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        });
      });
    } catch (error) {
      console.error('Get installs by month error:', error.message);
      return [];
    }
  }

  /**
   * Schedule a roof install
   */
  async scheduleInstall(customerId, scheduledDate, crewName = null) {
    try {
      await db.updateCustomer(customerId, {
        date_roof_scheduled: scheduledDate,
        roofing_crew: crewName
      });

      // Create activity
      await db.createActivity(
        customerId,
        'install_scheduled',
        `Roof install scheduled for ${scheduledDate}`,
        crewName ? `Assigned crew: ${crewName}` : ''
      );

      return true;
    } catch (error) {
      console.error('Schedule install error:', error.message);
      return false;
    }
  }

  /**
   * Mark install as completed
   */
  async completeInstall(customerId, completedDate) {
    try {
      await db.updateCustomer(customerId, {
        date_roof_completed: completedDate,
        status: 'completed'
      });

      // Create activity
      await db.createActivity(
        customerId,
        'install_completed',
        `Roof install completed on ${completedDate}`,
        ''
      );

      return true;
    } catch (error) {
      console.error('Complete install error:', error.message);
      return false;
    }
  }

  /**
   * Get calendar events (combines scheduled and completed)
   */
  async getCalendarEvents(startDate, endDate) {
    try {
      const query = `
        SELECT
          id,
          name,
          property_address,
          city,
          state,
          job_id,
          roofing_crew,
          date_roof_scheduled as event_date,
          'scheduled' as event_type,
          status
        FROM customers
        WHERE date_roof_scheduled BETWEEN ? AND ?

        UNION ALL

        SELECT
          id,
          name,
          property_address,
          city,
          state,
          job_id,
          roofing_crew,
          date_roof_completed as event_date,
          'completed' as event_type,
          status
        FROM customers
        WHERE date_roof_completed BETWEEN ? AND ?

        ORDER BY event_date ASC
      `;

      return new Promise((resolve, reject) => {
        db.db.all(query, [startDate, endDate, startDate, endDate], (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        });
      });
    } catch (error) {
      console.error('Get calendar events error:', error.message);
      return [];
    }
  }

  /**
   * Get crew schedule
   */
  async getCrewSchedule(crewName, days = 30) {
    try {
      const query = `
        SELECT * FROM customers
        WHERE roofing_crew = ?
        AND date_roof_scheduled >= date('now')
        AND date_roof_scheduled <= date('now', '+${days} days')
        ORDER BY date_roof_scheduled ASC
      `;

      return new Promise((resolve, reject) => {
        db.db.all(query, [crewName], (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        });
      });
    } catch (error) {
      console.error('Get crew schedule error:', error.message);
      return [];
    }
  }

  /**
   * Get all crews
   */
  async getAllCrews() {
    try {
      const query = `
        SELECT DISTINCT roofing_crew
        FROM customers
        WHERE roofing_crew IS NOT NULL
        ORDER BY roofing_crew ASC
      `;

      return new Promise((resolve, reject) => {
        db.db.all(query, [], (err, rows) => {
          if (err) reject(err);
          else resolve(rows.map(r => r.roofing_crew));
        });
      });
    } catch (error) {
      console.error('Get all crews error:', error.message);
      return [];
    }
  }
}

// Singleton instance
const calendarService = new CalendarService();

module.exports = calendarService;
