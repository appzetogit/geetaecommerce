import api from '../config';

export interface VideoFind {
  _id: string;
  id?: string; // Some parts of the UI use .id instead of ._id
  title: string;
  price: number;
  originalPrice: number;
  videoUrl: string;
  views: string;
  likes: string[];
  shares: number;
  linkedProduct?: {
      _id: string;
      productName: string;
      price: number;
      stock?: number;
      mainImage?: string;
  };
}

export const getVideoFinds = async () => {
  const response = await api.get<{ success: boolean; data: VideoFind[] }>('/customer/video-finds');
  return response.data;
};

export const toggleLikeVideo = async (videoId: string) => {
  const response = await api.post<{ success: boolean; data: VideoFind; isLiked: boolean }>(`/customer/video-finds/${videoId}/like`);
  return response.data;
};

export const incrementShareCount = async (videoId: string) => {
  const response = await api.post<{ success: boolean; data: VideoFind }>(`/customer/video-finds/${videoId}/share`);
  return response.data;
};
