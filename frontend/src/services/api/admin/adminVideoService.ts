import api from '../config';
import { ApiResponse } from './types';

export interface VideoFind {
  _id: string; // Changed from id to _id for Mongoose
  title: string;
  price: number;
  originalPrice: number;
  videoUrl: string;
  views: string;
  linkedProduct?: {
      _id: string;
      productName: string;
  };
}

export interface CreateVideoFindData {
  title: string;
  price: number;
  originalPrice: number;
  videoUrl: string;
  views?: string;
  linkedProductId: string;
}

// Get all video finds
export const getVideoFinds = async (): Promise<ApiResponse<VideoFind[]>> => {
  const response = await api.get<ApiResponse<VideoFind[]>>('/admin/video-finds');
  return response.data;
};

// Create a new video find
export const createVideoFind = async (data: CreateVideoFindData): Promise<ApiResponse<VideoFind>> => {
  const response = await api.post<ApiResponse<VideoFind>>('/admin/video-finds', data);
  return response.data;
};

// Update a video find
export const updateVideoFind = async (id: string, data: Partial<CreateVideoFindData>): Promise<ApiResponse<VideoFind>> => {
  const response = await api.put<ApiResponse<VideoFind>>(`/admin/video-finds/${id}`, data);
  return response.data;
};

// Delete a video find
export const deleteVideoFind = async (id: string): Promise<ApiResponse<void>> => {
  const response = await api.delete<ApiResponse<void>>(`/admin/video-finds/${id}`);
  return response.data;
};

// Upload video
export const uploadVideo = async (file: File): Promise<ApiResponse<{ url: string; public_id: string }>> => {
  const formData = new FormData();
  formData.append("video", file);
  const response = await api.post<ApiResponse<{ url: string; public_id: string }>>("/upload/video", formData, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
  });
  return response.data;
};
