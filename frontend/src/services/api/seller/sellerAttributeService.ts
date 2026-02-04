
import api from '../config';

// Interface for Attribute (same as Admin)
export interface Attribute {
  _id: string;
  name: string;
}

export const getAttributes = async (search?: string) => {
  const response = await api.get('/seller/attributes', { params: { search } });
  return response.data;
};

export const createAttribute = async (data: { name: string }) => {
  const response = await api.post('/seller/attributes', data);
  return response.data;
};

export const updateAttribute = async (id: string, data: { name: string }) => {
  const response = await api.put(`/seller/attributes/${id}`, data);
  return response.data;
};

export const deleteAttribute = async (id: string) => {
  const response = await api.delete(`/seller/attributes/${id}`);
  return response.data;
};
