import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../../../context/ToastContext';
import { PurchaseEntryRecord, PurchaseItem } from './SellerPOSOrders';
import { getSellerPurchaseEntries as apiGetSellerPurchaseEntries } from '../../../services/api/seller/sellerPurchaseService';

const SellerPOSQuotations: React.FC = () => {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [quotations, setQuotations] = useState<PurchaseEntryRecord[]>([]);
  const [selectedQuote, setSelectedQuote] = useState<PurchaseEntryRecord | null>(null);
  const [showActionSheet, setShowActionSheet] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Fetch saved quotations from localStorage
  useEffect(() => {
    const loadQuotations = async () => {
      try {
        const res = await apiGetSellerPurchaseEntries('quotation');
        if (res.success && Array.isArray(res.data)) {
          const normalized: PurchaseEntryRecord[] = res.data.map((q: any) => ({
            ...q,
            totals: {
              grossAmount: q.totals?.grossAmount ?? q.totals?.gross ?? 0,
              discountAmount: q.totals?.discountAmount ?? q.totals?.discount ?? 0,
              taxAmount: q.totals?.taxAmount ?? q.totals?.tax ?? 0,
              roundOff: q.totals?.roundOff ?? 0,
              netAmount: q.totals?.netAmount ?? q.totals?.net ?? 0,
            }
          }));
          setQuotations(normalized.filter(q => q.type === 'quotation'));
          localStorage.setItem('seller_pos_purchase_entries', JSON.stringify(res.data));
          return;
        }
      } catch {
        // fallback to local cache
      }

      try {
        const raw = localStorage.getItem('seller_pos_purchase_entries');
        if (raw) {
          const parsed: any[] = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            const normalized: PurchaseEntryRecord[] = parsed.map(q => ({
              ...q,
              totals: {
                grossAmount: q.totals?.grossAmount ?? q.totals?.gross ?? 0,
                discountAmount: q.totals?.discountAmount ?? q.totals?.discount ?? 0,
                taxAmount: q.totals?.taxAmount ?? q.totals?.tax ?? 0,
                roundOff: q.totals?.roundOff ?? 0,
                netAmount: q.totals?.netAmount ?? q.totals?.net ?? 0,
              }
            }));
            setQuotations(normalized.filter(q => q.type === 'quotation'));
          }
        }
      } catch (err) {
        console.error('Failed to load quotations', err);
      }
    };
    void loadQuotations();
  }, []);

  const handleActionClick = (quote: PurchaseEntryRecord) => {
    setSelectedQuote(quote);
    setShowActionSheet(true);
  };

  const closeActionSheet = () => {
    setShowActionSheet(false);
    setSelectedQuote(null);
  };

  const handleEditOrder = () => {
    if (!selectedQuote) return;
    // Store selected quote in session storage or state for AdminPOSOrders to pick up
    sessionStorage.setItem('edit_quotation_data', JSON.stringify(selectedQuote));
    navigate('/seller/pos/orders?mode=edit_quotation');
    closeActionSheet();
  };

  const handleConvertToBill = () => {
    if (!selectedQuote) return;
    // Logic to convert to bill - basically load into POS and trigger checkout
    sessionStorage.setItem('convert_quotation_data', JSON.stringify(selectedQuote));
    navigate('/seller/pos/orders?mode=convert_quotation');
    closeActionSheet();
  };

  const handleViewBill = () => {
    if (!selectedQuote) return;
    printQuotation(selectedQuote);
    closeActionSheet();
  };

  const handlePrint = () => {
    if (!selectedQuote) return;
    printQuotation(selectedQuote);
    closeActionSheet();
  };

  const printQuotation = (entry: PurchaseEntryRecord) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    let shopName = 'GEETA STORES';
    let shopAddress = 'Nagda, Madhya Pradesh, India - 454001';
    let shopPhone = '7898111456';
    try {
      const rawSettings = localStorage.getItem('seller_bill_settings');
      if (rawSettings) {
        const parsed = JSON.parse(rawSettings);
        if (parsed?.shopName?.trim()) shopName = parsed.shopName.trim();
        if (parsed?.address?.trim()) shopAddress = parsed.address.trim();
        if (parsed?.phone?.trim()) shopPhone = parsed.phone.trim();
      }
    } catch {}
    const shopAddressHtml = shopAddress.replace(/\n/g, '<br>');

    const billNoPrefix = entry.type === 'quotation' ? 'QTN' : 'BILL';
    const billNo = `${billNoPrefix}/${new Date(entry.createdAt).getFullYear()}/${entry.id.slice(-5)}`;
    const supplierName = entry.supplier?.name || 'Walk-in Supplier';
    const supplierAddress = entry.supplier?.address || '-';
    const supplierPhone = entry.supplier?.phone || '-';
    const supplierGst = entry.supplier?.gstNumber || '-';

    // Group tax by GST percentage
    const taxGroups: { [percent: number]: { taxable: number; cgst: number; sgst: number } } = {};
    entry.items.forEach(item => {
      const gross = item.purchasePrice * item.qty;
      const discount = item.billDiscountType === '%' ? (gross * item.billDiscount) / 100 : item.billDiscount;
      const netBeforeTax = Math.max(gross - discount, 0);

      let lineTax = 0;
      let lineTaxable = 0;

      if (item.includingGST) {
        lineTax = (netBeforeTax * item.gstPercent) / (100 + item.gstPercent);
        lineTaxable = netBeforeTax - lineTax;
      } else {
        lineTax = (netBeforeTax * item.gstPercent) / 100;
        lineTaxable = netBeforeTax;
      }

      const rate = item.gstPercent;
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

    const rows = entry.items.map((item, idx) => {
      const gross = item.purchasePrice * item.qty;
      const discount = item.billDiscountType === '%' ? (gross * item.billDiscount) / 100 : item.billDiscount;
      const taxableLine = Math.max(gross - discount, 0);
      const lineTax = item.includingGST ? 0 : (taxableLine * item.gstPercent) / 100;
      const lineNet = taxableLine + lineTax;
      return `
        <tr>
          <td>${idx + 1}</td>
          <td>${item.productName}</td>
          <td>${item.hsn || '-'}</td>
          <td>${item.mrp.toFixed(2)}</td>
          <td>${item.qty.toFixed(2)}</td>
          <td>${item.purchasePrice.toFixed(2)}</td>
          <td>${item.billDiscount.toFixed(2)}${item.billDiscountType}</td>
          <td>${(item.gstPercent / 2).toFixed(2)}</td>
          <td>${(item.gstPercent / 2).toFixed(2)}</td>
          <td>${lineNet.toFixed(2)}</td>
        </tr>
      `;
    }).join('');

    const html = `
      <html>
        <head>
          <title>Quotation - ${billNo}</title>
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
            .net-total { font-size: 20px; font-weight: 800; margin-top: 6px; border-top: 1px dashed #999; padding-top: 6px; }
          </style>
        </head>
        <body>
          <div class="top">
            <h1>${shopName}</h1>
            <p>${shopAddressHtml}</p>
            <p>Mobile: ${shopPhone}</p>
          </div>

          <div class="meta">
            <div class="box">
              <h3 style="margin-bottom:6px;">Customer Details</h3>
              <div class="line"><span>Name</span><strong>${supplierName}</strong></div>
              <div class="line"><span>Address</span><span>${supplierAddress}</span></div>
              <div class="line"><span>Phone</span><span>${supplierPhone}</span></div>
              <div class="line"><span>GSTIN</span><span>${supplierGst}</span></div>
            </div>
            <div class="box">
              <h3 style="margin-bottom:6px;">Quotation</h3>
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
              <div class="totals-row"><span>Gross Amt.</span><strong>${entry.totals.grossAmount.toFixed(2)}</strong></div>
              <div class="totals-row"><span>Total Deduction</span><strong>${entry.totals.discountAmount.toFixed(2)}</strong></div>
              <div class="totals-row"><span>GST Amt.</span><strong>${entry.totals.taxAmount.toFixed(2)}</strong></div>
              <div class="totals-row"><span>Round Off</span><strong>${entry.totals.roundOff.toFixed(2)}</strong></div>
              <div class="totals-row net-total"><span>Total Amount</span><strong>${entry.totals.netAmount.toFixed(2)}</strong></div>
            </div>
          </div>

          <p>Amt in words: ${entry.totals.netAmount.toFixed(2)} only</p>
          <p>Quotation is valid for limited period.</p>
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

  const handleShareWhatsApp = () => {
    if (!selectedQuote) return;
    const itemsList = selectedQuote.items.map((i: PurchaseItem) => `${i.productName} (x${i.qty}) - ?${i.retailPrice}`).join('\n');
    const message = `Hello,\nHere is your quotation details:\n\n${itemsList}\n\nTotal Amount: ?${selectedQuote.totals.netAmount}\n\nThank you for shopping with us!`;
    const phone = selectedQuote.supplier?.phone || '';
    window.open(`https://wa.me/${phone.replace(/\D/g, '')}?text=${encodeURIComponent(message)}`, '_blank');
    closeActionSheet();
  };

  const handleCall = () => {
    if (!selectedQuote) return;
    const phone = selectedQuote.supplier?.phone || '';
    if (phone) {
        window.location.href = `tel:${phone}`;
    } else {
        showToast('Phone number not available', 'error');
    }
    closeActionSheet();
  };

  const filteredQuotations = quotations.filter(q =>
    q.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (q.supplier?.name || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="p-4 sm:p-6 space-y-6 bg-gray-50 min-h-screen">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
        <div>
          <div className="flex items-center gap-2 mb-1">
             <button onClick={() => navigate('/seller/pos/orders')} className="p-1.5 hover:bg-gray-100 rounded-full transition-colors md:hidden">
                <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 19l-7-7 7-7" /></svg>
             </button>
             <h1 className="text-2xl font-bold text-gray-800">POS Quotations</h1>
          </div>
          <p className="text-gray-500 text-sm">Track and manage your customer price quotations</p>
        </div>
        <div className="flex gap-2">
            <button
              onClick={() => navigate('/seller/pos/orders?mode=new_quotation')}
              className="px-4 py-2 bg-[var(--primary-color)] text-white rounded-xl font-bold hover:bg-[var(--primary-dark)] transition-all shadow-sm flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4" /></svg>
              New Quote
            </button>
        </div>
      </div>

      {/* Date Filter Bar & Search */}
      <div className="space-y-3">
        <div className="bg-white rounded-2xl p-4 shadow-sm flex flex-col sm:flex-row gap-4 sm:items-center border border-gray-100">
          <div className="relative flex-1">
            <input
              type="text"
              placeholder="Search by quote ID or customer..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-gray-50 border-none rounded-xl py-2.5 pl-10 pr-4 text-sm focus:ring-2 focus:ring-[var(--primary-alpha-10)] outline-none transition-all"
            />
            <svg className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <div className="flex justify-between items-center bg-[#fff1f7] p-2 pl-4 rounded-xl border border-[var(--primary-color)]">
            <div className="flex items-center gap-3">
               <div>
                 <p className="text-[10px] font-bold text-[var(--primary-color)] uppercase tracking-wider">Date Range</p>
                 <p className="text-pink-700 text-xs font-medium">Last 30 Days</p>
               </div>
            </div>
            <button className="p-2 text-[var(--primary-color)] hover:text-[var(--primary-dark)]">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3M4 11h16M5 21h14a1 1 0 001-1V8a1 1 0 00-1-1H5a1 1 0 00-1 1v12a1 1 0 001 1z" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* List */}
      <div className="pb-24 space-y-4">
        {filteredQuotations.length === 0 ? (
          <div className="bg-white rounded-2xl py-20 shadow-sm border border-gray-100 flex flex-col items-center justify-center text-gray-400">
            <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-4">
                <svg className="w-8 h-8 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
            </div>
            <p className="font-medium text-gray-400">No quotations found</p>
            <p className="text-xs mt-1">Try searching with a different ID or name</p>
          </div>
        ) : (
          filteredQuotations.map((quote, idx) => (
            <div
              key={quote.id}
              onClick={() => handleActionClick(quote)}
              className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 hover:border-pink-200 active:scale-[0.99] transition-all cursor-pointer group"
            >
              <div className="flex gap-5">
                <div className="w-14 h-14 bg-[#fff1f7] rounded-2xl flex items-center justify-center text-[var(--primary-color)] shrink-0 group-hover:scale-110 transition-transform">
                  <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="text-base font-bold text-gray-800">Quote #{quotations.length - idx}</h3>
                      <p className="text-xs text-gray-500">{quote.supplier?.name || 'No customer'}</p>
                    </div>
                    <div className="bg-gray-100 px-2 py-1 rounded-lg flex items-center gap-1">
                      <svg className="w-3 h-3 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13l-1 5h12" />
                      </svg>
                      <span className="text-[10px] font-bold text-gray-700">{quote.items.length} item</span>
                    </div>
                  </div>
                  <div className="mt-4 flex justify-between items-end">
                    <div>
                      <p className="text-[10px] text-gray-400 font-medium tracking-tight">Amount</p>
                      <p className="text-2xl font-black text-gray-900 leading-none">?{(quote.totals?.netAmount ?? 0).toFixed(2)}</p>
                    </div>
                    <p className="text-[10px] text-gray-400 font-medium pb-0.5">{new Date(quote.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</p>
                  </div>
                  <div className="mt-2 text-[9px] text-gray-300 italic">Updated Just now</div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Action Sheet Modal */}
      {showActionSheet && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center sm:items-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm animate-in fade-in transition-all duration-300" onClick={closeActionSheet}>
          <div
            className="bg-white w-full max-w-lg rounded-t-[32px] sm:rounded-[32px] overflow-hidden shadow-2xl animate-in slide-in-from-bottom-full duration-300"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header / Grab Handle */}
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
              <button onClick={closeActionSheet} className="w-8 h-8 rounded-full bg-gray-50 flex items-center justify-center text-gray-400 hover:bg-gray-100 transition-colors">
                 <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            <div className="p-6 space-y-3 pb-10 sm:pb-6">
              <ActionItem
                icon={<svg className="w-5 h-5 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>}
                title="View Bill"
                subtitle="Preview order invoice"
                onClick={handleViewBill}
                iconBg="bg-emerald-50"
              />
              <ActionItem
                icon={<svg className="w-5 h-5 text-[var(--primary-color)]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>}
                title="Edit Order"
                subtitle="Modify order details"
                onClick={handleEditOrder}
                iconBg="bg-[var(--primary-alpha-10)]"
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
         <svg className="w-5 h-5 leading-none" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" /></svg>
      </div>
    </button>
  );
};

export default SellerPOSQuotations;

