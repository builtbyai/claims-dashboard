import React, { useState, useEffect, useMemo } from 'react';
import { Box, Typography, Alert } from '@mui/material';
import { Customer, StatusType, SortField, SortOrder } from '../../types/customer';
import { customerService } from '../../services/customerService';
import CustomerGrid from './CustomerGrid';
import FilterBar from './FilterBar';
import LoadingSpinner from '../Common/LoadingSpinner';

interface DashboardProps {
  searchQuery?: string;
}

const Dashboard: React.FC<DashboardProps> = ({ searchQuery = '' }) => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusType | 'all'>('all');
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');

  useEffect(() => {
    loadCustomers();
  }, []);

  const loadCustomers = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await customerService.getAllCustomers();
      setCustomers(data);
    } catch (err) {
      setError('Failed to load customers. Please try again later.');
      console.error('Error loading customers:', err);
    } finally {
      setLoading(false);
    }
  };

  const filteredAndSortedCustomers = useMemo(() => {
    let result = [...customers];

    // Apply search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (customer) =>
          customer.name.toLowerCase().includes(query) ||
          customer.property_address.toLowerCase().includes(query) ||
          customer.city.toLowerCase().includes(query)
      );
    }

    // Apply status filter
    if (statusFilter !== 'all') {
      result = result.filter((customer) => customer.status === statusFilter);
    }

    // Apply sorting
    result.sort((a, b) => {
      let comparison = 0;

      switch (sortField) {
        case 'name':
          comparison = a.name.localeCompare(b.name);
          break;
        case 'created_at':
          comparison = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
          break;
        case 'supplement_count':
          comparison = a.supplement_count - b.supplement_count;
          break;
        case 'status':
          comparison = a.status.localeCompare(b.status);
          break;
      }

      return sortOrder === 'asc' ? comparison : -comparison;
    });

    return result;
  }, [customers, searchQuery, statusFilter, sortField, sortOrder]);

  const handleStatusChange = (status: StatusType | 'all') => {
    setStatusFilter(status);
  };

  const handleSortChange = (field: SortField, order: SortOrder) => {
    setSortField(field);
    setSortOrder(order);
  };

  if (loading) {
    return <LoadingSpinner message="Loading customers..." />;
  }

  if (error) {
    return (
      <Alert severity="error" sx={{ mt: 2 }}>
        {error}
      </Alert>
    );
  }

  return (
    <Box>
      <Box
        sx={{
          mb: 4,
          pb: 3,
          borderBottom: '1px solid',
          borderColor: 'divider',
        }}
      >
        <Typography
          variant="h4"
          sx={{
            fontWeight: 700,
            mb: 1,
            background: 'linear-gradient(135deg, #2563eb 0%, #7c3aed 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}
        >
          Customer Dashboard
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Manage and track your roofing supplement customers
        </Typography>
      </Box>

      <FilterBar
        statusFilter={statusFilter}
        sortField={sortField}
        sortOrder={sortOrder}
        onStatusChange={handleStatusChange}
        onSortChange={handleSortChange}
      />

      {filteredAndSortedCustomers.length === 0 ? (
        <Alert
          severity="info"
          sx={{
            borderRadius: 2,
            border: '1px solid',
            borderColor: 'info.light',
            bgcolor: 'info.lighter',
          }}
        >
          {searchQuery
            ? `No customers found matching "${searchQuery}"`
            : 'No customers found'}
        </Alert>
      ) : (
        <>
          <Box
            sx={{
              mb: 3,
              p: 2,
              bgcolor: 'background.paper',
              borderRadius: 2,
              border: '1px solid',
              borderColor: 'divider',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <Typography variant="body1" fontWeight={600} color="text.primary">
              Showing {filteredAndSortedCustomers.length} customer{filteredAndSortedCustomers.length !== 1 ? 's' : ''}
            </Typography>
            {searchQuery && (
              <Typography variant="body2" color="primary.main" fontWeight={500}>
                Filtered by: "{searchQuery}"
              </Typography>
            )}
          </Box>
          <CustomerGrid customers={filteredAndSortedCustomers} />
        </>
      )}
    </Box>
  );
};

export default Dashboard;
