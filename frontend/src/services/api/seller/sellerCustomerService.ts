import api from "../config";
import { ApiResponse } from "../admin/types";
import { Customer, GetCustomersParams } from "../admin/adminCustomerService";

/**
 * Get all customers (Seller POS)
 */
export const getAllCustomers = async (
  params?: GetCustomersParams
): Promise<ApiResponse<Customer[]>> => {
  const response = await api.get<ApiResponse<Customer[]>>("/seller/pos/customers", {
    params,
  });
  return response.data;
};

/**
 * Create a new customer (Seller POS)
 */
export const createCustomer = async (
  data: Partial<Customer>
): Promise<ApiResponse<Customer>> => {
  const response = await api.post<ApiResponse<Customer>>("/seller/pos/customers", data);
  return response.data;
};
/**
 * Update a customer (Seller POS)
 */
export const updateCustomer = async (
  id: string,
  data: Partial<Customer>
): Promise<ApiResponse<Customer>> => {
  const response = await api.put<ApiResponse<Customer>>(`/seller/pos/customers/${id}`, data);
  return response.data;
};

/**
 * Delete a customer (Seller POS)
 */
export const deleteCustomer = async (id: string): Promise<ApiResponse<void>> => {
  const response = await api.delete<ApiResponse<void>>(`/seller/pos/customers/${id}`);
  return response.data;
};
