import React from 'react';
import {
  Card,
  CardContent,
  Typography,
  Chip,
  Box,
  CardActionArea,
  LinearProgress,
  IconButton,
  Tooltip,
  Divider
} from '@mui/material';
import {
  PhotoLibrary,
  Email,
  Description,
  Warning,
  AttachMoney
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { Customer } from '../../types/customer';
import StatusChip from '../Common/StatusChip';
import { formatRelativeTime } from '../../utils/formatters';

interface CustomerCardProps {
  customer: Customer;
}

const CustomerCard: React.FC<CustomerCardProps> = ({ customer }) => {
  const navigate = useNavigate();

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  const rcvAmount = (customer as any).rcv_amount || 0;
  const collectedAmount = (customer as any).collected_amount || 0;
  const outstandingBalance = rcvAmount - collectedAmount;
  const collectionPercentage = rcvAmount > 0 ? (collectedAmount / rcvAmount) * 100 : 0;
  const photoCount = customer.photo_count || 0;
  const daysSupplementing = (customer as any).days_supplementing || 0;
  const isHighPriority = photoCount >= 80 || daysSupplementing > 30;

  return (
    <Card
      elevation={0}
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        border: isHighPriority ? '2px solid' : '1px solid',
        borderColor: isHighPriority ? 'warning.main' : 'divider',
        background: isHighPriority
          ? 'linear-gradient(135deg, #fff9f0 0%, #ffffff 100%)'
          : '#ffffff',
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        '&:hover': {
          boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
          transform: 'translateY(-4px) scale(1.01)',
          borderColor: isHighPriority ? 'warning.dark' : 'primary.main',
        },
      }}
    >
      <CardActionArea
        onClick={() => navigate(`/customers/${customer.id}`)}
        sx={{ height: '100%' }}
      >
        <CardContent sx={{ height: '100%', p: 2.5 }}>
          <Box sx={{ mb: 2 }}>
            <Box display="flex" justifyContent="space-between" alignItems="start">
              <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
                {customer.name}
              </Typography>
              {isHighPriority && (
                <Tooltip title="High Priority">
                  <Warning color="warning" fontSize="small" />
                </Tooltip>
              )}
            </Box>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              {customer.property_address}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {customer.city}, {customer.state} {customer.zip}
            </Typography>
          </Box>

          {/* Financial Summary */}
          {rcvAmount > 0 && (
            <Box
              sx={{
                mb: 2,
                p: 2,
                background: 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)',
                borderRadius: 2,
                border: '1px solid',
                borderColor: 'primary.light',
              }}
            >
              <Box display="flex" justifyContent="space-between" alignItems="center" mb={1.5}>
                <Box>
                  <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ textTransform: 'uppercase', letterSpacing: 0.5 }}>
                    Total Value
                  </Typography>
                  <Typography variant="h5" color="primary.dark" fontWeight="bold" sx={{ mt: 0.5 }}>
                    {formatCurrency(rcvAmount)}
                  </Typography>
                </Box>
                <Chip
                  label={`${collectionPercentage.toFixed(0)}%`}
                  size="medium"
                  sx={{
                    bgcolor: collectionPercentage >= 80 ? 'success.main' : collectionPercentage >= 50 ? 'warning.main' : 'error.main',
                    color: 'white',
                    fontWeight: 700,
                    fontSize: '0.875rem',
                    px: 1,
                  }}
                />
              </Box>
              <Box mb={1}>
                <Box display="flex" justifyContent="space-between" mb={0.75}>
                  <Typography variant="body2" color="success.dark" fontWeight={600}>
                    Collected: {formatCurrency(collectedAmount)}
                  </Typography>
                  <Typography variant="body2" color="error.main" fontWeight={700}>
                    Due: {formatCurrency(outstandingBalance)}
                  </Typography>
                </Box>
                <LinearProgress
                  variant="determinate"
                  value={collectionPercentage}
                  sx={{
                    height: 8,
                    borderRadius: 4,
                    bgcolor: 'grey.200',
                    '& .MuiLinearProgress-bar': {
                      borderRadius: 4,
                      bgcolor: collectionPercentage >= 80 ? 'success.main' : collectionPercentage >= 50 ? 'warning.main' : 'error.main',
                    },
                  }}
                />
              </Box>
            </Box>
          )}

          <Divider sx={{ my: 1.5 }} />

          {/* Info Chips */}
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 1.5 }}>
            {customer.job_id && (
              <Chip
                label={`Job #${customer.job_id}`}
                size="small"
                color="primary"
                variant="outlined"
              />
            )}
            {photoCount > 0 && (
              <Chip
                icon={<PhotoLibrary />}
                label={`${photoCount} photos`}
                size="small"
                color={photoCount >= 80 ? 'warning' : 'default'}
                variant="outlined"
              />
            )}
            {daysSupplementing > 0 && (
              <Chip
                label={`${daysSupplementing} days`}
                size="small"
                color={daysSupplementing > 30 ? 'error' : 'default'}
                variant="outlined"
              />
            )}
          </Box>

          {/* Quick Actions */}
          <Box display="flex" justifyContent="space-between" alignItems="center">
            <Box display="flex" gap={0.5}>
              <Tooltip title="View Photos">
                <IconButton size="small" onClick={(e) => { e.stopPropagation(); }}>
                  <PhotoLibrary fontSize="small" />
                </IconButton>
              </Tooltip>
              <Tooltip title="View Documents">
                <IconButton size="small" onClick={(e) => { e.stopPropagation(); }}>
                  <Description fontSize="small" />
                </IconButton>
              </Tooltip>
              <Tooltip title="Send Email">
                <IconButton size="small" onClick={(e) => { e.stopPropagation(); }}>
                  <Email fontSize="small" />
                </IconButton>
              </Tooltip>
            </Box>
            <StatusChip status={customer.status} />
          </Box>

          <Box sx={{ mt: 1.5, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="caption" color="text.secondary">
              Last updated: {formatRelativeTime(customer.updated_at)}
            </Typography>
          </Box>
        </CardContent>
      </CardActionArea>
    </Card>
  );
};

export default CustomerCard;
