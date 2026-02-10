import api from './config';
import { PublicConfig } from '../../context/AppContext';

export interface UpdateSettingsResponse {
    success: boolean;
    message: string;
    data?: any;
}

export const getAdminAppSettings = async () => {
    const response = await api.get('/admin/settings');
    return response.data;
};

export const updateAdminAppSettings = async (settings: Partial<PublicConfig>) => {
    const response = await api.put('/admin/settings', settings);
    return response.data;
};
