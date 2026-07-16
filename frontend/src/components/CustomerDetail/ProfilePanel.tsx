import React from 'react';
import {
  Card,
  CardContent,
  Typography,
  Grid,
  Chip,
  Divider,
  Box,
} from '@mui/material';
import PhoneIcon from '@mui/icons-material/Phone';
import EmailIcon from '@mui/icons-material/Email';
import HomeIcon from '@mui/icons-material/Home';
import BusinessIcon from '@mui/icons-material/Business';
import { Customer } from '../../types/customer';
import { formatPhoneNumber, formatAddress } from '../../utils/formatters';
import StatusChip from '../Common/StatusChip';

interface ProfilePanelProps {
  customer: Customer;
}

const ProfilePanel: React.FC<ProfilePanelProps> = ({ customer }) => {
  return (
    <Card>
      <CardContent>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h5" sx={{ fontWeight: 600 }}>
            {customer.name}
          </Typography>
          <StatusChip status={customer.status} size="medium" />
        </Box>

        <Divider sx={{ mb: 2 }} />

        <Grid container spacing={2}>
          <Grid item xs={12} md={6}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
              <HomeIcon color="action" />
              <Box>
                <Typography variant="caption" color="text.secondary">
                  Property Address
                </Typography>
                <Typography variant="body2">
                  {formatAddress(
                    customer.property_address,
                    customer.city,
                    customer.state,
                    customer.zip
                  )}
                </Typography>
              </Box>
            </Box>
          </Grid>

          <Grid item xs={12} md={6}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
              <PhoneIcon color="action" />
              <Box>
                <Typography variant="caption" color="text.secondary">
                  Contact Phone
                </Typography>
                <Typography variant="body2">
                  {customer.contact_phone ? formatPhoneNumber(customer.contact_phone) : 'N/A'}
                </Typography>
              </Box>
            </Box>
          </Grid>

          <Grid item xs={12} md={6}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
              <EmailIcon color="action" />
              <Box>
                <Typography variant="caption" color="text.secondary">
                  Email
                </Typography>
                <Typography variant="body2">
                  {customer.contact_email || 'N/A'}
                </Typography>
              </Box>
            </Box>
          </Grid>

          <Grid item xs={12} md={6}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
              <BusinessIcon color="action" />
              <Box>
                <Typography variant="caption" color="text.secondary">
                  Insurance Company
                </Typography>
                <Typography variant="body2">
                  {customer.insurance_company || 'N/A'}
                </Typography>
              </Box>
            </Box>
          </Grid>
        </Grid>

        <Divider sx={{ my: 2 }} />

        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          {customer.job_id && (
            <Chip label={`Job ID: ${customer.job_id}`} size="small" variant="outlined" />
          )}
          {customer.claim_number && (
            <Chip label={`Claim: ${customer.claim_number}`} size="small" variant="outlined" />
          )}
          {customer.adjuster_name && (
            <Chip label={`Adjuster: ${customer.adjuster_name}`} size="small" variant="outlined" />
          )}
        </Box>
      </CardContent>
    </Card>
  );
};

export default ProfilePanel;
