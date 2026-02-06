import { useState } from "react";

interface Transaction {
  id: number;
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

export default function AdminSellerTransaction() {
  const [fromDate, setFromDate] = useState("12/09/2025");
  const [toDate, setToDate] = useState("12/09/2025");
  const [filterBySeller, setFilterBySeller] = useState("All Seller");
  const [filterByMethod, setFilterByMethod] = useState("All");
  const [perPage, setPerPage] = useState("10");
  const [searchQuery, setSearchQuery] = useState("");
  const [showAddFundModal, setShowAddFundModal] = useState(false);
  const [sortColumn, setSortColumn] = useState<keyof Transaction | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  // Mock data - you can add some sample data here
  const [transactions, setTransactions] = useState<Transaction[]>([]);

  // Fund Transfer Form State
  const [fundTransferData, setFundTransferData] = useState({
    seller: "",
    amount: "",
    message: "",
    type: "Credit"
  });

  const handleClear = () => {
    setFromDate("");
    setToDate("");
    console.log("Dates cleared");
  };

  const handleExport = () => {
    // Create CSV content
    const headers = ["ID", "Seller Name", "Order ID", "Order Item ID", "Product Name", "Variation", "Flag", "Amount", "Remark", "Date"];
    const csvContent = [
      headers.join(","),
      ...transactions.map(t =>
        [t.id, t.sellerName, t.orderId, t.orderItemId, t.productName, t.variation, t.flag, t.amount, t.remark, t.date].join(",")
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

    console.log("Exported transactions to CSV");
  };

  const handleAddFundTransfer = () => {
    setShowAddFundModal(true);
  };

  const handleCloseFundModal = () => {
    setShowAddFundModal(false);
    setFundTransferData({
      seller: "",
      amount: "",
      message: "",
      type: "Credit"
    });
  };

  const handleFundTransferSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log("Fund Transfer Data:", fundTransferData);
    alert(`Fund Transfer ${fundTransferData.type}: ₹${fundTransferData.amount} to ${fundTransferData.seller}`);
    handleCloseFundModal();
  };

  const handleSort = (column: keyof Transaction) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  const filteredTransactions = transactions.filter(transaction => {
    // Filter by seller
    if (filterBySeller !== "All Seller" && transaction.sellerName !== filterBySeller) {
      return false;
    }

    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        transaction.sellerName.toLowerCase().includes(query) ||
        transaction.orderId.toLowerCase().includes(query) ||
        transaction.productName.toLowerCase().includes(query) ||
        transaction.remark.toLowerCase().includes(query)
      );
    }

    return true;
  });

  const sortedTransactions = [...filteredTransactions].sort((a, b) => {
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

  const paginatedTransactions = sortedTransactions.slice(0, parseInt(perPage));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-sm border border-neutral-200">
        <div className="p-4 border-b border-neutral-200 flex items-center justify-between" style={{ background: '#e91e63' }}>
          <h2 className="text-lg font-bold text-white">View Seller List</h2>
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {/* From - To Date */}
            <div className="lg:col-span-2 flex items-center gap-2">
              <label className="text-sm font-semibold text-neutral-700 whitespace-nowrap">
                From - To Date:
              </label>
              <div className="flex items-center gap-2 flex-1">
                <input
                  type="text"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  className="flex-1 px-3 py-2 border border-neutral-300 rounded outline-none text-sm"
                  placeholder="12/09/2025"
                />
                <span className="text-neutral-500">-</span>
                <input
                  type="text"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  className="flex-1 px-3 py-2 border border-neutral-300 rounded outline-none text-sm"
                  placeholder="12/09/2025"
                />
                <button
                  onClick={handleClear}
                  className="px-4 py-2 bg-neutral-800 text-white rounded hover:bg-neutral-900 transition-colors text-sm font-medium"
                >
                  Clear
                </button>
              </div>
            </div>

            {/* Filter by Seller */}
            <div className="flex items-center gap-2">
              <label className="text-sm font-semibold text-neutral-700 whitespace-nowrap">
                Filter by Seller:
              </label>
              <select
                value={filterBySeller}
                onChange={(e) => setFilterBySeller(e.target.value)}
                className="flex-1 px-3 py-2 border border-neutral-300 rounded outline-none text-sm"
              >
                <option value="All Seller">All Seller</option>
                <option value="Seller 1">Seller 1</option>
                <option value="Seller 2">Seller 2</option>
              </select>
            </div>

            {/* Filter by Method */}
            <div className="flex items-center gap-2">
              <label className="text-sm font-semibold text-neutral-700 whitespace-nowrap">
                Filter by Method:
              </label>
              <select
                value={filterByMethod}
                onChange={(e) => setFilterByMethod(e.target.value)}
                className="flex-1 px-3 py-2 border border-neutral-300 rounded outline-none text-sm"
              >
                <option value="All">All</option>
                <option value="Cash">Cash</option>
                <option value="Online">Online</option>
              </select>
            </div>
          </div>

          {/* Per Page, Export, Search */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <label className="text-sm font-semibold text-neutral-700">Per Page:</label>
              <select
                value={perPage}
                onChange={(e) => setPerPage(e.target.value)}
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
                style={{ background: '#e91e63' }}
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
                onChange={(e) => setSearchQuery(e.target.value)}
                className="px-3 py-2 border border-neutral-300 rounded outline-none text-sm"
                placeholder="Search..."
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
                  className="px-4 py-3 text-left text-xs font-bold text-neutral-700 uppercase tracking-wider cursor-pointer hover:bg-neutral-100">
                  ID
                  <svg className="inline-block ml-1 w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                  </svg>
                </th>
                <th
                  onClick={() => handleSort('sellerName')}
                  className="px-4 py-3 text-left text-xs font-bold text-neutral-700 uppercase tracking-wider cursor-pointer hover:bg-neutral-100">
                  SELLER NAME
                  <svg className="inline-block ml-1 w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                  </svg>
                </th>
                <th
                  onClick={() => handleSort('orderId')}
                  className="px-4 py-3 text-left text-xs font-bold text-neutral-700 uppercase tracking-wider cursor-pointer hover:bg-neutral-100">
                  ORDER ID
                  <svg className="inline-block ml-1 w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                  </svg>
                </th>
                <th
                  onClick={() => handleSort('orderItemId')}
                  className="px-4 py-3 text-left text-xs font-bold text-neutral-700 uppercase tracking-wider cursor-pointer hover:bg-neutral-100">
                  ORDER ITEM ID
                  <svg className="inline-block ml-1 w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                  </svg>
                </th>
                <th
                  onClick={() => handleSort('productName')}
                  className="px-4 py-3 text-left text-xs font-bold text-neutral-700 uppercase tracking-wider cursor-pointer hover:bg-neutral-100">
                  PRODUCT NAME
                  <svg className="inline-block ml-1 w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                  </svg>
                </th>
                <th
                  onClick={() => handleSort('variation')}
                  className="px-4 py-3 text-left text-xs font-bold text-neutral-700 uppercase tracking-wider cursor-pointer hover:bg-neutral-100">
                  VARIATION
                  <svg className="inline-block ml-1 w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                  </svg>
                </th>
                <th
                  onClick={() => handleSort('flag')}
                  className="px-4 py-3 text-left text-xs font-bold text-neutral-700 uppercase tracking-wider cursor-pointer hover:bg-neutral-100">
                  FLAG
                  <svg className="inline-block ml-1 w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                  </svg>
                </th>
                <th
                  onClick={() => handleSort('amount')}
                  className="px-4 py-3 text-left text-xs font-bold text-neutral-700 uppercase tracking-wider cursor-pointer hover:bg-neutral-100">
                  AMOUNT
                  <svg className="inline-block ml-1 w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                  </svg>
                </th>
                <th
                  onClick={() => handleSort('remark')}
                  className="px-4 py-3 text-left text-xs font-bold text-neutral-700 uppercase tracking-wider cursor-pointer hover:bg-neutral-100">
                  REMARK
                  <svg className="inline-block ml-1 w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                  </svg>
                </th>
                <th
                  onClick={() => handleSort('date')}
                  className="px-4 py-3 text-left text-xs font-bold text-neutral-700 uppercase tracking-wider cursor-pointer hover:bg-neutral-100">
                  DATE
                  <svg className="inline-block ml-1 w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                  </svg>
                </th>
              </tr>
            </thead>
            <tbody>
              {paginatedTransactions.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-4 py-8 text-center text-neutral-500 text-sm">
                    No data available in table
                  </td>
                </tr>
              ) : (
                paginatedTransactions.map((transaction) => (
                  <tr key={transaction.id} className="border-b border-neutral-200 hover:bg-neutral-50">
                    <td className="px-4 py-3 text-sm text-neutral-800">{transaction.id}</td>
                    <td className="px-4 py-3 text-sm text-neutral-800">{transaction.sellerName}</td>
                    <td className="px-4 py-3 text-sm text-neutral-800">{transaction.orderId}</td>
                    <td className="px-4 py-3 text-sm text-neutral-800">{transaction.orderItemId}</td>
                    <td className="px-4 py-3 text-sm text-neutral-800">{transaction.productName}</td>
                    <td className="px-4 py-3 text-sm text-neutral-800">{transaction.variation}</td>
                    <td className="px-4 py-3 text-sm text-neutral-800">{transaction.flag}</td>
                    <td className="px-4 py-3 text-sm text-neutral-800">₹{transaction.amount}</td>
                    <td className="px-4 py-3 text-sm text-neutral-800">{transaction.remark}</td>
                    <td className="px-4 py-3 text-sm text-neutral-800">{transaction.date}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="p-4 border-t border-neutral-200 flex items-center justify-between">
          <div className="text-sm text-neutral-600">
            Showing 1 to {paginatedTransactions.length} of {filteredTransactions.length} entries
          </div>
          <div className="flex items-center gap-2">
            <button
              disabled={paginatedTransactions.length === 0}
              className={`px-3 py-1 border border-neutral-300 rounded text-sm ${
                paginatedTransactions.length === 0
                  ? 'text-neutral-400 cursor-not-allowed'
                  : 'text-neutral-700 hover:bg-neutral-50'
              }`}
            >
              &lt;
            </button>
            <button
              disabled={paginatedTransactions.length === 0}
              className={`px-3 py-1 border border-neutral-300 rounded text-sm ${
                paginatedTransactions.length === 0
                  ? 'text-neutral-400 cursor-not-allowed'
                  : 'text-neutral-700 hover:bg-neutral-50'
              }`}
            >
              &gt;
            </button>
          </div>
        </div>
      </div>

      {/* Add Fund Transfer Modal */}
      {showAddFundModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="p-4 border-b border-neutral-200 flex items-center justify-between" style={{ background: '#e91e63' }}>
              <h3 className="text-lg font-bold text-white">Add Fund Transfer</h3>
              <button
                onClick={handleCloseFundModal}
                className="text-white hover:text-neutral-200"
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </div>

            <form onSubmit={handleFundTransferSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-bold text-neutral-700 mb-2">
                  Select Seller <span className="text-red-500">*</span>
                </label>
                <select
                  value={fundTransferData.seller}
                  onChange={(e) => setFundTransferData({...fundTransferData, seller: e.target.value})}
                  required
                  className="w-full px-3 py-2 border border-neutral-300 rounded outline-none text-sm"
                >
                  <option value="">Select Seller</option>
                  <option value="Seller 1">Seller 1</option>
                  <option value="Seller 2">Seller 2</option>
                  <option value="Seller 3">Seller 3</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-bold text-neutral-700 mb-2">
                  Amount <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  value={fundTransferData.amount}
                  onChange={(e) => setFundTransferData({...fundTransferData, amount: e.target.value})}
                  required
                  min="0"
                  step="0.01"
                  className="w-full px-3 py-2 border border-neutral-300 rounded outline-none text-sm"
                  placeholder="Enter amount"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-neutral-700 mb-2">
                  Type <span className="text-red-500">*</span>
                </label>
                <select
                  value={fundTransferData.type}
                  onChange={(e) => setFundTransferData({...fundTransferData, type: e.target.value})}
                  className="w-full px-3 py-2 border border-neutral-300 rounded outline-none text-sm"
                >
                  <option value="Credit">Credit</option>
                  <option value="Debit">Debit</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-bold text-neutral-700 mb-2">
                  Message
                </label>
                <textarea
                  value={fundTransferData.message}
                  onChange={(e) => setFundTransferData({...fundTransferData, message: e.target.value})}
                  rows={3}
                  className="w-full px-3 py-2 border border-neutral-300 rounded outline-none text-sm resize-none"
                  placeholder="Enter message (optional)"
                />
              </div>

              <div className="flex gap-3 justify-end pt-4">
                <button
                  type="button"
                  onClick={handleCloseFundModal}
                  className="px-4 py-2 bg-neutral-200 hover:bg-neutral-300 text-neutral-800 font-semibold rounded transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-white font-semibold rounded transition-opacity hover:opacity-90"
                  style={{ background: '#e91e63' }}
                >
                  Add Fund Transfer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
