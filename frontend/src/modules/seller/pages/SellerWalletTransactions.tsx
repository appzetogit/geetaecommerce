import { useState } from "react";
import { useNavigate } from "react-router-dom";
import * as XLSX from 'xlsx';

interface Transaction {
  id: number;
  sellerName: string;
  orderId: string;
  productName: string;
  variation: string;
  flag: 'Credit' | 'Debit';
  amount: number;
  remark: string;
  date: string;
}

// Mock data
const MOCK_TRANSACTIONS: Transaction[] = [
  {
    id: 1,
    sellerName: "Geeta Stores",
    orderId: "#ORD12345",
    productName: "Samsung Galaxy S23 Ultra",
    variation: "256GB, Black",
    flag: "Credit",
    amount: 2500.00,
    remark: "Order Payment Received",
    date: "2026-02-03"
  },
  {
    id: 2,
    sellerName: "Geeta Stores",
    orderId: "#ORD12346",
    productName: "Apple iPhone 15 Pro",
    variation: "512GB, Blue",
    flag: "Credit",
    amount: 4500.00,
    remark: "Order Payment Received",
    date: "2026-02-02"
  },
  {
    id: 3,
    sellerName: "Geeta Stores",
    orderId: "#WD001",
    productName: "-",
    variation: "-",
    flag: "Debit",
    amount: 1000.00,
    remark: "Withdrawal Request Processed",
    date: "2026-02-01"
  },
  {
    id: 4,
    sellerName: "Geeta Stores",
    orderId: "#ORD12347",
    productName: "Sony WH-1000XM5 Headphones",
    variation: "Black",
    flag: "Credit",
    amount: 850.50,
    remark: "Order Payment Received",
    date: "2026-01-31"
  },
  {
    id: 5,
    sellerName: "Geeta Stores",
    orderId: "#FEE001",
    productName: "-",
    variation: "-",
    flag: "Debit",
    amount: 125.00,
    remark: "Platform Commission Fee",
    date: "2026-01-30"
  },
  {
    id: 6,
    sellerName: "Geeta Stores",
    orderId: "#ORD12348",
    productName: "Dell XPS 15 Laptop",
    variation: "i7, 16GB RAM",
    flag: "Credit",
    amount: 7200.00,
    remark: "Order Payment Received",
    date: "2026-01-29"
  },
];

export default function SellerWalletTransactions() {
  const navigate = useNavigate();
  const [transactions] = useState<Transaction[]>(MOCK_TRANSACTIONS);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [filterMethod, setFilterMethod] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [entriesPerPage, setEntriesPerPage] = useState(10);

  // Filter transactions
  const filteredTransactions = transactions.filter((transaction) => {
    const matchesFilter = filterMethod === "All" || transaction.flag === filterMethod;
    const matchesSearch =
      transaction.orderId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      transaction.productName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      transaction.remark.toLowerCase().includes(searchQuery.toLowerCase());

    let matchesDate = true;
    if (fromDate && toDate) {
      const transactionDate = new Date(transaction.date);
      matchesDate = transactionDate >= new Date(fromDate) && transactionDate <= new Date(toDate);
    }

    return matchesFilter && matchesSearch && matchesDate;
  });

  // Pagination
  const totalPages = Math.ceil(filteredTransactions.length / entriesPerPage);
  const startIndex = (currentPage - 1) * entriesPerPage;
  const endIndex = startIndex + entriesPerPage;
  const paginatedTransactions = filteredTransactions.slice(startIndex, endIndex);

  const handleExport = () => {
    const exportData = filteredTransactions.map(t => ({
      ID: t.id,
      'Seller Name': t.sellerName,
      'Order ID': t.orderId,
      'Product Name': t.productName,
      Variation: t.variation,
      Flag: t.flag,
      Amount: t.amount,
      Remark: t.remark,
      Date: t.date
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
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-neutral-800">View Transaction List</h1>
          <div className="text-sm text-neutral-600 mt-1">
            <span className="text-teal-600 hover:text-teal-700 cursor-pointer" onClick={() => navigate('/seller')}>Home</span>
            <span className="mx-2">/</span>
            <span className="text-teal-600 hover:text-teal-700 cursor-pointer" onClick={() => navigate('/seller/wallet')}>Wallet</span>
            <span className="mx-2">/</span>
            <span className="text-neutral-800">Transactions</span>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="bg-white rounded-lg shadow-sm border border-neutral-200">
        {/* Filters */}
        <div className="p-4 sm:p-6 border-b border-neutral-200 bg-teal-600">
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
                  className="flex-1 px-3 py-2 bg-white border border-neutral-300 rounded text-sm focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none"
                />
                <input
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  className="flex-1 px-3 py-2 bg-white border border-neutral-300 rounded text-sm focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none"
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
                className="flex-1 px-3 py-2 bg-white border border-neutral-300 rounded text-sm focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none"
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
                className="flex-1 px-3 py-2 bg-white border border-neutral-300 rounded text-sm focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none"
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
                className="flex-1 px-3 py-2 bg-white border border-neutral-300 rounded text-sm focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none"
              />
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[1000px]">
            <thead>
              <tr className="bg-neutral-50 text-xs font-bold text-neutral-600 uppercase">
                <th className="p-4 border-b border-neutral-200">Id</th>
                <th className="p-4 border-b border-neutral-200">Seller Name</th>
                <th className="p-4 border-b border-neutral-200">Order Id</th>
                <th className="p-4 border-b border-neutral-200">Product Name</th>
                <th className="p-4 border-b border-neutral-200">Variation</th>
                <th className="p-4 border-b border-neutral-200">Flag</th>
                <th className="p-4 border-b border-neutral-200">Amount</th>
                <th className="p-4 border-b border-neutral-200">Remark</th>
                <th className="p-4 border-b border-neutral-200">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {paginatedTransactions.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-8 text-center text-sm text-neutral-500">
                    No data available in table
                  </td>
                </tr>
              ) : (
                paginatedTransactions.map((transaction) => (
                  <tr key={transaction.id} className="hover:bg-neutral-50/50 transition-colors">
                    <td className="p-4 text-sm text-neutral-900">{transaction.id}</td>
                    <td className="p-4 text-sm text-neutral-900">{transaction.sellerName}</td>
                    <td className="p-4 text-sm font-medium text-teal-600">{transaction.orderId}</td>
                    <td className="p-4 text-sm text-neutral-900">{transaction.productName}</td>
                    <td className="p-4 text-sm text-neutral-600">{transaction.variation}</td>
                    <td className="p-4">
                      <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                        transaction.flag === 'Credit'
                          ? 'bg-green-100 text-green-700'
                          : 'bg-red-100 text-red-700'
                      }`}>
                        {transaction.flag}
                      </span>
                    </td>
                    <td className={`p-4 text-sm font-bold ${
                      transaction.flag === 'Credit' ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {transaction.flag === 'Credit' ? '+' : '-'} ₹{transaction.amount.toFixed(2)}
                    </td>
                    <td className="p-4 text-sm text-neutral-600">{transaction.remark}</td>
                    <td className="p-4 text-sm text-neutral-600">{new Date(transaction.date).toLocaleDateString()}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="p-4 border-t border-neutral-200 flex items-center justify-between bg-neutral-50/30">
          <p className="text-xs text-neutral-500">
            Showing {startIndex + 1} to {Math.min(endIndex, filteredTransactions.length)} of {filteredTransactions.length} entries
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
