import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import * as XLSX from 'xlsx';
import * as walletService from '../../../services/api/walletService';
import toast from 'react-hot-toast';

interface WithdrawalRequest {
  _id: string;
  amount: number;
  remarks: string;
  status: 'Pending' | 'Approved' | 'Rejected' | 'Completed';
  paymentMethod: string;
  accountDetails: string;
  createdAt: string;
  updatedAt: string;
}

export default function SellerWithdrawalRequests() {
  const navigate = useNavigate();
  const [withdrawals, setWithdrawals] = useState<WithdrawalRequest[]>([]);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [entriesPerPage, setEntriesPerPage] = useState(10);
  const [totalEntries, setTotalEntries] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);

  // Form state
  const [formAmount, setFormAmount] = useState("");
  const [formMessage, setFormMessage] = useState("");
  const [formMethod, setFormMethod] = useState<'Bank Transfer' | 'UPI'>('Bank Transfer');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Bank form state
  const [bankDetails, setBankDetails] = useState({
    accountHolderName: '',
    accountNumber: '',
    bankName: '',
    ifscCode: '',
  });

  // UPI form state
  const [upiId, setUpiId] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = {
        page: currentPage,
        limit: entriesPerPage,
        search: searchQuery || undefined,
        fromDate: fromDate || undefined,
        toDate: toDate || undefined,
      };

      const response = await walletService.getWithdrawalRequests(params);
      if (response.success) {
        setWithdrawals(response.data.requests);
        setTotalEntries(response.data.pagination.total);
        setTotalPages(response.data.pagination.pages);
      }
    } catch (err) {
      console.error('Error fetching withdrawal requests:', err);
    } finally {
      setLoading(false);
    }
  }, [currentPage, entriesPerPage, searchQuery, fromDate, toDate]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleExport = () => {
    const exportData = withdrawals.map(w => ({
      ID: w._id,
      Amount: w.amount,
      Message: w.remarks,
      Status: w.status,
      Method: w.paymentMethod,
      'Request Date': new Date(w.createdAt).toLocaleString(),
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
    setCurrentPage(1);
  };

  const handleSubmitRequest = async () => {
    if (!formAmount || Number(formAmount) <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }

    if (formMethod === 'Bank Transfer') {
      if (!bankDetails.accountHolderName || !bankDetails.accountNumber || !bankDetails.bankName || !bankDetails.ifscCode) {
        toast.error('Please fill all bank details');
        return;
      }
    } else if (formMethod === 'UPI') {
      if (!upiId) {
        toast.error('Please enter UPI ID');
        return;
      }
    }

    setIsSubmitting(true);
    try {
      let formattedDetails = '';
      if (formMethod === 'Bank Transfer') {
        formattedDetails = `A/C Holder: ${bankDetails.accountHolderName}, A/C No: ${bankDetails.accountNumber}, Bank: ${bankDetails.bankName}, IFSC: ${bankDetails.ifscCode}`;
      } else {
        formattedDetails = `UPI ID: ${upiId}`;
      }

      const response = await walletService.createWithdrawalRequest({
        amount: Number(formAmount),
        paymentMethod: formMethod,
        accountDetails: formattedDetails,
        remarks: formMessage
      });

      if (response.success) {
        toast.success("Withdrawal request submitted successfully!");
        setShowModal(false);
        setFormAmount("");
        setFormMessage("");
        setBankDetails({ accountHolderName: '', accountNumber: '', bankName: '', ifscCode: '' });
        setUpiId('');
        fetchData();
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to submit request");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-neutral-800">View Withdrawal Request List</h1>
          <div className="text-sm text-neutral-600 mt-1">
            <span className="text-[var(--primary-color)] hover:text-[var(--primary-dark)] cursor-pointer" onClick={() => navigate('/seller')}>Home</span>
            <span className="mx-2">/</span>
            <span className="text-[var(--primary-color)] hover:text-[var(--primary-dark)] cursor-pointer" onClick={() => navigate('/seller/wallet')}>Wallet</span>
            <span className="mx-2">/</span>
            <span className="text-neutral-800">Withdrawal Requests</span>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="bg-white rounded-lg shadow-sm border border-neutral-200">
        {/* Header with Add Button */}
        <div className="p-4 sm:p-6 border-b border-neutral-200 bg-[var(--primary-color)] flex items-center justify-between">
          <h2 className="text-lg font-bold text-white">View Withdrawal Request List</h2>
          <button
            onClick={() => setShowModal(true)}
            className="px-4 py-2 bg-white text-[var(--primary-color)] hover:bg-neutral-50 text-sm font-bold rounded transition-colors flex items-center gap-2"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="12" y1="5" x2="12" y2="19"></line>
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
            New Withdrawal Request
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
                className="px-4 py-2 bg-[var(--primary-color)] hover:bg-[var(--primary-dark)] text-white text-sm font-medium rounded transition-colors flex items-center gap-2 w-full md:w-auto justify-center"
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
                className="flex-1 px-3 py-2 bg-white border border-neutral-300 rounded text-sm focus:ring-2 focus:ring-[var(--primary-color)]/20 focus:border-[var(--primary-color)] outline-none"
              />
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[900px]">
            <thead>
              <tr className="bg-neutral-50 text-xs font-bold text-neutral-600 uppercase">
                <th className="p-4 border-b border-neutral-200">Date</th>
                <th className="p-4 border-b border-neutral-200">Amount</th>
                <th className="p-4 border-b border-neutral-200">Method</th>
                <th className="p-4 border-b border-neutral-200">Status</th>
                <th className="p-4 border-b border-neutral-200">Remark</th>
                <th className="p-4 border-b border-neutral-200">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-sm text-neutral-500">
                    <div className="flex items-center justify-center gap-2">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-[var(--primary-color)]"></div>
                      <span>Loading requests...</span>
                    </div>
                  </td>
                </tr>
              ) : withdrawals.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-sm text-neutral-500">
                    No data available in table
                  </td>
                </tr>
              ) : (
                withdrawals.map((withdrawal) => (
                  <tr key={withdrawal._id} className="hover:bg-neutral-50/50 transition-colors">
                    <td className="p-4 text-sm text-neutral-600">{new Date(withdrawal.createdAt).toLocaleDateString()}</td>
                    <td className="p-4 text-sm font-bold text-neutral-900">₹{withdrawal.amount.toFixed(2)}</td>
                    <td className="p-4 text-sm text-neutral-900">{withdrawal.paymentMethod}</td>
                    <td className="p-4">
                      <span className={`px-3 py-1 rounded-full text-[10px] font-bold ${
                        withdrawal.status === 'Approved' || withdrawal.status === 'Completed'
                          ? 'bg-[var(--primary-alpha-20)] text-[var(--primary-darker)]'
                          : withdrawal.status === 'Pending'
                          ? 'bg-yellow-50 text-yellow-700'
                          : 'bg-red-50 text-red-600'
                      }`}>
                        {withdrawal.status}
                      </span>
                    </td>
                    <td className="p-4 text-sm text-neutral-600 truncate max-w-[200px]">{withdrawal.remarks || '-'}</td>
                    <td className="p-4 text-xs text-neutral-500 font-mono truncate max-w-[200px]">{withdrawal.accountDetails}</td>
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

      {/* Add Fund Request Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-neutral-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md animate-in zoom-in duration-200">
            {/* Modal Header */}
            <div className="bg-[var(--primary-color)] px-6 py-4 flex justify-between items-center text-white rounded-t-2xl">
              <h3 className="text-lg font-bold">New Withdrawal Request</h3>
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
                    className="w-full pl-8 pr-4 py-3 bg-white border border-neutral-300 rounded-lg focus:ring-2 focus:ring-[var(--primary-color)]/20 focus:border-[var(--primary-color)] outline-none text-base"
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
                  className="w-full px-4 py-3 bg-white border border-neutral-300 rounded-lg focus:ring-2 focus:ring-[var(--primary-color)]/20 focus:border-[var(--primary-color)] outline-none text-base resize-none"
                />
              </div>

              {/* Method Selection */}
              <div className="space-y-2">
                <label className="text-sm font-bold text-neutral-700">Select Method</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setFormMethod('Bank Transfer')}
                    className={`flex items-center justify-center gap-2 p-2.5 border-2 rounded-xl transition-all ${formMethod === 'Bank Transfer' ? 'border-[var(--primary-color)] bg-[var(--primary-color)]/5 text-[var(--primary-color)]' : 'border-neutral-100 bg-white text-neutral-500'}`}>
                    <span className="text-xs font-bold">Bank Transfer</span>
                  </button>
                  <button
                    onClick={() => setFormMethod('UPI')}
                    className={`flex items-center justify-center gap-2 p-2.5 border-2 rounded-xl transition-all ${formMethod === 'UPI' ? 'border-[var(--primary-color)] bg-[var(--primary-color)]/5 text-[var(--primary-color)]' : 'border-neutral-100 bg-white text-neutral-500'}`}>
                    <span className="text-xs font-bold">UPI</span>
                  </button>
                </div>
              </div>


              {/* Dynamic Details Fields */}
              <div className="space-y-3 pt-2 animate-in slide-in-from-top-2 duration-300">
                {formMethod === 'Bank Transfer' ? (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">Holder Name</label>
                        <input
                          type="text"
                          value={bankDetails.accountHolderName}
                          onChange={(e) => setBankDetails({ ...bankDetails, accountHolderName: e.target.value })}
                          placeholder="John Doe"
                          className="w-full px-3 py-2 bg-white border border-neutral-200 rounded-lg focus:ring-2 focus:ring-[var(--primary-color)]/20 focus:border-[var(--primary-color)] outline-none text-xs font-semibold shadow-sm"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">A/C Number</label>
                        <input
                          type="text"
                          value={bankDetails.accountNumber}
                          onChange={(e) => setBankDetails({ ...bankDetails, accountNumber: e.target.value })}
                          placeholder="000011112222"
                          className="w-full px-3 py-2 bg-white border border-neutral-200 rounded-lg focus:ring-2 focus:ring-[var(--primary-color)]/20 focus:border-[var(--primary-color)] outline-none text-xs font-semibold shadow-sm"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">Bank Name</label>
                        <input
                          type="text"
                          value={bankDetails.bankName}
                          onChange={(e) => setBankDetails({ ...bankDetails, bankName: e.target.value })}
                          placeholder="HDFC Bank"
                          className="w-full px-3 py-2 bg-white border border-neutral-200 rounded-lg focus:ring-2 focus:ring-[var(--primary-color)]/20 focus:border-[var(--primary-color)] outline-none text-xs font-semibold shadow-sm"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">IFSC Code</label>
                        <input
                          type="text"
                          value={bankDetails.ifscCode}
                          onChange={(e) => setBankDetails({ ...bankDetails, ifscCode: e.target.value })}
                          placeholder="HDFC0000"
                          className="w-full px-3 py-2 bg-white border border-neutral-200 rounded-lg focus:ring-2 focus:ring-[var(--primary-color)]/20 focus:border-[var(--primary-color)] outline-none text-xs font-bold text-[var(--primary-color)] uppercase shadow-sm"
                        />
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider ml-1">UPI ID (VPA)</label>
                    <div className="relative">
                      <input
                        type="text"
                        value={upiId}
                        onChange={(e) => setUpiId(e.target.value)}
                        placeholder="yourname@upi"
                        className="w-full pl-4 pr-10 py-2.5 bg-white border border-neutral-200 rounded-lg focus:ring-2 focus:ring-[var(--primary-color)]/20 focus:border-[var(--primary-color)] outline-none text-sm font-bold text-neutral-900 shadow-sm"
                      />
                    </div>
                  </div>
                )}

              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-6 border-t border-neutral-200 flex gap-3">
              <button
                onClick={() => setShowModal(false)}
                className="flex-1 px-4 py-3 bg-neutral-200 hover:bg-neutral-300 text-neutral-800 font-bold rounded-lg transition-colors"
                disabled={isSubmitting}
              >
                Cancel
              </button>
              <button
                onClick={handleSubmitRequest}
                className="flex-1 px-4 py-3 bg-[var(--primary-color)] hover:bg-[var(--primary-dark)] text-white font-bold rounded-lg transition-colors flex items-center justify-center gap-2"
                disabled={isSubmitting}
              >
                {isSubmitting && <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                {isSubmitting ? 'Submitting...' : 'Submit Request'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
