import api from "../config";
import { ApiResponse } from "./types";

export interface Staff {
  _id: string;
  name: string;
  phone: string;
  role: string;
  commission: number;
  permissions?: string[];
}

export interface CreateStaffData {
  name: string;
  phone: string;
  role: string;
  commission?: number;
  permissions?: string[];
}

export interface UpdateStaffData {
  name?: string;
  phone?: string;
  role?: string;
  commission?: number;
  permissions?: string[];
}

export const getStaff = async (): Promise<ApiResponse<Staff[]>> => {
  const response = await api.get<ApiResponse<Staff[]>>("/admin/staff");
  return response.data;
};

export const createStaff = async (
  data: CreateStaffData
): Promise<ApiResponse<Staff>> => {
  const response = await api.post<ApiResponse<Staff>>("/admin/staff", data);
  return response.data;
};

export const updateStaff = async (
  id: string,
  data: UpdateStaffData
): Promise<ApiResponse<Staff>> => {
  const response = await api.put<ApiResponse<Staff>>(`/admin/staff/${id}`, data);
  return response.data;
};

export const deleteStaff = async (
  id: string
): Promise<ApiResponse<void>> => {
  const response = await api.delete<ApiResponse<void>>(`/admin/staff/${id}`);
  return response.data;
};


