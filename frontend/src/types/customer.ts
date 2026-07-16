// Type definitions for customer management system

export interface Customer {
  id: number;
  name: string;
  normalized_name: string;
  property_address: string;
  city: string;
  state: string;
  zip: string;
  claim_number: string;
  insurance_company: string;
  adjuster_name: string;
  job_id: string;
  contact_phone: string;
  contact_email: string;
  folder_path: string;
  photo_count: number;
  supplement_count: number;
  status: 'needs_supplement' | 'in_progress' | 'completed' | 'pending';
  created_at: string;
  updated_at: string;
}

export interface Activity {
  id: number;
  customer_id: number;
  activity_date: string;
  activity_type: string;
  description: string;
  attachments: string;
  created_at: string;
}

export interface FolderInfo {
  name: string;
  path: string;
  file_count: number;
  icon: string;
}

export type StatusType = 'needs_supplement' | 'in_progress' | 'completed' | 'pending';

export type SortField = 'name' | 'created_at' | 'supplement_count' | 'status';
export type SortOrder = 'asc' | 'desc';

export interface FilterOptions {
  search: string;
  status: StatusType | 'all';
  sortField: SortField;
  sortOrder: SortOrder;
}
