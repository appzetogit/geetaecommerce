import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useToast } from '../../../context/ToastContext';
import {
    getSupplierDetail,
    addDebt,
    paySupplier,
    editSupplier,
    deleteSupplier,
    Supplier,
    SupplierTransaction
} from '../../../services/api/admin/supplierService';
import { jsPDF } from "jspdf";
import {
    getAdminPurchaseEntries,
    deleteAdminPurchaseEntry
} from '../../../services/api/admin/adminPosPurchaseEntryService';
import * as XLSX from 'xlsx';

const AdminPOSSupplierDetail = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { showToast } = useToast();
    const [supplier, setSupplier] = useState<Supplier | null>(null);
    const [transactions, setTransactions] = useState<SupplierTransaction[]>([]);
    const [loading, setLoading] = useState(true);
    const [purchaseEntries, setPurchaseEntries] = useState<any[]>([]);
    const [activeTab, setActiveTab] = useState<'ledger' | 'purchases'>('ledger');
    const [expandedPurchaseId, setExpandedPurchaseId] = useState<string | null>(null);

    // Modal states
    const [showPayModal, setShowPayModal] = useState(false);
    const [showDebtModal, setShowDebtModal] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);

    // Form States
    const dateNow = new Date().toISOString().split('T')[0];
    const [amount, setAmount] = useState('');
    const [date, setDate] = useState(dateNow);
    const [note, setNote] = useState('');
    const [isActionLoading, setIsActionLoading] = useState(false);

    // Edit state
    const [editData, setEditData] = useState({
        name: '',
        phone: '',
        address: '',
        gstNumber: '',
        notes: ''
    });

    useEffect(() => {
        loadSupplier();
    }, [id]);

    const loadSupplier = async () => {
        if (!id) return;
        setLoading(true);
        try {
            const res = await getSupplierDetail(id);
            if (res.success) {
                setSupplier(res.data.supplier);
                setTransactions(res.data.transactions || []);
                setEditData({
                    name: res.data.supplier.name,
                    phone: res.data.supplier.phone,
                    address: res.data.supplier.address || '',
                    gstNumber: res.data.supplier.gstNumber || '',
                    notes: res.data.supplier.notes || ''
                });

                // Load supplier's purchase entries
                try {
                    const pRes = await getAdminPurchaseEntries();
                    if (pRes.success && Array.isArray(pRes.data)) {
                        const filtered = pRes.data.filter(entry => 
                            entry.supplier && 
                            (String(entry.supplier._id) === String(id) || 
                             String(entry.supplier.id) === String(id) ||
                             String(entry.supplier.phone) === String(res.data.supplier.phone))
                        );
                        setPurchaseEntries(filtered);
                    }
                } catch (err) {
                    console.error("Failed to load purchases:", err);
                }
            }
        } catch (error) {
            console.error(error);
            showToast("Failed to load supplier details", "error");
            navigate('/admin/pos/suppliers');
        } finally {
            setLoading(false);
        }
    };

    const handleAddDebt = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!id || !amount) return;

        setIsActionLoading(true);
        try {
            const res = await addDebt(id, {
                amount: parseFloat(amount),
                description: note || 'Manual Purchase Debt',
                date
            });
            if (res.success) {
                showToast("Debt added successfully", "success");
                setShowDebtModal(false);
                resetForm();
                loadSupplier();
            }
        } catch (error) {
            showToast("Failed to add debt", "error");
        } finally {
            setIsActionLoading(false);
        }
    };

    const handlePaySupplier = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!id || !amount) return;

        setIsActionLoading(true);
        try {
            const res = await paySupplier(id, {
                amount: parseFloat(amount),
                description: note || 'Cash Payment to Supplier',
                date
            });
            if (res.success) {
                showToast("Payment recorded successfully", "success");
                setShowPayModal(false);
                resetForm();
                loadSupplier();
            }
        } catch (error) {
            showToast("Failed to record payment", "error");
        } finally {
            setIsActionLoading(false);
        }
    };

    const handleUpdateSupplier = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!id) return;

        setIsActionLoading(true);
        try {
            const res = await editSupplier(id, editData);
            if (res.success) {
                showToast("Supplier updated successfully", "success");
                setShowEditModal(false);
                loadSupplier();
            }
        } catch (error) {
            showToast("Failed to update supplier", "error");
        } finally {
            setIsActionLoading(false);
        }
    };

    const handleDelete = async () => {
        if (!id || !window.confirm("Are you sure you want to delete this supplier and all transaction history?")) return;

        try {
            const res = await deleteSupplier(id);
            if (res.success) {
                showToast("Supplier deleted", "success");
                navigate('/admin/pos/suppliers');
            }
        } catch (error) {
            showToast("Failed to delete supplier", "error");
        }
    };

    const resetForm = () => {
        setAmount('');
        setDate(dateNow);
        setNote('');
    };

    const handleDeletePurchase = async (entryId: string) => {
        if (!window.confirm("Are you sure you want to delete this purchase entry? This will NOT automatically reverse inventory changes but will remove it from the supplier's order history.")) return;
        try {
            const res = await deleteAdminPurchaseEntry(entryId);
            if (res.success) {
                showToast("Purchase entry deleted successfully", "success");
                setPurchaseEntries(prev => prev.filter(e => e.id !== entryId));
            }
        } catch (error) {
            showToast("Failed to delete purchase entry", "error");
        }
    };

    const printInvoice = (entry: any) => {
        const printWindow = window.open('', '_blank', 'width=980,height=760');
        if (!printWindow) {
            showToast('Please allow popups to print invoice.', 'error');
            return;
        }

        let bs: any = null;
        try {
            const rawSettings = localStorage.getItem('admin_pos_bill_settings');
            if (rawSettings) bs = JSON.parse(rawSettings);
        } catch (e) {
            console.error(e);
        }

        const esc = (v: string) =>
          v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
        const shopTitle = esc(String(bs?.shopName || 'GEETA'));
        const addrLines = String(
          bs?.address ||
            'Q7WM+92M, Q7WM+92M, , Indore Division,\nNagda, Madhya Pradesh, India - 454001'
        );
        const addrHtml = esc(addrLines).replace(/\n/g, '<br>');
        const phoneLine = esc(String(bs?.phone || '7898111456'));
        const fssaiBlk =
          bs?.fssai?.enabled && bs?.fssai?.text
            ? `FSSAI: ${esc(String(bs.fssai.text))}`
            : 'FSSAI: 583545736';

        const billNoPrefix = entry.type === 'quotation' ? 'QTN' : 'BILL';
        const billNo = `${billNoPrefix}/${new Date(entry.createdAt || Date.now()).getFullYear()}/${entry.id.slice(-5)}`;
        const supplierName = entry.supplier?.name || supplier?.name || 'Walk-in Supplier';
        const supplierAddress = entry.supplier?.address || supplier?.address || '-';
        const supplierPhone = entry.supplier?.phone || supplier?.phone || '-';
        const supplierGst = entry.supplier?.gstNumber || supplier?.gstNumber || '-';

        const taxGroups: { [percent: number]: { taxable: number; cgst: number; sgst: number } } = {};
        const items = Array.isArray(entry.items) ? entry.items : [];
        items.forEach((item: any) => {
          const gross = (item.purchasePrice || item.price || 0) * (item.qty || 0);
          const discount = item.billDiscountType === '%' ? (gross * (item.billDiscount || 0)) / 100 : (item.billDiscount || 0);
          const netBeforeTax = Math.max(gross - discount, 0);

          let lineTax = 0;
          let lineTaxable = 0;
          const gstPercent = item.gstPercent !== undefined ? item.gstPercent : 18;

          if (item.includingGST) {
            lineTax = (netBeforeTax * gstPercent) / (100 + gstPercent);
            lineTaxable = netBeforeTax - lineTax;
          } else {
            lineTax = (netBeforeTax * gstPercent) / 100;
            lineTaxable = netBeforeTax;
          }

          const rate = gstPercent;
          if (!taxGroups[rate]) {
            taxGroups[rate] = { taxable: 0, cgst: 0, sgst: 0 };
          }
          taxGroups[rate].taxable += lineTaxable;
          taxGroups[rate].cgst += lineTax / 2;
          taxGroups[rate].sgst += lineTax / 2;
        });

        const gstRowsHtml = Object.entries(taxGroups).flatMap(([rateStr, data]) => {
          const rate = Number(rateStr);
          const halfRate = (rate / 2).toFixed(1) + '%';
          return [
            `<tr><td>CGST</td><td>${halfRate}</td><td>${data.taxable.toFixed(2)}</td><td>${data.cgst.toFixed(2)}</td></tr>`,
            `<tr><td>SGST</td><td>${halfRate}</td><td>${data.taxable.toFixed(2)}</td><td>${data.sgst.toFixed(2)}</td></tr>`
          ];
        }).join('');

        const rows = items.map((item: any, idx: number) => {
          const gross = (item.purchasePrice || item.price || 0) * (item.qty || 0);
          const discount = item.billDiscountType === '%' ? (gross * (item.billDiscount || 0)) / 100 : (item.billDiscount || 0);
          const taxableLine = Math.max(gross - discount, 0);
          const lineTax = item.includingGST ? 0 : (taxableLine * (item.gstPercent !== undefined ? item.gstPercent : 18)) / 100;
          const lineNet = taxableLine + lineTax;
          return `
            <tr>
              <td>${idx + 1}</td>
              <td>${item.productName}</td>
              <td>${item.hsn || '-'}</td>
              <td>${(item.mrp || 0).toFixed(2)}</td>
              <td>${(item.qty || 0).toFixed(2)}</td>
              <td>${(item.purchasePrice || item.price || 0).toFixed(2)}</td>
              <td>${(item.billDiscount || 0).toFixed(2)}${item.billDiscountType || '%'}</td>
              <td>${((item.gstPercent !== undefined ? item.gstPercent : 18) / 2).toFixed(2)}</td>
              <td>${((item.gstPercent !== undefined ? item.gstPercent : 18) / 2).toFixed(2)}</td>
              <td>${lineNet.toFixed(2)}</td>
            </tr>
          `;
        }).join('');

        const grossAmount = entry.totals?.grossAmount !== undefined ? entry.totals.grossAmount : 0;
        const discountAmount = entry.totals?.discountAmount !== undefined ? entry.totals.discountAmount : 0;
        const taxAmount = entry.totals?.taxAmount !== undefined ? entry.totals.taxAmount : 0;
        const roundOff = entry.totals?.roundOff !== undefined ? entry.totals.roundOff : 0;
        const netAmount = entry.totals?.netAmount !== undefined ? entry.totals.netAmount : 0;

        const html = `
          <html>
            <head>
              <title>${entry.type === 'quotation' ? 'Quotation' : 'Retail Invoice'} - ${billNo}</title>
              <style>
                body { font-family: Arial, sans-serif; margin: 22px; color: #111; }
                h1, h2, h3, p { margin: 0; }
                .top { text-align: center; margin-bottom: 10px; }
                .top h1 { font-size: 34px; letter-spacing: 1px; }
                .top p { font-size: 18px; margin-top: 3px; }
                .meta { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin: 12px 0; font-size: 16px; }
                .meta .box { border: 1px solid #d9d9d9; padding: 10px; min-height: 90px; }
                .meta .line { display: flex; justify-content: space-between; margin: 2px 0; }
                table { width: 100%; border-collapse: collapse; margin-top: 8px; }
                th, td { border: 1px solid #d9d9d9; padding: 7px 6px; font-size: 14px; text-align: left; }
                th { background: #f6f6f6; font-weight: 700; }
                td:last-child, th:last-child { text-align: right; }
                .summary-wrap { display: grid; grid-template-columns: 1fr 320px; gap: 16px; margin-top: 12px; }
                .gst-box, .totals-box { border: 1px solid #d9d9d9; padding: 8px; }
                .totals-row { display: flex; justify-content: space-between; margin: 4px 0; font-size: 15px; }
                .net { font-size: 20px; font-weight: 800; margin-top: 6px; border-top: 1px dashed #999; padding-top: 6px; }
                .footer { margin-top: 18px; font-size: 14px; }
              </style>
            </head>
            <body>
              <div class="top">
                <h1 style="font-size: 28px; font-weight: 800; margin-bottom: 4px;">${shopTitle}</h1>
                <p style="font-size: 14px; line-height: 1.4;">${addrHtml}<br>${phoneLine}<br>${fssaiBlk}</p>
              </div>

              <div class="meta">
                <div class="box">
                  <h3 style="margin-bottom:6px;">Supplier Details</h3>
                  <div class="line"><span>Name</span><strong>${supplierName}</strong></div>
                  <div class="line"><span>Address</span><span>${supplierAddress}</span></div>
                  <div class="line"><span>Phone</span><span>${supplierPhone}</span></div>
                  <div class="line"><span>GSTIN</span><span>${supplierGst}</span></div>
                </div>
                <div class="box">
                  <h3 style="margin-bottom:6px;">${entry.type === 'quotation' ? 'Quotation' : 'Retail Invoice'}</h3>
                  <div class="line"><span>Type</span><strong>${entry.type.toUpperCase()}</strong></div>
                  <div class="line"><span>Bill No</span><span>${billNo}</span></div>
                  <div class="line"><span>Date</span><span>${entry.date}</span></div>
                  <div class="line"><span>Payment</span><span>${entry.paymentMode}</span></div>
                </div>
              </div>

              <table>
                <thead>
                  <tr>
                    <th>S No</th>
                    <th>Item Name</th>
                    <th>HSN Code</th>
                    <th>MRP</th>
                    <th>Quantity</th>
                    <th>Rate/P</th>
                    <th>Disc</th>
                    <th>CGST %</th>
                    <th>SGST %</th>
                    <th>Net Amt.</th>
                  </tr>
                </thead>
                <tbody>
                  ${rows}
                </tbody>
              </table>

              <div class="summary-wrap">
                <div class="gst-box">
                  <h3 style="margin-bottom:6px;">GST Summary</h3>
                  <table>
                    <thead>
                      <tr><th>Type of Tax</th><th>%</th><th>Taxable</th><th>Tax Amount</th></tr>
                    </thead>
                    <tbody>
                      ${gstRowsHtml}
                    </tbody>
                  </table>
                </div>
                <div class="totals-box">
                  <div class="totals-row"><span>Gross Amt.</span><strong>${grossAmount.toFixed(2)}</strong></div>
                  <div class="totals-row"><span>Total Deduction</span><strong>${discountAmount.toFixed(2)}</strong></div>
                  <div class="totals-row"><span>GST Amt.</span><strong>${taxAmount.toFixed(2)}</strong></div>
                  <div class="totals-row"><span>Round Off</span><strong>${roundOff.toFixed(2)}</strong></div>
                  <div class="totals-row net-total"><span>Total Amount</span><strong>${netAmount.toFixed(2)}</strong></div>
                </div>
              </div>

              <p>Amt in words: ${netAmount.toFixed(2)} only</p>
              <p>${entry.type === 'quotation' ? 'Quotation is valid for limited period.' : 'Payment must be paid within agreed days.'}</p>
              <p style="margin-top: 24px; text-align:right;">Authorised Signature</p>

              <script>
                setTimeout(function() { window.print(); }, 400);
              </script>
            </body>
          </html>
        `;

        printWindow.document.write(html);
        printWindow.document.close();
    };

    const handleExportExcel = () => {
        if (!supplier) return;
        if (purchaseEntries.length === 0) {
            showToast("No purchase history to export", "error");
            return;
        }

        try {
            const exportRows: any[] = [];

            purchaseEntries.forEach(entry => {
                const billNoPrefix = entry.type === 'quotation' ? 'QTN' : 'BILL';
                const billNo = `${billNoPrefix}/${new Date(entry.createdAt || Date.now()).getFullYear()}/${entry.id.slice(-5)}`;
                const items = Array.isArray(entry.items) ? entry.items : [];

                if (items.length === 0) {
                    exportRows.push({
                        "Bill Date": entry.date || new Date(entry.createdAt).toLocaleDateString(),
                        "Bill No": billNo,
                        "Type": entry.type.toUpperCase(),
                        "Payment Mode": entry.paymentMode || '-',
                        "Product Name": "(No Items)",
                        "Batch": "-",
                        "HSN": "-",
                        "MRP (Rs)": 0,
                        "Quantity": 0,
                        "Purchase Price (Rs)": 0,
                        "Discount": "-",
                        "GST %": 0,
                        "Gross Total (Rs)": entry.totals?.grossAmount || 0,
                        "Bill Discount (Rs)": entry.totals?.discountAmount || 0,
                        "GST Amount (Rs)": entry.totals?.taxAmount || 0,
                        "Net Amount (Rs)": entry.totals?.netAmount || 0
                    });
                } else {
                    items.forEach((item: any) => {
                        const gross = (item.purchasePrice || item.price || 0) * (item.qty || 0);
                        const discount = item.billDiscountType === '%' ? (gross * (item.billDiscount || 0)) / 100 : (item.billDiscount || 0);
                        const taxable = Math.max(gross - discount, 0);
                        const gstPercent = item.gstPercent !== undefined ? item.gstPercent : 18;
                        const gst = item.includingGST ? 0 : (taxable * gstPercent) / 100;
                        const netAmount = taxable + gst;

                        exportRows.push({
                            "Bill Date": entry.date || new Date(entry.createdAt).toLocaleDateString(),
                            "Bill No": billNo,
                            "Type": entry.type.toUpperCase(),
                            "Payment Mode": entry.paymentMode || '-',
                            "Product Name": item.productName || '-',
                            "Batch": item.batch || '-',
                            "HSN": item.hsn || '-',
                            "MRP (Rs)": item.mrp || 0,
                            "Quantity": item.qty || 0,
                            "Purchase Price (Rs)": item.purchasePrice || item.price || 0,
                            "Discount": `${item.billDiscount || 0}${item.billDiscountType || '%'}`,
                            "GST %": gstPercent,
                            "Item Net Total (Rs)": netAmount,
                            "Bill Net Total (Rs)": entry.totals?.netAmount || 0
                        });
                    });
                }
            });

            const worksheet = XLSX.utils.json_to_sheet(exportRows);
            const workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, worksheet, "Purchase History");

            const maxLens = Object.keys(exportRows[0] || {}).map(key => {
                let max = key.length;
                exportRows.forEach(row => {
                    const val = String(row[key] || '');
                    if (val.length > max) max = val.length;
                });
                return { wch: max + 2 };
            });
            worksheet['!cols'] = maxLens;

            XLSX.writeFile(workbook, `${supplier.name.replace(/\s+/g, '_')}_Purchase_History_${new Date().toISOString().split('T')[0]}.xlsx`);
            showToast("Purchase history exported to Excel successfully", "success");
        } catch (error) {
            console.error(error);
            showToast("Failed to export Excel file", "error");
        }
    };

    const handleExportPDF = () => {
        if (!supplier) return;
        const doc = new jsPDF();

        // Header
        doc.setFillColor(241, 135, 181);
        doc.rect(0, 0, 210, 40, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(22);
        doc.text("Supplier Statement", 105, 25, { align: "center" });

        // Supplier Info
        doc.setTextColor(0, 0, 0);
        doc.setFontSize(10);
        doc.text(`Supplier: ${supplier.name}`, 20, 50);
        doc.text(`Phone: ${supplier.phone}`, 20, 56);
        if (supplier.gstNumber) doc.text(`GST: ${supplier.gstNumber}`, 20, 62);
        doc.text(`Statement Date: ${new Date().toLocaleDateString()}`, 140, 50);

        // Balance Card in PDF
        doc.setFillColor(249, 250, 251);
        doc.roundedRect(20, 70, 170, 20, 2, 2, 'F');
        doc.setFontSize(12);
        doc.setFont("helvetica", "bold");
        doc.text("Current Balance Due:", 30, 83);
        doc.setTextColor(supplier.currentBalance > 0 ? 220 : 34, supplier.currentBalance > 0 ? 38 : 197, supplier.currentBalance > 0 ? 38 : 94);
        doc.text(`Rs. ${Math.abs(supplier.currentBalance).toLocaleString()} ${supplier.currentBalance < 0 ? '(Advance)' : ''}`, 80, 83);

        doc.setTextColor(0, 0, 0);
        let y = 100;

        // Transactions Header
        doc.setFontSize(14);
        doc.text("Recent Transactions", 20, y);
        y += 10;

        // Table Header
        doc.setFillColor(229, 231, 235);
        doc.rect(20, y, 170, 10, 'F');
        doc.setFontSize(9);
        doc.text("Date", 25, y + 7);
        doc.text("Type", 60, y + 7);
        doc.text("Description", 90, y + 7);
        doc.text("Amount", 185, y + 7, { align: 'right' });
        y += 12;

        doc.setFont("helvetica", "normal");
        transactions.forEach((txn) => {
            if (y > 270) {
                doc.addPage();
                y = 20;
            }

            doc.text(new Date(txn.date).toLocaleDateString(), 25, y);
            doc.text(txn.type, 60, y);

            const desc = doc.splitTextToSize(txn.description || '-', 60);
            doc.text(desc, 90, y);

            const amountStr = `Rs. ${Math.abs(txn.amount).toLocaleString()}`;
            if (txn.amount < 0) {
                doc.setTextColor(0, 150, 0);
                doc.text(`- ${amountStr}`, 185, y, { align: 'right' });
            } else {
                doc.setTextColor(220, 0, 0);
                doc.text(`+ ${amountStr}`, 185, y, { align: 'right' });
            }
            doc.setTextColor(0, 0, 0);

            const rowHeight = Math.max(8, desc.length * 4 + 4);
            y += rowHeight;
            doc.setDrawColor(240);
            doc.line(20, y - 2, 190, y - 2);
        });

        doc.save(`${supplier.name.replace(/\s+/g, '_')}_Khata.pdf`);
    };

    if (loading) return <div className="p-10 text-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--primary-color)] mx-auto mb-4"></div>Loading Ledger...</div>;
    if (!supplier) return <div className="p-10 text-center">Supplier not found</div>;

    const totalPurchased = transactions.filter(t => t.type === 'Purchase' || (t.type === 'Manual' && t.amount > 0)).reduce((sum, t) => sum + t.amount, 0);
    const totalPaid = Math.abs(transactions.filter(t => t.type === 'Payment' || (t.type === 'Manual' && t.amount < 0)).reduce((sum, t) => sum + t.amount, 0));

    return (
        <div className="flex flex-col min-h-screen bg-gray-50/50 pb-24 font-sans">
            <div className="p-4 md:p-6 max-w-5xl mx-auto w-full space-y-6">
                {/* Header Card */}
                <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div className="flex items-center gap-4">
                        <button onClick={() => navigate('/admin/pos/suppliers')} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                            <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
                        </button>
                        <div>
                            <h1 className="text-2xl font-black text-gray-900 leading-tight">{supplier.name}</h1>
                            <div className="flex flex-wrap items-center gap-2 mt-1">
                                <span className="text-sm text-gray-400 font-bold font-mono">{supplier.phone}</span>
                                {supplier.gstNumber && (
                                    <span className="text-[10px] bg-[var(--primary-alpha-10)] text-[var(--primary-dark)] font-black px-2 py-0.5 rounded-full uppercase tracking-tighter">GST: {supplier.gstNumber}</span>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="flex gap-2 w-full md:w-auto">
                        <button onClick={() => setShowEditModal(true)} className="flex-1 md:flex-none p-2.5 bg-gray-50 text-gray-600 rounded-xl hover:bg-gray-100 transition-colors border border-gray-100 font-bold text-xs flex items-center justify-center gap-2">
                             <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                             Edit
                        </button>
                        <button onClick={handleExportPDF} className="flex-1 md:flex-none p-2.5 bg-gray-50 text-gray-600 rounded-xl hover:bg-gray-100 transition-colors border border-gray-100 font-bold text-xs flex items-center justify-center gap-2">
                             <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                             PDF
                        </button>
                        <button onClick={handleExportExcel} className="flex-1 md:flex-none p-2.5 bg-gray-50 text-gray-600 rounded-xl hover:bg-gray-100 transition-colors border border-gray-100 font-bold text-xs flex items-center justify-center gap-2">
                             <svg className="w-3.5 h-3.5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                             </svg>
                             Excel
                        </button>
                    </div>
                </div>

                {/* Hero Balance Card */}
                <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-[2.5rem] p-8 text-white shadow-2xl shadow-gray-200 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 -mt-20 -mr-20 w-80 h-80 bg-white/5 rounded-full blur-[100px] group-hover:bg-white/10 transition-all duration-700"></div>

                    <div className="relative z-10 text-center space-y-4">
                        <p className="text-[10px] font-black uppercase tracking-[0.3em] text-white/50">Total Amount Payable</p>
                        <h2 className={`text-6xl font-black ${supplier.currentBalance < 0 ? 'text-green-400' : 'text-white'}`}>
                            ₹{Math.abs(supplier.currentBalance).toLocaleString()}
                        </h2>
                        {supplier.currentBalance < 0 && (
                            <span className="inline-block bg-green-400/20 text-green-400 text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest">Advance Paid</span>
                        )}

                        <div className="grid grid-cols-2 gap-4 mt-8 pt-8 border-t border-white/10">
                            <div>
                                <p className="text-[9px] font-bold text-white/40 uppercase tracking-widest">Total Purchased</p>
                                <p className="text-xl font-bold">₹{totalPurchased.toLocaleString()}</p>
                            </div>
                            <div>
                                <p className="text-[9px] font-bold text-white/40 uppercase tracking-widest">Total Paid</p>
                                <p className="text-xl font-bold text-[var(--primary-color)]">₹{totalPaid.toLocaleString()}</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Tabs Selector */}
                <div className="flex bg-gray-100 p-1.5 rounded-2xl border border-gray-200/30 max-w-sm mx-auto">
                    <button
                        type="button"
                        onClick={() => setActiveTab('ledger')}
                        className={`flex-1 py-2 px-3 rounded-xl font-black text-[10px] uppercase tracking-wider transition-all duration-300 ${activeTab === 'ledger' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-900'}`}
                    >
                        Ledger Statement
                    </button>
                    <button
                        type="button"
                        onClick={() => setActiveTab('purchases')}
                        className={`flex-1 py-2 px-3 rounded-xl font-black text-[10px] uppercase tracking-wider transition-all duration-300 relative ${activeTab === 'purchases' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-900'}`}
                    >
                        Purchase History
                        {purchaseEntries.length > 0 && (
                            <span className="absolute -top-1 -right-1 bg-[var(--primary-color)] text-white text-[8px] font-black w-4.5 h-4.5 rounded-full flex items-center justify-center border border-white">
                                {purchaseEntries.length}
                            </span>
                        )}
                    </button>
                </div>

                {activeTab === 'ledger' ? (
                    /* Transactions Table */
                    <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
                        <div className="px-6 py-4 border-b border-gray-50 flex items-center justify-between">
                            <h3 className="font-black text-gray-900">Transaction History</h3>
                            <span className="text-[10px] font-bold text-gray-400 uppercase">{transactions.length} entries</span>
                        </div>

                        <div className="divide-y divide-gray-50">
                            {transactions.length === 0 ? (
                                <div className="p-12 text-center flex flex-col items-center gap-3">
                                    <div className="w-16 h-16 rounded-full bg-gray-50 flex items-center justify-center text-gray-300">
                                        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0a2 2 0 01-2 2H6a2 2 0 01-2-2m16 0l-8 4-8-4" /></svg>
                                    </div>
                                    <p className="text-gray-400 font-medium italic text-sm">No transactions yet</p>
                                </div>
                            ) : (
                                transactions.map((t, idx) => (
                                    <div key={t._id || idx} className="p-5 flex items-center justify-between hover:bg-gray-50 transition-colors">
                                        <div className="flex items-center gap-4">
                                            <div className={`w-10 h-10 rounded-2xl flex items-center justify-center ${t.amount < 0 ? 'bg-[var(--primary-alpha-10)] text-[var(--primary-color)]' : 'bg-red-50 text-red-500'}`}>
                                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    {t.amount < 0
                                                        ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                                                        : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10" />
                                                    }
                                                </svg>
                                            </div>
                                            <div>
                                                <p className="text-xs font-black text-gray-900 leading-tight uppercase tracking-tight">{t.type}</p>
                                                <p className="text-[10px] text-gray-400 font-bold mt-0.5">{new Date(t.date).toLocaleDateString()} • {t.description}</p>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <p className={`text-base font-black ${t.amount < 0 ? 'text-[var(--primary-color)]' : 'text-red-500'}`}>
                                                {t.amount < 0 ? '-' : '+'}₹{Math.abs(t.amount).toLocaleString()}
                                            </p>
                                            <p className="text-[10px] font-bold text-gray-300">Bal: ₹{t.balanceAfter.toLocaleString()}</p>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                ) : (
                    /* Purchase History Table */
                    <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
                        <div className="px-6 py-4 border-b border-gray-50 flex items-center justify-between">
                            <h3 className="font-black text-gray-900">Purchase Bills & Quotations</h3>
                            <span className="text-[10px] font-bold text-gray-400 uppercase">{purchaseEntries.length} entries</span>
                        </div>

                        <div className="divide-y divide-gray-50">
                            {purchaseEntries.length === 0 ? (
                                <div className="p-12 text-center flex flex-col items-center gap-3">
                                    <div className="w-16 h-16 rounded-full bg-gray-50 flex items-center justify-center text-gray-300">
                                        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
                                    </div>
                                    <p className="text-gray-400 font-medium italic text-sm">No purchase orders or quotations found</p>
                                </div>
                            ) : (
                                purchaseEntries.map((entry, idx) => {
                                    const isExpanded = expandedPurchaseId === entry.id;
                                    const billNoPrefix = entry.type === 'quotation' ? 'QTN' : 'BILL';
                                    const billNo = `${billNoPrefix}/${new Date(entry.createdAt || Date.now()).getFullYear()}/${entry.id.slice(-5)}`;
                                    return (
                                        <div key={entry.id || idx} className="hover:bg-gray-50/50 transition-colors border-b border-gray-100 last:border-0">
                                            {/* Main Row */}
                                            <div className="p-5 flex items-center justify-between cursor-pointer" onClick={() => setExpandedPurchaseId(isExpanded ? null : entry.id)}>
                                                <div className="flex items-center gap-4">
                                                    <div className={`w-10 h-10 rounded-2xl flex items-center justify-center ${entry.type === 'quotation' ? 'bg-orange-50 text-orange-500' : 'bg-green-50 text-green-500'}`}>
                                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            {entry.type === 'quotation'
                                                                ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                                                : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                                                            }
                                                        </svg>
                                                    </div>
                                                    <div>
                                                        <div className="flex items-center gap-2">
                                                            <p className="text-xs font-black text-gray-900 leading-tight uppercase tracking-tight">{billNo}</p>
                                                            <span className={`text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-tighter ${entry.type === 'quotation' ? 'bg-orange-100 text-orange-700' : 'bg-green-100 text-green-700'}`}>
                                                                {entry.type}
                                                            </span>
                                                        </div>
                                                        <p className="text-[10px] text-gray-400 font-bold mt-0.5">
                                                            {entry.date ? new Date(entry.date).toLocaleDateString() : 'N/A'} • {entry.paymentMode} • {entry.items?.length || 0} items
                                                        </p>
                                                    </div>
                                                </div>

                                                <div className="flex items-center gap-4">
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            sessionStorage.setItem('edit_purchase_data', JSON.stringify(entry));
                                                            navigate('/admin/pos/orders?mode=edit_purchase');
                                                        }}
                                                        className="px-3 py-1 bg-white border border-gray-200 rounded-md text-xs font-bold text-gray-600 hover:text-[var(--primary-color)] hover:border-[var(--primary-color)] shadow-sm transition-colors"
                                                    >
                                                        Edit
                                                    </button>
                                                    <div className="text-right">
                                                        <p className="text-base font-black text-gray-900">
                                                            ₹{(entry.totals?.netAmount || 0).toLocaleString()}
                                                        </p>
                                                        <p className="text-[9px] font-bold text-gray-400 uppercase tracking-tighter">Gross: ₹{(entry.totals?.grossAmount || 0).toLocaleString()}</p>
                                                    </div>
                                                    <svg className={`w-5 h-5 text-gray-400 transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
                                                </div>
                                            </div>

                                            {/* Expanded Details Panel */}
                                            {isExpanded && (
                                                <div className="px-5 pb-5 pt-2 border-t border-gray-50 bg-gray-50/30 space-y-4 animate-in slide-in-from-top-2 duration-200">
                                                    <div className="overflow-x-auto rounded-xl border border-gray-100 bg-white">
                                                        <table className="min-w-full divide-y divide-gray-100">
                                                            <tbody className="divide-y divide-gray-50">
                                                                {entry.items?.map((item: any, itemIdx: number) => {
                                                                    const gross = (item.purchasePrice || item.price || 0) * (item.qty || 0);
                                                                    const discount = item.billDiscountType === '%' ? (gross * (item.billDiscount || 0)) / 100 : (item.billDiscount || 0);
                                                                    const taxable = Math.max(gross - discount, 0);
                                                                    const gstPercent = item.gstPercent !== undefined ? item.gstPercent : 18;
                                                                    const gst = item.includingGST ? 0 : (taxable * gstPercent) / 100;
                                                                    const itemNet = taxable + gst;
                                                                    return (
                                                                        <tr key={item.id || itemIdx} className="hover:bg-gray-50/50">
                                                                            <td className="px-4 py-2.5">
                                                                                <p className="text-xs font-bold text-gray-900">{item.productName}</p>
                                                                                {item.batch && <span className="text-[9px] text-gray-400 font-mono">Batch: {item.batch}</span>}
                                                                            </td>
                                                                            <td className="px-4 py-2.5 text-center text-xs font-bold text-gray-500">₹{(item.mrp || 0).toLocaleString()}</td>
                                                                            <td className="px-4 py-2.5 text-center text-xs font-bold text-gray-900">{item.qty}</td>
                                                                            <td className="px-4 py-2.5 text-center text-xs font-bold text-gray-900">₹{(item.purchasePrice || item.price || 0).toLocaleString()}</td>
                                                                            <td className="px-4 py-2.5 text-center text-xs font-bold text-green-600">{item.billDiscount || 0}{item.billDiscountType || '%'}</td>
                                                                            <td className="px-4 py-2.5 text-center text-xs font-bold text-gray-500">{gstPercent}%</td>
                                                                            <td className="px-4 py-2.5 text-right text-xs font-bold text-gray-900">₹{itemNet.toLocaleString()}</td>
                                                                        </tr>
                                                                    );
                                                                })}
                                                            </tbody>
                                                        </table>
                                                    </div>

                                                    <div className="flex justify-end gap-2">
                                                        <button
                                                            type="button"
                                                            onClick={() => printInvoice(entry)}
                                                            className="py-2 px-4 bg-gray-900 text-white rounded-xl font-bold text-[10px] uppercase tracking-wider hover:bg-gray-800 transition-colors flex items-center gap-1.5 shadow-sm"
                                                        >
                                                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
                                                            Print Invoice
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => handleDeletePurchase(entry.id)}
                                                            className="py-2 px-4 bg-red-50 text-red-600 rounded-xl font-bold text-[10px] uppercase tracking-wider hover:bg-red-100 transition-colors flex items-center gap-1.5"
                                                        >
                                                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                                            Delete Bill
                                                        </button>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </div>
                )}

                <div className="pt-8 opacity-40 hover:opacity-100 transition-opacity flex justify-center">
                    <button onClick={handleDelete} className="text-red-500 text-[10px] font-black uppercase tracking-widest flex items-center gap-2 hover:bg-red-50 px-4 py-2 rounded-xl">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        Delete Supplier Forever
                    </button>
                </div>
            </div>

            {/* Sticky Action Footer */}
            <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/80 backdrop-blur-xl border-t border-gray-100 flex justify-center z-40">
                <div className="flex gap-4 w-full max-w-lg">
                    <button
                        onClick={() => { resetForm(); setShowDebtModal(true); }}
                        className="flex-1 py-4 bg-gray-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-gray-200 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>
                        Add Debt
                    </button>
                    <button
                        onClick={() => { resetForm(); setShowPayModal(true); }}
                        className="flex-1 py-4 bg-[var(--primary-color)] text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-pink-100 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                        Pay Supplier
                    </button>
                </div>
            </div>

            {/* Pay Modal */}
            {(showPayModal || showDebtModal) && (
                <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white w-full max-w-sm rounded-t-[2.5rem] sm:rounded-3xl shadow-2xl overflow-hidden slide-in-from-bottom-5">
                        <div className={`p-8 text-white text-center ${showPayModal ? 'bg-[var(--primary-color)]' : 'bg-gray-900'}`}>
                            <h3 className="text-2xl font-black">{showPayModal ? 'Pay Supplier' : 'Add Purchase Debt'}</h3>
                            <p className="text-white/60 text-[10px] font-bold uppercase mt-1 tracking-widest">
                                {showPayModal ? 'Decrease balance you owe' : 'Increase balance you owe'}
                            </p>
                        </div>
                        <form onSubmit={showPayModal ? handlePaySupplier : handleAddDebt} className="p-8 space-y-6">
                            <div className="relative">
                                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 ml-1">Enter Amount</label>
                                <div className="flex items-center border-b-2 border-gray-100 focus-within:border-[var(--primary-color)] transition-colors pb-3">
                                    <span className="text-4xl font-black text-gray-200 mr-2">₹</span>
                                    <input
                                        type="number" required min="1" autoFocus
                                        className="w-full text-5xl font-black outline-none bg-transparent placeholder-gray-100 text-gray-900"
                                        placeholder="0"
                                        value={amount} onChange={e => setAmount(e.target.value)}
                                    />
                                </div>
                            </div>

                            <div className="space-y-4">
                                <div>
                                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 ml-1">Description / Bill No.</label>
                                    <input
                                        type="text" required
                                        className="w-full bg-gray-50 border-none rounded-2xl px-5 py-4 text-sm font-bold text-gray-900 focus:ring-2 focus:ring-[var(--primary-color)]/10 outline-none"
                                        placeholder={showPayModal ? "Cash payment / NEFT Ref" : "Bill #123 / Goods received"}
                                        value={note} onChange={e => setNote(e.target.value)}
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 ml-1">Transaction Date</label>
                                    <input
                                        type="date" required
                                        className="w-full bg-gray-50 border-none rounded-2xl px-5 py-4 text-sm font-bold text-gray-900 focus:ring-2 focus:ring-[var(--primary-color)]/10 outline-none"
                                        value={date} onChange={e => setDate(e.target.value)}
                                    />
                                </div>
                            </div>

                            <div className="flex gap-3 pt-4">
                                <button type="button" onClick={() => { setShowPayModal(false); setShowDebtModal(false); }} className="flex-1 py-4 text-gray-400 font-black text-[10px] uppercase tracking-widest hover:bg-gray-50 rounded-2xl transition-all">Cancel</button>
                                <button
                                    type="submit"
                                    disabled={isActionLoading}
                                    className={`flex-[2] py-4 rounded-2xl text-white font-black text-[10px] uppercase tracking-[0.2em] shadow-lg transition-all active:scale-[0.98] ${showPayModal ? 'bg-[var(--primary-color)] shadow-pink-100' : 'bg-gray-900 shadow-gray-200'}`}
                                >
                                    {isActionLoading ? 'Processing...' : (showPayModal ? 'Save Payment' : 'Save Debt')}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Edit Modal */}
            {showEditModal && (
                <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden">
                        <div className="bg-gray-50 px-8 py-6 flex justify-between items-center border-b border-gray-100">
                            <h3 className="text-lg font-black text-gray-900 uppercase tracking-tight">Edit Supplier</h3>
                            <button onClick={() => setShowEditModal(false)} className="text-gray-400 p-2 hover:bg-gray-100 rounded-full transition-colors"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg></button>
                        </div>
                        <form onSubmit={handleUpdateSupplier} className="p-8 space-y-4">
                            <div>
                                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 ml-1">Name</label>
                                <input type="text" required className="w-full bg-gray-50 border-none rounded-xl px-4 py-3 text-sm font-bold" value={editData.name} onChange={e => setEditData({...editData, name: e.target.value})} />
                            </div>
                            <div>
                                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 ml-1">Phone</label>
                                <input type="tel" required maxLength={10} className="w-full bg-gray-50 border-none rounded-xl px-4 py-3 text-sm font-bold" value={editData.phone} onChange={e => setEditData({...editData, phone: e.target.value})} />
                            </div>
                            <div>
                                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 ml-1">GST Number</label>
                                <input type="text" className="w-full bg-gray-50 border-none rounded-xl px-4 py-3 text-sm font-bold uppercase" value={editData.gstNumber} onChange={e => setEditData({...editData, gstNumber: e.target.value.toUpperCase()})} />
                            </div>
                            <div>
                                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 ml-1">Address</label>
                                <textarea rows={2} className="w-full bg-gray-50 border-none rounded-xl px-4 py-3 text-sm font-bold resize-none" value={editData.address} onChange={e => setEditData({...editData, address: e.target.value})} />
                            </div>
                            <button type="submit" disabled={isActionLoading} className="w-full py-4 bg-gray-900 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest mt-4">Save Changes</button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminPOSSupplierDetail;
