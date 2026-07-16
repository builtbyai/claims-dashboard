import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, CircularProgress, Alert } from '@mui/material';
import InstallCalendar from './InstallCalendar';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:5001/api';

export default function CalendarPage() {
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    fetchCustomers();
  }, []);

  const fetchCustomers = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE}/customers`);
      if (!response.ok) throw new Error('Failed to fetch customers');
      const result = await response.json();
      setCustomers(result.data || result);
      setError(null);
    } catch (err: any) {
      console.error('Error fetching customers:', err);
      setError(err.message || 'Failed to load customers');
    } finally {
      setLoading(false);
    }
  };

  const handleEventClick = (customer: any) => {
    navigate(`/customers/${customer.id}`);
  };

  const handleDateClick = (date: Date) => {
    console.log('Date clicked:', date);
    // You can implement additional functionality here (e.g., create event)
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
    <InstallCalendar
      customers={customers}
      onDateClick={handleDateClick}
      onEventClick={handleEventClick}
    />
  );
}
