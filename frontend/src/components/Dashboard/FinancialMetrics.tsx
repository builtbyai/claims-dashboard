import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Grid,
  Typography,
  CircularProgress,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  LinearProgress,
  Tabs,
  Tab,
  Alert
} from '@mui/material';
import {
  TrendingUp,
  TrendingDown,
  AttachMoney,
  AccountBalance,
  Receipt,
  Warning
} from '@mui/icons-material';
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface FinancialSummary {
  total_jobs: number;
  total_rcv: number;
  total_collected: number;
  total_outstanding: number;
  avg_collection_rate: number;
  jobs_awaiting_payment: number;
  amount_awaiting_payment: number;
}

interface JobByStatus {
  status: string;
  count: number;
  total_rcv: number;
}

interface InsuranceBreakdown {
  insurance_company: string;
  job_count: number;
  total_rcv: number;
  total_collected: number;
  total_outstanding: number;
  avg_collection_rate: number;
  [key: string]: string | number; // Add index signature for Recharts
}

interface OutstandingJob {
  id: number;
  job_id: string;
  homeowner_name: string;
  property_address: string;
  insurance_company: string;
  rcv_amount: number;
  collected_amount: number;
  outstanding_balance: number;
  days_supplementing: number;
  status: string;
}

interface MonthlyRevenue {
  month: string;
  job_count: number;
  total_rcv: number;
  total_collected: number;
  outstanding: number;
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D'];

const FinancialMetrics: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<FinancialSummary | null>(null);
  const [jobsByStatus, setJobsByStatus] = useState<JobByStatus[]>([]);
  const [insuranceBreakdown, setInsuranceBreakdown] = useState<InsuranceBreakdown[]>([]);
  const [outstandingJobs, setOutstandingJobs] = useState<OutstandingJob[]>([]);
  const [monthlyRevenue, setMonthlyRevenue] = useState<MonthlyRevenue[]>([]);
  const [activeTab, setActiveTab] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadFinancialData();
  }, []);

  const loadFinancialData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Load summary
      const summaryRes = await fetch('http://localhost:5001/api/financials/summary');
      const summaryData = await summaryRes.json();

      if (summaryData.success) {
        setSummary(summaryData.summary);
        setJobsByStatus(summaryData.jobsByStatus || []);
      }

      // Load insurance breakdown
      const insuranceRes = await fetch('http://localhost:5001/api/financials/by-insurance');
      const insuranceData = await insuranceRes.json();

      if (insuranceData.success) {
        setInsuranceBreakdown(insuranceData.breakdown || []);
      }

      // Load outstanding jobs
      const outstandingRes = await fetch('http://localhost:5001/api/financials/outstanding');
      const outstandingData = await outstandingRes.json();

      if (outstandingData.success) {
        setOutstandingJobs(outstandingData.jobs?.slice(0, 10) || []);
      }

      // Load monthly revenue
      const revenueRes = await fetch('http://localhost:5001/api/financials/monthly-revenue');
      const revenueData = await revenueRes.json();

      if (revenueData.success) {
        setMonthlyRevenue(revenueData.monthlyRevenue || []);
      }

    } catch (err) {
      console.error('Error loading financial data:', err);
      setError('Failed to load financial data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  const formatPercent = (value: number) => {
    return `${value.toFixed(1)}%`;
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error" sx={{ m: 2 }}>
        {error}
      </Alert>
    );
  }

  if (!summary) {
    return (
      <Alert severity="warning" sx={{ m: 2 }}>
        No financial data available
      </Alert>
    );
  }

  const collectionRate = summary.total_rcv > 0
    ? (summary.total_collected / summary.total_rcv) * 100
    : 0;

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom fontWeight="bold">
        Financial Metrics Dashboard
      </Typography>

      {/* Summary Cards */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" mb={1}>
                <Receipt color="primary" sx={{ mr: 1 }} />
                <Typography variant="h6">Total RCV</Typography>
              </Box>
              <Typography variant="h4" color="primary">
                {formatCurrency(summary.total_rcv)}
              </Typography>
              <Typography variant="body2" color="textSecondary">
                {summary.total_jobs} jobs
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" mb={1}>
                <AttachMoney color="success" sx={{ mr: 1 }} />
                <Typography variant="h6">Collected</Typography>
              </Box>
              <Typography variant="h4" color="success.main">
                {formatCurrency(summary.total_collected)}
              </Typography>
              <Typography variant="body2" color="textSecondary">
                {formatPercent(collectionRate)} collection rate
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" mb={1}>
                <AccountBalance color="warning" sx={{ mr: 1 }} />
                <Typography variant="h6">Outstanding</Typography>
              </Box>
              <Typography variant="h4" color="warning.main">
                {formatCurrency(summary.total_outstanding)}
              </Typography>
              <Typography variant="body2" color="textSecondary">
                Balance due
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" mb={1}>
                <Warning color="error" sx={{ mr: 1 }} />
                <Typography variant="h6">Awaiting Payment</Typography>
              </Box>
              <Typography variant="h4" color="error.main">
                {summary.jobs_awaiting_payment}
              </Typography>
              <Typography variant="body2" color="textSecondary">
                {formatCurrency(summary.amount_awaiting_payment)}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Collection Rate Progress */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Overall Collection Rate
          </Typography>
          <Box display="flex" alignItems="center">
            <Box flex={1} mr={2}>
              <LinearProgress
                variant="determinate"
                value={collectionRate}
                sx={{ height: 10, borderRadius: 5 }}
              />
            </Box>
            <Typography variant="h6">{formatPercent(collectionRate)}</Typography>
          </Box>
        </CardContent>
      </Card>

      {/* Tabs for different views */}
      <Card>
        <Tabs value={activeTab} onChange={(_, newValue) => setActiveTab(newValue)}>
          <Tab label="Insurance Breakdown" />
          <Tab label="Top Outstanding" />
          <Tab label="Monthly Revenue" />
        </Tabs>

        <CardContent>
          {/* Insurance Breakdown Tab */}
          {activeTab === 0 && (
            <Box>
              <Typography variant="h6" gutterBottom>
                Breakdown by Insurance Company
              </Typography>
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Insurance Company</TableCell>
                      <TableCell align="right">Jobs</TableCell>
                      <TableCell align="right">Total RCV</TableCell>
                      <TableCell align="right">Collected</TableCell>
                      <TableCell align="right">Outstanding</TableCell>
                      <TableCell align="right">Collection Rate</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {insuranceBreakdown.map((item, index) => (
                      <TableRow key={index}>
                        <TableCell>
                          <Chip label={item.insurance_company} size="small" />
                        </TableCell>
                        <TableCell align="right">{item.job_count}</TableCell>
                        <TableCell align="right">{formatCurrency(item.total_rcv)}</TableCell>
                        <TableCell align="right">{formatCurrency(item.total_collected)}</TableCell>
                        <TableCell align="right">{formatCurrency(item.total_outstanding)}</TableCell>
                        <TableCell align="right">
                          <Chip
                            label={formatPercent(item.avg_collection_rate || 0)}
                            color={item.avg_collection_rate >= 80 ? 'success' : item.avg_collection_rate >= 50 ? 'warning' : 'error'}
                            size="small"
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>

              {/* Insurance Pie Chart */}
              <Box mt={4}>
                <Typography variant="h6" gutterBottom>
                  RCV Distribution by Insurance Company
                </Typography>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={insuranceBreakdown}
                      dataKey="total_rcv"
                      nameKey="insurance_company"
                      cx="50%"
                      cy="50%"
                      outerRadius={100}
                      label={(props: any) => {
                        const entry = insuranceBreakdown[props.index];
                        return `${entry.insurance_company}: ${formatCurrency(entry.total_rcv)}`;
                      }}
                    >
                      {insuranceBreakdown.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: any) => formatCurrency(value)} />
                  </PieChart>
                </ResponsiveContainer>
              </Box>
            </Box>
          )}

          {/* Top Outstanding Tab */}
          {activeTab === 1 && (
            <Box>
              <Typography variant="h6" gutterBottom>
                Top 10 Jobs by Outstanding Balance
              </Typography>
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Customer</TableCell>
                      <TableCell>Address</TableCell>
                      <TableCell>Insurance</TableCell>
                      <TableCell align="right">RCV</TableCell>
                      <TableCell align="right">Collected</TableCell>
                      <TableCell align="right">Outstanding</TableCell>
                      <TableCell align="right">Days Supplementing</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {outstandingJobs.map((job) => (
                      <TableRow key={job.id}>
                        <TableCell>{job.homeowner_name}</TableCell>
                        <TableCell>{job.property_address || 'N/A'}</TableCell>
                        <TableCell>
                          <Chip label={job.insurance_company} size="small" />
                        </TableCell>
                        <TableCell align="right">{formatCurrency(job.rcv_amount)}</TableCell>
                        <TableCell align="right">{formatCurrency(job.collected_amount)}</TableCell>
                        <TableCell align="right">
                          <Typography color="error" fontWeight="bold">
                            {formatCurrency(job.outstanding_balance)}
                          </Typography>
                        </TableCell>
                        <TableCell align="right">
                          <Chip
                            label={`${job.days_supplementing || 0} days`}
                            color={job.days_supplementing > 30 ? 'error' : 'default'}
                            size="small"
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>
          )}

          {/* Monthly Revenue Tab */}
          {activeTab === 2 && (
            <Box>
              <Typography variant="h6" gutterBottom>
                Monthly Revenue Trends
              </Typography>
              <ResponsiveContainer width="100%" height={400}>
                <BarChart data={monthlyRevenue}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis tickFormatter={(value: number) => `$${(value / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={(value: any) => formatCurrency(value)} />
                  <Legend />
                  <Bar dataKey="total_rcv" name="Total RCV" fill="#0088FE" />
                  <Bar dataKey="total_collected" name="Collected" fill="#00C49F" />
                  <Bar dataKey="outstanding" name="Outstanding" fill="#FF8042" />
                </BarChart>
              </ResponsiveContainer>

              {/* Monthly Revenue Table */}
              <Box mt={4}>
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Month</TableCell>
                        <TableCell align="right">Jobs</TableCell>
                        <TableCell align="right">Total RCV</TableCell>
                        <TableCell align="right">Collected</TableCell>
                        <TableCell align="right">Outstanding</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {monthlyRevenue.map((month) => (
                        <TableRow key={month.month}>
                          <TableCell>{month.month}</TableCell>
                          <TableCell align="right">{month.job_count}</TableCell>
                          <TableCell align="right">{formatCurrency(month.total_rcv)}</TableCell>
                          <TableCell align="right">{formatCurrency(month.total_collected)}</TableCell>
                          <TableCell align="right">{formatCurrency(month.outstanding)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Box>
            </Box>
          )}
        </CardContent>
      </Card>
    </Box>
  );
};

export default FinancialMetrics;
