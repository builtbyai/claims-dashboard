// Application constants

export const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

export const STATUS_COLORS = {
  needs_supplement: '#ff9800', // Orange
  in_progress: '#2196f3',      // Blue
  completed: '#4caf50',         // Green
  pending: '#9e9e9e',           // Gray
} as const;

export const STATUS_LABELS = {
  needs_supplement: 'Needs Supplement',
  in_progress: 'In Progress',
  completed: 'Completed',
  pending: 'Pending',
} as const;

export const MUI_STATUS_COLORS = {
  needs_supplement: 'warning',
  in_progress: 'info',
  completed: 'success',
  pending: 'default',
} as const;

export const FOLDER_NAMES = [
  'Photos',
  'Supplements',
  'Estimates',
  'Correspondence',
  'Insurance Documents',
  'Invoices',
] as const;

export const ACTIVITY_TYPES = {
  CREATED: 'Customer Created',
  UPDATED: 'Customer Updated',
  PHOTO_UPLOADED: 'Photo Uploaded',
  SUPPLEMENT_CREATED: 'Supplement Created',
  NOTE_ADDED: 'Note Added',
  STATUS_CHANGED: 'Status Changed',
} as const;
