import api from "../config";
import { ApiResponse } from "./types";
import { Seller } from "./adminProductService";

export const getSellers = async (): Promise<ApiResponse<Seller[]>> => {
  const response = await api.get<ApiResponse<Seller[]>>("/admin/sellers");
  return response.data;
};

export const createSeller = async (formData: FormData): Promise<ApiResponse<Seller>> => {
    // Note: When sending FormData, browser automatically sets Content-Type to multipart/form-data
    // and includes the boundary. We don't need to manually set it.
    const response = await api.post<ApiResponse<Seller>>("/admin/sellers", formData);
    return response.data;
};

export const toggleSellerStatus = async (id: string, isEnabled: boolean): Promise<ApiResponse<Seller>> => {
    const response = await api.patch<ApiResponse<Seller>>(`/admin/sellers/${id}/toggle-status`, { isEnabled });
    return response.data;
};
