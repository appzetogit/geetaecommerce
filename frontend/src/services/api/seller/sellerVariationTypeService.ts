import api from '../config';

export interface VariationType {
  _id: string;
  name: string;
}

export const getVariationTypes = async (search?: string) => {
  const response = await api.get('/seller/variation-types', { params: { search } });
  return response.data;
};

export const createVariationType = async (data: { name: string }) => {
  const response = await api.post('/seller/variation-types', data);
  return response.data;
};

export const updateVariationType = async (id: string, data: { name: string }) => {
  const response = await api.put(`/seller/variation-types/${id}`, data);
  return response.data;
};

export const deleteVariationType = async (id: string) => {
  const response = await api.delete(`/seller/variation-types/${id}`);
  return response.data;
};
