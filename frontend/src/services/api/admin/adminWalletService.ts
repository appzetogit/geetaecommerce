import api from "../config";
import { ApiResponse } from "./types";

export interface WalletTransaction {
  _id: string;
  sellerId: {
    _id: string;
    storeName: string;
    sellerName: string;
  };
  amount: number;
  type: "Credit" | "Debit";
  description: string;
  status: "Completed" | "Pending" | "Failed";
  reference: string;
  createdAt: string;
}

export interface WithdrawalRequest {
  _id: string;
  sellerId: {
    _id: string;
    storeName: string;
    sellerName: string;
    accountName?: string;
    bankName?: string;
    accountNumber?: string;
    ifsc?: string;
  };
  amount: number;
  status: "Pending" | "Approved" | "Rejected" | "Completed";
  method: string;
  remarks?: string;
  createdAt: string;
}

/**
 * Get all wallet transactions for Admin
 */
export const getWalletTransactions = async (params?: any): Promise<ApiResponse<WalletTransaction[]>> => {
  const response = await api.get<ApiResponse<WalletTransaction[]>>("/admin/wallet/transactions", { params });
  return response.data;
};

/**
 * Get all withdrawal requests for Admin
 */
export const getWithdrawalRequests = async (params?: any): Promise<ApiResponse<WithdrawalRequest[]>> => {
  const response = await api.get<ApiResponse<WithdrawalRequest[]>>("/admin/wallet/withdrawals", { params });
  return response.data;
};

/**
 * Update withdrawal status
 */
export const updateWithdrawalStatus = async (id: string, data: { status: string; remarks?: string }): Promise<ApiResponse<WithdrawalRequest>> => {
  const response = await api.put<ApiResponse<WithdrawalRequest>>(`/admin/wallet/withdrawals/${id}`, data);
  return response.data;
};

/**
 * Get financial dashboard stats
 */
export const getFinancialDashboard = async (params?: any): Promise<ApiResponse<any>> => {
  const response = await api.get<ApiResponse<any>>("/admin/financial/dashboard", { params });
  return response.data;
};

/**
 * Get seller commissions (order-level transactions)
 */
export const getSellerCommissions = async (params?: any): Promise<ApiResponse<any[]>> => {
  const response = await api.get<ApiResponse<any[]>>("/admin/wallet/seller-commissions", { params });
  return response.data;
};

/**
 * Add manual fund transfer
 */
export const addManualFundTransfer = async (data: { sellerId: string; amount: number; type: string; description?: string }): Promise<ApiResponse<any>> => {
  const response = await api.post<ApiResponse<any>>("/admin/wallet/manual-fund-transfer", data);
  return response.data;
};
