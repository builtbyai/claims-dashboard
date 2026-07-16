import React from 'react';
import { Chip } from '@mui/material';
import { StatusType } from '../../types/customer';
import { MUI_STATUS_COLORS, STATUS_LABELS } from '../../utils/constants';

interface StatusChipProps {
  status: StatusType;
  size?: 'small' | 'medium';
}

const StatusChip: React.FC<StatusChipProps> = ({ status, size = 'small' }) => {
  const color = MUI_STATUS_COLORS[status] as 'default' | 'warning' | 'info' | 'success';
  const label = STATUS_LABELS[status];

  return (
    <Chip
      label={label}
      color={color}
      size={size}
      sx={{
        fontWeight: 500,
      }}
    />
  );
};

export default StatusChip;
