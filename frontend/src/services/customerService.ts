// Customer service for API calls
import api from './api';
import { Customer, Activity, FolderInfo, FilterOptions } from '../types/customer';

export const customerService = {
  // Get all customers
  getAllCustomers: async (): Promise<Customer[]> => {
    const response = await api.get<{data: Customer[]}>('/customers');
    return response.data.data;
  },

  // Get customer by ID
  getCustomerById: async (id: number): Promise<Customer> => {
    const response = await api.get<Customer>(`/customers/${id}`);
    return response.data;
  },

  // Get customer activities
  getCustomerActivities: async (id: number): Promise<Activity[]> => {
    const response = await api.get<{data: Activity[]}>(`/customers/${id}/activities`);
    return response.data.data || [];
  },

  // Get customer folder structure
  getCustomerFolders: async (id: number): Promise<FolderInfo[]> => {
    const response = await api.get<{folders: FolderInfo[]}>(`/customers/${id}/folders`);
    return response.data.folders;
  },

  // Search customers
  searchCustomers: async (query: string): Promise<Customer[]> => {
    const response = await api.get<{data: Customer[]}>('/customers', {
      params: { search: query },
    });
    return response.data.data;
  },

  // Filter customers by status
  filterByStatus: async (status: string): Promise<Customer[]> => {
    const response = await api.get<{data: Customer[]}>('/customers', {
      params: { status },
    });
    return response.data.data;
  },

  // Sort customers
  sortCustomers: async (field: string, order: string): Promise<Customer[]> => {
    const response = await api.get<{data: Customer[]}>('/customers', {
      params: { sort: field, order },
    });
    return response.data.data;
  },

  // Advanced filter with multiple options
  filterCustomers: async (options: FilterOptions): Promise<Customer[]> => {
    const params: any = {};

    if (options.search) {
      params.search = options.search;
    }

    if (options.status !== 'all') {
      params.status = options.status;
    }

    if (options.sortField) {
      params.sort = options.sortField;
      params.order = options.sortOrder;
    }

    const response = await api.get<{data: Customer[]}>('/customers', { params });
    return response.data.data;
  },

  // Update customer status
  updateCustomerStatus: async (id: number, status: string): Promise<Customer> => {
    const response = await api.patch<Customer>(`/customers/${id}`, { status });
    return response.data;
  },

  // Create new activity
  createActivity: async (
    customerId: number,
    activityType: string,
    description: string,
    attachments?: string
  ): Promise<Activity> => {
    const response = await api.post<Activity>(`/customers/${customerId}/activities`, {
      activity_type: activityType,
      description,
      attachments: attachments || '',
    });
    return response.data;
  },
};
