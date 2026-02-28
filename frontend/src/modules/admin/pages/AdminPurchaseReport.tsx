import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../../../context/ToastContext';

interface PurchaseItemRow {
  productName: string;
  qty: number;
  purchasePrice: number;
  gstPercent: number;
}

interface PurchaseReportEntry {
  id: string;
  type: 'purchase' | 'quotation';
  supplier: { name?: string; gstNumber?: string } | null;
  paymentMode: string;
  date: string;
  items: PurchaseItemRow[];
  totals: {
    gross?: number;
    discount?: number;
    tax?: number;
    roundOff?: number;
    net?: number;
    grossAmount?: number;
    discountAmount?: number;
    taxAmount?: number;
    netAmount?: number;
  };
}
const AdminPurchaseReport: React.FC = () => {
  const [entries, setEntries] = useState<PurchaseReportEntry[]>([]);
  const [selectedRowKeys, setSelectedRowKeys] = useState<string[]>([]);
  const [editMode, setEditMode] = useState(false);

  const fetchEntries = () => {
    try {
      const raw = localStorage.getItem('admin_pos_purchase_entries');
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) setEntries(parsed);
    } catch {
      setEntries([]);
    }
  };

  const navigate = useNavigate();
  const { showToast } = useToast();
  const [selectedEntry, setSelectedEntry] = useState<PurchaseReportEntry | null>(null);
  const [showActionSheet, setShowActionSheet] = useState(false);

  useEffect(() => {
    fetchEntries();
  }, []);

  const rows = useMemo(() => {
    return entries.filter((entry) => entry.type === 'purchase').flatMap((entry) => {
      const gross = entry.totals.gross ?? entry.totals.grossAmount ?? 0;
      const discount = entry.totals.discount ?? entry.totals.discountAmount ?? 0;
      const tax = entry.totals.tax ?? entry.totals.taxAmount ?? 0;
      const net = entry.totals.net ?? entry.totals.netAmount ?? 0;

      return entry.items.map((item, idx) => ({
        key: `${entry.id}_${idx}`,
        entryId: entry.id,
        itemIndex: idx,
        billNo: `${entry.type === 'quotation' ? 'QTN' : 'PUR'}-${entry.id.slice(-5)}`,
        supplier: entry.supplier?.name || '-',
        gstNo: entry.supplier?.gstNumber || '-',
        paymentMode: entry.paymentMode || '-',
        date: entry.date || '-',
        type: entry.type,
        productName: item.productName,
        qty: item.qty,
        purchasePrice: item.purchasePrice,
        gst: item.gstPercent,
        gross,
        discount,
        tax,
        net,
      }));
    });
  }, [entries]);

  const selectedSet = useMemo(() => new Set(selectedRowKeys), [selectedRowKeys]);
  const allSelected = rows.length > 0 && rows.every((row) => selectedSet.has(row.key));

  const handleSelectAll = () => {
    if (allSelected) {
      setSelectedRowKeys([]);
      return;
    }
    setSelectedRowKeys(rows.map((row) => row.key));
  };

  const handleToggleRow = (key: string) => {
    setSelectedRowKeys((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  const handleRowClick = (entryId: string) => {
    if (editMode) return;
    const entry = entries.find(e => e.id === entryId);
    if (entry) {
        setSelectedEntry(entry);
        setShowActionSheet(true);
    }
  };

  const handleEditOrder = () => {
    if (!selectedEntry) return;
    sessionStorage.setItem('edit_purchase_data', JSON.stringify(selectedEntry));
    navigate('/admin/pos/orders?mode=edit_purchase');
    setShowActionSheet(false);
  };

  const handlePrint = () => {
    if (!selectedEntry) return;
    printPurchaseInvoice(selectedEntry);
    setShowActionSheet(false);
  };

  const printPurchaseInvoice = (entry: PurchaseReportEntry) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const billNoPrefix = entry.type === 'quotation' ? 'QTN' : 'PUR';
    const billNo = `${billNoPrefix}-${entry.id.slice(-5)}`;
    const supplierName = entry.supplier?.name || 'Walk-in Supplier';
    const supplierAddress = '-';
    const supplierPhone = '-';
    const supplierGst = entry.supplier?.gstNumber || '-';
    const taxable = (entry.totals.grossAmount || entry.totals.gross || 0).toFixed(2);
    const taxAmount = (entry.totals.taxAmount || entry.totals.tax || 0);
    const cgst = (taxAmount / 2).toFixed(2);
    const sgst = (taxAmount / 2).toFixed(2);

    const rowsHtml = entry.items.map((item, idx) => {
      const gross = item.purchasePrice * item.qty;
      const taxableLine = gross;
      const lineTax = (taxableLine * item.gstPercent) / 100;
      const lineNet = taxableLine + lineTax;
      return `
        <tr>
          <td>${idx + 1}</td>
          <td>${item.productName}</td>
          <td>-</td>
          <td>${item.purchasePrice.toFixed(2)}</td>
          <td>${item.qty}</td>
          <td>${item.purchasePrice.toFixed(2)}</td>
          <td>0.00</td>
          <td>${(item.gstPercent / 2).toFixed(2)}</td>
          <td>${(item.gstPercent / 2).toFixed(2)}</td>
          <td>${lineNet.toFixed(2)}</td>
        </tr>
      `;
    }).join('');

    const html = `
      <html>
        <head>
          <title>Purchase Invoice - ${billNo}</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; color: #333; }
            .header { text-align: center; margin-bottom: 20px; }
            .header h1 { margin: 0; font-size: 28px; }
            .meta { display: flex; justify-content: space-between; margin-bottom: 20px; }
            .meta-box { border: 1px solid #ddd; padding: 10px; width: 48%; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; font-size: 12px; }
            th { background-color: #f9f9f9; }
            .totals { float: right; width: 300px; }
            .totals div { display: flex; justify-content: space-between; padding: 4px 0; }
            .grand-total { font-weight: bold; font-size: 16px; border-top: 1px solid #333; margin-top: 5px; padding-top: 5px; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>GEETA</h1>
            <p>Nagda, Madhya Pradesh, India - 454001<br>Mobile: 7898111456</p>
          </div>
          <div class="meta">
            <div class="meta-box">
              <h3>Supplier Details</h3>
              <p>Name: ${supplierName}<br>GSTIN: ${supplierGst}</p>
            </div>
            <div class="meta-box">
              <h3>Invoice Details</h3>
              <p>Bill No: ${billNo}<br>Date: ${entry.date}<br>Payment: ${entry.paymentMode}</p>
            </div>
          </div>
          <table>
            <thead>
              <tr>
                <th>S.No</th>
                <th>Item Name</th>
                <th>HSN</th>
                <th>MRP</th>
                <th>Qty</th>
                <th>Rate</th>
                <th>Disc</th>
                <th>CGST%</th>
                <th>SGST%</th>
                <th>Net</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
          </table>
          <div class="totals">
            <div><span>Gross:</span><span>${(entry.totals.grossAmount || entry.totals.gross || 0).toFixed(2)}</span></div>
            <div><span>Discount:</span><span>${(entry.totals.discountAmount || entry.totals.discount || 0).toFixed(2)}</span></div>
            <div><span>Tax:</span><span>${(entry.totals.taxAmount || entry.totals.tax || 0).toFixed(2)}</span></div>
            <div class="grand-total"><span>Total:</span><span>${(entry.totals.netAmount || entry.totals.net || 0).toFixed(2)}</span></div>
          </div>
          <script>window.onload = () => { window.print(); window.close(); }</script>
        </body>
      </html>
    `;
    printWindow.document.write(html);
    printWindow.document.close();
  };

  const handleDownloadExcel = () => {
    if (rows.length === 0) return;
    const headers = [
      'Bill No',
      'Type',
      'Supplier',
      'GST No',
      'Product',
      'Qty',
      'Price',
      'GST%',
      'Gross',
      'Discount',
      'Tax',
      'Net',
      'Payment',
      'Date',
    ];

    const escapeCsv = (value: string | number) => {
      const stringValue = String(value ?? '');
      return `"${stringValue.replace(/"/g, '""')}"`;
    };

    const lines = [
      headers.map((h) => escapeCsv(h)).join(','),
      ...rows.map((row) =>
        [
          row.billNo,
          row.type.toUpperCase(),
          row.supplier,
          row.gstNo,
          row.productName,
          row.qty,
          row.purchasePrice.toFixed(2),
          row.gst,
          row.gross.toFixed(2),
          row.discount.toFixed(2),
          row.tax.toFixed(2),
          row.net.toFixed(2),
          row.paymentMode,
          row.date,
        ]
          .map((cell) => escapeCsv(cell))
          .join(',')
      ),
    ];

    const blob = new Blob(['\uFEFF' + lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `purchase-report-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleCellEdit = (
    entryId: string,
    itemIndex: number,
    field: 'supplier' | 'gstNo' | 'productName' | 'qty' | 'purchasePrice' | 'gst' | 'paymentMode' | 'date',
    value: string
  ) => {
    setEntries((prev) => {
      const nextEntries = prev.map((entry) => {
        if (entry.id !== entryId || entry.type !== 'purchase') return entry;

        const updatedItems = entry.items.map((item, idx) => {
          if (idx !== itemIndex) return item;
          if (field === 'productName') return { ...item, productName: value };
          if (field === 'qty') return { ...item, qty: Math.max(0, Number(value) || 0) };
          if (field === 'purchasePrice') return { ...item, purchasePrice: Math.max(0, Number(value) || 0) };
          if (field === 'gst') return { ...item, gstPercent: Math.max(0, Number(value) || 0) };
          return item;
        });

        const gross = updatedItems.reduce((sum, item) => sum + item.qty * item.purchasePrice, 0);
        const tax = updatedItems.reduce(
          (sum, item) => sum + (item.qty * item.purchasePrice * item.gstPercent) / 100,
          0
        );
        const discount = entry.totals.discount ?? entry.totals.discountAmount ?? 0;
        const roundOff = entry.totals.roundOff ?? 0;
        const net = gross - discount + tax + roundOff;

        return {
          ...entry,
          supplier:
            field === 'supplier'
              ? { ...(entry.supplier || {}), name: value }
              : field === 'gstNo'
              ? { ...(entry.supplier || {}), gstNumber: value }
              : entry.supplier,
          paymentMode: field === 'paymentMode' ? value : entry.paymentMode,
          date: field === 'date' ? value : entry.date,
          items: updatedItems,
          totals: {
            ...entry.totals,
            gross,
            grossAmount: gross,
            discount,
            discountAmount: discount,
            tax,
            taxAmount: tax,
            roundOff,
            net,
            netAmount: net,
          },
        };
      });

      localStorage.setItem('admin_pos_purchase_entries', JSON.stringify(nextEntries));
      return nextEntries;
    });
  };

  return (
    <div className="p-4 md:p-6 bg-gray-50 min-h-screen">
      <div className="max-w-7xl mx-auto">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 md:p-6 mb-4">
          <h1 className="text-xl md:text-2xl font-bold text-gray-800">Purchase Report</h1>
          <p className="text-sm text-gray-500 mt-1">Purchase and quotation entries report</p>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 mb-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-gray-600">
            Selected: <span className="font-semibold text-gray-800">{selectedRowKeys.length}</span> rows
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setEditMode((prev) => !prev)}
              className={`inline-flex items-center px-5 py-2 text-white text-xs font-black rounded-lg active:scale-95 transition-all shadow-sm ${
                editMode ? 'bg-indigo-700' : 'bg-indigo-600 hover:bg-indigo-700'
              }`}
            >
              {editMode ? 'Done Editing' : 'Bulk Edit'}
            </button>
            <button
              type="button"
              onClick={handleDownloadExcel}
              className="inline-flex items-center px-5 py-2 bg-emerald-600 text-white text-xs font-black rounded-lg hover:bg-emerald-700 active:scale-95 transition-all shadow-sm"
            >
              Excel
            </button>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1250px]">
              <thead className="bg-gray-50 text-xs uppercase text-gray-600">
                <tr>
                  <th className="px-4 py-3 text-left">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={handleSelectAll}
                      aria-label="Select all rows"
                    />
                  </th>
                  <th className="px-4 py-3 text-left">Bill No</th>
                  <th className="px-4 py-3 text-left">Type</th>
                  <th className="px-4 py-3 text-left">Supplier</th>
                  <th className="px-4 py-3 text-left">GST No</th>
                  <th className="px-4 py-3 text-left">Product</th>
                  <th className="px-4 py-3 text-right">Qty</th>
                  <th className="px-4 py-3 text-right">Price</th>
                  <th className="px-4 py-3 text-right">GST%</th>
                  <th className="px-4 py-3 text-right">Gross</th>
                  <th className="px-4 py-3 text-right">Discount</th>
                  <th className="px-4 py-3 text-right">Tax</th>
                  <th className="px-4 py-3 text-right">Net</th>
                  <th className="px-4 py-3 text-left">Payment</th>
                  <th className="px-4 py-3 text-left">Date</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={15} className="px-4 py-10 text-center text-gray-500">
                      No purchase entries found
                    </td>
                  </tr>
                ) : (
                  rows.map((row) => (
                    <tr
                      key={row.key}
                      className={`border-t border-gray-100 text-sm transition-colors ${!editMode ? 'hover:bg-gray-50 cursor-pointer' : ''}`}
                      onClick={() => handleRowClick(row.entryId)}
                    >
                      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={selectedSet.has(row.key)}
                          onChange={() => handleToggleRow(row.key)}
                          aria-label={`Select ${row.billNo}`}
                        />
                      </td>
                      <td className="px-4 py-3 font-semibold text-gray-800">{row.billNo}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                          row.type === 'quotation' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'
                        }`}>
                          {row.type.toUpperCase()}
                        </span>
                      </td>
                      <td className="px-4 py-3" onClick={(e) => editMode && e.stopPropagation()}>
                        {editMode ? (
                          <input
                            type="text"
                            value={row.supplier}
                            onChange={(e) => handleCellEdit(row.entryId, row.itemIndex, 'supplier', e.target.value)}
                            className="w-full px-2 py-1 text-xs border border-gray-200 rounded-md focus:border-indigo-500 outline-none font-bold"
                          />
                        ) : (
                          row.supplier
                        )}
                      </td>
                      <td className="px-4 py-3" onClick={(e) => editMode && e.stopPropagation()}>
                        {editMode ? (
                          <input
                            type="text"
                            value={row.gstNo}
                            onChange={(e) => handleCellEdit(row.entryId, row.itemIndex, 'gstNo', e.target.value)}
                            className="w-full px-2 py-1 text-xs border border-gray-200 rounded-md focus:border-indigo-500 outline-none font-mono"
                          />
                        ) : (
                          row.gstNo
                        )}
                      </td>
                      <td className="px-4 py-3" onClick={(e) => editMode && e.stopPropagation()}>
                        {editMode ? (
                          <input
                            type="text"
                            value={row.productName}
                            onChange={(e) => handleCellEdit(row.entryId, row.itemIndex, 'productName', e.target.value)}
                            className="w-full px-2 py-1 text-xs border border-gray-200 rounded-md focus:border-indigo-500 outline-none font-bold"
                          />
                        ) : (
                          row.productName
                        )}
                      </td>
                      <td className="px-4 py-3 text-right" onClick={(e) => editMode && e.stopPropagation()}>
                        {editMode ? (
                          <input
                            type="number"
                            min="0"
                            value={row.qty}
                            onChange={(e) => handleCellEdit(row.entryId, row.itemIndex, 'qty', e.target.value)}
                            className="w-20 ml-auto px-2 py-1 text-xs border border-gray-200 rounded-md focus:border-indigo-500 outline-none font-bold text-right"
                          />
                        ) : (
                          row.qty
                        )}
                      </td>
                      <td className="px-4 py-3 text-right" onClick={(e) => editMode && e.stopPropagation()}>
                        {editMode ? (
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={row.purchasePrice}
                            onChange={(e) => handleCellEdit(row.entryId, row.itemIndex, 'purchasePrice', e.target.value)}
                            className="w-24 ml-auto px-2 py-1 text-xs border border-gray-200 rounded-md focus:border-indigo-500 outline-none font-bold text-right"
                          />
                        ) : (
                          row.purchasePrice.toFixed(2)
                        )}
                      </td>
                      <td className="px-4 py-3 text-right" onClick={(e) => editMode && e.stopPropagation()}>
                        {editMode ? (
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={row.gst}
                            onChange={(e) => handleCellEdit(row.entryId, row.itemIndex, 'gst', e.target.value)}
                            className="w-20 ml-auto px-2 py-1 text-xs border border-gray-200 rounded-md focus:border-indigo-500 outline-none font-bold text-right"
                          />
                        ) : (
                          row.gst
                        )}
                      </td>
                      <td className="px-4 py-3 text-right" onClick={(e) => editMode && e.stopPropagation()}>{row.gross.toFixed(2)}</td>
                      <td className="px-4 py-3 text-right" onClick={(e) => editMode && e.stopPropagation()}>{row.discount.toFixed(2)}</td>
                      <td className="px-4 py-3 text-right" onClick={(e) => editMode && e.stopPropagation()}>{row.tax.toFixed(2)}</td>
                      <td className="px-4 py-3 text-right font-bold text-[#f187b5]" onClick={(e) => editMode && e.stopPropagation()}>{row.net.toFixed(2)}</td>
                      <td className="px-4 py-3" onClick={(e) => editMode && e.stopPropagation()}>
                        {editMode ? (
                          <select
                            value={row.paymentMode}
                            onChange={(e) => handleCellEdit(row.entryId, row.itemIndex, 'paymentMode', e.target.value)}
                            className="w-full px-2 py-1 text-xs border border-gray-200 rounded-md focus:border-indigo-500 outline-none font-bold"
                          >
                            <option value="Cash">Cash</option>
                            <option value="Credit">Credit</option>
                            <option value="Online">Online</option>
                          </select>
                        ) : (
                          row.paymentMode
                        )}
                      </td>
                      <td className="px-4 py-3" onClick={(e) => editMode && e.stopPropagation()}>
                        {editMode ? (
                          <input
                            type="date"
                            value={row.date}
                            onChange={(e) => handleCellEdit(row.entryId, row.itemIndex, 'date', e.target.value)}
                            className="w-full px-2 py-1 text-xs border border-gray-200 rounded-md focus:border-indigo-500 outline-none font-bold"
                          />
                        ) : (
                          row.date
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Action Sheet Modal */}
        {showActionSheet && (
          <div className="fixed inset-0 z-[100] flex items-end justify-center sm:items-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm animate-in fade-in transition-all duration-300" onClick={() => setShowActionSheet(false)}>
            <div
              className="bg-white w-full max-w-lg rounded-t-[32px] sm:rounded-[32px] overflow-hidden shadow-2xl animate-in slide-in-from-bottom-full duration-300"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-2 sm:hidden flex justify-center">
                <div className="w-12 h-1.5 bg-gray-200 rounded-full" />
              </div>

              <div className="px-6 py-6 border-b border-gray-50 flex justify-between items-center">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-gray-50 rounded-2xl flex items-center justify-center text-gray-400">
                      <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                          <circle cx="5" cy="12" r="2" /><circle cx="12" cy="12" r="2" /><circle cx="19" cy="12" r="2" />
                      </svg>
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-gray-800">Order Actions</h3>
                    <p className="text-xs text-gray-400 font-medium">Choose an action for this order</p>
                  </div>
                </div>
                <button onClick={() => setShowActionSheet(false)} className="w-8 h-8 rounded-full bg-gray-50 flex items-center justify-center text-gray-400 hover:bg-gray-100 transition-colors">
                   <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>

              <div className="p-6 space-y-3 pb-10 sm:pb-6">
                <ActionItem
                  icon={<svg className="w-5 h-5 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>}
                  title="Edit Order"
                  subtitle="Modify order details"
                  onClick={handleEditOrder}
                  iconBg="bg-purple-50"
                />
                <ActionItem
                  icon={<svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>}
                  title="Print"
                  subtitle="Print order receipt"
                  onClick={handlePrint}
                  iconBg="bg-gray-100"
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

interface ActionItemProps {
  icon: JSX.Element;
  title: string;
  subtitle: string;
  onClick: () => void;
  iconBg: string;
}

const ActionItem: React.FC<ActionItemProps> = ({ icon, title, subtitle, onClick, iconBg }) => {
  return (
    <button
      onClick={onClick}
      className="w-full bg-white rounded-2xl p-4 flex items-center justify-between hover:bg-gray-50 active:scale-[0.98] transition-all border border-transparent hover:border-gray-100 group"
    >
      <div className="flex items-center gap-4">
        <div className={`w-12 h-12 ${iconBg} rounded-[20px] flex items-center justify-center transition-transform group-hover:scale-110`}>
          {icon}
        </div>
        <div className="text-left">
          <p className="text-base font-bold text-gray-800 leading-tight">{title}</p>
          <p className="text-[11px] text-gray-400 font-medium mt-0.5">{subtitle}</p>
        </div>
      </div>
      <div className="text-gray-300">
         <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" /></svg>
      </div>
    </button>
  );
};

export default AdminPurchaseReport;
