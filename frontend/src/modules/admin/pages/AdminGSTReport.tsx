import React, { useCallback } from 'react';
import CustomGSTReport, { SupplierLite } from '../../shared/CustomGSTReport';
import {
    listGSTReport,
    createGSTReport,
    updateGSTReport,
    deleteGSTReport,
} from '../../../services/api/admin/adminGSTReportService';
import { getAllSuppliers, Supplier } from '../../../services/api/admin/supplierService';

const AdminGSTReport: React.FC = () => {
    // Adapt the admin supplier service shape into the lightweight SupplierLite contract
    // that CustomGSTReport expects.
    const getAllSuppliersFn = useCallback(async (search?: string) => {
        const res = await getAllSuppliers(search);
        const data: SupplierLite[] = (res?.data || []).map((s: Supplier) => ({
            _id: s._id,
            name: s.name,
            phone: s.phone,
            gstNumber: s.gstNumber,
        }));
        return { success: !!res?.success, data };
    }, []);

    return (
        <CustomGSTReport
            title="Custom GST Report"
            subtitle="Manual GST register — add bills, auto-fill supplier GST, edit any cell inline"
            listFn={listGSTReport}
            createFn={createGSTReport}
            updateFn={updateGSTReport}
            deleteFn={deleteGSTReport}
            getAllSuppliersFn={getAllSuppliersFn}
        />
    );
};

export default AdminGSTReport;
