import api from "../config";

export const createAttribute = async (data: { name: string }) => {
  try {
    const response = await api.post("/admin/attributes", data);
    return response.data;
  } catch (error: any) {
    throw error.response?.data || error.message;
  }
};

export const getAttributes = async (search: string = "") => {
  try {
    const response = await api.get(`/admin/attributes?search=${search}`);
    return response.data;
  } catch (error: any) {
    throw error.response?.data || error.message;
  }
};

export const updateAttribute = async (id: string, data: { name: string }) => {
  try {
    const response = await api.put(`/admin/attributes/${id}`, data);
    return response.data;
  } catch (error: any) {
    throw error.response?.data || error.message;
  }
};

export const deleteAttribute = async (id: string) => {
  try {
    const response = await api.delete(`/admin/attributes/${id}`);
    return response.data;
  } catch (error: any) {
    throw error.response?.data || error.message;
  }
};
