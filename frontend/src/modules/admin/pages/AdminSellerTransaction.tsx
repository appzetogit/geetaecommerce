import { useState, useEffect, useCallback } from "react";
import { getSellerCommissions, addManualFundTransfer } from "../../../services/api/admin/adminWalletService";
import { getSellers } from "../../../services/api/admin/adminSellerService";
import toast from "react-hot-toast";

interface Transaction {
  id: string;
  sellerName: string;
  orderId: string;
  orderItemId: string;
  productName: string;
  variation: string;
  flag: string;
  amount: number;
  remark: string;
  date: string;
}

interface SellerOption {
  _id: string;
  storeName: string;
  sellerName: string;
}

export default function AdminSellerTransaction() {
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [filterBySeller, setFilterBySeller] = useState("All Seller");
  const [perPage, setPerPage] = useState("10");
  const [searchQuery, setSearchQuery] = useState("");
  const [showAddFundModal, setShowAddFundModal] = useState(false);
  const [sortColumn, setSortColumn] = useState<keyof Transaction | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalEntries, setTotalEntries] = useState(0);

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [sellers, setSellers] = useState<SellerOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Fund Transfer Form State
  const [fundTransferData, setFundTransferData] = useState({
    sellerId: "",
    amount: "",
    message: "",
    type: "Credit"
  });

  const fetchSellers = useCallback(async () => {
    try {
      const response = await getSellers();
      if (response.success) {
        setSellers(response.data.map((s: any) => ({
          _id: s._id,
          storeName: s.storeName,
          sellerName: s.sellerName
        })));
      }
    } catch (error) {
      console.error("Error fetching sellers:", error);
    }
  }, []);

  const fetchTransactions = useCallback(async () => {
    try {
      setLoading(true);
      const params = {
        page: currentPage,
        limit: perPage,
        sellerId: filterBySeller === "All Seller" ? undefined : filterBySeller,
        search: searchQuery || undefined,
        startDate: fromDate || undefined,
        endDate: toDate || undefined
      };

      const response = await getSellerCommissions(params);
      if (response.success) {
        setTransactions(response.data);
        setTotalEntries(response.pagination?.total || 0);
      }
    } catch (error) {
      console.error("Error fetching transactions:", error);
      toast.error("Failed to fetch transactions");
    } finally {
      setLoading(false);
    }
  }, [currentPage, perPage, filterBySeller, searchQuery, fromDate, toDate]);

  useEffect(() => {
    fetchSellers();
  }, [fetchSellers]);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  const handleClear = () => {
    setFromDate("");
    setToDate("");
    setFilterBySeller("All Seller");
    setSearchQuery("");
    setCurrentPage(1);
  };

  const handleExport = () => {
    if (transactions.length === 0) {
      toast.error("No data to export");
      return;
    }
    // Create CSV content
    const headers = ["ID", "Seller Name", "Order ID", "Order Item ID", "Product Name", "Variation", "Flag", "Amount", "Remark", "Date"];
    const csvContent = [
      headers.join(","),
      ...transactions.map(t =>
        [t.id, t.sellerName, t.orderId, t.orderItemId, t.productName, t.variation, t.flag, t.amount, t.remark, new Date(t.date).toLocaleString()].join(",")
      )
    ].join("\n");

    // Create download link
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `seller-transactions-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  const handleAddFundTransfer = () => {
    setShowAddFundModal(true);
  };

  const handleCloseFundModal = () => {
    setShowAddFundModal(false);
    setFundTransferData({
      sellerId: "",
      amount: "",
      message: "",
      type: "Credit"
    });
  };

  const handleFundTransferSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fundTransferData.sellerId || !fundTransferData.amount) {
      toast.error("Please fill all required fields");
      return;
    }

    try {
      setSubmitting(true);
      const response = await addManualFundTransfer({
        sellerId: fundTransferData.sellerId,
        amount: parseFloat(fundTransferData.amount),
        type: fundTransferData.type,
        description: fundTransferData.message
      });

      if (response.success) {
        toast.success(response.message || "Fund transfer successful");
        handleCloseFundModal();
        fetchTransactions();
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Failed to process fund transfer");
    } finally {
      setSubmitting(false);
    }
  };

  const handleSort = (column: keyof Transaction) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  const sortedTransactions = [...transactions].sort((a, b) => {
    if (!sortColumn) return 0;

    const aValue = a[sortColumn];
    const bValue = b[sortColumn];

    if (typeof aValue === 'number' && typeof bValue === 'number') {
      return sortDirection === 'asc' ? aValue - bValue : bValue - aValue;
    }

    const aStr = String(aValue).toLowerCase();
    const bStr = String(bValue).toLowerCase();

    if (sortDirection === 'asc') {
      return aStr < bStr ? -1 : aStr > bStr ? 1 : 0;
    } else {
      return aStr > bStr ? -1 : aStr < bStr ? 1 : 0;
    }
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-sm border border-neutral-200">
        <div className="p-4 border-b border-neutral-200 flex items-center justify-between" style={{ background: 'var(--primary-color)' }}>
          <h2 className="text-lg font-bold text-white">Seller Transactions</h2>
          <button
            onClick={handleAddFundTransfer}
            className="px-4 py-2 bg-white text-neutral-800 font-semibold rounded hover:bg-neutral-100 transition-colors flex items-center gap-2"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19"></line>
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
            Add Fund Transfer
          </button>
        </div>

        {/* Filters */}
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
            {/* From - To Date */}
            <div className="lg:col-span-1 flex flex-col gap-1">
              <label className="text-sm font-semibold text-neutral-700">
                From Date:
              </label>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => { setFromDate(e.target.value); setCurrentPage(1); }}
                className="w-full px-3 py-2 border border-neutral-300 rounded outline-none text-sm"
              />
            </div>
            <div className="lg:col-span-1 flex flex-col gap-1">
              <label className="text-sm font-semibold text-neutral-700">
                To Date:
              </label>
              <input
                type="date"
                value={toDate}
                onChange={(e) => { setToDate(e.target.value); setCurrentPage(1); }}
                className="w-full px-3 py-2 border border-neutral-300 rounded outline-none text-sm"
              />
            </div>

            {/* Filter by Seller */}
            <div className="flex flex-col gap-1">
              <label className="text-sm font-semibold text-neutral-700">
                Filter by Seller:
              </label>
              <div className="flex gap-2">
                <select
                  value={filterBySeller}
                  onChange={(e) => { setFilterBySeller(e.target.value); setCurrentPage(1); }}
                  className="flex-1 px-3 py-2 border border-neutral-300 rounded outline-none text-sm"
                >
                  <option value="All Seller">All Seller</option>
                  {sellers.map(s => (
                    <option key={s._id} value={s._id}>{s.storeName} ({s.sellerName})</option>
                  ))}
                </select>
                <button
                   onClick={handleClear}
                   className="px-3 py-2 bg-neutral-800 text-white rounded hover:bg-neutral-900 transition-colors text-sm font-medium"
                >
                   Clear
                </button>
              </div>
            </div>
          </div>

          {/* Per Page, Export, Search */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <label className="text-sm font-semibold text-neutral-700">Per Page:</label>
              <select
                value={perPage}
                onChange={(e) => { setPerPage(e.target.value); setCurrentPage(1); }}
                className="px-3 py-2 border border-neutral-300 rounded outline-none text-sm"
              >
                <option value="10">10</option>
                <option value="25">25</option>
                <option value="50">50</option>
                <option value="100">100</option>
              </select>

              <button
                onClick={handleExport}
                className="px-4 py-2 text-white rounded hover:opacity-90 transition-opacity text-sm font-medium flex items-center gap-2"
                style={{ background: 'var(--primary-color)' }}
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                  <polyline points="7 10 12 15 17 10"></polyline>
                  <line x1="12" y1="15" x2="12" y2="3"></line>
                </svg>
                Export
              </button>
            </div>

            <div className="flex items-center gap-2">
              <label className="text-sm font-semibold text-neutral-700">Search:</label>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                className="px-3 py-2 border border-neutral-300 rounded outline-none text-sm w-64"
                placeholder="Order ID, Product, Seller..."
              />
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-neutral-50 border-y border-neutral-200">
                <th
                  onClick={() => handleSort('id')}
                  className="px-4 py-3 text-left text-[11px] font-bold text-neutral-700 uppercase tracking-wider cursor-pointer hover:bg-neutral-100 min-w-[100px]">
                  ID {sortColumn === 'id' && (sortDirection === 'asc' ? '↑' : '↓')}
                </th>
                <th
                  onClick={() => handleSort('sellerName')}
                  className="px-4 py-3 text-left text-[11px] font-bold text-neutral-700 uppercase tracking-wider cursor-pointer hover:bg-neutral-100">
                  SELLER {sortColumn === 'sellerName' && (sortDirection === 'asc' ? '↑' : '↓')}
                </th>
                <th
                  onClick={() => handleSort('orderId')}
                  className="px-4 py-3 text-left text-[11px] font-bold text-neutral-700 uppercase tracking-wider cursor-pointer hover:bg-neutral-100">
                  ORDER# {sortColumn === 'orderId' && (sortDirection === 'asc' ? '↑' : '↓')}
                </th>
                <th
                  onClick={() => handleSort('productName')}
                  className="px-4 py-3 text-left text-[11px] font-bold text-neutral-700 uppercase tracking-wider cursor-pointer hover:bg-neutral-100 min-w-[150px]">
                  PRODUCT {sortColumn === 'productName' && (sortDirection === 'asc' ? '↑' : '↓')}
                </th>
                <th
                  onClick={() => handleSort('variation')}
                  className="px-4 py-3 text-left text-[11px] font-bold text-neutral-700 uppercase tracking-wider cursor-pointer hover:bg-neutral-100">
                  VAR {sortColumn === 'variation' && (sortDirection === 'asc' ? '↑' : '↓')}
                </th>
                <th
                  onClick={() => handleSort('flag')}
                  className="px-4 py-3 text-left text-[11px] font-bold text-neutral-700 uppercase tracking-wider cursor-pointer hover:bg-neutral-100">
                  STATUS {sortColumn === 'flag' && (sortDirection === 'asc' ? '↑' : '↓')}
                </th>
                <th
                  onClick={() => handleSort('amount')}
                  className="px-4 py-3 text-left text-[11px] font-bold text-neutral-700 uppercase tracking-wider cursor-pointer hover:bg-neutral-100">
                  AMT {sortColumn === 'amount' && (sortDirection === 'asc' ? '↑' : '↓')}
                </th>
                <th
                  className="px-4 py-3 text-left text-[11px] font-bold text-neutral-700 uppercase tracking-wider min-w-[200px]">
                  REMARK
                </th>
                <th
                  onClick={() => handleSort('date')}
                  className="px-4 py-3 text-left text-[11px] font-bold text-neutral-700 uppercase tracking-wider cursor-pointer hover:bg-neutral-100 min-w-[120px]">
                  DATE {sortColumn === 'date' && (sortDirection === 'asc' ? '↑' : '↓')}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200 bg-white">
              {loading ? (
                <tr>
                   <td colSpan={10} className="px-4 py-10 text-center text-neutral-500">
                      <div className="flex flex-col items-center gap-2">
                         <div className="w-8 h-8 border-4 border-[var(--primary-color)] border-t-transparent rounded-full animate-spin"></div>
                         <span>Loading transactions...</span>
                      </div>
                   </td>
                </tr>
              ) : sortedTransactions.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-4 py-10 text-center text-neutral-500 text-sm italic">
                    No transactions found matching your criteria
                  </td>
                </tr>
              ) : (
                sortedTransactions.map((transaction) => (
                  <tr key={transaction.id} className="hover:bg-neutral-50 transition-colors">
                    <td className="px-4 py-3 text-xs font-mono text-neutral-500">#{transaction.id.slice(-6)}</td>
                    <td className="px-4 py-3 text-xs font-semibold text-neutral-900">{transaction.sellerName}</td>
                    <td className="px-4 py-3 text-xs font-bold text-[var(--primary-color)]">{transaction.orderId}</td>
                    <td className="px-4 py-3 text-xs text-neutral-800">
                       <div className="truncate max-w-[150px]" title={transaction.productName}>
                          {transaction.productName}
                       </div>
                    </td>
                    <td className="px-4 py-3 text-[10px] text-neutral-500">{transaction.variation}</td>
                    <td className="px-4 py-3">
                       <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          transaction.flag === 'Paid' ? 'bg-[var(--primary-alpha-20)] text-[var(--primary-darker)]' :
                          transaction.flag === 'Pending' ? 'bg-yellow-100 text-yellow-700' :
                          transaction.flag === 'Cancelled' ? 'bg-red-100 text-red-700' : 'bg-[var(--primary-alpha-20)] text-[var(--primary-darker)]'
                       }`}>
                          {transaction.flag}
                       </span>
                    </td>
                    <td className="px-4 py-3 text-xs font-bold text-[var(--primary-dark)]">₹{transaction.amount.toFixed(2)}</td>
                    <td className="px-4 py-3 text-xs text-neutral-600 italic truncate max-w-[200px]" title={transaction.remark}>
                       {transaction.remark}
                    </td>
                    <td className="px-4 py-3 text-[11px] text-neutral-500 whitespace-nowrap">
                       {new Date(transaction.date).toLocaleDateString()} {new Date(transaction.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="p-4 border-t border-neutral-200 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="text-xs font-medium text-neutral-500">
            Showing {Math.min((currentPage - 1) * parseInt(perPage) + 1, totalEntries)} to {Math.min(currentPage * parseInt(perPage), totalEntries)} of {totalEntries} entries
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1 || loading}
              className={`px-3 py-1 border border-neutral-200 rounded text-xs font-bold transition-all ${
                currentPage === 1 ? 'text-neutral-300' : 'text-neutral-700 hover:bg-neutral-50 hover:border-[var(--primary-color)]'
              }`}
            >
              PREVIOUS
            </button>
            <div className="flex items-center gap-1 mx-2">
               {Array.from({ length: Math.min(5, Math.ceil(totalEntries / parseInt(perPage))) }, (_, i) => {
                  const pageNum = i + 1;
                  return (
                     <button
                        key={pageNum}
                        onClick={() => setCurrentPage(pageNum)}
                        className={`w-8 h-8 rounded text-xs font-bold transition-all ${
                           currentPage === pageNum ? 'bg-[var(--primary-color)] text-white shadow-md' : 'text-neutral-600 hover:bg-neutral-50'
                        }`}
                     >
                        {pageNum}
                     </button>
                  );
               })}
               {Math.ceil(totalEntries / parseInt(perPage)) > 5 && <span className="text-neutral-400">...</span>}
            </div>
            <button
              onClick={() => setCurrentPage(p => p + 1)}
              disabled={currentPage >= Math.ceil(totalEntries / parseInt(perPage)) || loading}
              className={`px-3 py-1 border border-neutral-200 rounded text-xs font-bold transition-all ${
                currentPage >= Math.ceil(totalEntries / parseInt(perPage)) ? 'text-neutral-300' : 'text-neutral-700 hover:bg-neutral-50 hover:border-[var(--primary-color)]'
              }`}
            >
              NEXT
            </button>
          </div>
        </div>
      </div>

      {/* Add Fund Transfer Modal */}
      {showAddFundModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full overflow-hidden border border-neutral-200 transition-all scale-100">
            <div className="p-4 border-b border-neutral-200 flex items-center justify-between" style={{ background: 'var(--primary-color)' }}>
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                 <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10"></circle>
                    <line x1="12" y1="8" x2="12" y2="16"></line>
                    <line x1="8" y1="12" x2="16" y2="12"></line>
                 </svg>
                 Add Fund Transfer
              </h3>
              <button
                onClick={handleCloseFundModal}
                className="text-white hover:text-neutral-200 transition-colors"
                disabled={submitting}
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </div>

            <form onSubmit={handleFundTransferSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-neutral-500 uppercase tracking-widest mb-1">
                  Select Seller <span className="text-red-500">*</span>
                </label>
                <select
                  value={fundTransferData.sellerId}
                  onChange={(e) => setFundTransferData({...fundTransferData, sellerId: e.target.value})}
                  required
                  disabled={submitting}
                  className="w-full px-4 py-2 bg-neutral-50 border border-neutral-200 rounded-lg outline-none text-sm focus:border-[var(--primary-color)] focus:ring-1 focus:ring-[var(--primary-color)] transition-all"
                >
                  <option value="">Select Seller</option>
                  {sellers.map(s => (
                    <option key={s._id} value={s._id}>{s.storeName} ({s.sellerName})</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-neutral-500 uppercase tracking-widest mb-1">
                    Amount (₹) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    value={fundTransferData.amount}
                    onChange={(e) => setFundTransferData({...fundTransferData, amount: e.target.value})}
                    required
                    disabled={submitting}
                    min="0"
                    step="0.01"
                    className="w-full px-4 py-2 bg-neutral-50 border border-neutral-200 rounded-lg outline-none text-sm focus:border-[var(--primary-color)] focus:ring-1 focus:ring-[var(--primary-color)] transition-all font-mono"
                    placeholder="0.00"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-neutral-500 uppercase tracking-widest mb-1">
                    Transfer Type <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={fundTransferData.type}
                    onChange={(e) => setFundTransferData({...fundTransferData, type: e.target.value})}
                    className="w-full px-4 py-2 bg-neutral-50 border border-neutral-200 rounded-lg outline-none text-sm focus:border-[var(--primary-color)] focus:ring-1 focus:ring-[var(--primary-color)] transition-all"
                    disabled={submitting}
                  >
                    <option value="Credit">Credit (+)</option>
                    <option value="Debit">Debit (-)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-neutral-500 uppercase tracking-widest mb-1">
                  Remark / Message
                </label>
                <textarea
                  value={fundTransferData.message}
                  onChange={(e) => setFundTransferData({...fundTransferData, message: e.target.value})}
                  rows={3}
                  disabled={submitting}
                  className="w-full px-4 py-2 bg-neutral-50 border border-neutral-200 rounded-lg outline-none text-sm resize-none focus:border-[var(--primary-color)] focus:ring-1 focus:ring-[var(--primary-color)] transition-all"
                  placeholder="Reason for manual adjustment..."
                />
              </div>

              <div className="flex gap-3 justify-end pt-4 border-t border-neutral-100">
                <button
                  type="button"
                  onClick={handleCloseFundModal}
                  disabled={submitting}
                  className="px-6 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-600 text-sm font-bold rounded-lg transition-colors"
                >
                  CANCEL
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-6 py-2 text-white text-sm font-bold rounded-lg transition-all shadow-lg hover:shadow-xl active:scale-95 flex items-center gap-2"
                  style={{ background: 'var(--primary-color)' }}
                >
                  {submitting ? (
                     <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        PROCESSING...
                     </>
                  ) : (
                     'CONFIRM TRANSFER'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
