import api from '../config';

const BASE_PATH = '/admin/pos/suppliers';

// Types
export interface Supplier {
    _id: string;
    name: string;
    phone: string;
    address?: string;
    gstNumber?: string;
    notes?: string;
    openingBalance: number;
    openingBalanceType: 'Payment' | 'Receive';
    currentBalance: number;
}

export interface SupplierTransaction {
    _id: string;
    supplier: string;
    type: 'Purchase' | 'Payment' | 'Manual';
    amount: number; // positive = we owe more (Purchase), negative = we paid (Payment)
    balanceAfter: number;
    description: string;
    referenceId?: string;
    date: string;
    createdBy?: string;
    createdAt: string;
}

export interface SupplierDetailResponse {
    supplier: Supplier;
    transactions: SupplierTransaction[];
}

// APIs
export const getAllSuppliers = async (search?: string, hasDue?: boolean, hasAdvance?: boolean) => {
    try {
        const response = await api.get(BASE_PATH, {
            params: { search, hasDue, hasAdvance }
        });
        return response.data;
    } catch (error) {
        throw error;
    }
};

export const getSupplierDetail = async (id: string) => {
    try {
        const response = await api.get(`${BASE_PATH}/${id}`);
        return response.data;
    } catch (error) {
        throw error;
    }
};

export const createSupplier = async (data: Partial<Supplier>) => {
    try {
        const response = await api.post(BASE_PATH, data);
        return response.data;
    } catch (error) {
        throw error;
    }
};

export const editSupplier = async (id: string, data: Partial<Supplier>) => {
    try {
        const response = await api.put(`${BASE_PATH}/${id}`, data);
        return response.data;
    } catch (error) {
        throw error;
    }
};

export const deleteSupplier = async (id: string) => {
    try {
        const response = await api.delete(`${BASE_PATH}/${id}`);
        return response.data;
    } catch (error) {
        throw error;
    }
};

export const addDebt = async (id: string, data: { amount: number, description: string, date?: string }) => {
    try {
        const response = await api.post(`${BASE_PATH}/${id}/debt`, data);
        return response.data;
    } catch (error) {
        throw error;
    }
};

export const paySupplier = async (id: string, data: { amount: number, description: string, date?: string }) => {
    try {
        const response = await api.post(`${BASE_PATH}/${id}/pay`, data);
        return response.data;
    } catch (error) {
        throw error;
    }
};
