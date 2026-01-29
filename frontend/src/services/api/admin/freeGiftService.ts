import api from "../config";

export interface FreeGiftRule {
  id: string; // frontend usually expects string id, backend returns _id. Mapped if needed.
  _id?: string;
  minCartValue: number;
  giftProductId: string;
  giftProduct?: any; // Populated product
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
