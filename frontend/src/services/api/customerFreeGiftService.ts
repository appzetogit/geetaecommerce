import api from "./config";

export const getCustomerFreeGiftRules = async () => {
  try {
    const response = await api.get("/customer/free-gift-rules");
    return response.data;
  } catch (error: any) {
    throw error.response?.data || error.message;
  }
};
