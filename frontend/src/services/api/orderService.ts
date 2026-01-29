import api from './config';

export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
}

export interface Order {
  id: string;
  orderId: string;
  deliveryDate: string;
  orderDate: string;
  status: string;
  amount: number;
  customerName?: string;
  customerPhone?: string;
  deliveryBoyName?: string;
}

export interface OrderItem {
  srNo: string;
  product: string;
  soldBy: string;
  unit: string;
  price: number;
  tax: number;
  taxPercent: number;
  qty: number;
  subtotal: number;
}

export interface DeliveryAddress {
  name: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  latitude?: number;
  longitude?: number;
}

export interface OrderDetail {
  id: string;
  invoiceNumber: string;
  orderDate: string;
  deliveryDate: string;
  timeSlot: string;
  status: 'Out For Delivery' | 'Received' | 'Payment Pending' | 'Cancelled' | 'Rejected';
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  deliveryBoyName: string;
  deliveryBoyPhone: string;
  items: OrderItem[];
  subtotal: number;
  tax: number;
  grandTotal: number;
  paymentMethod: string;
  paymentStatus: string;
  deliveryAddress: DeliveryAddress;
}

export interface UpdateOrderStatusData {
  status: 'Accepted' | 'On the way' | 'Delivered' | 'Cancelled';
}

export interface GetOrdersParams {
  dateFrom?: string;
  dateTo?: string;
  status?: string;
  search?: string;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

/**
 * Get orders with filters
 */
export const getOrders = async (params?: GetOrdersParams): Promise<ApiResponse<Order[]>> => {
  const response = await api.get<ApiResponse<Order[]>>('/orders', { params });
  return response.data;
};

/**
 * Get order by ID
 */
export const getOrderById = async (id: string): Promise<ApiResponse<OrderDetail>> => {
  const response = await api.get<ApiResponse<OrderDetail>>(`/orders/${id}`);
  return response.data;
};

/**
 * Update order status
 */
export const updateOrderStatus = async (id: string, data: UpdateOrderStatusData): Promise<ApiResponse<{ id: string; status: string }>> => {
  const response = await api.patch<ApiResponse<{ id: string; status: string }>>(`/orders/${id}/status`, data);
  return response.data;
};
