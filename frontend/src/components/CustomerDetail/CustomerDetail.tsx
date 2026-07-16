import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Button,
  Alert,
  Grid,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { Customer, Activity, FolderInfo } from '../../types/customer';
import { customerService } from '../../services/customerService';
import ProfilePanel from './ProfilePanel';
import TimelinePanel from './TimelinePanel';
import FolderBrowser from './FolderBrowser';
import LoadingSpinner from '../Common/LoadingSpinner';
import Breadcrumbs from '../Layout/Breadcrumbs';

const CustomerDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [folders, setFolders] = useState<FolderInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (id) {
      loadCustomerData(parseInt(id));
    }
  }, [id]);

  const loadCustomerData = async (customerId: number) => {
    try {
      setLoading(true);
      setError(null);

      const [customerData, activitiesData, foldersData] = await Promise.all([
        customerService.getCustomerById(customerId),
        customerService.getCustomerActivities(customerId),
        customerService.getCustomerFolders(customerId),
      ]);

      setCustomer(customerData);
      setActivities(activitiesData);
      setFolders(foldersData);
    } catch (err) {
      setError('Failed to load customer details. Please try again later.');
      console.error('Error loading customer data:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <LoadingSpinner message="Loading customer details..." />;
  }

  if (error || !customer) {
    return (
      <Box>
        <Alert severity="error" sx={{ mt: 2 }}>
          {error || 'Customer not found'}
        </Alert>
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={() => navigate('/')}
          sx={{ mt: 2 }}
        >
          Back to Dashboard
        </Button>
      </Box>
    );
  }

  const breadcrumbItems = [
    { label: 'Dashboard', path: '/' },
    { label: customer.name },
  ];

  return (
    <Box>
      <Breadcrumbs items={breadcrumbItems} />

      <Button
        startIcon={<ArrowBackIcon />}
        onClick={() => navigate('/')}
        sx={{ mb: 3 }}
      >
        Back to Dashboard
      </Button>

      <Grid container spacing={3}>
        <Grid item xs={12}>
          <ProfilePanel customer={customer} />
        </Grid>

        <Grid item xs={12} md={6}>
          <FolderBrowser folders={folders} />
        </Grid>

        <Grid item xs={12} md={6}>
          <TimelinePanel activities={activities} />
        </Grid>
      </Grid>
    </Box>
  );
};

export default CustomerDetail;
