import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import * as XLSX from 'xlsx';
import * as walletService from '../../../services/api/walletService';

interface Transaction {
  _id: string;
  sellerId: {
    storeName: string;
  };
  amount: number;
  type: 'Credit' | 'Debit';
  description: string;
  status: 'Completed' | 'Pending' | 'Failed';
  reference: string;
  createdAt: string;
}

export default function SellerWalletTransactions() {
  const navigate = useNavigate();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [filterMethod, setFilterMethod] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [entriesPerPage, setEntriesPerPage] = useState(10);
  const [loading, setLoading] = useState(false);
  const [totalEntries, setTotalEntries] = useState(0);
  const [totalPages, setTotalPages] = useState(0);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = {
        page: currentPage,
        limit: entriesPerPage,
        type: filterMethod === 'All' ? undefined : filterMethod,
        searchQuery: searchQuery || undefined,
        fromDate: fromDate || undefined,
        toDate: toDate || undefined,
      };

      const response = await walletService.getWalletTransactions(params);
      if (response.success) {
        setTransactions(response.data.transactions);
        setTotalEntries(response.data.pagination.total);
        setTotalPages(response.data.pagination.pages);
      }
    } catch (err) {
      console.error('Error fetching transactions:', err);
    } finally {
      setLoading(false);
    }
  }, [currentPage, entriesPerPage, filterMethod, searchQuery, fromDate, toDate]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleExport = () => {
    const exportData = transactions.map(t => ({
      ID: t._id,
      'Seller Name': (t.sellerId as any)?.storeName || 'N/A',
      'Type': t.type,
      Amount: t.amount,
      Description: t.description,
      Reference: t.reference,
      Status: t.status,
      Date: new Date(t.createdAt).toLocaleString()
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Transactions");
    XLSX.writeFile(workbook, `Wallet_Transactions_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const handleClear = () => {
    setFromDate("");
    setToDate("");
    setFilterMethod("All");
    setSearchQuery("");
    setCurrentPage(1);
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-neutral-800">View Transaction List</h1>
          <div className="text-sm text-neutral-600 mt-1">
            <span className="text-[var(--primary-color)] hover:text-[var(--primary-dark)] cursor-pointer" onClick={() => navigate('/seller')}>Home</span>
            <span className="mx-2">/</span>
            <span className="text-[var(--primary-color)] hover:text-[var(--primary-dark)] cursor-pointer" onClick={() => navigate('/seller/wallet')}>Wallet</span>
            <span className="mx-2">/</span>
            <span className="text-neutral-800">Transactions</span>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="bg-white rounded-lg shadow-sm border border-neutral-200">
        {/* Filters */}
        <div className="p-4 sm:p-6 border-b border-neutral-200 bg-[var(--primary-color)]">
          <h2 className="text-lg font-bold text-white mb-4">View Transaction List</h2>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Date Range */}
            <div className="md:col-span-2 flex gap-2 items-center">
              <label className="text-white text-sm font-medium whitespace-nowrap">From - To Date:</label>
              <div className="flex gap-2 flex-1">
                <input
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  className="flex-1 px-3 py-2 bg-white border border-neutral-300 rounded text-sm focus:ring-2 focus:ring-[var(--primary-color)]/20 focus:border-[var(--primary-color)] outline-none"
                />
                <input
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  className="flex-1 px-3 py-2 bg-white border border-neutral-300 rounded text-sm focus:ring-2 focus:ring-[var(--primary-color)]/20 focus:border-[var(--primary-color)] outline-none"
                />
              </div>
            </div>

            {/* Clear Button */}
            <div className="flex items-end">
              <button
                onClick={handleClear}
                className="px-4 py-2 bg-neutral-800 hover:bg-neutral-900 text-white text-sm font-medium rounded transition-colors w-full md:w-auto"
              >
                Clear
              </button>
            </div>

            {/* Filter Method */}
            <div className="flex gap-2 items-center">
              <label className="text-white text-sm font-medium whitespace-nowrap">Filter by Method:</label>
              <select
                value={filterMethod}
                onChange={(e) => setFilterMethod(e.target.value)}
                className="flex-1 px-3 py-2 bg-white border border-neutral-300 rounded text-sm focus:ring-2 focus:ring-[var(--primary-color)]/20 focus:border-[var(--primary-color)] outline-none"
              >
                <option value="All">All</option>
                <option value="Credit">Credit</option>
                <option value="Debit">Debit</option>
              </select>
            </div>
          </div>

          {/* Second Row */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
            {/* Per Page */}
            <div className="flex gap-2 items-center">
              <label className="text-white text-sm font-medium whitespace-nowrap">Per Page:</label>
              <select
                value={entriesPerPage}
                onChange={(e) => setEntriesPerPage(Number(e.target.value))}
                className="flex-1 px-3 py-2 bg-white border border-neutral-300 rounded text-sm focus:ring-2 focus:ring-[var(--primary-color)]/20 focus:border-[var(--primary-color)] outline-none"
              >
                <option value="10">10</option>
                <option value="25">25</option>
                <option value="50">50</option>
                <option value="100">100</option>
              </select>
            </div>

            {/* Export Button */}
            <div className="flex items-end">
              <button
                onClick={handleExport}
                className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium rounded transition-colors flex items-center gap-2 w-full md:w-auto justify-center"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                  <polyline points="7 10 12 15 17 10"></polyline>
                  <line x1="12" y1="15" x2="12" y2="3"></line>
                </svg>
                Export
              </button>
            </div>

            {/* Search */}
            <div className="flex gap-2 items-center">
              <label className="text-white text-sm font-medium whitespace-nowrap">Search:</label>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search..."
                className="flex-1 px-3 py-2 bg-white border border-neutral-300 rounded text-sm focus:ring-2 focus:ring-[var(--primary-color)]/20 focus:border-[var(--primary-color)] outline-none"
              />
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[1000px]">
            <thead>
              <tr className="bg-neutral-50 text-xs font-bold text-neutral-600 uppercase">
                <th className="p-4 border-b border-neutral-200">Date</th>
                <th className="p-4 border-b border-neutral-200">Description</th>
                <th className="p-4 border-b border-neutral-200">Reference</th>
                <th className="p-4 border-b border-neutral-200">Type</th>
                <th className="p-4 border-b border-neutral-200">Amount</th>
                <th className="p-4 border-b border-neutral-200">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-sm text-neutral-500">
                    <div className="flex items-center justify-center gap-2">
                       <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-[var(--primary-color)]"></div>
                       <span>Loading transactions...</span>
                    </div>
                  </td>
                </tr>
              ) : transactions.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-sm text-neutral-500">
                    No data available in table
                  </td>
                </tr>
              ) : (
                transactions.map((transaction) => (
                  <tr key={transaction._id} className="hover:bg-neutral-50/50 transition-colors">
                    <td className="p-4 text-sm text-neutral-600">{new Date(transaction.createdAt).toLocaleString()}</td>
                    <td className="p-4 text-sm font-medium text-neutral-900">{transaction.description}</td>
                    <td className="p-4 text-xs font-mono text-neutral-400">{transaction.reference}</td>
                    <td className="p-4">
                      <span className={`px-3 py-1 rounded-full text-[10px] font-bold ${
                        transaction.type === 'Credit'
                          ? 'bg-[var(--primary-alpha-20)] text-[var(--primary-darker)]'
                          : 'bg-red-100 text-red-700'
                      }`}>
                        {transaction.type}
                      </span>
                    </td>
                    <td className={`p-4 text-sm font-bold ${
                      transaction.type === 'Credit' ? 'text-[var(--primary-dark)]' : 'text-red-600'
                    }`}>
                      {transaction.type === 'Credit' ? '+' : '-'} ₹{transaction.amount.toFixed(2)}
                    </td>
                    <td className="p-4">
                       <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
                         transaction.status === 'Completed' ? 'bg-[var(--primary-color)]/10 text-[var(--primary-color)]' :
                         transaction.status === 'Pending' ? 'bg-yellow-50 text-yellow-700' : 'bg-red-50 text-red-700'
                       }`}>
                         {transaction.status}
                       </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="p-4 border-t border-neutral-200 flex items-center justify-between bg-neutral-50/30">
          <p className="text-xs text-neutral-500">
            Showing {(currentPage - 1) * entriesPerPage + 1} to {Math.min(currentPage * entriesPerPage, totalEntries)} of {totalEntries} entries
          </p>
          <div className="flex gap-2">
            <button
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(p => p - 1)}
              className="px-3 py-1.5 border border-neutral-300 rounded-md text-xs font-medium bg-white hover:bg-neutral-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Previous
            </button>
            <button
              disabled={currentPage === totalPages || totalPages === 0}
              onClick={() => setCurrentPage(p => p + 1)}
              className="px-3 py-1.5 border border-neutral-300 rounded-md text-xs font-medium bg-white hover:bg-neutral-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
