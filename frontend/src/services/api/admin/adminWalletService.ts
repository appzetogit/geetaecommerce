import api from "../config";


import { ApiResponse } from "./types";

export interface WalletTransaction {
  id: string;
  type: string;
  amount: number;
  transactionType: "credit" | "debit" | "pending";
  description: string;
  date: string;
  status: string;
}

export interface GetWalletTransactionsParams {
  page?: number;
  limit?: number;
  type?: "seller" | "customer";
  userId?: string;
  transactionType?: "credit" | "debit";
}

export interface ProcessFundTransferData {
  fromType: "seller" | "customer";
  fromId: string;
  toType: "seller" | "customer";
  toId: string;
  amount: number;
  reason?: string;
}

export interface FundTransferResponse {
  from: {
    type: string;
    id: string;
    previousBalance: number;
    newBalance: number;
  };
  to: {
    type: string;
    id: string;
    previousBalance: number;
    newBalance: number;
  };
  amount: number;
  reason?: string;
}

export interface SellerTransaction {
  id: string;
  type: string;
  amount: number;
  transactionType: "credit" | "pending";
  description: string;
  date: string;
  status: string;
}

export interface ProcessWithdrawalData {
  sellerId: string;
  amount: number;
  paymentReference?: string;
  notes?: string;
}

export interface WithdrawalResponse {
  seller: any;
  transaction: {
    amount: number;
    paymentReference?: string;
    notes?: string;
    previousBalance: number;
    newBalance: number;
  };
}

/**
 * Get wallet transactions
 */
export const getWalletTransactions = async (
  params?: GetWalletTransactionsParams
): Promise<ApiResponse<WalletTransaction[]>> => {
  const response = await api.get<ApiResponse<WalletTransaction[]>>(
    "/admin/wallet/transactions",
    {
      params,
    }
  );
  return response.data;
};

/**
 * Process fund transfer
 */
export const processFundTransfer = async (
  data: ProcessFundTransferData
): Promise<ApiResponse<FundTransferResponse>> => {
  const response = await api.post<ApiResponse<FundTransferResponse>>(
    "/admin/wallet/transfer",
    data
  );
  return response.data;
};

/**
 * Get seller transactions
 */
export const getSellerTransactions = async (
  sellerId: string,
  params?: { page?: number; limit?: number }
): Promise<ApiResponse<SellerTransaction[]>> => {
  const response = await api.get<ApiResponse<SellerTransaction[]>>(
    `/admin/wallet/seller/${sellerId}`,
    { params }
  );
  return response.data;
};

/**
 * Process withdrawal request
 */
export const processWithdrawal = async (
  data: ProcessWithdrawalData
): Promise<ApiResponse<WithdrawalResponse>> => {
  const response = await api.post<ApiResponse<WithdrawalResponse>>(
    "/admin/wallet/withdrawal",
    data
  );
  return response.data;
};

/**
 * Get all withdrawal requests for admin
 */
export const getWithdrawalRequests = async (params?: any): Promise<ApiResponse<any>> => {
  const response = await api.get<ApiResponse<any>>("/admin/wallet/withdrawals", { params });
  return response.data;
};

/**
 * Update withdrawal request status (Approve/Reject)
 */
export const updateWithdrawalStatus = async (id: string, data: { status: string; remarks?: string }): Promise<ApiResponse<any>> => {
  const response = await api.put<ApiResponse<any>>(`/admin/wallet/withdrawals/${id}`, data);
  return response.data;
};

/**
 * Get financial dashboard stats
 */
export const getFinancialDashboard = async (params?: any): Promise<ApiResponse<any>> => {
  const response = await api.get<ApiResponse<any>>("/admin/financial/dashboard", { params });
  return response.data;
};
