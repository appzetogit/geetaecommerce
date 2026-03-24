import api from "../config";
import { ApiResponse } from "./types";

export const getAdminPurchaseEntries = async (
  type?: "purchase" | "quotation"
): Promise<ApiResponse<any[]>> => {
  const response = await api.get<ApiResponse<any[]>>("/admin/pos/purchase-entries", {
    params: type ? { type } : undefined,
  });
  return response.data;
};

export const upsertAdminPurchaseEntry = async (entry: any): Promise<ApiResponse<any>> => {
  const response = await api.post<ApiResponse<any>>("/admin/pos/purchase-entries", entry);
  return response.data;
};

export const deleteAdminPurchaseEntry = async (
  entryId: string
): Promise<ApiResponse<void>> => {
  const response = await api.delete<ApiResponse<void>>(`/admin/pos/purchase-entries/${entryId}`);
  return response.data;
};

