import api from "../config";
import { ApiResponse } from "./types";

export interface GSTSalesData {
  _id: string; // Order Item ID
  type?: "order" | "quotation";
  date?: string;
  invoiceNo?: string;
  customerName?: string;
  gstin?: string;
  productName: string;
  hsn?: string;
  hsnCode?: string;
  quantity?: number;
  stock?: number;
  price?: number;
  taxableAmount?: number;
  taxPercentage?: number;
  gst?: number;
  taxAmount?: number;
  totalAmount?: number;
}

export interface PaymentData {
  _id: string; // Order ID
  date: string;
  paymentId: string;
  orderNumber: string;
  customerName: string;
  amount: number;
  paymentMethod: string;
  status: "Paid" | "Pending" | "Failed" | "Refunded";
  type: "POS" | "Online";
}

export interface GetReportParams {
  page?: number;
  limit?: number;
  search?: string;
  dateFrom?: string;
  dateTo?: string;
}

export const getGSTSalesReport = async (params?: GetReportParams): Promise<ApiResponse<GSTSalesData[]>> => {
  const response = await api.get<ApiResponse<GSTSalesData[]>>("/seller/reports/gst-sales", { params });
  return response.data;
};

export const deleteGSTSalesReportEntries = async (
  ids: string[]
): Promise<ApiResponse<{ deletedCount: number; failed: { id: string; message: string }[] }>> => {
  const response = await api.delete<ApiResponse<{ deletedCount: number; failed: { id: string; message: string }[] }>>(
    "/seller/reports/gst-sales",
    { data: { ids } }
  );
  return response.data;
};

export const getPaymentReport = async (params?: GetReportParams): Promise<ApiResponse<PaymentData[]>> => {
  const response = await api.get<ApiResponse<PaymentData[]>>("/seller/reports/payment", { params });
  return response.data;
};
