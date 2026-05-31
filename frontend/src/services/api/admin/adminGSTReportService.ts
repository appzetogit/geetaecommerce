import api from '../config';

const BASE_PATH = '/admin/reports/gst-register';

export interface GSTReportEntry {
    _id: string;
    sellerId?: string;
    isAdmin: boolean;
    date: string;
    billNo: string;
    supplierLedgerId?: string;
    supplierName: string;
    supplierGstNumber?: string;
    itemCategory?: string;
    totalAmount: number;
    slab5Amount: number;
    slab5Gst: number;
    slab12Amount: number;
    slab12Gst: number;
    slab18Amount: number;
    slab18Gst: number;
    slab28Amount: number;
    slab28Gst: number;
    customRate?: number;
    customAmount: number;
    customGst: number;
    createdAt: string;
    updatedAt: string;
}

export interface ListGSTReportParams {
    search?: string;
    dateFrom?: string;
    dateTo?: string;
}

export type GSTReportEntryPayload = Partial<Omit<GSTReportEntry, '_id' | 'isAdmin' | 'sellerId' | 'createdAt' | 'updatedAt'>>;

export const listGSTReport = async (params?: ListGSTReportParams) => {
    const response = await api.get(BASE_PATH, { params });
    return response.data as { success: boolean; data: GSTReportEntry[] };
};

export const createGSTReport = async (payload: GSTReportEntryPayload) => {
    const response = await api.post(BASE_PATH, payload);
    return response.data as { success: boolean; data: GSTReportEntry };
};

export const updateGSTReport = async (id: string, patch: GSTReportEntryPayload) => {
    const response = await api.patch(`${BASE_PATH}/${id}`, patch);
    return response.data as { success: boolean; data: GSTReportEntry };
};

export const deleteGSTReport = async (id: string) => {
    const response = await api.delete(`${BASE_PATH}/${id}`);
    return response.data as { success: boolean; message: string };
};
