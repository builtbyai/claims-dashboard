import React from 'react';
import {
  Box,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  SelectChangeEvent,
} from '@mui/material';
import { StatusType, SortField, SortOrder } from '../../types/customer';

interface FilterBarProps {
  statusFilter: StatusType | 'all';
  sortField: SortField;
  sortOrder: SortOrder;
  onStatusChange: (status: StatusType | 'all') => void;
  onSortChange: (field: SortField, order: SortOrder) => void;
}

const FilterBar: React.FC<FilterBarProps> = ({
  statusFilter,
  sortField,
  sortOrder,
  onStatusChange,
  onSortChange,
}) => {
  const handleStatusChange = (event: SelectChangeEvent) => {
    onStatusChange(event.target.value as StatusType | 'all');
  };

  const handleSortChange = (event: SelectChangeEvent) => {
    const [field, order] = event.target.value.split('-');
    onSortChange(field as SortField, order as SortOrder);
  };

  return (
    <Box
      sx={{
        display: 'flex',
        gap: 2,
        mb: 3,
        flexWrap: 'wrap',
      }}
    >
      <FormControl sx={{ minWidth: 200 }}>
        <InputLabel id="status-filter-label">Status</InputLabel>
        <Select
          labelId="status-filter-label"
          value={statusFilter}
          label="Status"
          onChange={handleStatusChange}
        >
          <MenuItem value="all">All Status</MenuItem>
          <MenuItem value="needs_supplement">Needs Supplement</MenuItem>
          <MenuItem value="in_progress">In Progress</MenuItem>
          <MenuItem value="completed">Completed</MenuItem>
          <MenuItem value="pending">Pending</MenuItem>
        </Select>
      </FormControl>

      <FormControl sx={{ minWidth: 200 }}>
        <InputLabel id="sort-label">Sort By</InputLabel>
        <Select
          labelId="sort-label"
          value={`${sortField}-${sortOrder}`}
          label="Sort By"
          onChange={handleSortChange}
        >
          <MenuItem value="name-asc">Name (A-Z)</MenuItem>
          <MenuItem value="name-desc">Name (Z-A)</MenuItem>
          <MenuItem value="created_at-desc">Newest First</MenuItem>
          <MenuItem value="created_at-asc">Oldest First</MenuItem>
          <MenuItem value="supplement_count-desc">Most Supplements</MenuItem>
          <MenuItem value="supplement_count-asc">Least Supplements</MenuItem>
        </Select>
      </FormControl>
    </Box>
  );
};

export default FilterBar;
