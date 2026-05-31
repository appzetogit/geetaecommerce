import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'react-hot-toast';
import * as XLSX from 'xlsx';

// ---------- Types ----------

export interface GSTReportEntry {
    _id: string;
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

export type GSTReportEntryPayload = Partial<Omit<GSTReportEntry, '_id' | 'createdAt' | 'updatedAt'>>;

export interface SupplierLite {
    _id: string;
    name: string;
    phone?: string;
    gstNumber?: string;
}

export interface CustomGSTReportProps {
    title?: string;
    subtitle?: string;
    listFn: (params?: { search?: string; dateFrom?: string; dateTo?: string }) => Promise<{ success: boolean; data: GSTReportEntry[] }>;
    createFn: (payload: GSTReportEntryPayload) => Promise<{ success: boolean; data: GSTReportEntry }>;
    updateFn: (id: string, patch: GSTReportEntryPayload) => Promise<{ success: boolean; data: GSTReportEntry }>;
    deleteFn: (id: string) => Promise<{ success: boolean; message: string }>;
    getAllSuppliersFn: (search?: string) => Promise<{ success: boolean; data: SupplierLite[] }>;
}

// ---------- Slab config ----------
// Tailwind classes are written out in full so JIT picks them up correctly.

interface FixedSlabConfig {
    rate: 5 | 12 | 18 | 28;
    label: string;
    amountKey: 'slab5Amount' | 'slab12Amount' | 'slab18Amount' | 'slab28Amount';
    gstKey: 'slab5Gst' | 'slab12Gst' | 'slab18Gst' | 'slab28Gst';
    groupHeaderClass: string;
    subHeaderClass: string;
    cellClass: string;
    footerCellClass: string;
    gstTextClass: string;
    formContainerClass: string;
}

const FIXED_SLABS: FixedSlabConfig[] = [
    {
        rate: 5, label: '5%',
        amountKey: 'slab5Amount', gstKey: 'slab5Gst',
        groupHeaderClass: 'bg-emerald-100/70 text-emerald-800',
        subHeaderClass: 'bg-emerald-50 text-emerald-700',
        cellClass: 'bg-emerald-50/30',
        footerCellClass: 'bg-emerald-100/40',
        gstTextClass: 'text-emerald-700',
        formContainerClass: 'bg-emerald-50/50 border-emerald-200',
    },
    {
        rate: 12, label: '12%',
        amountKey: 'slab12Amount', gstKey: 'slab12Gst',
        groupHeaderClass: 'bg-sky-100/70 text-sky-800',
        subHeaderClass: 'bg-sky-50 text-sky-700',
        cellClass: 'bg-sky-50/30',
        footerCellClass: 'bg-sky-100/40',
        gstTextClass: 'text-sky-700',
        formContainerClass: 'bg-sky-50/50 border-sky-200',
    },
    {
        rate: 18, label: '18%',
        amountKey: 'slab18Amount', gstKey: 'slab18Gst',
        groupHeaderClass: 'bg-amber-100/70 text-amber-800',
        subHeaderClass: 'bg-amber-50 text-amber-700',
        cellClass: 'bg-amber-50/30',
        footerCellClass: 'bg-amber-100/40',
        gstTextClass: 'text-amber-700',
        formContainerClass: 'bg-amber-50/50 border-amber-200',
    },
    {
        rate: 28, label: '28%',
        amountKey: 'slab28Amount', gstKey: 'slab28Gst',
        groupHeaderClass: 'bg-purple-100/70 text-purple-800',
        subHeaderClass: 'bg-purple-50 text-purple-700',
        cellClass: 'bg-purple-50/30',
        footerCellClass: 'bg-purple-100/40',
        gstTextClass: 'text-purple-700',
        formContainerClass: 'bg-purple-50/50 border-purple-200',
    },
];

const CUSTOM_SLAB = {
    groupHeaderClass: 'bg-indigo-100/60 text-indigo-800',
    subHeaderClass: 'bg-indigo-50 text-indigo-700',
    cellClass: 'bg-indigo-50/30',
    footerCellClass: 'bg-indigo-100/30',
    gstTextClass: 'text-indigo-700',
};

// ---------- Helpers ----------

const toIsoDate = (d: Date | string | undefined): string => {
    if (!d) return '';
    const date = typeof d === 'string' ? new Date(d) : d;
    if (isNaN(date.getTime())) return '';
    return date.toISOString().split('T')[0];
};

const formatCurrency = (n: number | undefined): string => {
    const v = Number(n || 0);
    return v.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const NUMERIC_FIELDS: Array<keyof GSTReportEntry> = [
    'totalAmount',
    'slab5Amount', 'slab5Gst',
    'slab12Amount', 'slab12Gst',
    'slab18Amount', 'slab18Gst',
    'slab28Amount', 'slab28Gst',
    'customRate', 'customAmount', 'customGst',
];

// Map a fixed slab amount field to its GST counterpart + rate, used for auto-calculation
const FIXED_AMOUNT_TO_GST: Record<string, { gstKey: keyof GSTReportEntry; rate: number }> = {
    slab5Amount: { gstKey: 'slab5Gst', rate: 5 },
    slab12Amount: { gstKey: 'slab12Gst', rate: 12 },
    slab18Amount: { gstKey: 'slab18Gst', rate: 18 },
    slab28Amount: { gstKey: 'slab28Gst', rate: 28 },
};

// Calculate GST = amount × rate / 100, rounded to 2 decimals
const calcGst = (amount: number, rate: number): number => {
    const v = (Number(amount || 0) * Number(rate || 0)) / 100;
    return Math.round(v * 100) / 100;
};

// ---------- Component ----------

const CustomGSTReport: React.FC<CustomGSTReportProps> = ({
    title = 'Custom GST Report',
    subtitle = 'Manual GST register — add bills, auto-fill supplier GST, edit any cell inline',
    listFn, createFn, updateFn, deleteFn, getAllSuppliersFn,
}) => {
    const [rows, setRows] = useState<GSTReportEntry[]>([]);
    const [loading, setLoading] = useState(false);
    const [search, setSearch] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [dateRange, setDateRange] = useState({ start: '', end: '' });

    // Add / Edit Record modal state (shared modal; editingRowId === null means "Add")
    const [showAddModal, setShowAddModal] = useState(false);
    const [editingRowId, setEditingRowId] = useState<string | null>(null);
    const [allSuppliers, setAllSuppliers] = useState<SupplierLite[]>([]);
    const [supplierSearch, setSupplierSearch] = useState('');
    const [showSupplierResults, setShowSupplierResults] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    const blankForm = useMemo<GSTReportEntryPayload>(() => ({
        date: new Date().toISOString(),
        billNo: '',
        supplierLedgerId: undefined,
        supplierName: '',
        supplierGstNumber: '',
        itemCategory: '',
        // Numeric fields intentionally left undefined so the inputs render empty (no pre-filled "0").
        totalAmount: undefined,
        slab5Amount: undefined, slab5Gst: undefined,
        slab12Amount: undefined, slab12Gst: undefined,
        slab18Amount: undefined, slab18Gst: undefined,
        slab28Amount: undefined, slab28Gst: undefined,
        customRate: undefined, customAmount: undefined, customGst: undefined,
    }), []);
    const [form, setForm] = useState<GSTReportEntryPayload>(blankForm);

    // Inline-edit state: which cell is currently being edited
    const [editingCell, setEditingCell] = useState<{ rowId: string; field: keyof GSTReportEntry } | null>(null);
    const [editingValue, setEditingValue] = useState<string>('');
    const [savingCell, setSavingCell] = useState<string | null>(null);

    // ---------- Data fetching ----------
    const fetchData = useCallback(async () => {
        try {
            setLoading(true);
            const params: { search?: string; dateFrom?: string; dateTo?: string } = {};
            if (debouncedSearch) params.search = debouncedSearch;
            if (dateRange.start) {
                params.dateFrom = new Date(dateRange.start).toISOString();
            }
            if (dateRange.end) {
                params.dateTo = new Date(new Date(dateRange.end).setHours(23, 59, 59, 999)).toISOString();
            }

            const res = await listFn(params);
            if (res.success) setRows(res.data);
        } catch (err) {
            console.error('Failed to fetch GST report:', err);
            toast.error('Failed to load GST report');
        } finally {
            setLoading(false);
        }
    }, [listFn, debouncedSearch, dateRange]);

    useEffect(() => { fetchData(); }, [fetchData]);

    // Debounce search
    useEffect(() => {
        const t = setTimeout(() => setDebouncedSearch(search), 400);
        return () => clearTimeout(t);
    }, [search]);

    // Load suppliers when modal opens
    useEffect(() => {
        if (!showAddModal) return;
        (async () => {
            try {
                const res = await getAllSuppliersFn();
                if (res.success) setAllSuppliers(res.data);
            } catch (err) {
                console.error('Failed to load suppliers', err);
            }
        })();
    }, [showAddModal, getAllSuppliersFn]);

    // ---------- Add / Edit Record handlers ----------
    const openAddModal = () => {
        setEditingRowId(null);
        setForm({ ...blankForm, date: new Date().toISOString() });
        setSupplierSearch('');
        setShowSupplierResults(false);
        setShowAddModal(true);
    };

    const openEditModal = (row: GSTReportEntry) => {
        setEditingRowId(row._id);
        setForm({
            date: row.date,
            billNo: row.billNo,
            supplierLedgerId: row.supplierLedgerId,
            supplierName: row.supplierName,
            supplierGstNumber: row.supplierGstNumber || '',
            itemCategory: row.itemCategory || '',
            totalAmount: row.totalAmount,
            slab5Amount: row.slab5Amount,
            slab5Gst: row.slab5Gst,
            slab12Amount: row.slab12Amount,
            slab12Gst: row.slab12Gst,
            slab18Amount: row.slab18Amount,
            slab18Gst: row.slab18Gst,
            slab28Amount: row.slab28Amount,
            slab28Gst: row.slab28Gst,
            customRate: row.customRate,
            customAmount: row.customAmount,
            customGst: row.customGst,
        });
        setSupplierSearch(row.supplierName || '');
        setShowSupplierResults(false);
        setShowAddModal(true);
    };

    const closeAddModal = () => {
        setShowAddModal(false);
        setEditingRowId(null);
        setShowSupplierResults(false);
    };

    const filteredSuppliers = useMemo(() => {
        const q = supplierSearch.trim().toLowerCase();
        if (!q) return allSuppliers.slice(0, 20);
        return allSuppliers.filter(s =>
            (s.name || '').toLowerCase().includes(q) ||
            (s.phone || '').includes(q) ||
            (s.gstNumber || '').toLowerCase().includes(q)
        ).slice(0, 20);
    }, [allSuppliers, supplierSearch]);

    const selectSupplier = (s: SupplierLite) => {
        setForm(prev => ({
            ...prev,
            supplierLedgerId: s._id,
            supplierName: s.name || '',
            supplierGstNumber: s.gstNumber || '',
        }));
        setSupplierSearch(s.name || '');
        setShowSupplierResults(false);
    };

    const updateForm = <K extends keyof GSTReportEntryPayload>(key: K, value: GSTReportEntryPayload[K]) => {
        setForm(prev => ({ ...prev, [key]: value }));
    };

    const handleSubmitForm = async () => {
        if (!form.supplierName?.trim()) { toast.error('Supplier name is required'); return; }
        if (!form.billNo?.trim()) { toast.error('Bill no. is required'); return; }
        try {
            setSubmitting(true);
            const payload: GSTReportEntryPayload = {
                ...form,
                date: form.date ? new Date(form.date).toISOString() : new Date().toISOString(),
                totalAmount: Number(form.totalAmount || 0),
                slab5Amount: Number(form.slab5Amount || 0),
                slab5Gst: Number(form.slab5Gst || 0),
                slab12Amount: Number(form.slab12Amount || 0),
                slab12Gst: Number(form.slab12Gst || 0),
                slab18Amount: Number(form.slab18Amount || 0),
                slab18Gst: Number(form.slab18Gst || 0),
                slab28Amount: Number(form.slab28Amount || 0),
                slab28Gst: Number(form.slab28Gst || 0),
                customRate: Number(form.customRate || 0),
                customAmount: Number(form.customAmount || 0),
                customGst: Number(form.customGst || 0),
            };

            if (editingRowId) {
                const res = await updateFn(editingRowId, payload);
                if (res.success) {
                    setRows(prev => prev.map(r => r._id === editingRowId ? res.data : r));
                    toast.success('Record updated');
                    closeAddModal();
                } else {
                    toast.error('Failed to update record');
                }
            } else {
                const res = await createFn(payload);
                if (res.success) {
                    setRows(prev => [res.data, ...prev]);
                    toast.success('Record added');
                    closeAddModal();
                } else {
                    toast.error('Failed to save record');
                }
            }
        } catch (err: any) {
            const msg = err?.response?.data?.message || 'Failed to save record';
            toast.error(msg);
        } finally {
            setSubmitting(false);
        }
    };

    // ---------- Inline edit handlers ----------
    const startEdit = (row: GSTReportEntry, field: keyof GSTReportEntry) => {
        const raw = (row as any)[field];
        let str = '';
        if (field === 'date') str = toIsoDate(raw);
        else if (raw === null || raw === undefined) str = '';
        else str = String(raw);
        setEditingCell({ rowId: row._id, field });
        setEditingValue(str);
    };

    const cancelEdit = () => {
        setEditingCell(null);
        setEditingValue('');
    };

    const saveEdit = async () => {
        if (!editingCell) return;
        const { rowId, field } = editingCell;
        const row = rows.find(r => r._id === rowId);
        if (!row) { cancelEdit(); return; }

        let newValue: any = editingValue;
        if (NUMERIC_FIELDS.includes(field)) {
            const num = parseFloat(editingValue);
            newValue = isNaN(num) ? 0 : num;
        } else if (field === 'date') {
            if (!editingValue) { cancelEdit(); return; }
            newValue = new Date(editingValue).toISOString();
        } else {
            newValue = editingValue;
        }

        const cellKey = `${rowId}:${String(field)}`;
        try {
            setSavingCell(cellKey);
            const patch: GSTReportEntryPayload = { [field]: newValue } as any;

            // Auto-recompute the corresponding GST Paid when Amount (or custom Rate) changes
            if (typeof newValue === 'number') {
                const fieldStr = String(field);
                if (fieldStr in FIXED_AMOUNT_TO_GST) {
                    const cfg = FIXED_AMOUNT_TO_GST[fieldStr];
                    (patch as any)[cfg.gstKey] = calcGst(newValue, cfg.rate);
                } else if (field === 'customAmount') {
                    const rate = Number(row.customRate || 0);
                    patch.customGst = calcGst(newValue, rate);
                } else if (field === 'customRate') {
                    const amount = Number(row.customAmount || 0);
                    patch.customGst = calcGst(amount, newValue);
                }
            }

            const res = await updateFn(rowId, patch);
            if (res.success) {
                setRows(prev => prev.map(r => r._id === rowId ? res.data : r));
            } else {
                toast.error('Failed to update');
            }
        } catch (err: any) {
            const msg = err?.response?.data?.message || 'Failed to update';
            toast.error(msg);
        } finally {
            setSavingCell(null);
            cancelEdit();
        }
    };

    const inputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') { e.preventDefault(); saveEdit(); }
        else if (e.key === 'Escape') { e.preventDefault(); cancelEdit(); }
    };

    // ---------- Delete handler ----------
    const handleDeleteRow = async (id: string) => {
        if (!window.confirm('Delete this record? This cannot be undone.')) return;
        try {
            const res = await deleteFn(id);
            if (res.success) {
                setRows(prev => prev.filter(r => r._id !== id));
                toast.success('Record deleted');
            } else {
                toast.error('Failed to delete');
            }
        } catch (err: any) {
            const msg = err?.response?.data?.message || 'Failed to delete';
            toast.error(msg);
        }
    };

    // ---------- Excel download ----------
    const downloadExcel = () => {
        if (rows.length === 0) {
            toast.error('No records to export');
            return;
        }

        const sheetRows = rows.map(r => ({
            'Date': toIsoDate(r.date),
            'Bill No.': r.billNo || '',
            'Supplier Name': r.supplierName || '',
            'GST Number': r.supplierGstNumber || '',
            'Item Category': r.itemCategory || '',
            'Total Amount': Number(r.totalAmount || 0),
            'Amount @ 5%': Number(r.slab5Amount || 0),
            'GST Paid @ 5%': Number(r.slab5Gst || 0),
            'Amount @ 12%': Number(r.slab12Amount || 0),
            'GST Paid @ 12%': Number(r.slab12Gst || 0),
            'Amount @ 18%': Number(r.slab18Amount || 0),
            'GST Paid @ 18%': Number(r.slab18Gst || 0),
            'Amount @ 28%': Number(r.slab28Amount || 0),
            'GST Paid @ 28%': Number(r.slab28Gst || 0),
            'Custom Rate %': Number(r.customRate || 0),
            'Amount @ Custom %': Number(r.customAmount || 0),
            'GST Paid @ Custom %': Number(r.customGst || 0),
            'Total GST Paid': Number((r.slab5Gst || 0) + (r.slab12Gst || 0) + (r.slab18Gst || 0) + (r.slab28Gst || 0) + (r.customGst || 0)),
        }));

        const totalsRow: Record<string, any> = {
            'Date': '',
            'Bill No.': '',
            'Supplier Name': '',
            'GST Number': '',
            'Item Category': 'TOTALS',
            'Total Amount': sheetRows.reduce((s, r) => s + r['Total Amount'], 0),
            'Amount @ 5%': sheetRows.reduce((s, r) => s + r['Amount @ 5%'], 0),
            'GST Paid @ 5%': sheetRows.reduce((s, r) => s + r['GST Paid @ 5%'], 0),
            'Amount @ 12%': sheetRows.reduce((s, r) => s + r['Amount @ 12%'], 0),
            'GST Paid @ 12%': sheetRows.reduce((s, r) => s + r['GST Paid @ 12%'], 0),
            'Amount @ 18%': sheetRows.reduce((s, r) => s + r['Amount @ 18%'], 0),
            'GST Paid @ 18%': sheetRows.reduce((s, r) => s + r['GST Paid @ 18%'], 0),
            'Amount @ 28%': sheetRows.reduce((s, r) => s + r['Amount @ 28%'], 0),
            'GST Paid @ 28%': sheetRows.reduce((s, r) => s + r['GST Paid @ 28%'], 0),
            'Custom Rate %': '',
            'Amount @ Custom %': sheetRows.reduce((s, r) => s + r['Amount @ Custom %'], 0),
            'GST Paid @ Custom %': sheetRows.reduce((s, r) => s + r['GST Paid @ Custom %'], 0),
            'Total GST Paid': sheetRows.reduce((s, r) => s + r['Total GST Paid'], 0),
        };

        const worksheet = XLSX.utils.json_to_sheet([...sheetRows, totalsRow]);

        // Auto-size columns roughly based on header / max cell length
        const headers = Object.keys(sheetRows[0] || totalsRow);
        worksheet['!cols'] = headers.map(h => {
            const maxLen = Math.max(
                h.length,
                ...[...sheetRows, totalsRow].map(r => String((r as any)[h] ?? '').length)
            );
            return { wch: Math.min(maxLen + 2, 40) };
        });

        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'GST Report');

        const today = new Date().toISOString().split('T')[0];
        const rangePart = dateRange.start || dateRange.end
            ? `_${dateRange.start || 'start'}_to_${dateRange.end || 'end'}`
            : '';
        XLSX.writeFile(workbook, `Custom_GST_Report${rangePart}_${today}.xlsx`);
        toast.success('Excel downloaded');
    };

    // ---------- Totals ----------
    const totals = useMemo(() => rows.reduce((acc, r) => ({
        totalAmount: acc.totalAmount + Number(r.totalAmount || 0),
        slab5Amount: acc.slab5Amount + Number(r.slab5Amount || 0),
        slab5Gst: acc.slab5Gst + Number(r.slab5Gst || 0),
        slab12Amount: acc.slab12Amount + Number(r.slab12Amount || 0),
        slab12Gst: acc.slab12Gst + Number(r.slab12Gst || 0),
        slab18Amount: acc.slab18Amount + Number(r.slab18Amount || 0),
        slab18Gst: acc.slab18Gst + Number(r.slab18Gst || 0),
        slab28Amount: acc.slab28Amount + Number(r.slab28Amount || 0),
        slab28Gst: acc.slab28Gst + Number(r.slab28Gst || 0),
        customAmount: acc.customAmount + Number(r.customAmount || 0),
        customGst: acc.customGst + Number(r.customGst || 0),
    }), {
        totalAmount: 0,
        slab5Amount: 0, slab5Gst: 0,
        slab12Amount: 0, slab12Gst: 0,
        slab18Amount: 0, slab18Gst: 0,
        slab28Amount: 0, slab28Gst: 0,
        customAmount: 0, customGst: 0,
    }), [rows]);

    const totalGstPaid = totals.slab5Gst + totals.slab12Gst + totals.slab18Gst + totals.slab28Gst + totals.customGst;

    // ---------- Render helpers ----------
    const renderCell = (
        row: GSTReportEntry,
        field: keyof GSTReportEntry,
        opts?: { type?: 'text' | 'number' | 'date'; align?: 'left' | 'right' | 'center'; render?: (v: any) => React.ReactNode; minWidth?: number }
    ) => {
        const { type = 'text', align = 'left', render, minWidth } = opts || {};
        const isEditing = editingCell?.rowId === row._id && editingCell?.field === field;
        const cellKey = `${row._id}:${String(field)}`;
        const isSaving = savingCell === cellKey;
        const raw = (row as any)[field];

        if (isEditing) {
            return (
                <input
                    autoFocus
                    type={type}
                    value={editingValue}
                    onChange={(e) => setEditingValue(e.target.value)}
                    onBlur={saveEdit}
                    onKeyDown={inputKeyDown}
                    step={type === 'number' ? 'any' : undefined}
                    className={`w-full px-2 py-1 text-sm border border-pink-400 rounded focus:border-pink-500 focus:ring-1 focus:ring-pink-300 outline-none ${align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : ''}`}
                    style={{ minWidth }}
                />
            );
        }

        return (
            <button
                type="button"
                onClick={() => startEdit(row, field)}
                title="Click to edit"
                className={`w-full block px-2 py-1 rounded text-sm hover:bg-pink-50/60 transition-colors ${align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left'} ${isSaving ? 'opacity-60' : ''}`}
                style={{ minWidth }}
            >
                {render ? render(raw) : (raw === null || raw === undefined || raw === '' ? <span className="text-gray-300">—</span> : String(raw))}
                {isSaving && <span className="ml-1 text-[10px] text-pink-500">saving…</span>}
            </button>
        );
    };

    const supplierBlurTimer = useRef<number | null>(null);

    // Column count for empty/loading states: 6 fixed + 4 slabs * 2 + custom 3 + actions = 6+8+3+1 = 18
    const totalColumns = 6 + FIXED_SLABS.length * 2 + 3 + 1;

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
            {/* ---------- Header ---------- */}
            <div className="bg-white border-b border-gray-200 shadow-sm">
                <div className="max-w-[120rem] mx-auto px-4 sm:px-6 lg:px-8 py-4">
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
                            <p className="text-sm text-gray-500 mt-1">{subtitle}</p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            <button
                                onClick={downloadExcel}
                                disabled={rows.length === 0}
                                title={rows.length === 0 ? 'No records to download' : 'Download as Excel'}
                                className="inline-flex items-center px-4 py-2 bg-emerald-600 text-white text-sm font-semibold rounded-lg hover:bg-emerald-700 active:scale-95 transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                </svg>
                                Download Excel
                            </button>
                            <button
                                onClick={openAddModal}
                                className="inline-flex items-center px-4 py-2 bg-[var(--primary-dark)] text-white text-sm font-semibold rounded-lg hover:bg-[var(--primary-darker)] active:scale-95 transition-all shadow-sm"
                            >
                                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                                </svg>
                                Add Record
                            </button>
                        </div>
                    </div>

                    {/* Filters row: From / To / Search */}
                    <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-gray-700 mb-1.5 px-1">From Date</label>
                            <input
                                type="date"
                                value={dateRange.start}
                                max={dateRange.end || undefined}
                                onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                                className="w-full px-4 py-2.5 text-sm bg-white border border-gray-300 rounded-lg focus:border-pink-500 focus:ring-2 focus:ring-pink-200 outline-none shadow-sm"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-700 mb-1.5 px-1">To Date</label>
                            <input
                                type="date"
                                value={dateRange.end}
                                min={dateRange.start || undefined}
                                onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                                className="w-full px-4 py-2.5 text-sm bg-white border border-gray-300 rounded-lg focus:border-pink-500 focus:ring-2 focus:ring-pink-200 outline-none shadow-sm"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-700 mb-1.5 px-1">Search</label>
                            <input
                                type="text"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder="Supplier, GST, bill no., category…"
                                className="w-full px-4 py-2.5 text-sm bg-white border border-gray-300 rounded-lg focus:border-pink-500 focus:ring-2 focus:ring-pink-200 outline-none shadow-sm"
                            />
                        </div>
                    </div>

                    {(dateRange.start || dateRange.end) && (
                        <div className="mt-2 flex items-center gap-2 text-xs">
                            <span className="text-gray-500">
                                Filtering: {dateRange.start || '—'} to {dateRange.end || '—'}
                            </span>
                            <button
                                type="button"
                                onClick={() => setDateRange({ start: '', end: '' })}
                                className="text-pink-600 hover:text-pink-700 font-semibold underline-offset-2 hover:underline"
                            >
                                Clear dates
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* ---------- Stats ---------- */}
            <div className="max-w-[120rem] mx-auto px-4 sm:px-6 lg:px-8 py-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
                    <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-200">
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Records</p>
                        <p className="text-2xl font-black text-[var(--primary-dark)] mt-2">{rows.length}</p>
                    </div>
                    <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-200">
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Total Amount</p>
                        <p className="text-2xl font-black text-[var(--primary-dark)] mt-2">₹{formatCurrency(totals.totalAmount)}</p>
                    </div>
                    <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-200">
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Total GST Paid</p>
                        <p className="text-2xl font-black text-emerald-700 mt-2">₹{formatCurrency(totalGstPaid)}</p>
                    </div>
                </div>

                {/* ---------- Table ---------- */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="text-sm border-collapse" style={{ minWidth: 1900, width: 'max-content' }}>
                            <thead>
                                {/* Top group header row */}
                                <tr className="bg-gradient-to-r from-green-50 to-emerald-50 border-b border-green-200">
                                    <th rowSpan={2} style={{ minWidth: 130 }} className="px-4 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider border border-gray-200 whitespace-nowrap">Date</th>
                                    <th rowSpan={2} style={{ minWidth: 130 }} className="px-4 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider border border-gray-200 whitespace-nowrap">Bill No.</th>
                                    <th rowSpan={2} style={{ minWidth: 200 }} className="px-4 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider border border-gray-200 whitespace-nowrap">Supplier Name</th>
                                    <th rowSpan={2} style={{ minWidth: 170 }} className="px-4 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider border border-gray-200 whitespace-nowrap">GST Number</th>
                                    <th rowSpan={2} style={{ minWidth: 160 }} className="px-4 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider border border-gray-200 whitespace-nowrap">Item Category</th>
                                    <th rowSpan={2} style={{ minWidth: 130 }} className="px-4 py-3 text-right text-xs font-bold text-gray-600 uppercase tracking-wider border border-gray-200 whitespace-nowrap">Total Amount</th>
                                    {FIXED_SLABS.map(slab => (
                                        <th key={slab.rate} colSpan={2} className={`px-4 py-2 text-center text-xs font-bold uppercase tracking-wider border border-gray-200 whitespace-nowrap ${slab.groupHeaderClass}`}>
                                            Amount @ {slab.label}
                                        </th>
                                    ))}
                                    <th colSpan={3} className={`px-4 py-2 text-center text-xs font-bold uppercase tracking-wider border border-gray-200 whitespace-nowrap ${CUSTOM_SLAB.groupHeaderClass}`}>
                                        Amount @ [ ]%
                                    </th>
                                    <th rowSpan={2} style={{ minWidth: 120 }} className="px-4 py-3 text-center text-xs font-bold text-gray-600 uppercase tracking-wider border border-gray-200 whitespace-nowrap">Actions</th>
                                </tr>
                                {/* Sub-header row for grouped columns */}
                                <tr className="bg-gradient-to-r from-green-50 to-emerald-50 border-b-2 border-green-200">
                                    {FIXED_SLABS.map(slab => (
                                        <React.Fragment key={slab.rate}>
                                            <th style={{ minWidth: 110 }} className={`px-3 py-2 text-right text-[11px] font-bold uppercase tracking-wider border border-gray-200 whitespace-nowrap ${slab.subHeaderClass}`}>Amount</th>
                                            <th style={{ minWidth: 110 }} className={`px-3 py-2 text-right text-[11px] font-bold uppercase tracking-wider border border-gray-200 whitespace-nowrap ${slab.subHeaderClass}`}>GST Paid</th>
                                        </React.Fragment>
                                    ))}
                                    <th style={{ minWidth: 80 }} className={`px-3 py-2 text-center text-[11px] font-bold uppercase tracking-wider border border-gray-200 whitespace-nowrap ${CUSTOM_SLAB.subHeaderClass}`}>Rate %</th>
                                    <th style={{ minWidth: 110 }} className={`px-3 py-2 text-right text-[11px] font-bold uppercase tracking-wider border border-gray-200 whitespace-nowrap ${CUSTOM_SLAB.subHeaderClass}`}>Amount</th>
                                    <th style={{ minWidth: 110 }} className={`px-3 py-2 text-right text-[11px] font-bold uppercase tracking-wider border border-gray-200 whitespace-nowrap ${CUSTOM_SLAB.subHeaderClass}`}>GST Paid</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {loading ? (
                                    <tr>
                                        <td colSpan={totalColumns} className="px-6 py-12 text-center text-gray-500 text-sm italic">Loading…</td>
                                    </tr>
                                ) : rows.length === 0 ? (
                                    <tr>
                                        <td colSpan={totalColumns} className="px-6 py-12 text-center text-gray-400 text-sm">
                                            No records yet. Click <span className="font-semibold text-[var(--primary-dark)]">+ Add Record</span> to create one.
                                        </td>
                                    </tr>
                                ) : (
                                    rows.map(row => (
                                        <tr key={row._id} className="hover:bg-pink-50/30 transition-colors">
                                            <td className="border border-gray-100 px-2 py-2 whitespace-nowrap">{renderCell(row, 'date', { type: 'date', render: v => toIsoDate(v) || '—', minWidth: 130 })}</td>
                                            <td className="border border-gray-100 px-2 py-2 whitespace-nowrap">{renderCell(row, 'billNo', { minWidth: 130 })}</td>
                                            <td className="border border-gray-100 px-2 py-2">{renderCell(row, 'supplierName', { minWidth: 200, render: v => <span className="font-semibold text-gray-900">{v || '—'}</span> })}</td>
                                            <td className="border border-gray-100 px-2 py-2 whitespace-nowrap">{renderCell(row, 'supplierGstNumber', { minWidth: 170, render: v => v ? <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-700 rounded-full font-mono">{v}</span> : <span className="text-gray-300">—</span> })}</td>
                                            <td className="border border-gray-100 px-2 py-2">{renderCell(row, 'itemCategory', { minWidth: 160 })}</td>
                                            <td className="border border-gray-100 px-2 py-2 whitespace-nowrap">{renderCell(row, 'totalAmount', { type: 'number', align: 'right', minWidth: 130, render: v => <span className="font-semibold">₹{formatCurrency(v)}</span> })}</td>
                                            {FIXED_SLABS.map(slab => (
                                                <React.Fragment key={slab.rate}>
                                                    <td className={`border border-gray-100 px-2 py-2 whitespace-nowrap ${slab.cellClass}`}>{renderCell(row, slab.amountKey, { type: 'number', align: 'right', minWidth: 110, render: v => `₹${formatCurrency(v)}` })}</td>
                                                    <td className={`border border-gray-100 px-2 py-2 whitespace-nowrap ${slab.cellClass}`}>{renderCell(row, slab.gstKey, { type: 'number', align: 'right', minWidth: 110, render: v => <span className={`${slab.gstTextClass} font-semibold`}>₹{formatCurrency(v)}</span> })}</td>
                                                </React.Fragment>
                                            ))}
                                            <td className={`border border-gray-100 px-2 py-2 whitespace-nowrap ${CUSTOM_SLAB.cellClass}`}>{renderCell(row, 'customRate', { type: 'number', align: 'center', minWidth: 80, render: v => v ? `${v}%` : <span className="text-gray-300">—</span> })}</td>
                                            <td className={`border border-gray-100 px-2 py-2 whitespace-nowrap ${CUSTOM_SLAB.cellClass}`}>{renderCell(row, 'customAmount', { type: 'number', align: 'right', minWidth: 110, render: v => `₹${formatCurrency(v)}` })}</td>
                                            <td className={`border border-gray-100 px-2 py-2 whitespace-nowrap ${CUSTOM_SLAB.cellClass}`}>{renderCell(row, 'customGst', { type: 'number', align: 'right', minWidth: 110, render: v => <span className={`${CUSTOM_SLAB.gstTextClass} font-semibold`}>₹{formatCurrency(v)}</span> })}</td>
                                            <td className="border border-gray-100 text-center whitespace-nowrap">
                                                <div className="inline-flex items-center gap-1">
                                                    <button
                                                        onClick={() => openEditModal(row)}
                                                        title="Edit row in modal"
                                                        className="p-1.5 text-sky-600 hover:bg-sky-50 rounded-md transition-colors"
                                                    >
                                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                                        </svg>
                                                    </button>
                                                    <button
                                                        onClick={() => handleDeleteRow(row._id)}
                                                        title="Delete row"
                                                        className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-md transition-colors"
                                                    >
                                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M1 7h22M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3" />
                                                        </svg>
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                            {rows.length > 0 && (
                                <tfoot>
                                    <tr className="bg-gray-50 font-bold">
                                        <td colSpan={5} className="px-4 py-3 text-right border border-gray-200 text-xs uppercase tracking-wider text-gray-700 whitespace-nowrap">Totals</td>
                                        <td className="px-4 py-3 text-right border border-gray-200 whitespace-nowrap">₹{formatCurrency(totals.totalAmount)}</td>
                                        {FIXED_SLABS.map(slab => (
                                            <React.Fragment key={slab.rate}>
                                                <td className={`px-4 py-3 text-right border border-gray-200 whitespace-nowrap ${slab.footerCellClass}`}>₹{formatCurrency(totals[slab.amountKey])}</td>
                                                <td className={`px-4 py-3 text-right border border-gray-200 whitespace-nowrap ${slab.footerCellClass} ${slab.gstTextClass}`}>₹{formatCurrency(totals[slab.gstKey])}</td>
                                            </React.Fragment>
                                        ))}
                                        <td className={`px-4 py-3 text-center border border-gray-200 ${CUSTOM_SLAB.footerCellClass} text-gray-400`}>—</td>
                                        <td className={`px-4 py-3 text-right border border-gray-200 whitespace-nowrap ${CUSTOM_SLAB.footerCellClass}`}>₹{formatCurrency(totals.customAmount)}</td>
                                        <td className={`px-4 py-3 text-right border border-gray-200 whitespace-nowrap ${CUSTOM_SLAB.footerCellClass} ${CUSTOM_SLAB.gstTextClass}`}>₹{formatCurrency(totals.customGst)}</td>
                                        <td className="border border-gray-200"></td>
                                    </tr>
                                </tfoot>
                            )}
                        </table>
                    </div>
                </div>
                <p className="text-xs text-gray-500 mt-3 italic">Tip: scroll horizontally to see all columns. Click any cell to edit it directly — press Enter to save, Esc to cancel.</p>
            </div>

            {/* ---------- Add Record Modal ---------- */}
            {showAddModal && (
                <div className="fixed inset-0 z-[80] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl my-8">
                        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
                            <div>
                                <h2 className="text-lg font-bold text-gray-900">{editingRowId ? 'Edit GST Record' : 'Add GST Record'}</h2>
                                <p className="text-xs text-gray-500 mt-0.5">
                                    {editingRowId
                                        ? 'Update any field below. All changes are saved on click of Update Record.'
                                        : 'Fill in the bill details. Type the supplier name to auto-fill from existing suppliers.'}
                                </p>
                            </div>
                            <button onClick={closeAddModal} className="text-gray-400 hover:text-gray-700 transition-colors p-1 rounded">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>

                        <div className="px-6 py-5 grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[70vh] overflow-y-auto">
                            {/* Date */}
                            <div>
                                <label className="block text-xs font-semibold text-gray-700 mb-1.5">Date</label>
                                <input
                                    type="date"
                                    value={toIsoDate(form.date)}
                                    onChange={(e) => updateForm('date', e.target.value ? new Date(e.target.value).toISOString() : undefined)}
                                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:border-pink-500 focus:ring-1 focus:ring-pink-300 outline-none"
                                />
                            </div>
                            {/* Bill No */}
                            <div>
                                <label className="block text-xs font-semibold text-gray-700 mb-1.5">Bill No. <span className="text-rose-500">*</span></label>
                                <input
                                    type="text"
                                    value={form.billNo || ''}
                                    onChange={(e) => updateForm('billNo', e.target.value)}
                                    placeholder="e.g. INV-2025-001"
                                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:border-pink-500 focus:ring-1 focus:ring-pink-300 outline-none"
                                />
                            </div>

                            {/* Supplier Name (autocomplete) */}
                            <div className="md:col-span-2 relative">
                                <label className="block text-xs font-semibold text-gray-700 mb-1.5">Supplier Name <span className="text-rose-500">*</span></label>
                                <input
                                    type="text"
                                    value={supplierSearch}
                                    onChange={(e) => {
                                        setSupplierSearch(e.target.value);
                                        updateForm('supplierName', e.target.value);
                                        updateForm('supplierLedgerId', undefined);
                                        setShowSupplierResults(true);
                                    }}
                                    onFocus={() => setShowSupplierResults(true)}
                                    onBlur={() => {
                                        if (supplierBlurTimer.current) window.clearTimeout(supplierBlurTimer.current);
                                        supplierBlurTimer.current = window.setTimeout(() => setShowSupplierResults(false), 180);
                                    }}
                                    placeholder="Type to search existing suppliers…"
                                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:border-pink-500 focus:ring-1 focus:ring-pink-300 outline-none"
                                />
                                {showSupplierResults && filteredSuppliers.length > 0 && (
                                    <div className="absolute z-[90] left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-xl max-h-56 overflow-y-auto">
                                        {filteredSuppliers.map(s => (
                                            <button
                                                key={s._id}
                                                type="button"
                                                onMouseDown={(e) => { e.preventDefault(); selectSupplier(s); }}
                                                className="w-full text-left px-4 py-2 hover:bg-pink-50 border-b border-gray-100 last:border-b-0"
                                            >
                                                <div className="font-semibold text-sm text-gray-900">{s.name}</div>
                                                <div className="text-xs text-gray-500">
                                                    {s.phone ? s.phone : ''}{s.phone && s.gstNumber ? ' · ' : ''}{s.gstNumber ? `GST: ${s.gstNumber}` : ''}
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                )}
                                {form.supplierLedgerId && (
                                    <p className="mt-1 text-[11px] text-emerald-600 font-medium">Linked to existing supplier — GST auto-filled below.</p>
                                )}
                            </div>

                            {/* GST Number */}
                            <div className="md:col-span-2">
                                <label className="block text-xs font-semibold text-gray-700 mb-1.5">GST Number</label>
                                <input
                                    type="text"
                                    value={form.supplierGstNumber || ''}
                                    onChange={(e) => updateForm('supplierGstNumber', e.target.value)}
                                    placeholder="e.g. 22AAAAA0000A1Z5"
                                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:border-pink-500 focus:ring-1 focus:ring-pink-300 outline-none font-mono"
                                />
                            </div>

                            {/* Item Category */}
                            <div className="md:col-span-2">
                                <label className="block text-xs font-semibold text-gray-700 mb-1.5">Item Category</label>
                                <input
                                    type="text"
                                    value={form.itemCategory || ''}
                                    onChange={(e) => updateForm('itemCategory', e.target.value)}
                                    placeholder="e.g. Groceries, Electronics"
                                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:border-pink-500 focus:ring-1 focus:ring-pink-300 outline-none"
                                />
                            </div>

                            {/* Total Amount */}
                            <div className="md:col-span-2">
                                <label className="block text-xs font-semibold text-gray-700 mb-1.5">Total Amount (₹)</label>
                                <input
                                    type="number"
                                    step="any"
                                    value={form.totalAmount ?? ''}
                                    onChange={(e) => {
                                        const v = e.target.value;
                                        updateForm('totalAmount', v === '' ? undefined : (parseFloat(v) || 0));
                                    }}
                                    placeholder="0"
                                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:border-pink-500 focus:ring-1 focus:ring-pink-300 outline-none"
                                />
                            </div>

                            {/* Fixed slab groups */}
                            {FIXED_SLABS.map(slab => (
                                <div key={slab.rate} className={`md:col-span-2 p-3 rounded-lg border ${slab.formContainerClass}`}>
                                    <p className={`text-xs font-bold uppercase tracking-wider mb-2 ${slab.gstTextClass}`}>Amount @ {slab.label}</p>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="block text-xs font-semibold text-gray-700 mb-1">Amount</label>
                                            <input
                                                type="number"
                                                step="any"
                                                value={(form[slab.amountKey] as number | undefined) ?? ''}
                                                onChange={(e) => {
                                                    const v = e.target.value;
                                                    if (v === '') {
                                                        setForm(prev => ({
                                                            ...prev,
                                                            [slab.amountKey]: undefined,
                                                            [slab.gstKey]: undefined,
                                                        }));
                                                    } else {
                                                        const amount = parseFloat(v) || 0;
                                                        setForm(prev => ({
                                                            ...prev,
                                                            [slab.amountKey]: amount,
                                                            [slab.gstKey]: calcGst(amount, slab.rate),
                                                        }));
                                                    }
                                                }}
                                                placeholder="0"
                                                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg outline-none focus:border-pink-500 focus:ring-1 focus:ring-pink-300"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-semibold text-gray-700 mb-1">GST Paid <span className="text-[10px] font-normal text-gray-400">(auto)</span></label>
                                            <input
                                                type="number"
                                                step="any"
                                                value={(form[slab.gstKey] as number | undefined) ?? ''}
                                                onChange={(e) => {
                                                    const v = e.target.value;
                                                    updateForm(slab.gstKey, v === '' ? undefined : (parseFloat(v) || 0));
                                                }}
                                                placeholder="0"
                                                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg outline-none focus:border-pink-500 focus:ring-1 focus:ring-pink-300"
                                            />
                                        </div>
                                    </div>
                                </div>
                            ))}

                            {/* Custom slab group */}
                            <div className="md:col-span-2 p-3 rounded-lg bg-indigo-50/50 border border-indigo-200">
                                <p className="text-xs font-bold text-indigo-800 uppercase tracking-wider mb-2">Amount @ [ ]%  (custom rate)</p>
                                <div className="grid grid-cols-3 gap-3">
                                    <div>
                                        <label className="block text-xs font-semibold text-gray-700 mb-1">Rate %</label>
                                        <input
                                            type="number"
                                            step="any"
                                            value={form.customRate ?? ''}
                                            onChange={(e) => {
                                                const v = e.target.value;
                                                if (v === '') {
                                                    setForm(prev => ({ ...prev, customRate: undefined, customGst: undefined }));
                                                } else {
                                                    const rate = parseFloat(v) || 0;
                                                    const amount = Number(form.customAmount || 0);
                                                    setForm(prev => ({
                                                        ...prev,
                                                        customRate: rate,
                                                        customGst: form.customAmount === undefined ? undefined : calcGst(amount, rate),
                                                    }));
                                                }
                                            }}
                                            placeholder="e.g. 3"
                                            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-300"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-gray-700 mb-1">Amount</label>
                                        <input
                                            type="number"
                                            step="any"
                                            value={form.customAmount ?? ''}
                                            onChange={(e) => {
                                                const v = e.target.value;
                                                if (v === '') {
                                                    setForm(prev => ({ ...prev, customAmount: undefined, customGst: undefined }));
                                                } else {
                                                    const amount = parseFloat(v) || 0;
                                                    const rate = Number(form.customRate || 0);
                                                    setForm(prev => ({
                                                        ...prev,
                                                        customAmount: amount,
                                                        customGst: form.customRate === undefined ? undefined : calcGst(amount, rate),
                                                    }));
                                                }
                                            }}
                                            placeholder="0"
                                            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-300"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-gray-700 mb-1">GST Paid <span className="text-[10px] font-normal text-gray-400">(auto)</span></label>
                                        <input
                                            type="number"
                                            step="any"
                                            value={form.customGst ?? ''}
                                            onChange={(e) => {
                                                const v = e.target.value;
                                                updateForm('customGst', v === '' ? undefined : (parseFloat(v) || 0));
                                            }}
                                            placeholder="0"
                                            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-300"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-gray-200 bg-gray-50/60 rounded-b-2xl">
                            <button
                                onClick={closeAddModal}
                                disabled={submitting}
                                className="px-4 py-2 text-sm font-semibold text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSubmitForm}
                                disabled={submitting}
                                className="px-5 py-2 text-sm font-semibold text-white bg-[var(--primary-dark)] rounded-lg hover:bg-[var(--primary-darker)] active:scale-95 transition-all shadow-sm disabled:opacity-50"
                            >
                                {submitting
                                    ? (editingRowId ? 'Updating…' : 'Saving…')
                                    : (editingRowId ? 'Update Record' : 'Save Record')}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CustomGSTReport;
