import api from './config';

export interface Review {
    _id: string;
    product: string;
    customer: {
        _id: string;
        name: string;
    };
    rating: number;
    comment: string;
    createdAt: string;
}

export interface ReviewResponse {
    success: boolean;
    data: Review[];
    message?: string;
}

/**
 * Get reviews for a product
 */
export const getProductReviews = async (productId: string): Promise<ReviewResponse> => {
    const response = await api.get<ReviewResponse>(`/customer/reviews/${productId}`);
    return response.data;
};

/**
 * Add a review for a product
 */
export const addReview = async (productId: string, rating: number, comment: string): Promise<any> => {
    const response = await api.post('/customer/reviews', { productId, rating, comment });
    return response.data;
};
