import api from "../config";

export type FreeGiftRuleType = 'free_gift' | 'discount';
export type FreeGiftDiscountType = 'fixed' | 'percentage';

export interface FreeGiftRule {
  id: string;
  _id?: string;
  minCartValue: number;
  ruleType?: FreeGiftRuleType;
  giftProductId?: string;
  giftProduct?: any;
  discountType?: FreeGiftDiscountType;
  discountValue?: number;
  status: 'Active' | 'Inactive';
}

export const createFreeGiftRule = async (data: any) => {
  try {
    const response = await api.post("/admin/free-gift-rules", data);
    return response.data;
  } catch (error: any) {
    throw error.response?.data || error.message;
  }
};

export const getFreeGiftRules = async () => {
  try {
    const response = await api.get("/admin/free-gift-rules");
    return response.data;
  } catch (error: any) {
    throw error.response?.data || error.message;
  }
};

export const updateFreeGiftRule = async (id: string, data: any) => {
  try {
    const response = await api.put(`/admin/free-gift-rules/${id}`, data);
    return response.data;
  } catch (error: any) {
    throw error.response?.data || error.message;
  }
};

export const deleteFreeGiftRule = async (id: string) => {
  try {
    const response = await api.delete(`/admin/free-gift-rules/${id}`);
    return response.data;
  } catch (error: any) {
    throw error.response?.data || error.message;
  }
};
