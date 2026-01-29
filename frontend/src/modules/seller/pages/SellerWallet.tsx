import { useState, useMemo, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import * as walletService from '../../../services/api/walletService';
import ThemedDropdown from '../components/ThemedDropdown';
import ThemedDatePicker from '../components/ThemedDatePicker';

type TabType = 'transaction' | 'withdraw' | 'earning';

interface Transaction {
  _id: string;
  type: 'Credit' | 'Debit';
  amount: number;
  description: string;
  createdAt: string;
  status: 'Completed' | 'Pending' | 'Failed';
  reference: string;
}

interface WithdrawRequest {
  _id: string;
  amount: number;
  createdAt: string;
  status: 'Pending' | 'Approved' | 'Rejected' | 'Completed';
  paymentMethod: string;
  accountDetails: string;
  remarks?: string;
}

interface Earning {
  id: string;
  orderId: string;
  source: string;
  amount: number;
  commission: number;
  netEarning: number;
  date: string;
  status: 'Settled' | 'Pending';
}

export default function SellerWallet() {
  const navigate = useNavigate();

  // EARLY RETURN TO HIDE PAGE CONTENT
  return (
    <div className="flex items-center justify-center min-h-[400px]">
        <p className="text-neutral-500 text-lg font-medium">Wallet feature is currently disabled.</p>
    </div>
  );

  // The rest of the logic is preserved below and can be restored by removing the return above
  const [activeTab, setActiveTab] = useState<TabType>('transaction');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [currentPage, setCurrentPage] = useState(1);
  const [entriesPerPage, setEntriesPerPage] = useState(10);
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);

  // Real stats state
  const [stats, setStats] = useState({
    availableBalance: 0,
    totalEarnings: 0,
    pendingSettlement: 0,
    totalWithdrawn: 0,
  });

  // Data states
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [withdrawRequests, setWithdrawRequests] = useState<WithdrawRequest[]>([]);
  const [earnings, setEarnings] = useState<Earning[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totalPages, setTotalPages] = useState(1);
  const [totalEntries, setTotalEntries] = useState(0);

  // Withdrawal form state
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [withdrawMethod, setWithdrawMethod] = useState<'Bank Transfer' | 'UPI'>('Bank Transfer');
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

  const fetchStats = async () => {
    try {
      const response = await walletService.getWalletStats();
      if (response.success) {
        setStats(response.data);
      }
    } catch (err) {
      console.error('Error fetching wallet stats:', err);
    }
  };

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = {
        page: currentPage,
        limit: entriesPerPage,
        status: statusFilter === 'All' ? undefined : statusFilter,
        searchQuery: searchQuery || undefined,
        fromDate: fromDate || undefined,
        toDate: toDate || undefined,
      };

      let response;
      if (activeTab === 'transaction') {
        response = await walletService.getWalletTransactions(params);
        if (response.success) {
          setTransactions(response.data.transactions);
          setTotalPages(response.data.pagination.pages);
          setTotalEntries(response.data.pagination.total);
        }
      } else if (activeTab === 'withdraw') {
        response = await walletService.getWithdrawalRequests(params);
        if (response.success) {
          setWithdrawRequests(response.data.requests);
          setTotalPages(response.data.pagination.pages);
          setTotalEntries(response.data.pagination.total);
        }
      } else if (activeTab === 'earning') {
        response = await walletService.getOrderEarnings(params);
        if (response.success) {
          setEarnings(response.data.earnings);
          setTotalPages(response.data.pagination.pages);
          setTotalEntries(response.data.pagination.total);
        }
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to fetch wallet data');
    } finally {
      setLoading(false);
    }
  }, [activeTab, currentPage, entriesPerPage, statusFilter, searchQuery, fromDate, toDate]);

  useEffect(() => {
    fetchStats();
    fetchData();
  }, [fetchData]);

  const handleWithdrawSubmit = async () => {
    if (!withdrawAmount || Number(withdrawAmount) <= 0) {
      alert('Please enter a valid amount');
      return;
    }

    if (Number(withdrawAmount) > stats.availableBalance) {
      alert('Insufficient balance');
      return;
    }

    if (withdrawMethod === 'Bank Transfer') {
      if (!bankDetails.accountHolderName || !bankDetails.accountNumber || !bankDetails.bankName || !bankDetails.ifscCode) {
        alert('Please fill all bank details');
        return;
      }
    } else if (withdrawMethod === 'UPI') {
      if (!upiId) {
        alert('Please enter UPI ID');
        return;
      }
    }

    setIsSubmitting(true);
    try {
      let formattedDetails = '';
      if (withdrawMethod === 'Bank Transfer') {
        formattedDetails = `A/C Holder: ${bankDetails.accountHolderName}, A/C No: ${bankDetails.accountNumber}, Bank: ${bankDetails.bankName}, IFSC: ${bankDetails.ifscCode}`;
      } else {
        formattedDetails = `UPI ID: ${upiId}`;
      }

      const response = await walletService.createWithdrawalRequest({
        amount: Number(withdrawAmount),
        paymentMethod: withdrawMethod,
        accountDetails: formattedDetails,
      });

      if (response.success) {
        alert('Withdrawal request submitted successfully!');
        setShowWithdrawModal(false);
        setWithdrawAmount('');
        fetchStats();
        fetchData();
      }
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to submit withdrawal request');
    } finally {
      setIsSubmitting(false);
    }
  };

  const displayedData = useMemo(() => {
    if (activeTab === 'transaction') return transactions;
    if (activeTab === 'withdraw') return withdrawRequests;
    if (activeTab === 'earning') return earnings;
    return [];
  }, [activeTab, transactions, withdrawRequests, earnings]);
  const tabs = [
    { id: 'transaction' as TabType, label: 'Transactions', icon: '💳' },
    { id: 'withdraw' as TabType, label: 'Withdrawal Requests', icon: '💰' },
    { id: 'earning' as TabType, label: 'Order Earnings', icon: '📈' },
  ];

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-neutral-800">My Wallet</h1>
          <div className="text-sm text-neutral-600">
            <span className="text-teal-600 hover:text-teal-700 cursor-pointer" onClick={() => navigate('/seller')}>Home</span>
            <span className="mx-2">/</span>
            <span className="text-neutral-800">Wallet</span>
          </div>
        </div>
        {loading && <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-teal-600"></div>}
        <button
          onClick={() => setShowWithdrawModal(true)}
          className="bg-teal-600 hover:bg-teal-700 text-white px-6 py-2.5 rounded-lg font-semibold shadow-sm transition-all flex items-center gap-2"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
            <polyline points="17 8 12 3 7 8"></polyline>
            <line x1="12" y1="3" x2="12" y2="15"></line>
          </svg>
          Withdraw Money
        </button>
      </div>

      {/* Summary Cards (Admin Inspired Gradients) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        <div className="bg-gradient-to-br from-teal-600 to-teal-700 rounded-lg shadow-lg p-6 text-white transition-transform hover:scale-[1.02]">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-teal-100">Available Balance</h3>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="5" width="20" height="14" rx="2" />
              <line x1="2" y1="10" x2="22" y2="10" />
            </svg>
          </div>
          <p className="text-3xl font-bold">₹{stats.availableBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
          <p className="text-xs text-teal-100 mt-1">Ready to withdraw</p>
        </div>

        <div className="bg-gradient-to-br from-green-600 to-green-700 rounded-lg shadow-lg p-6 text-white transition-transform hover:scale-[1.02]">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-green-100">Total Earnings</h3>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M23 6l-9.5 9.5-5-5L1 18" />
              <path d="M17 6h6v6" />
            </svg>
          </div>
          <p className="text-3xl font-bold">₹{stats.totalEarnings.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
          <p className="text-xs text-green-100 mt-1">Life-time gross earnings</p>
        </div>

        <div className="bg-gradient-to-br from-yellow-600 to-yellow-700 rounded-lg shadow-lg p-6 text-white transition-transform hover:scale-[1.02]">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-yellow-100">Pending Settlement</h3>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
          </div>
          <p className="text-3xl font-bold">₹{stats.pendingSettlement.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
          <p className="text-xs text-yellow-100 mt-1">Orders in process</p>
        </div>

        <div className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-lg shadow-lg p-6 text-white transition-transform hover:scale-[1.02]">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-blue-100">Total Withdrawn</h3>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
          </div>
          <p className="text-3xl font-bold">₹{stats.totalWithdrawn.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
          <p className="text-xs text-blue-100 mt-1">Total payout received</p>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="bg-white rounded-lg shadow-sm border border-neutral-200 min-h-[400px]">
        {/* Tabs */}
        <div className="border-b border-neutral-200">
          <nav className="flex -mb-px overflow-x-auto">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id);
                  setCurrentPage(1);
                  setSearchQuery('');
                  setStatusFilter('All');
                }}
                className={`flex items-center gap-2 px-4 sm:px-6 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${activeTab === tab.id
                  ? 'border-teal-600 text-teal-600'
                  : 'border-transparent text-neutral-500 hover:text-neutral-700 hover:border-neutral-300'
                  }`}
              >
                <span>{tab.icon}</span>
                <span>{tab.label}</span>
              </button>
            ))}
          </nav>
        </div>

        {/* Filters Panel */}
        <div className="p-4 sm:p-6 border-b border-neutral-200 bg-neutral-50/30">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Search */}
            <div>
              <label className="block text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-2">
                Quick Search
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search transactions..."
                  className="w-full pl-10 pr-4 py-2 bg-white border border-neutral-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none"
                />
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400">
                  <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
              </div>
            </div>

            {/* Date Range */}
            <div>
              <label className="block text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-2">
                Date Range
              </label>
              <div className="flex gap-2">
                <ThemedDatePicker
                  value={fromDate}
                  onChange={setFromDate}
                  placeholder="Start Date"
                  className="flex-1"
                />
                <ThemedDatePicker
                  value={toDate}
                  onChange={setToDate}
                  placeholder="End Date"
                  className="flex-1"
                  align="right"
                />
              </div>
            </div>

            {/* Status Filter */}
            <div>
              <label className="block text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-2">
                Status
              </label>
              <ThemedDropdown
                options={['All', ...(
                  activeTab === 'transaction'
                    ? ['Completed', 'Pending', 'Failed']
                    : activeTab === 'withdraw'
                      ? ['Pending', 'Approved', 'Completed', 'Rejected']
                      : ['Settled', 'Pending']
                )]}
                value={statusFilter}
                onChange={setStatusFilter}
              />
            </div>
          </div>
        </div>

        {/* Data Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-neutral-50 text-[11px] font-bold text-neutral-500 uppercase tracking-wider">
                {activeTab === 'transaction' && (
                  <>
                    <th className="p-4 border-b border-neutral-200">Date & Time</th>
                    <th className="p-4 border-b border-neutral-200">Description</th>
                    <th className="p-4 border-b border-neutral-200 text-right">Amount</th>
                    <th className="p-4 border-b border-neutral-200">Status</th>
                    <th className="p-4 border-b border-neutral-200">Reference</th>
                  </>
                )}
                {activeTab === 'withdraw' && (
                  <>
                    <th className="p-4 border-b border-neutral-200">Request Date</th>
                    <th className="p-4 border-b border-neutral-200">Method</th>
                    <th className="p-4 border-b border-neutral-200 text-right">Amount</th>
                    <th className="p-4 border-b border-neutral-200">Details</th>
                    <th className="p-4 border-b border-neutral-200">Status</th>
                  </>
                )}
                {activeTab === 'earning' && (
                  <>
                    <th className="p-4 border-b border-neutral-200">Date</th>
                    <th className="p-4 border-b border-neutral-200">Order ID</th>
                    <th className="p-4 border-b border-neutral-200">Product</th>
                    <th className="p-4 border-b border-neutral-200 text-right">Sale Amt</th>
                    <th className="p-4 border-b border-neutral-200 text-right">Commission</th>
                    <th className="p-4 border-b border-neutral-200 text-right text-teal-600">Net Earning</th>
                    <th className="p-4 border-b border-neutral-200">Status</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {displayedData.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-sm text-neutral-500">
                    No records found matching your criteria.
                  </td>
                </tr>
              ) : (
                displayedData.map((item: any) => (
                  <tr key={item.id} className="hover:bg-neutral-50/50 transition-colors">
                    {activeTab === 'transaction' && (
                      <>
                        <td className="p-4 text-sm text-neutral-600 whitespace-nowrap">{new Date(item.createdAt).toLocaleString()}</td>
                        <td className="p-4 text-sm font-medium text-neutral-900">{item.description}</td>
                        <td className={`p-4 text-sm font-bold text-right ${item.type === 'Credit' ? 'text-green-600' : 'text-red-600'}`}>
                          {item.type === 'Credit' ? '+' : '-'} ₹{item.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="p-4">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${item.status === 'Completed' ? 'bg-green-100 text-green-700' :
                            item.status === 'Pending' ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'
                            }`}>
                            {item.status}
                          </span>
                        </td>
                        <td className="p-4 text-xs font-mono text-neutral-400">{item.reference}</td>
                      </>
                    )}
                    {activeTab === 'withdraw' && (
                      <>
                        <td className="p-4 text-sm text-neutral-600">{new Date(item.createdAt).toLocaleDateString()}</td>
                        <td className="p-4 text-sm text-neutral-600">{item.paymentMethod}</td>
                        <td className="p-4 text-sm font-bold text-right text-neutral-900">₹{item.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                        <td className="p-4 text-[10px] text-neutral-400 font-mono">{item.accountDetails}</td>
                        <td className="p-4">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${item.status === 'Completed' || item.status === 'Approved' ? 'bg-green-100 text-green-700' :
                            item.status === 'Pending' ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'
                            }`}>
                            {item.status}
                          </span>
                        </td>
                      </>
                    )}
                    {activeTab === 'earning' && (
                      <>
                        <td className="p-4 text-sm text-neutral-600">{new Date(item.date).toLocaleDateString()}</td>
                        <td className="p-4 text-sm font-medium text-neutral-900">{item.orderId}</td>
                        <td className="p-4 text-sm text-neutral-600">{item.source}</td>
                        <td className="p-4 text-sm text-right text-neutral-600">₹{item.amount.toFixed(2)}</td>
                        <td className="p-4 text-sm text-right text-red-500">-₹{item.commission.toFixed(2)}</td>
                        <td className="p-4 text-sm font-bold text-right text-teal-600">₹{item.netEarning.toFixed(2)}</td>
                        <td className="p-4">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${item.status === 'Settled' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                            }`}>
                            {item.status}
                          </span>
                        </td>
                      </>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="p-4 border-t border-neutral-200 flex items-center justify-between bg-neutral-50/10">
          <p className="text-xs text-neutral-500">
            Showing {(currentPage - 1) * entriesPerPage + 1} to {Math.min(currentPage * entriesPerPage, totalEntries)} of {totalEntries} entries
          </p>
          <div className="flex gap-2">
            <button
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(p => p - 1)}
              className="px-3 py-1.5 border border-neutral-300 rounded-md text-xs font-medium bg-white hover:bg-neutral-50 disabled:opacity-50 transition-colors"
            >
              Previous
            </button>
            <button
              disabled={currentPage === totalPages || totalPages === 0}
              onClick={() => setCurrentPage(p => p + 1)}
              className="px-3 py-1.5 border border-neutral-300 rounded-md text-xs font-medium bg-white hover:bg-neutral-50 disabled:opacity-50 transition-colors"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {/* Withdraw Modal */}
      {showWithdrawModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-neutral-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md flex flex-col max-h-[85vh] overflow-hidden animate-in zoom-in duration-200 border border-neutral-100">
            {/* Header - Compact */}
            <div className="bg-teal-600 px-5 py-3 flex justify-between items-center text-white shrink-0">
              <div>
                <h3 className="text-base font-bold">Withdraw Money</h3>
                <p className="text-[9px] text-teal-100 uppercase tracking-widest font-bold">Payout Request</p>
              </div>
              <button onClick={() => setShowWithdrawModal(false)} className="p-1.5 hover:bg-white/20 rounded-lg transition-colors">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
              </button>
            </div>

            {/* Scrollable Form Content - Compact Spacing */}
            <div className="flex-1 overflow-y-auto p-5 space-y-5 custom-scrollbar bg-neutral-50/30">
              {/* Balance Card - More Compact */}
              <div className="p-3.5 bg-white rounded-xl border border-teal-100 flex items-center justify-between shadow-sm">
                <div>
                  <p className="text-[10px] text-neutral-400 uppercase font-bold tracking-wider mb-0.5">Available Balance</p>
                  <p className="text-xl font-black text-teal-600">₹{stats.availableBalance.toLocaleString('en-IN')}</p>
                </div>
                <div className="h-10 w-10 bg-teal-50 rounded-lg flex items-center justify-center border border-teal-100">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0d9488" strokeWidth="2.5"><rect x="2" y="5" width="20" height="14" rx="2" /><line x1="2" y1="10" x2="22" y2="10" /></svg>
                </div>
              </div>

              {/* Amount Label & Input */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider ml-1">Amount to Withdraw</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400 font-bold">₹</span>
                  <input
                    type="number"
                    value={withdrawAmount}
                    onChange={(e) => setWithdrawAmount(e.target.value)}
                    placeholder="0.00"
                    className="w-full pl-8 pr-4 py-3 bg-white border border-neutral-200 rounded-xl focus:ring-4 focus:ring-teal-500/10 focus:border-teal-500 outline-none font-bold text-base transition-all shadow-sm"
                  />
                </div>
              </div>

              {/* Method Selection */}
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider ml-1">Select Method</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setWithdrawMethod('Bank Transfer')}
                    className={`flex items-center justify-center gap-2 p-3 border-2 rounded-xl transition-all ${withdrawMethod === 'Bank Transfer' ? 'border-teal-600 bg-teal-50 shadow-inner' : 'border-neutral-100 bg-white shadow-sm'}`}>
                    <span className="text-lg">🏦</span>
                    <span className={`text-[11px] font-bold ${withdrawMethod === 'Bank Transfer' ? 'text-teal-700' : 'text-neutral-500'}`}>Bank</span>
                  </button>
                  <button
                    onClick={() => setWithdrawMethod('UPI')}
                    className={`flex items-center justify-center gap-2 p-3 border-2 rounded-xl transition-all ${withdrawMethod === 'UPI' ? 'border-teal-600 bg-teal-50 shadow-inner' : 'border-neutral-100 bg-white shadow-sm'}`}>
                    <span className="text-lg">📱</span>
                    <span className={`text-[11px] font-bold ${withdrawMethod === 'UPI' ? 'text-teal-700' : 'text-neutral-500'}`}>UPI</span>
                  </button>
                </div>
              </div>

              {/* Conditional Details Fields - Gridded for compactness */}
              <div className="space-y-3.5 animate-in slide-in-from-top-2 duration-300">
                <div className="h-px bg-neutral-200 w-full" />

                {withdrawMethod === 'Bank Transfer' ? (
                  <div className="space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider ml-1">Holder Name</label>
                        <input
                          type="text"
                          value={bankDetails.accountHolderName}
                          onChange={(e) => setBankDetails({ ...bankDetails, accountHolderName: e.target.value })}
                          placeholder="John Doe"
                          className="w-full px-3.5 py-2.5 bg-white border border-neutral-200 rounded-lg focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none text-xs font-semibold shadow-sm"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider ml-1">Account Number</label>
                        <input
                          type="text"
                          value={bankDetails.accountNumber}
                          onChange={(e) => setBankDetails({ ...bankDetails, accountNumber: e.target.value })}
                          placeholder="000011112222"
                          className="w-full px-3.5 py-2.5 bg-white border border-neutral-200 rounded-lg focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none text-xs font-semibold shadow-sm"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider ml-1">Bank Name</label>
                        <input
                          type="text"
                          value={bankDetails.bankName}
                          onChange={(e) => setBankDetails({ ...bankDetails, bankName: e.target.value })}
                          placeholder="HDFC Bank"
                          className="w-full px-3.5 py-2.5 bg-white border border-neutral-200 rounded-lg focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none text-xs font-semibold shadow-sm"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider ml-1">IFSC Code</label>
                        <input
                          type="text"
                          value={bankDetails.ifscCode}
                          onChange={(e) => setBankDetails({ ...bankDetails, ifscCode: e.target.value })}
                          placeholder="HDFC0000"
                          className="w-full px-3.5 py-2.5 bg-white border border-neutral-200 rounded-lg focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none text-xs font-bold text-teal-800 uppercase shadow-sm"
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
                        className="w-full pl-4 pr-10 py-2.5 bg-white border border-neutral-200 rounded-lg focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none text-sm font-bold text-teal-900 shadow-sm"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#2dd4bf" strokeWidth="2.5"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" /></svg>
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Action Footer - Compact */}
            <div className="p-5 bg-white border-t border-neutral-100 shrink-0">
              <button
                onClick={handleWithdrawSubmit}
                disabled={isSubmitting}
                className="w-full bg-teal-600 hover:bg-teal-700 text-white py-3.5 rounded-xl font-bold uppercase tracking-widest shadow-lg shadow-teal-600/20 transition-all hover:shadow-teal-600/30 active:scale-[0.98] disabled:opacity-50 disabled:transform-none flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Processing...</span>
                  </>
                ) : (
                  <span>Submit Request</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
