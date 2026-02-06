import api from './config';

export interface DashboardStats {
    totalUser: number;
    totalCategory: number;
    totalSubcategory: number;
    totalProduct: number;
    totalOrders: number;
    completedOrders: number;
    pendingOrders: number;
    cancelledOrders: number;
    soldOutProducts: number;
    lowStockProducts: number;
    totalRevenue: number;
    yearlyOrderData: { date: string; value: number }[];
    dailyOrderData: { date: string; value: number }[];
}

export interface NewOrder {
    id: string;
    orderDate: string;
    status: string;
    amount: number;
}

export interface DashboardResponse {
    success: boolean;
    message: string;
    data: {
        stats: DashboardStats;
        newOrders: NewOrder[];
    };
}

/**
 * Get seller's dashboard statistics
 */
export const getSellerDashboardStats = async (): Promise<DashboardResponse> => {
    const response = await api.get<DashboardResponse>('/seller/dashboard/stats');
    return response.data;
};

export interface SalesSummaryData {
  summary: {
    totalSales: number;
    totalSalesChange: number;
    totalOrders: number;
    totalOrdersChange: number;
    paidAmount: number;
    paidAmountChange: number;
    creditAmount: number;
    creditAmountChange: number;
    totalProfit: number;
    totalLoss: number;
    netProfit: number;
  };
  dailySales: Array<{
    day: string;
    date: string;
    sales: number;
    orders: number;
  }>;
}

export interface SalesSummaryResponse {
    success: boolean;
    message: string;
    data: SalesSummaryData;
}

/**
 * Get seller's sales summary
 */
export const getSellerSalesSummary = async (startDate: string, endDate: string): Promise<SalesSummaryResponse> => {
    const response = await api.get<SalesSummaryResponse>('/seller/dashboard/sales-summary', {
        params: { startDate, endDate }
    });
    return response.data;
};
