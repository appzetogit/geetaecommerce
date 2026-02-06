import { useState } from "react";
import { useNavigate } from "react-router-dom";
import * as XLSX from 'xlsx';

interface WithdrawalRequest {
  id: number;
  amount: number;
  message: string;
  status: 'Pending' | 'Approved' | 'Rejected';
  remark: string;
  requestDate: string;
  paymentDate: string;
}

// Mock data
const MOCK_WITHDRAWALS: WithdrawalRequest[] = [
  {
    id: 1,
    amount: 5000.00,
    message: "Monthly withdrawal for business expenses",
    status: "Approved",
    remark: "Processed successfully",
    requestDate: "2026-02-01",
    paymentDate: "2026-02-03"
  },
  {
    id: 2,
    amount: 3000.00,
    message: "Urgent withdrawal needed",
    status: "Pending",
    remark: "Under review",
    requestDate: "2026-02-04",
    paymentDate: "-"
  },
  {
    id: 3,
    amount: 2500.00,
    message: "Regular monthly payout",
    status: "Approved",
    remark: "Payment completed",
    requestDate: "2026-01-28",
    paymentDate: "2026-01-30"
  },
  {
    id: 4,
    amount: 10000.00,
    message: "Large withdrawal for inventory purchase",
    status: "Rejected",
    remark: "Insufficient balance at the time",
    requestDate: "2026-01-25",
    paymentDate: "-"
  },
  {
    id: 5,
    amount: 1500.00,
    message: "Small withdrawal for operational costs",
    status: "Approved",
    remark: "Processed via UPI",
    requestDate: "2026-01-20",
    paymentDate: "2026-01-21"
  },
];

export default function SellerWithdrawalRequests() {
  const navigate = useNavigate();
  const [withdrawals, setWithdrawals] = useState<WithdrawalRequest[]>(MOCK_WITHDRAWALS);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [entriesPerPage, setEntriesPerPage] = useState(10);
  const [showModal, setShowModal] = useState(false);

  // Form state
  const [formAmount, setFormAmount] = useState("");
  const [formMessage, setFormMessage] = useState("");
  const [formBankAccount, setFormBankAccount] = useState("HDFC Bank - ****1234");

  // Filter withdrawals
  const filteredWithdrawals = withdrawals.filter((withdrawal) => {
    const matchesSearch =
      withdrawal.message.toLowerCase().includes(searchQuery.toLowerCase()) ||
      withdrawal.remark.toLowerCase().includes(searchQuery.toLowerCase()) ||
      withdrawal.status.toLowerCase().includes(searchQuery.toLowerCase());

    let matchesDate = true;
    if (fromDate && toDate) {
      const requestDate = new Date(withdrawal.requestDate);
      matchesDate = requestDate >= new Date(fromDate) && requestDate <= new Date(toDate);
    }

    return matchesSearch && matchesDate;
  });

  // Pagination
  const totalPages = Math.ceil(filteredWithdrawals.length / entriesPerPage);
  const startIndex = (currentPage - 1) * entriesPerPage;
  const endIndex = startIndex + entriesPerPage;
  const paginatedWithdrawals = filteredWithdrawals.slice(startIndex, endIndex);

  const handleExport = () => {
    const exportData = filteredWithdrawals.map(w => ({
      ID: w.id,
      Amount: w.amount,
      Message: w.message,
      Status: w.status,
      Remark: w.remark,
      'Request Date': w.requestDate,
      'Payment Date': w.paymentDate
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Withdrawals");
    XLSX.writeFile(workbook, `Withdrawal_Requests_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const handleClear = () => {
    setFromDate("");
    setToDate("");
    setSearchQuery("");
  };

  const handleSubmitRequest = () => {
    if (!formAmount || Number(formAmount) <= 0) {
      alert("Please enter a valid amount");
      return;
    }
    if (!formMessage.trim()) {
      alert("Please enter a message");
      return;
    }

    const newRequest: WithdrawalRequest = {
      id: withdrawals.length + 1,
      amount: Number(formAmount),
      message: formMessage,
      status: "Pending",
      remark: "Request submitted",
      requestDate: new Date().toISOString().split('T')[0],
      paymentDate: "-"
    };

    setWithdrawals([newRequest, ...withdrawals]);
    setShowModal(false);
    setFormAmount("");
    setFormMessage("");
    alert("Withdrawal request submitted successfully!");
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-neutral-800">View Withdrawal Request List</h1>
          <div className="text-sm text-neutral-600 mt-1">
            <span className="text-teal-600 hover:text-teal-700 cursor-pointer" onClick={() => navigate('/seller')}>Home</span>
            <span className="mx-2">/</span>
            <span className="text-teal-600 hover:text-teal-700 cursor-pointer" onClick={() => navigate('/seller/wallet')}>Wallet</span>
            <span className="mx-2">/</span>
            <span className="text-neutral-800">Withdrawal Requests</span>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="bg-white rounded-lg shadow-sm border border-neutral-200">
        {/* Header with Add Button */}
        <div className="p-4 sm:p-6 border-b border-neutral-200 bg-teal-600 flex items-center justify-between">
          <h2 className="text-lg font-bold text-white">View Withdrawal Request List</h2>
          <button
            onClick={() => setShowModal(true)}
            className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white text-sm font-bold rounded transition-colors flex items-center gap-2"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="12" y1="5" x2="12" y2="19"></line>
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
            Add Fund Request
          </button>
        </div>

        {/* Filters */}
        <div className="p-4 sm:p-6 border-b border-neutral-200 bg-neutral-50/30">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Date Range */}
            <div className="flex gap-2 items-center">
              <label className="text-neutral-700 text-sm font-medium whitespace-nowrap">From - To Date:</label>
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

            {/* Empty space for alignment */}
            <div></div>
          </div>

          {/* Second Row */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
            {/* Per Page */}
            <div className="flex gap-2 items-center">
              <label className="text-neutral-700 text-sm font-medium whitespace-nowrap">Per Page:</label>
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
              <label className="text-neutral-700 text-sm font-medium whitespace-nowrap">Search:</label>
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
          <table className="w-full text-left border-collapse min-w-[900px]">
            <thead>
              <tr className="bg-neutral-50 text-xs font-bold text-neutral-600 uppercase">
                <th className="p-4 border-b border-neutral-200">Id</th>
                <th className="p-4 border-b border-neutral-200">Amount</th>
                <th className="p-4 border-b border-neutral-200">Message</th>
                <th className="p-4 border-b border-neutral-200">Status</th>
                <th className="p-4 border-b border-neutral-200">Remark</th>
                <th className="p-4 border-b border-neutral-200">Req. Date</th>
                <th className="p-4 border-b border-neutral-200">Payment Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {paginatedWithdrawals.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-sm text-neutral-500">
                    No data available in table
                  </td>
                </tr>
              ) : (
                paginatedWithdrawals.map((withdrawal) => (
                  <tr key={withdrawal.id} className="hover:bg-neutral-50/50 transition-colors">
                    <td className="p-4 text-sm text-neutral-900">{withdrawal.id}</td>
                    <td className="p-4 text-sm font-bold text-neutral-900">₹{withdrawal.amount.toFixed(2)}</td>
                    <td className="p-4 text-sm text-neutral-900 max-w-xs truncate">{withdrawal.message}</td>
                    <td className="p-4">
                      <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                        withdrawal.status === 'Approved'
                          ? 'bg-green-100 text-green-700'
                          : withdrawal.status === 'Pending'
                          ? 'bg-yellow-100 text-yellow-700'
                          : 'bg-red-100 text-red-700'
                      }`}>
                        {withdrawal.status}
                      </span>
                    </td>
                    <td className="p-4 text-sm text-neutral-600">{withdrawal.remark}</td>
                    <td className="p-4 text-sm text-neutral-600">{new Date(withdrawal.requestDate).toLocaleDateString()}</td>
                    <td className="p-4 text-sm text-neutral-600">{withdrawal.paymentDate !== '-' ? new Date(withdrawal.paymentDate).toLocaleDateString() : '-'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="p-4 border-t border-neutral-200 flex items-center justify-between bg-neutral-50/30">
          <p className="text-xs text-neutral-500">
            Showing {startIndex + 1} to {Math.min(endIndex, filteredWithdrawals.length)} of {filteredWithdrawals.length} entries
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

      {/* Add Fund Request Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-neutral-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md animate-in zoom-in duration-200">
            {/* Modal Header */}
            <div className="bg-teal-600 px-6 py-4 flex justify-between items-center text-white rounded-t-2xl">
              <h3 className="text-lg font-bold">Add Fund Request</h3>
              <button
                onClick={() => setShowModal(false)}
                className="p-1.5 hover:bg-white/20 rounded-lg transition-colors"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-4">
              {/* Amount */}
              <div className="space-y-2">
                <label className="text-sm font-bold text-neutral-700">Amount *</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-500 font-bold">₹</span>
                  <input
                    type="number"
                    value={formAmount}
                    onChange={(e) => setFormAmount(e.target.value)}
                    placeholder="0.00"
                    className="w-full pl-8 pr-4 py-3 bg-white border border-neutral-300 rounded-lg focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none text-base"
                  />
                </div>
              </div>

              {/* Message */}
              <div className="space-y-2">
                <label className="text-sm font-bold text-neutral-700">Message *</label>
                <textarea
                  value={formMessage}
                  onChange={(e) => setFormMessage(e.target.value)}
                  placeholder="Enter your message..."
                  rows={4}
                  className="w-full px-4 py-3 bg-white border border-neutral-300 rounded-lg focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none text-base resize-none"
                />
              </div>

              {/* Bank Account */}
              <div className="space-y-2">
                <label className="text-sm font-bold text-neutral-700">Bank Account</label>
                <select
                  value={formBankAccount}
                  onChange={(e) => setFormBankAccount(e.target.value)}
                  className="w-full px-4 py-3 bg-white border border-neutral-300 rounded-lg focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none text-base"
                >
                  <option value="HDFC Bank - ****1234">HDFC Bank - ****1234</option>
                  <option value="SBI - ****5678">SBI - ****5678</option>
                  <option value="ICICI Bank - ****9012">ICICI Bank - ****9012</option>
                  <option value="Axis Bank - ****3456">Axis Bank - ****3456</option>
                </select>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-6 border-t border-neutral-200 flex gap-3">
              <button
                onClick={() => setShowModal(false)}
                className="flex-1 px-4 py-3 bg-neutral-200 hover:bg-neutral-300 text-neutral-800 font-bold rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmitRequest}
                className="flex-1 px-4 py-3 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-lg transition-colors"
              >
                Submit Request
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
