import React, { useState, useEffect } from 'react';
import { Box, CircularProgress, Alert, Snackbar } from '@mui/material';
import KanbanBoard from './KanbanBoard';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:5001/api';

export default function KanbanPage() {
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false,
    message: '',
    severity: 'success',
  });

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

  const handleCustomerMove = async (customerId: number, newStage: string) => {
    try {
      // Optimistic update
      setCustomers(prev =>
        prev.map(c =>
          c.id === customerId ? { ...c, kanban_stage: newStage } : c
        )
      );

      // Update on backend
      const response = await fetch(`${API_BASE}/customers/${customerId}/kanban`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ kanban_stage: newStage }),
      });

      if (!response.ok) {
        throw new Error('Failed to update customer stage');
      }

      setSnackbar({
        open: true,
        message: 'Customer stage updated successfully',
        severity: 'success',
      });
    } catch (err: any) {
      console.error('Error updating customer stage:', err);

      // Revert optimistic update
      fetchCustomers();

      setSnackbar({
        open: true,
        message: err.message || 'Failed to update customer stage',
        severity: 'error',
      });
    }
  };

  const handleEmailClick = (customer: any) => {
    console.log('Email clicked for customer:', customer);
    // You can implement email functionality here or navigate to email panel
  };

  const handleCloseSnackbar = () => {
    setSnackbar({ ...snackbar, open: false });
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
    <>
      <KanbanBoard
        customers={customers}
        onCustomerMove={handleCustomerMove}
        onEmailClick={handleEmailClick}
      />

      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={handleCloseSnackbar}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert onClose={handleCloseSnackbar} severity={snackbar.severity} sx={{ width: '100%' }}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </>
  );
}
