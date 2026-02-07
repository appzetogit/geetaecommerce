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
