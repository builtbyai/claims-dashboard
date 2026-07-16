import React from 'react';
import {
  Box,
  Paper,
  Typography,
  Grid,
  Chip,
  IconButton,
  Tooltip,
  Divider,
  Link,
} from '@mui/material';
import BusinessIcon from '@mui/icons-material/Business';
import PhoneIcon from '@mui/icons-material/Phone';
import EmailIcon from '@mui/icons-material/Email';
import PersonIcon from '@mui/icons-material/Person';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import AssignmentIcon from '@mui/icons-material/Assignment';
import { Customer } from '../../types/customer';

interface InsurancePanelProps {
  customer: Customer;
}

const copyToClipboard = (text: string, label: string) => {
  navigator.clipboard.writeText(text);
  // Could add a snackbar notification here
  console.log(`Copied ${label}: ${text}`);
};

export default function InsurancePanel({ customer }: InsurancePanelProps) {
  const hasInsuranceInfo =
    customer.insurance_company ||
    customer.claim_number ||
    customer.adjuster_name;

  if (!hasInsuranceInfo) {
    return (
      <Box sx={{ textAlign: 'center', py: 8 }}>
        <BusinessIcon sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
        <Typography variant="h6" color="text.secondary">
          No Insurance Information
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          Insurance and adjuster details will appear here when available
        </Typography>
      </Box>
    );
  }

  return (
    <Box>
      <Typography variant="h5" fontWeight="bold" gutterBottom>
        🏢 Insurance & Claims Information
      </Typography>

      <Grid container spacing={3} sx={{ mt: 2 }}>
        {/* Insurance Company */}
        <Grid item xs={12} md={6}>
          <Paper elevation={2} sx={{ p: 3, height: '100%' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
              <BusinessIcon color="primary" sx={{ mr: 1 }} />
              <Typography variant="h6" fontWeight="bold">
                Insurance Company
              </Typography>
            </Box>

            <Divider sx={{ mb: 2 }} />

            <Box sx={{ mb: 2 }}>
              <Typography variant="caption" color="text.secondary">
                Company Name
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography variant="h6">
                  {customer.insurance_company || 'Not specified'}
                </Typography>
                {customer.insurance_company && (
                  <IconButton
                    size="small"
                    onClick={() =>
                      copyToClipboard(customer.insurance_company!, 'Insurance Company')
                    }
                  >
                    <ContentCopyIcon fontSize="small" />
                  </IconButton>
                )}
              </Box>
            </Box>

            {(customer as any).insurance_phone && (
              <Box sx={{ mb: 2 }}>
                <Typography variant="caption" color="text.secondary">
                  Claims Phone
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <PhoneIcon fontSize="small" color="action" />
                  <Link
                    href={`tel:${(customer as any).insurance_phone}`}
                    sx={{ textDecoration: 'none' }}
                  >
                    <Typography variant="body1">
                      {(customer as any).insurance_phone}
                    </Typography>
                  </Link>
                  <IconButton
                    size="small"
                    onClick={() =>
                      copyToClipboard((customer as any).insurance_phone, 'Phone Number')
                    }
                  >
                    <ContentCopyIcon fontSize="small" />
                  </IconButton>
                </Box>
              </Box>
            )}

            {(customer as any).insurance_email && (
              <Box>
                <Typography variant="caption" color="text.secondary">
                  Claims Email
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <EmailIcon fontSize="small" color="action" />
                  <Link
                    href={`mailto:${(customer as any).insurance_email}`}
                    sx={{ textDecoration: 'none' }}
                  >
                    <Typography variant="body1">
                      {(customer as any).insurance_email}
                    </Typography>
                  </Link>
                  <IconButton
                    size="small"
                    onClick={() =>
                      copyToClipboard((customer as any).insurance_email, 'Email')
                    }
                  >
                    <ContentCopyIcon fontSize="small" />
                  </IconButton>
                </Box>
              </Box>
            )}
          </Paper>
        </Grid>

        {/* Adjuster Information */}
        <Grid item xs={12} md={6}>
          <Paper elevation={2} sx={{ p: 3, height: '100%' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
              <PersonIcon color="primary" sx={{ mr: 1 }} />
              <Typography variant="h6" fontWeight="bold">
                Adjuster / Claim Handler
              </Typography>
            </Box>

            <Divider sx={{ mb: 2 }} />

            <Box sx={{ mb: 2 }}>
              <Typography variant="caption" color="text.secondary">
                Adjuster Name
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography variant="h6">
                  {customer.adjuster_name || 'Not assigned'}
                </Typography>
                {customer.adjuster_name && (
                  <IconButton
                    size="small"
                    onClick={() =>
                      copyToClipboard(customer.adjuster_name!, 'Adjuster Name')
                    }
                  >
                    <ContentCopyIcon fontSize="small" />
                  </IconButton>
                )}
              </Box>
            </Box>

            {(customer as any).adjuster_phone && (
              <Box sx={{ mb: 2 }}>
                <Typography variant="caption" color="text.secondary">
                  Direct Line
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <PhoneIcon fontSize="small" color="action" />
                  <Link
                    href={`tel:${(customer as any).adjuster_phone}`}
                    sx={{ textDecoration: 'none' }}
                  >
                    <Typography variant="body1">
                      {(customer as any).adjuster_phone}
                    </Typography>
                  </Link>
                  <IconButton
                    size="small"
                    onClick={() =>
                      copyToClipboard((customer as any).adjuster_phone, 'Phone Number')
                    }
                  >
                    <ContentCopyIcon fontSize="small" />
                  </IconButton>
                </Box>
              </Box>
            )}

            {(customer as any).adjuster_email && (
              <Box>
                <Typography variant="caption" color="text.secondary">
                  Email Address
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <EmailIcon fontSize="small" color="action" />
                  <Link
                    href={`mailto:${(customer as any).adjuster_email}`}
                    sx={{ textDecoration: 'none' }}
                  >
                    <Typography variant="body1">
                      {(customer as any).adjuster_email}
                    </Typography>
                  </Link>
                  <IconButton
                    size="small"
                    onClick={() =>
                      copyToClipboard((customer as any).adjuster_email, 'Email')
                    }
                  >
                    <ContentCopyIcon fontSize="small" />
                  </IconButton>
                </Box>
              </Box>
            )}
          </Paper>
        </Grid>

        {/* Claim Information */}
        <Grid item xs={12}>
          <Paper elevation={2} sx={{ p: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
              <AssignmentIcon color="primary" sx={{ mr: 1 }} />
              <Typography variant="h6" fontWeight="bold">
                Claim Details
              </Typography>
            </Box>

            <Divider sx={{ mb: 2 }} />

            <Grid container spacing={3}>
              <Grid item xs={12} sm={6} md={3}>
                <Typography variant="caption" color="text.secondary">
                  Claim Number
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Typography variant="body1" fontWeight="bold">
                    {customer.claim_number || 'Not provided'}
                  </Typography>
                  {customer.claim_number && (
                    <IconButton
                      size="small"
                      onClick={() =>
                        copyToClipboard(customer.claim_number!, 'Claim Number')
                      }
                    >
                      <ContentCopyIcon fontSize="small" />
                    </IconButton>
                  )}
                </Box>
              </Grid>

              <Grid item xs={12} sm={6} md={3}>
                <Typography variant="caption" color="text.secondary">
                  Job ID
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Typography variant="body1" fontWeight="bold">
                    {customer.job_id || 'Not assigned'}
                  </Typography>
                  {customer.job_id && (
                    <IconButton
                      size="small"
                      onClick={() =>
                        copyToClipboard(customer.job_id!, 'Job ID')
                      }
                    >
                      <ContentCopyIcon fontSize="small" />
                    </IconButton>
                  )}
                </Box>
              </Grid>

              <Grid item xs={12} sm={6} md={3}>
                <Typography variant="caption" color="text.secondary">
                  Status
                </Typography>
                <Box>
                  <Chip
                    label={customer.status || 'Unknown'}
                    color={customer.status === 'completed' ? 'success' : 'default'}
                    size="small"
                  />
                </Box>
              </Grid>

              <Grid item xs={12} sm={6} md={3}>
                <Typography variant="caption" color="text.secondary">
                  Supplement Count
                </Typography>
                <Typography variant="body1" fontWeight="bold">
                  {customer.supplement_count || 0}
                </Typography>
              </Grid>
            </Grid>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
}
