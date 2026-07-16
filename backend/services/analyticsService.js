const db = require('../database/db');
const rooflinkService = require('./rooflinkService');

/**
 * Analytics Service
 *
 * Provides real-time metrics, KPIs, and business intelligence
 * for the supplement dashboard.
 */

class AnalyticsService {
  /**
   * Get comprehensive dashboard statistics
   */
  async getDashboardStats() {
    try {
      const [
        jobStats,
        supplementStats,
        revenueStats,
        timelineStats,
        teamPerformance,
      ] = await Promise.all([
        this.getJobStatistics(),
        this.getSupplementStatistics(),
        this.getRevenueStatistics(),
        this.getTimelineStatistics(),
        this.getTeamPerformance(),
      ]);

      return {
        timestamp: new Date().toISOString(),
        jobs: jobStats,
        supplements: supplementStats,
        revenue: revenueStats,
        timeline: timelineStats,
        team: teamPerformance,
      };
    } catch (error) {
      console.error('Error getting dashboard stats:', error);
      throw error;
    }
  }

  /**
   * Job statistics
   */
  async getJobStatistics() {
    return new Promise((resolve, reject) => {
      db.all(
        `SELECT
          COUNT(*) as total_jobs,
          SUM(CASE WHEN status = 'needs_supplement' THEN 1 ELSE 0 END) as needs_supplement,
          SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END) as in_progress,
          SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
          SUM(CASE WHEN photo_count >= 80 THEN 1 ELSE 0 END) as high_photo_count,
          AVG(photo_count) as avg_photo_count,
          SUM(CASE WHEN date_roof_scheduled IS NOT NULL AND date_roof_completed IS NULL THEN 1 ELSE 0 END) as scheduled_pending,
          SUM(CASE WHEN supplement_count > 0 THEN 1 ELSE 0 END) as has_supplements
        FROM customers`,
        [],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows[0] || {});
        }
      );
    });
  }

  /**
   * Supplement statistics
   */
  async getSupplementStatistics() {
    return new Promise((resolve, reject) => {
      db.all(
        `SELECT
          COUNT(*) as total_customers_with_supplements,
          SUM(supplement_count) as total_supplements,
          AVG(supplement_count) as avg_supplements_per_job,
          SUM(CASE WHEN supplement_sent_date IS NOT NULL THEN 1 ELSE 0 END) as supplements_sent,
          AVG(CAST((julianday('now') - julianday(supplement_sent_date)) AS INTEGER)) as avg_days_supplementing
        FROM customers
        WHERE supplement_count > 0 OR supplement_sent_date IS NOT NULL`,
        [],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows[0] || {});
        }
      );
    });
  }

  /**
   * Revenue statistics
   */
  async getRevenueStatistics() {
    return new Promise((resolve, reject) => {
      db.all(
        `SELECT
          SUM(estimate_total) as total_revenue,
          AVG(estimate_total) as avg_job_value,
          MAX(estimate_total) as highest_job,
          MIN(estimate_total) as lowest_job,
          COUNT(CASE WHEN estimate_total > 50000 THEN 1 END) as high_value_jobs,
          SUM(CASE WHEN status = 'completed' THEN estimate_total ELSE 0 END) as completed_revenue,
          SUM(CASE WHEN status = 'in_progress' THEN estimate_total ELSE 0 END) as pipeline_revenue
        FROM customers
        WHERE estimate_total IS NOT NULL AND estimate_total > 0`,
        [],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows[0] || {});
        }
      );
    });
  }

  /**
   * Timeline statistics
   */
  async getTimelineStatistics() {
    return new Promise((resolve, reject) => {
      db.all(
        `SELECT
          AVG(CAST((julianday(date_roof_scheduled) - julianday(date_created)) AS INTEGER)) as avg_days_to_schedule,
          AVG(CAST((julianday(date_roof_completed) - julianday(date_roof_scheduled)) AS INTEGER)) as avg_days_scheduled_to_complete,
          AVG(CAST((julianday(date_roof_completed) - julianday(date_created)) AS INTEGER)) as avg_total_job_duration,
          COUNT(CASE WHEN date_roof_scheduled < date() AND date_roof_completed IS NULL THEN 1 END) as overdue_installs
        FROM customers
        WHERE date_created IS NOT NULL`,
        [],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows[0] || {});
        }
      );
    });
  }

  /**
   * Team performance metrics
   */
  async getTeamPerformance() {
    return new Promise((resolve, reject) => {
      db.all(
        `SELECT
          roofing_crew,
          COUNT(*) as total_jobs,
          SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed_jobs,
          AVG(estimate_total) as avg_job_value,
          SUM(estimate_total) as total_revenue
        FROM customers
        WHERE roofing_crew IS NOT NULL AND roofing_crew != ''
        GROUP BY roofing_crew
        ORDER BY completed_jobs DESC`,
        [],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows || []);
        }
      );
    });
  }

  /**
   * Get trends over time
   */
  async getTrends(days = 30) {
    return new Promise((resolve, reject) => {
      db.all(
        `SELECT
          DATE(date_created) as date,
          COUNT(*) as jobs_created,
          SUM(estimate_total) as revenue,
          AVG(photo_count) as avg_photos
        FROM customers
        WHERE date_created >= date('now', '-${days} days')
        GROUP BY DATE(date_created)
        ORDER BY date DESC`,
        [],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows || []);
        }
      );
    });
  }

  /**
   * Get supplement approval rate
   */
  async getSupplementApprovalRate() {
    try {
      // This would need RoofLink API call to get actual approval data
      // For now, return estimated data from local DB
      return new Promise((resolve, reject) => {
        db.all(
          `SELECT
            COUNT(*) as total_with_supplements,
            SUM(CASE WHEN supplement_approved_date IS NOT NULL THEN 1 ELSE 0 END) as approved,
            AVG(CAST((julianday(supplement_approved_date) - julianday(supplement_sent_date)) AS INTEGER)) as avg_days_to_approval
          FROM customers
          WHERE supplement_sent_date IS NOT NULL`,
          [],
          (err, rows) => {
            if (err) reject(err);
            else {
              const data = rows[0] || {};
              const approvalRate = data.total_with_supplements > 0
                ? (data.approved / data.total_with_supplements) * 100
                : 0;

              resolve({
                ...data,
                approval_rate: approvalRate.toFixed(2),
              });
            }
          }
        );
      });
    } catch (error) {
      console.error('Error getting supplement approval rate:', error);
      throw error;
    }
  }

  /**
   * Get insurance company statistics
   */
  async getInsuranceCompanyStats() {
    return new Promise((resolve, reject) => {
      db.all(
        `SELECT
          insurance_company,
          COUNT(*) as total_jobs,
          SUM(estimate_total) as total_revenue,
          AVG(estimate_total) as avg_job_value,
          SUM(supplement_count) as total_supplements,
          AVG(CAST((julianday(supplement_approved_date) - julianday(supplement_sent_date)) AS INTEGER)) as avg_approval_time
        FROM customers
        WHERE insurance_company IS NOT NULL AND insurance_company != ''
        GROUP BY insurance_company
        ORDER BY total_jobs DESC
        LIMIT 20`,
        [],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows || []);
        }
      );
    });
  }

  /**
   * Get photo analysis statistics
   */
  async getPhotoAnalytics() {
    return new Promise((resolve, reject) => {
      db.all(
        `SELECT
          CASE
            WHEN photo_count < 50 THEN '0-49'
            WHEN photo_count < 80 THEN '50-79'
            WHEN photo_count < 100 THEN '80-99'
            ELSE '100+'
          END as photo_range,
          COUNT(*) as job_count,
          AVG(estimate_total) as avg_value,
          AVG(supplement_count) as avg_supplements
        FROM customers
        WHERE photo_count > 0
        GROUP BY photo_range
        ORDER BY photo_range`,
        [],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows || []);
        }
      );
    });
  }

  /**
   * Get real-time KPIs (Key Performance Indicators)
   */
  async getKPIs() {
    const [
      stats,
      approvalRate,
      trends7days,
      trends30days,
    ] = await Promise.all([
      this.getDashboardStats(),
      this.getSupplementApprovalRate(),
      this.getTrends(7),
      this.getTrends(30),
    ]);

    // Calculate week-over-week growth
    const thisWeekRevenue = trends7days.reduce((sum, day) => sum + (day.revenue || 0), 0);
    const lastMonthAvgWeeklyRevenue = trends30days.reduce((sum, day) => sum + (day.revenue || 0), 0) / 4;

    const revenueGrowth = lastMonthAvgWeeklyRevenue > 0
      ? ((thisWeekRevenue - lastMonthAvgWeeklyRevenue) / lastMonthAvgWeeklyRevenue) * 100
      : 0;

    return {
      timestamp: new Date().toISOString(),
      kpis: {
        total_jobs: stats.jobs.total_jobs || 0,
        active_jobs: (stats.jobs.in_progress || 0) + (stats.jobs.needs_supplement || 0),
        completion_rate: stats.jobs.total_jobs > 0
          ? ((stats.jobs.completed / stats.jobs.total_jobs) * 100).toFixed(2)
          : 0,
        total_revenue: stats.revenue.total_revenue || 0,
        pipeline_revenue: stats.revenue.pipeline_revenue || 0,
        avg_job_value: stats.revenue.avg_job_value || 0,
        supplement_approval_rate: approvalRate.approval_rate || 0,
        avg_days_to_approval: approvalRate.avg_days_to_approval || 0,
        revenue_growth_wow: revenueGrowth.toFixed(2),
        high_priority_jobs: stats.jobs.high_photo_count || 0,
        overdue_installs: stats.timeline.overdue_installs || 0,
      },
      trends: {
        last_7_days: trends7days,
        last_30_days: trends30days,
      },
    };
  }

  /**
   * Generate export report
   */
  async generateReport(startDate, endDate, format = 'json') {
    const reportData = {
      generated_at: new Date().toISOString(),
      period: { start: startDate, end: endDate },
      summary: await this.getDashboardStats(),
      kpis: await this.getKPIs(),
      insurance_companies: await this.getInsuranceCompanyStats(),
      photo_analytics: await this.getPhotoAnalytics(),
      approval_rate: await this.getSupplementApprovalRate(),
    };

    if (format === 'csv') {
      // Convert to CSV format
      return this.convertToCSV(reportData);
    }

    return reportData;
  }

  /**
   * Convert report data to CSV
   */
  convertToCSV(data) {
    // Simple CSV conversion - can be enhanced
    let csv = 'Report Generated,' + data.generated_at + '\n\n';

    csv += 'KPI,Value\n';
    Object.entries(data.kpis.kpis).forEach(([key, value]) => {
      csv += `${key},${value}\n`;
    });

    return csv;
  }
}

module.exports = new AnalyticsService();
