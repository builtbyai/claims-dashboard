import React, { useState } from 'react';
import {
  Box,
  Paper,
  Typography,
  Chip,
  Grid,
  Card,
  CardContent,
  List,
  ListItem,
  ListItemText,
  ListItemAvatar,
  Avatar,
  Divider,
  Badge,
  Tooltip,
} from '@mui/material';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import interactionPlugin from '@fullcalendar/interaction';
import { formatDistanceToNow, differenceInDays, format, isPast, isFuture } from 'date-fns';
import EventIcon from '@mui/icons-material/Event';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ScheduleIcon from '@mui/icons-material/Schedule';
import PhotoCameraIcon from '@mui/icons-material/PhotoCamera';
import WarningIcon from '@mui/icons-material/Warning';

interface InstallCalendarProps {
  customers: any[];
  onDateClick?: (date: Date) => void;
  onEventClick?: (customer: any) => void;
}

// Calculate days until/since install
const getInstallDays = (customer: any) => {
  const now = new Date();

  if (customer.date_roof_completed) {
    const completedDate = new Date(customer.date_roof_completed);
    const days = differenceInDays(now, completedDate);
    return {
      type: 'completed',
      days,
      text: `${days} days ago`,
      color: '#4caf50',
    };
  }

  if (customer.date_roof_scheduled) {
    const scheduledDate = new Date(customer.date_roof_scheduled);
    const days = differenceInDays(scheduledDate, now);

    if (days < 0) {
      return {
        type: 'overdue',
        days: Math.abs(days),
        text: `${Math.abs(days)} days overdue`,
        color: '#f44336',
      };
    }

    return {
      type: 'upcoming',
      days,
      text: `in ${days} days`,
      color: '#2196f3',
    };
  }

  return null;
};

// Get supplementing duration
const getSupplementingDays = (customer: any) => {
  if (!customer.supplement_sent_date) return null;

  const sentDate = new Date(customer.supplement_sent_date);
  const now = new Date();
  const days = differenceInDays(now, sentDate);

  return {
    days,
    isUrgent: days > 7,
    text: `${days} days supplementing`,
  };
};

export default function InstallCalendar({ customers, onDateClick, onEventClick }: InstallCalendarProps) {
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  // Prepare calendar events
  const calendarEvents = customers
    .filter(c => c.date_roof_scheduled || c.date_roof_completed)
    .map(customer => {
      const isCompleted = !!customer.date_roof_completed;
      const eventDate = isCompleted
        ? customer.date_roof_completed
        : customer.date_roof_scheduled;

      return {
        id: customer.id,
        title: customer.name,
        date: eventDate,
        backgroundColor: isCompleted ? '#4caf50' : '#2196f3',
        borderColor: isCompleted ? '#388e3c' : '#1976d2',
        extendedProps: {
          customer,
          isCompleted,
          photoCount: customer.photo_count,
          crewName: customer.roofing_crew,
        },
      };
    });

  // Get upcoming installs (next 30 days)
  const upcomingInstalls = customers
    .filter(c => c.date_roof_scheduled && isFuture(new Date(c.date_roof_scheduled)))
    .map(c => ({
      ...c,
      installInfo: getInstallDays(c),
    }))
    .sort((a, b) => {
      const dateA = new Date(a.date_roof_scheduled).getTime();
      const dateB = new Date(b.date_roof_scheduled).getTime();
      return dateA - dateB;
    })
    .slice(0, 10); // Top 10 upcoming

  // Get recent completions (last 30 days)
  const recentCompletions = customers
    .filter(c => c.date_roof_completed && isPast(new Date(c.date_roof_completed)))
    .map(c => ({
      ...c,
      installInfo: getInstallDays(c),
    }))
    .sort((a, b) => {
      const dateA = new Date(b.date_roof_completed).getTime();
      const dateB = new Date(a.date_roof_completed).getTime();
      return dateA - dateB;
    })
    .slice(0, 10); // Top 10 recent

  // Get customers supplementing (with photo count)
  const supplementingCustomers = customers
    .filter(c => c.supplement_sent_date && !c.date_roof_completed)
    .map(c => ({
      ...c,
      suppInfo: getSupplementingDays(c),
    }))
    .sort((a, b) => {
      const daysA = a.suppInfo?.days || 0;
      const daysB = b.suppInfo?.days || 0;
      return daysB - daysA; // Most days first
    });

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom fontWeight="bold">
        📅 Install Calendar & Timeline
      </Typography>

      <Grid container spacing={3}>
        {/* Calendar */}
        <Grid item xs={12} lg={8}>
          <Paper elevation={3} sx={{ p: 2 }}>
            <FullCalendar
              plugins={[dayGridPlugin, interactionPlugin]}
              initialView="dayGridMonth"
              events={calendarEvents}
              height="600px"
              headerToolbar={{
                left: 'prev,next today',
                center: 'title',
                right: 'dayGridMonth,dayGridWeek',
              }}
              eventClick={(info: any) => {
                if (onEventClick) {
                  onEventClick(info.event.extendedProps.customer);
                }
              }}
              dateClick={(info: any) => {
                setSelectedDate(new Date(info.dateStr));
                if (onDateClick) {
                  onDateClick(new Date(info.dateStr));
                }
              }}
            />

            {/* Legend */}
            <Box sx={{ display: 'flex', gap: 2, mt: 2, justifyContent: 'center' }}>
              <Chip
                icon={<ScheduleIcon />}
                label="Scheduled"
                sx={{ bgcolor: '#2196f3', color: 'white' }}
                size="small"
              />
              <Chip
                icon={<CheckCircleIcon />}
                label="Completed"
                sx={{ bgcolor: '#4caf50', color: 'white' }}
                size="small"
              />
            </Box>
          </Paper>
        </Grid>

        {/* Side Panel */}
        <Grid item xs={12} lg={4}>
          {/* Upcoming Installs */}
          <Paper elevation={3} sx={{ p: 2, mb: 2 }}>
            <Typography variant="h6" gutterBottom fontWeight="bold">
              ⏰ Upcoming Installs
            </Typography>
            <List dense>
              {upcomingInstalls.length === 0 ? (
                <Typography variant="body2" color="text.secondary" sx={{ p: 2, textAlign: 'center' }}>
                  No upcoming installs scheduled
                </Typography>
              ) : (
                upcomingInstalls.map((customer) => (
                  <React.Fragment key={customer.id}>
                    <ListItem
                      button
                      onClick={() => onEventClick && onEventClick(customer)}
                    >
                      <ListItemAvatar>
                        <Avatar sx={{ bgcolor: customer.installInfo?.color }}>
                          <EventIcon />
                        </Avatar>
                      </ListItemAvatar>
                      <ListItemText
                        primary={customer.name}
                        secondary={
                          <>
                            <Typography component="span" variant="caption" display="block">
                              📅 {format(new Date(customer.date_roof_scheduled), 'MMM dd, yyyy')}
                            </Typography>
                            <Typography component="span" variant="caption" color="primary" fontWeight="bold">
                              {customer.installInfo?.text}
                            </Typography>
                            {customer.roofing_crew && (
                              <Typography component="span" variant="caption" display="block">
                                👷 {customer.roofing_crew}
                              </Typography>
                            )}
                          </>
                        }
                      />
                      <Chip
                        label={`${customer.installInfo?.days}d`}
                        size="small"
                        color="primary"
                      />
                    </ListItem>
                    <Divider />
                  </React.Fragment>
                ))
              )}
            </List>
          </Paper>

          {/* Recent Completions */}
          <Paper elevation={3} sx={{ p: 2, mb: 2 }}>
            <Typography variant="h6" gutterBottom fontWeight="bold">
              ✅ Recent Completions
            </Typography>
            <List dense>
              {recentCompletions.length === 0 ? (
                <Typography variant="body2" color="text.secondary" sx={{ p: 2, textAlign: 'center' }}>
                  No recent completions
                </Typography>
              ) : (
                recentCompletions.map((customer) => (
                  <React.Fragment key={customer.id}>
                    <ListItem>
                      <ListItemAvatar>
                        <Avatar sx={{ bgcolor: '#4caf50' }}>
                          <CheckCircleIcon />
                        </Avatar>
                      </ListItemAvatar>
                      <ListItemText
                        primary={customer.name}
                        secondary={
                          <>
                            <Typography component="span" variant="caption" display="block">
                              ✅ {format(new Date(customer.date_roof_completed), 'MMM dd, yyyy')}
                            </Typography>
                            <Typography component="span" variant="caption" color="success.main">
                              {customer.installInfo?.text}
                            </Typography>
                          </>
                        }
                      />
                    </ListItem>
                    <Divider />
                  </React.Fragment>
                ))
              )}
            </List>
          </Paper>

          {/* Supplementing Tracker */}
          <Paper elevation={3} sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom fontWeight="bold">
              📸 Supplementing Status
            </Typography>
            <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
              Days supplementing + photo count
            </Typography>
            <List dense>
              {supplementingCustomers.length === 0 ? (
                <Typography variant="body2" color="text.secondary" sx={{ p: 2, textAlign: 'center' }}>
                  No active supplements
                </Typography>
              ) : (
                supplementingCustomers.slice(0, 5).map((customer) => (
                  <React.Fragment key={customer.id}>
                    <ListItem>
                      <ListItemAvatar>
                        <Badge
                          badgeContent={customer.photo_count}
                          color={customer.photo_count >= 80 ? 'error' : 'primary'}
                        >
                          <Avatar
                            sx={{
                              bgcolor: customer.suppInfo?.isUrgent ? '#ff9800' : '#2196f3',
                            }}
                          >
                            {customer.suppInfo?.isUrgent ? <WarningIcon /> : <PhotoCameraIcon />}
                          </Avatar>
                        </Badge>
                      </ListItemAvatar>
                      <ListItemText
                        primary={customer.name}
                        secondary={
                          <>
                            <Typography
                              component="span"
                              variant="caption"
                              color={customer.suppInfo?.isUrgent ? 'warning.main' : 'text.secondary'}
                              fontWeight={customer.suppInfo?.isUrgent ? 'bold' : 'normal'}
                            >
                              {customer.suppInfo?.text}
                            </Typography>
                            <Typography component="span" variant="caption" display="block">
                              📸 {customer.photo_count} photos
                              {customer.photo_count >= 80 && ' - URGENT'}
                            </Typography>
                          </>
                        }
                      />
                    </ListItem>
                    <Divider />
                  </React.Fragment>
                ))
              )}
            </List>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
}
