import api from "../config";
import { ApiResponse } from "./types";

export interface StockSummaryData {
  _id: string;
  productId: string;
  name: string;
  variantName: string;
  uom: string;
  purchaseValue: number;
  mrp: number;
  sellingPrice: number;
  openingStock: number;
  quantity: number;
  totalDiscountRs: number;
  totalDiscountPercent: number;
  totalMRP: number;
  totalSP: number;
  totalPurchasePrice: number;
  wholesalePrice: number;
  onlineOfferPrice: number;
  lowStockQty: number;
  supplier: string;
  category: string;
  ean: string;
  gst: number;
  hsn: string;
  cess: number;
  brand: string;
  expiryDate: string;
  imageUrl: string;
}

export interface GetStockSummaryParams {
  page?: number;
  limit?: number;
  search?: string;
  category?: string;
  dateFrom?: string;
  dateTo?: string;
}

/**
 * Get Stock Summary Report
 */
export const getStockSummary = async (params?: GetStockSummaryParams): Promise<ApiResponse<StockSummaryData[]>> => {
  const response = await api.get<ApiResponse<StockSummaryData[]>>("/admin/inventory/stock-summary", { params });
  return response.data;
};

export interface StockBalanceData {
  _id: string;
  name: string;
  variantName: string;
  uom: string;
  sellingPrice: number;
  openingStockQty: number;
  quantity: number;
  hsn: string;
  cess: number;
  gst: number;
  totalSellingPrice: number;
  totalPurchasePrice: number;
  supplier: string;
  category: string;
  subCategory: string;
  purchasePrice: number;
}

/**
 * Get Stock Balance Summary Report
 */
export const getStockBalanceSummary = async (params?: GetStockSummaryParams): Promise<ApiResponse<StockBalanceData[]>> => {
  const response = await api.get<ApiResponse<StockBalanceData[]>>("/admin/inventory/stock-balance", { params });
  return response.data;
};
export interface LowStockData {
  _id: string;
  name: string;
  variantName: string;
  uom: string;
  purchaseValue: number;
  mrp: number;
  sellingPrice: number;
  quantity: number;
  lowStockQty: number;
  supplier: string;
  category: string;
}

/**
 * Get Low Stock Summary Report
 */
export const getLowStockSummary = async (params?: GetStockSummaryParams): Promise<ApiResponse<LowStockData[]>> => {
  const response = await api.get<ApiResponse<LowStockData[]>>("/admin/inventory/low-stock", { params });
  return response.data;
};
export interface OutOfStockData {
  _id: string;
  name: string;
  variantName: string;
  uom: string;
  purchaseValue: number;
  mrp: number;
  sellingPrice: number;
  quantity: number;
  supplier: string;
  category: string;
}

/**
 * Get Out of Stock Summary Report
 */
export const getOutOfStockSummary = async (params?: GetStockSummaryParams): Promise<ApiResponse<OutOfStockData[]>> => {
  const response = await api.get<ApiResponse<OutOfStockData[]>>("/admin/inventory/out-of-stock", { params });
  return response.data;
};

export interface LossData {
  _id: string;
  date: string;
  productName: string;
  weight: string;
  quantity: number;
  reason: string;
  sku?: string;
}

/**
 * Get Loss Summary Report
 */
export const getLossSummary = async (params?: GetStockSummaryParams): Promise<ApiResponse<LossData[]>> => {
  const response = await api.get<ApiResponse<LossData[]>>("/admin/inventory/loss-summary", { params });
  return response.data;
};

/**
 * Create Loss Record
 */
export const createLossRecord = async (data: any): Promise<ApiResponse<LossData>> => {
  const response = await api.post<ApiResponse<LossData>>("/admin/inventory/loss", data);
  return response.data;
};

/**
 * Delete Loss Record
 */
export const deleteLossRecord = async (id: string): Promise<ApiResponse<any>> => {
  const response = await api.delete<ApiResponse<any>>(`/admin/inventory/loss/${id}`);
  return response.data;
};

export interface GSTSalesData {
  _id: string;
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
  taxAmount?: number;
  cgst?: number;
  sgst?: number;
  igst?: number;
  totalAmount?: number;
}

/**
 * Get GST Sales Report
 */
export const getGSTSalesReport = async (params?: GetStockSummaryParams): Promise<ApiResponse<GSTSalesData[]>> => {
  const response = await api.get<ApiResponse<GSTSalesData[]>>("/admin/inventory/gst-sales", { params });
  return response.data;
};

export const deleteGSTSalesReportEntries = async (
  ids: string[]
): Promise<ApiResponse<{ deletedCount: number; failed: { id: string; message: string }[] }>> => {
  const response = await api.delete<ApiResponse<{ deletedCount: number; failed: { id: string; message: string }[] }>>(
    "/admin/inventory/gst-sales",
    { data: { ids } }
  );
  return response.data;
};

export interface PaymentData {
  _id: string;
  paymentId: string;
  orderNumber: string;
  date: string;
  customerName: string;
  amount: number;
  paymentMethod: string;
  status: "Paid" | "Pending" | "Failed" | "Refunded";
  type: "POS" | "Online";
}

/**
 * Get Payment Transaction Report
 */
export const getPaymentReport = async (params?: GetStockSummaryParams): Promise<ApiResponse<PaymentData[]>> => {
  const response = await api.get<ApiResponse<PaymentData[]>>("/admin/inventory/payment-report", { params });
  return response.data;
};

export interface SalesSummaryReportData {
  _id: string;
  date: string;
  time: string;
  invoiceNo: string;
  customerName: string;
  paymentMode: string;
  status: string;
  total: number;
  noOfItems: number;
  totalMRP: number;
  totalSP: number;
  totalDiscount: number;
  totalDiscountPercent: number;
  profit: number;
  mode: string;
}

/**
 * Get Sales Summary Report
 */
export const getSalesSummaryReport = async (params?: GetStockSummaryParams): Promise<ApiResponse<SalesSummaryReportData[]>> => {
  const response = await api.get<ApiResponse<SalesSummaryReportData[]>>("/admin/inventory/sales-summary-report", { params });
  return response.data;
};

export interface ReturnExchangeData {
  _id: string;
  date: string;
  saleReturnNo: string;
  invoiceNo: string;
  customerName: string;
  paymentMode: string;
  noOfItems: number;
  totalMRP: number;
  totalSP: number;
  totalDiscount: number;
  returnAmt: number;
  saleAmt: number;
  billAmt: number;
  paidBy: string;
}

/**
 * Get Return and Exchange Report
 */
export const getReturnExchangeReport = async (params?: GetStockSummaryParams): Promise<ApiResponse<ReturnExchangeData[]>> => {
  const response = await api.get<ApiResponse<ReturnExchangeData[]>>("/admin/inventory/return-exchange-report", { params });
  return response.data;
};

export interface StockSalesData {
  _id: string;
  itemName: string;
  variantName: string;
  uom: string;
  hsn: string;
  cess: string;
  gst: string;
  category: string;
  unitsSold: number;
  purchasePrice: number;
  sellingPrice: number;
  totalSellingPrice: number;
  profit: number;
  salesman: string;
}

/**
 * Get Stock Sales Summary Report
 */
export const getStockSalesSummary = async (params?: GetStockSummaryParams): Promise<ApiResponse<StockSalesData[]>> => {
  const response = await api.get<ApiResponse<StockSalesData[]>>("/admin/inventory/stock-sales-summary", { params });
  return response.data;
};

export interface DueSummaryData {
  _id: string;
  orderNo: string;
  date: string;
  customerName: string;
  customerPhone: string;
  total: number;
  paid: number;
  due: number;
  paymentMode: string;
  status: string;
}

/**
 * Get Due Summary Report
 */
export const getDueSummaryReport = async (params?: GetStockSummaryParams): Promise<ApiResponse<DueSummaryData[]>> => {
  const response = await api.get<ApiResponse<DueSummaryData[]>>("/admin/inventory/due-summary", { params });
  return response.data;
};
