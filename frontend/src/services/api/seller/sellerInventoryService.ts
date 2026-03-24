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
 * Get Stock Summary Report for Seller
 */
export const getStockSummary = async (params?: GetStockSummaryParams): Promise<ApiResponse<StockSummaryData[]>> => {
  const response = await api.get<ApiResponse<StockSummaryData[]>>("/seller/inventory/stock-summary", { params });
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
 * Get Stock Balance Summary Report for Seller
 */
export const getStockBalanceSummary = async (params?: GetStockSummaryParams): Promise<ApiResponse<StockBalanceData[]>> => {
  const response = await api.get<ApiResponse<StockBalanceData[]>>("/seller/inventory/stock-balance", { params });
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
 * Get Low Stock Summary Report for Seller
 */
export const getLowStockSummary = async (params?: GetStockSummaryParams): Promise<ApiResponse<LowStockData[]>> => {
  const response = await api.get<ApiResponse<LowStockData[]>>("/seller/inventory/low-stock", { params });
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
 * Get Out of Stock Summary Report for Seller
 */
export const getOutOfStockSummary = async (params?: GetStockSummaryParams): Promise<ApiResponse<OutOfStockData[]>> => {
  const response = await api.get<ApiResponse<OutOfStockData[]>>("/seller/inventory/out-of-stock", { params });
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
 * Get Loss Summary Report for Seller
 */
export const getLossSummary = async (params?: GetStockSummaryParams): Promise<ApiResponse<LossData[]>> => {
  const response = await api.get<ApiResponse<LossData[]>>("/seller/inventory/loss-summary", { params });
  return response.data;
};

/**
 * Create Loss Record for Seller
 */
export const createLossRecord = async (data: any): Promise<ApiResponse<LossData>> => {
  const response = await api.post<ApiResponse<LossData>>("/seller/inventory/loss", data);
  return response.data;
};

/**
 * Delete Loss Record for Seller
 */
export const deleteLossRecord = async (id: string): Promise<ApiResponse<any>> => {
  const response = await api.delete<ApiResponse<any>>(`/seller/inventory/loss/${id}`);
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
  const response = await api.get<ApiResponse<SalesSummaryReportData[]>>("/seller/reports/sales-summary", { params });
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
  const response = await api.get<ApiResponse<ReturnExchangeData[]>>("/seller/reports/return-exchange", { params });
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
  const response = await api.get<ApiResponse<StockSalesData[]>>("/seller/reports/stock-sales-summary", { params });
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
  const response = await api.get<ApiResponse<DueSummaryData[]>>("/seller/reports/due-summary", { params });
  return response.data;
};

