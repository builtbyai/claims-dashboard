import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Button,
  Alert,
  Grid,
  Tabs,
  Tab,
  Paper,
  Typography,
  Chip,
  Divider,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import PersonIcon from '@mui/icons-material/Person';
import BusinessIcon from '@mui/icons-material/Business';
import AttachMoneyIcon from '@mui/icons-material/AttachMoney';
import PhotoCameraIcon from '@mui/icons-material/PhotoCamera';
import TimelineIcon from '@mui/icons-material/Timeline';
import FolderIcon from '@mui/icons-material/Folder';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import EmailIcon from '@mui/icons-material/Email';
import { Customer, Activity, FolderInfo } from '../../types/customer';
import { customerService } from '../../services/customerService';
import ProfilePanel from './ProfilePanel';
import TimelinePanel from './TimelinePanel';
import FolderBrowser from './FolderBrowser';
import LoadingSpinner from '../Common/LoadingSpinner';
import Breadcrumbs from '../Layout/Breadcrumbs';
import EmailTrackingPanel from '../Email/EmailTrackingPanel';

// New enhanced panels
import InsurancePanel from './InsurancePanel';
// import EstimatesPanel from './EstimatesPanel';
// import PhotoGallery from './PhotoGallery';
// import InstallSchedule from './InstallSchedule';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`customer-tabpanel-${index}`}
      aria-labelledby={`customer-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ pt: 3 }}>{children}</Box>}
    </div>
  );
}

export default function EnhancedCustomerDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [folders, setFolders] = useState<FolderInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentTab, setCurrentTab] = useState(0);

  // Mock email data (will be replaced with real API calls)
  const [emails, setEmails] = useState([
    {
      id: '1',
      subject: 'Estimate Approval - Job #3518605',
      from: 'claims@insurer.example',
      to: 'supplement@summit-roofing.example',
      date: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // 2 hours ago
      preview: 'Your supplement for Sample Customer has been approved. Please proceed with installation scheduling.',
      hasAttachment: true,
      isUnread: true,
      isUrgent: false,
      category: 'approval' as const,
    },
    {
      id: '2',
      subject: 'Supplement Request - Additional Items',
      from: 'supplement@summit-roofing.example',
      to: 'claims@insurer.example',
      date: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(), // 2 days ago
      preview: 'Please review the attached supplement request for additional scope items identified during inspection.',
      hasAttachment: true,
      isUnread: false,
      isUrgent: false,
      category: 'supplement' as const,
    },
  ]);

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

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setCurrentTab(newValue);
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

      {/* Header with quick info */}
      <Paper elevation={2} sx={{ p: 2, mb: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Box>
            <Typography variant="h4" fontWeight="bold">
              {customer.name}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {customer.property_address}, {customer.city}, {customer.state} {customer.zip}
            </Typography>
          </Box>

          <Box sx={{ display: 'flex', gap: 1 }}>
            {customer.job_id && (
              <Chip
                label={`Job #${customer.job_id}`}
                color="primary"
                variant="outlined"
              />
            )}
            {customer.photo_count >= 80 && (
              <Chip
                label="SUPPLEMENT NEEDED"
                color="error"
                icon={<PhotoCameraIcon />}
              />
            )}
          </Box>
        </Box>

        <Button
          startIcon={<ArrowBackIcon />}
          onClick={() => navigate('/')}
          variant="outlined"
          size="small"
        >
          Back to Dashboard
        </Button>
      </Paper>

      {/* Tabs */}
      <Paper elevation={2}>
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs
            value={currentTab}
            onChange={handleTabChange}
            variant="scrollable"
            scrollButtons="auto"
          >
            <Tab icon={<PersonIcon />} label="Profile" />
            <Tab icon={<BusinessIcon />} label="Insurance" />
            <Tab icon={<AttachMoneyIcon />} label="Estimates" />
            <Tab icon={<PhotoCameraIcon />} label="Photos" />
            <Tab icon={<EmailIcon />} label="Emails" />
            <Tab icon={<TimelineIcon />} label="Timeline" />
            <Tab icon={<FolderIcon />} label="Folders" />
            <Tab icon={<CalendarTodayIcon />} label="Schedule" />
          </Tabs>
        </Box>

        {/* Profile Tab */}
        <TabPanel value={currentTab} index={0}>
          <Box sx={{ p: 3 }}>
            <ProfilePanel customer={customer} />
          </Box>
        </TabPanel>

        {/* Insurance Tab */}
        <TabPanel value={currentTab} index={1}>
          <Box sx={{ p: 3 }}>
            <InsurancePanel customer={customer} />
          </Box>
        </TabPanel>

        {/* Estimates Tab */}
        <TabPanel value={currentTab} index={2}>
          <Box sx={{ p: 3 }}>
            <Typography variant="h6">Estimates Panel</Typography>
            <Typography variant="body2" color="text.secondary">Coming soon...</Typography>
          </Box>
        </TabPanel>

        {/* Photos Tab */}
        <TabPanel value={currentTab} index={3}>
          <Box sx={{ p: 3 }}>
            <Typography variant="h6">Photo Gallery</Typography>
            <Typography variant="body2" color="text.secondary">
              Total Photos: {customer.photo_count}
            </Typography>
          </Box>
        </TabPanel>

        {/* Emails Tab */}
        <TabPanel value={currentTab} index={4}>
          <Box sx={{ p: 3 }}>
            <EmailTrackingPanel
              customerId={customer.id}
              customerName={customer.name}
              emails={emails}
              onEmailClick={(emailId) => console.log('Open email:', emailId)}
              onReply={(emailId) => console.log('Reply to:', emailId)}
              onComposeNew={() => console.log('Compose new email')}
            />
          </Box>
        </TabPanel>

        {/* Timeline Tab */}
        <TabPanel value={currentTab} index={5}>
          <Box sx={{ p: 3 }}>
            <TimelinePanel activities={activities} />
          </Box>
        </TabPanel>

        {/* Folders Tab */}
        <TabPanel value={currentTab} index={6}>
          <Box sx={{ p: 3 }}>
            <FolderBrowser folders={folders} />
          </Box>
        </TabPanel>

        {/* Schedule Tab */}
        <TabPanel value={currentTab} index={7}>
          <Box sx={{ p: 3 }}>
            <Typography variant="h6">Install Schedule</Typography>
            <Typography variant="body2" color="text.secondary">Coming soon...</Typography>
          </Box>
        </TabPanel>
      </Paper>
    </Box>
  );
}
