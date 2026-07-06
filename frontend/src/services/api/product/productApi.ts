import { CreateProductPayload } from "../../modules/shared/product-form/types/productForm.types";
import api from "../config";

export type { CreateProductPayload };

export const createProductAdmin = async (data: CreateProductPayload) => {
  const response = await api.post("/admin/products", {
    ...data,
    variations: data.variants,
  });
  return response.data;
};

export const updateProductAdmin = async (id: string, data: Partial<CreateProductPayload>) => {
  const response = await api.put(`/admin/products/${id}`, {
    ...data,
    variations: data.variants,
  });
  return response.data;
};

export const createProductSeller = async (data: CreateProductPayload) => {
  const response = await api.post("/products", {
    ...data,
    variations: data.variants,
  });
  return response.data;
};

export const updateProductSeller = async (id: string, data: Partial<CreateProductPayload>) => {
  const response = await api.put(`/products/${id}`, {
    ...data,
    variations: data.variants,
  });
  return response.data;
};

export const getProductAdmin = async (id: string) => {
  const response = await api.get(`/admin/products/${id}`);
  return response.data;
};

export const getProductSeller = async (id: string) => {
  const response = await api.get(`/products/${id}`);
  return response.data;
};
