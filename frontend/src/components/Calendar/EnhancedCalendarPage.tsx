import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  CircularProgress,
  Alert,
  Grid,
  Paper,
  Typography,
  List,
  ListItem,
  ListItemText,
  ListItemAvatar,
  Avatar,
  Chip,
  Divider,
  Card,
  CardContent,
  Badge,
  Tooltip,
  IconButton,
} from '@mui/material';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import listPlugin from '@fullcalendar/list';
import interactionPlugin from '@fullcalendar/interaction';
import { format, isPast, isFuture, differenceInDays, isToday } from 'date-fns';
import EventIcon from '@mui/material/icons/Event';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ScheduleIcon from '@mui/icons-material/Schedule';
import PhotoCameraIcon from '@mui/icons-material/PhotoCamera';
import WarningIcon from '@mui/icons-material/Warning';
import AttachMoneyIcon from '@mui/icons-material/AttachMoney';
import PersonIcon from '@mui/icons-material/Person';
import HomeIcon from '@mui/icons-material/Home';
import RefreshIcon from '@mui/icons-material/Refresh';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

interface Customer {
  id: number;
  name: string;
  property_address?: string;
  city?: string;
  state?: string;
  zip?: string;
  phone?: string;
  email?: string;
  status: string;
  job_id?: string;
  claim_number?: string;
  insurance_company?: string;
  sales_rep?: string;
  project_manager?: string;
  grand_total?: number;
  balance?: number;
  photo_count: number;
  install_date?: string;
  kanban_stage?: string;
  profile_path?: string;
}

interface CustomerActivity {
  id: number;
  customer_id: number;
  activity_type: string;
  activity_date: string;
  description: string;
  created_by?: string;
  notes?: string;
}

export default function EnhancedCalendarPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [activities, setActivities] = useState<CustomerActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);

      // Fetch customers
      const customersResponse = await fetch(`${API_BASE}/customers`);
      if (!customersResponse.ok) throw new Error('Failed to fetch customers');
      const customersData = await customersResponse.json();
      setCustomers(customersData.data || customersData || []);

      // Fetch activities
      const activitiesResponse = await fetch(`${API_BASE}/activities`);
      if (activitiesResponse.ok) {
        const activitiesData = await activitiesResponse.json();
        setActivities(activitiesData.data || activitiesData || []);
      }

      setError(null);
    } catch (err: any) {
      console.error('Error fetching data:', err);
      setError(err.message || 'Failed to load calendar data');
    } finally {
      setLoading(false);
    }
  };

  // Prepare calendar events from customers and activities
  const calendarEvents = [
    // Install dates from customers
    ...customers
      .filter(c => c.install_date)
      .map(customer => ({
        id: `customer-${customer.id}`,
        title: `🏠 ${customer.name} - Installation`,
        date: customer.install_date,
        backgroundColor: isToday(new Date(customer.install_date!)) ? '#ff9800' : '#2196f3',
        borderColor: isToday(new Date(customer.install_date!)) ? '#f57c00' : '#1976d2',
        extendedProps: {
          customer,
          type: 'installation',
          description: `Roof installation at ${customer.property_address || 'TBD'}`,
        },
      })),

    // Activities from database
    ...activities.map(activity => {
      const customer = customers.find(c => c.id === activity.customer_id);
      return {
        id: `activity-${activity.id}`,
        title: `${activity.activity_type === 'installation' ? '🏠' : '📋'} ${customer?.name || 'Unknown'} - ${activity.activity_type}`,
        date: activity.activity_date,
        backgroundColor: activity.activity_type === 'installation' ? '#2196f3' : '#9c27b0',
        borderColor: activity.activity_type === 'installation' ? '#1976d2' : '#7b1fa2',
        extendedProps: {
          customer,
          activity,
          type: activity.activity_type,
          description: activity.description,
        },
      };
    }),
  ];

  // Get upcoming events
  const upcomingEvents = calendarEvents
    .filter(e => isFuture(new Date(e.date)))
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .slice(0, 10);

  // Get today's events
  const todayEvents = calendarEvents
    .filter(e => isToday(new Date(e.date)));

  // Get overdue events
  const overdueEvents = customers
    .filter(c => c.install_date && isPast(new Date(c.install_date)) && c.status !== 'completed')
    .map(c => ({
      ...c,
      daysOverdue: differenceInDays(new Date(), new Date(c.install_date!)),
    }))
    .sort((a, b) => b.daysOverdue - a.daysOverdue);

  // Get high-value customers with upcoming installs
  const highValueUpcoming = customers
    .filter(c => c.install_date && isFuture(new Date(c.install_date)) && (c.balance || 0) > 15000)
    .sort((a, b) => (b.balance || 0) - (a.balance || 0));

  const handleEventClick = (info: any) => {
    const { customer } = info.event.extendedProps;
    if (customer) {
      navigate(`/customers/${customer.id}`);
    }
  };

  const handleDateClick = (info: any) => {
    setSelectedDate(new Date(info.dateStr));
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
        <CircularProgress size={60} />
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error" onClose={() => setError(null)}>
          {error}
        </Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" fontWeight="bold">
          📅 Enhanced Installation Calendar
        </Typography>
        <IconButton onClick={fetchData} color="primary">
          <RefreshIcon />
        </IconButton>
      </Box>

      <Grid container spacing={3}>
        {/* Main Calendar */}
        <Grid item xs={12} lg={8}>
          <Paper elevation={3} sx={{ p: 2 }}>
            <FullCalendar
              plugins={[dayGridPlugin, listPlugin, interactionPlugin]}
              initialView="dayGridMonth"
              events={calendarEvents}
              height="700px"
              headerToolbar={{
                left: 'prev,next today',
                center: 'title',
                right: 'dayGridMonth,dayGridWeek,listWeek',
              }}
              eventClick={handleEventClick}
              dateClick={handleDateClick}
              eventDisplay="block"
              displayEventTime={false}
            />

            {/* Legend */}
            <Box sx={{ display: 'flex', gap: 2, mt: 2, justifyContent: 'center', flexWrap: 'wrap' }}>
              <Chip
                icon={<ScheduleIcon />}
                label="Installation"
                sx={{ bgcolor: '#2196f3', color: 'white' }}
                size="small"
              />
              <Chip
                icon={<EventIcon />}
                label="Today's Event"
                sx={{ bgcolor: '#ff9800', color: 'white' }}
                size="small"
              />
              <Chip
                icon={<EventIcon />}
                label="Other Activity"
                sx={{ bgcolor: '#9c27b0', color: 'white' }}
                size="small"
              />
            </Box>
          </Paper>
        </Grid>

        {/* Side Panels */}
        <Grid item xs={12} lg={4}>
          {/* Today's Events */}
          {todayEvents.length > 0 && (
            <Paper elevation={3} sx={{ p: 2, mb: 2, bgcolor: '#fff3e0' }}>
              <Typography variant="h6" gutterBottom fontWeight="bold">
                📍 Today's Installations
              </Typography>
              <List dense>
                {todayEvents.map((event, idx) => (
                  <React.Fragment key={event.id}>
                    <ListItem>
                      <ListItemAvatar>
                        <Avatar sx={{ bgcolor: '#ff9800' }}>
                          <EventIcon />
                        </Avatar>
                      </ListItemAvatar>
                      <ListItemText
                        primary={event.extendedProps.customer?.name}
                        secondary={event.extendedProps.description}
                      />
                    </ListItem>
                    {idx < todayEvents.length - 1 && <Divider />}
                  </React.Fragment>
                ))}
              </List>
            </Paper>
          )}

          {/* Upcoming Installations */}
          <Paper elevation={3} sx={{ p: 2, mb: 2 }}>
            <Typography variant="h6" gutterBottom fontWeight="bold">
              ⏰ Upcoming Installations
            </Typography>
            <List dense>
              {upcomingEvents.length === 0 ? (
                <Typography variant="body2" color="text.secondary" sx={{ p: 2, textAlign: 'center' }}>
                  No upcoming installations
                </Typography>
              ) : (
                upcomingEvents.map((event, idx) => {
                  const daysUntil = differenceInDays(new Date(event.date), new Date());
                  return (
                    <React.Fragment key={event.id}>
                      <ListItem
                        button
                        onClick={() => event.extendedProps.customer && navigate(`/customers/${event.extendedProps.customer.id}`)}
                      >
                        <ListItemAvatar>
                          <Avatar sx={{ bgcolor: '#2196f3' }}>
                            <HomeIcon />
                          </Avatar>
                        </ListItemAvatar>
                        <ListItemText
                          primary={event.extendedProps.customer?.name}
                          secondary={
                            <>
                              <Typography component="span" variant="caption" display="block">
                                📅 {format(new Date(event.date), 'MMM dd, yyyy')}
                              </Typography>
                              <Typography component="span" variant="caption" color="primary" fontWeight="bold">
                                in {daysUntil} day{daysUntil !== 1 ? 's' : ''}
                              </Typography>
                            </>
                          }
                        />
                        <Chip
                          label={`${daysUntil}d`}
                          size="small"
                          color="primary"
                        />
                      </ListItem>
                      {idx < upcomingEvents.length - 1 && <Divider />}
                    </React.Fragment>
                  );
                })
              )}
            </List>
          </Paper>

          {/* High-Value Upcoming */}
          {highValueUpcoming.length > 0 && (
            <Paper elevation={3} sx={{ p: 2, mb: 2, bgcolor: '#e8f5e9' }}>
              <Typography variant="h6" gutterBottom fontWeight="bold">
                💰 High-Value Upcoming
              </Typography>
              <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
                Installations over $15,000
              </Typography>
              <List dense>
                {highValueUpcoming.slice(0, 5).map((customer, idx) => (
                  <React.Fragment key={customer.id}>
                    <ListItem>
                      <ListItemAvatar>
                        <Avatar sx={{ bgcolor: '#4caf50' }}>
                          <AttachMoneyIcon />
                        </Avatar>
                      </ListItemAvatar>
                      <ListItemText
                        primary={customer.name}
                        secondary={
                          <>
                            <Typography component="span" variant="caption" display="block">
                              📅 {customer.install_date && format(new Date(customer.install_date), 'MMM dd')}
                            </Typography>
                            <Typography component="span" variant="caption" color="success.main" fontWeight="bold">
                              ${customer.balance?.toLocaleString()}
                            </Typography>
                          </>
                        }
                      />
                    </ListItem>
                    {idx < highValueUpcoming.length - 1 && <Divider />}
                  </React.Fragment>
                ))}
              </List>
            </Paper>
          )}

          {/* Overdue Installations */}
          {overdueEvents.length > 0 && (
            <Paper elevation={3} sx={{ p: 2, mb: 2, bgcolor: '#ffebee' }}>
              <Typography variant="h6" gutterBottom fontWeight="bold">
                ⚠️ Overdue Installations
              </Typography>
              <List dense>
                {overdueEvents.slice(0, 5).map((customer, idx) => (
                  <React.Fragment key={customer.id}>
                    <ListItem>
                      <ListItemAvatar>
                        <Avatar sx={{ bgcolor: '#f44336' }}>
                          <WarningIcon />
                        </Avatar>
                      </ListItemAvatar>
                      <ListItemText
                        primary={customer.name}
                        secondary={
                          <>
                            <Typography component="span" variant="caption" display="block">
                              📅 {customer.install_date && format(new Date(customer.install_date), 'MMM dd, yyyy')}
                            </Typography>
                            <Typography component="span" variant="caption" color="error" fontWeight="bold">
                              {customer.daysOverdue} days overdue
                            </Typography>
                          </>
                        }
                      />
                    </ListItem>
                    {idx < overdueEvents.length - 1 && <Divider />}
                  </React.Fragment>
                ))}
              </List>
            </Paper>
          )}

          {/* Summary Stats */}
          <Grid container spacing={2}>
            <Grid item xs={6}>
              <Card>
                <CardContent sx={{ textAlign: 'center' }}>
                  <Typography variant="h4" color="primary" fontWeight="bold">
                    {todayEvents.length}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Today
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={6}>
              <Card>
                <CardContent sx={{ textAlign: 'center' }}>
                  <Typography variant="h4" color="success.main" fontWeight="bold">
                    {upcomingEvents.length}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Upcoming
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={6}>
              <Card>
                <CardContent sx={{ textAlign: 'center' }}>
                  <Typography variant="h4" color="warning.main" fontWeight="bold">
                    {highValueUpcoming.length}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    High Value
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={6}>
              <Card>
                <CardContent sx={{ textAlign: 'center' }}>
                  <Typography variant="h4" color="error" fontWeight="bold">
                    {overdueEvents.length}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Overdue
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </Grid>
      </Grid>
    </Box>
  );
}
