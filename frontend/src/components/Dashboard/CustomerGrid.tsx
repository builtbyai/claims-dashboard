import React from 'react';
import { Grid } from '@mui/material';
import { Customer } from '../../types/customer';
import CustomerCard from './CustomerCard';

interface CustomerGridProps {
  customers: Customer[];
}

const CustomerGrid: React.FC<CustomerGridProps> = ({ customers }) => {
  return (
    <Grid container spacing={3}>
      {customers.map((customer) => (
        <Grid item xs={12} sm={6} md={4} key={customer.id}>
          <CustomerCard customer={customer} />
        </Grid>
      ))}
    </Grid>
  );
};

export default CustomerGrid;
