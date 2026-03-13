import api from "../config";
import { ApiResponse } from "../admin/types";

export interface SellerBillSettingsPayload {
  shopName: string;
  address: string;
  phone: string;
  notes?: { text: string; enabled: boolean };
  terms?: { text: string; enabled: boolean };
  gst?: { text: string; enabled: boolean };
  fssai?: { text: string; enabled: boolean };
}

export const getSellerPurchaseEntries = async (
  type?: "purchase" | "quotation"
): Promise<ApiResponse<any[]>> => {
  const response = await api.get<ApiResponse<any[]>>("/seller/pos/purchase-entries", {
    params: type ? { type } : undefined,
  });
  return response.data;
};

export const upsertSellerPurchaseEntry = async (
  entry: any
): Promise<ApiResponse<any>> => {
  const response = await api.post<ApiResponse<any>>(
    "/seller/pos/purchase-entries",
    entry
  );
  return response.data;
};

export const deleteSellerPurchaseEntry = async (
  entryId: string
): Promise<ApiResponse<void>> => {
  const response = await api.delete<ApiResponse<void>>(
    `/seller/pos/purchase-entries/${entryId}`
  );
  return response.data;
};

export const getSellerBillSettings = async (): Promise<
  ApiResponse<SellerBillSettingsPayload | null>
> => {
  const response = await api.get<ApiResponse<SellerBillSettingsPayload | null>>(
    "/seller/pos/bill-settings"
  );
  return response.data;
};

export const updateSellerBillSettings = async (
  payload: SellerBillSettingsPayload
): Promise<ApiResponse<SellerBillSettingsPayload>> => {
  const response = await api.put<ApiResponse<SellerBillSettingsPayload>>(
    "/seller/pos/bill-settings",
    payload
  );
  return response.data;
};

export interface SellerPOSStatePayload {
  bills: any[];
  activeBillId: string;
}

export const getSellerPOSState = async (): Promise<
  ApiResponse<SellerPOSStatePayload>
> => {
  const response = await api.get<ApiResponse<SellerPOSStatePayload>>(
    "/seller/pos/state"
  );
  return response.data;
};

export const updateSellerPOSState = async (
  payload: SellerPOSStatePayload
): Promise<ApiResponse<SellerPOSStatePayload>> => {
  const response = await api.put<ApiResponse<SellerPOSStatePayload>>(
    "/seller/pos/state",
    payload
  );
  return response.data;
};

export const getSellerOwnCategories = async (): Promise<ApiResponse<any[]>> => {
  const response = await api.get<ApiResponse<any[]>>("/seller/pos/own-categories");
  return response.data;
};

export const createSellerOwnCategory = async (
  payload: any
): Promise<ApiResponse<any>> => {
  const response = await api.post<ApiResponse<any>>(
    "/seller/pos/own-categories",
    payload
  );
  return response.data;
};

export const updateSellerOwnCategory = async (
  id: string,
  payload: any
): Promise<ApiResponse<any>> => {
  const response = await api.put<ApiResponse<any>>(
    `/seller/pos/own-categories/${id}`,
    payload
  );
  return response.data;
};

export const deleteSellerOwnCategory = async (
  id: string
): Promise<ApiResponse<void>> => {
  const response = await api.delete<ApiResponse<void>>(
    `/seller/pos/own-categories/${id}`
  );
  return response.data;
};

export const getSellerOwnSubcategories = async (): Promise<ApiResponse<any[]>> => {
  const response = await api.get<ApiResponse<any[]>>("/seller/pos/own-subcategories");
  return response.data;
};

export const createSellerOwnSubcategory = async (
  payload: any
): Promise<ApiResponse<any>> => {
  const response = await api.post<ApiResponse<any>>(
    "/seller/pos/own-subcategories",
    payload
  );
  return response.data;
};


