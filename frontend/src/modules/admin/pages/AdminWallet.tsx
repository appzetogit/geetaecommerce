import { useState, useEffect, useCallback } from "react";
import {
  getWalletTransactions,
  getWithdrawalRequests,
  updateWithdrawalStatus,
  getFinancialDashboard,
  type WalletTransaction,
} from "../../../services/api/admin/adminWalletService";
import { getAllSellers } from "../../../services/api/sellerService";
import { useAuth } from "../../../context/AuthContext";
import toast from "react-hot-toast";

type TabType = "transaction" | "withdraw" | "balance" | "earning";

interface AdminStats {
  totalEarnings: number;
  paidEarnings: number;
  pendingEarnings: number;
  thisMonthEarnings: number;
}

export default function AdminWallet() {
  const { isAuthenticated, token } = useAuth();
  const [activeTab, setActiveTab] = useState<TabType>("transaction");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [currentPage, setCurrentPage] = useState(1);
  const entriesPerPage = 10;
  const [totalEntries, setTotalEntries] = useState(0);

  // Backend data states
  const [transactions, setTransactions] = useState<any[]>([]);
  const [withdrawRequests, setWithdrawRequests] = useState<any[]>([]);
  const [sellerBalances, setSellerBalances] = useState<any[]>([]);
  const [adminEarnings, setAdminEarnings] = useState<any[]>([]);
  const [stats, setStats] = useState<AdminStats>({
    totalEarnings: 0,
    paidEarnings: 0,
    pendingEarnings: 0,
    thisMonthEarnings: 0,
  });
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState(false);

  // Fetch Dashboard Stats
  const fetchStats = useCallback(async () => {
    try {
      const response = await getFinancialDashboard();
      if (response.success) {
        setStats({
          totalEarnings: response.data.commissions.total || 0,
          paidEarnings: response.data.commissions.paid || 0,
          pendingEarnings: response.data.commissions.pending || 0,
          thisMonthEarnings: response.data.commissions.sellerEarnings || 0,
        });

        if (response.data.recentTransactions) {
           setAdminEarnings(response.data.recentTransactions.map((t: any) => ({
             _id: t._id,
             source: t.type === 'Commission' ? 'Order Commission' : 'Withdrawal',
             description: t.description || 'N/A',
             amount: t.commissionAmount || t.amount || 0,
             date: new Date(t.createdAt).toLocaleDateString(),
             status: t.status
           })));
        }
      }
    } catch (err) {
      console.error("Error fetching stats:", err);
    }
  }, []);

  // Fetch data based on active tab
  const fetchTabData = useCallback(async () => {
    if (!isAuthenticated || !token) return;

    try {
      setLoading(true);

      const params = {
        page: currentPage,
        limit: entriesPerPage,
        status: statusFilter === 'All' ? undefined : statusFilter,
        search: searchQuery || undefined,
        startDate: fromDate || undefined,
        endDate: toDate || undefined,
      };

      if (activeTab === "transaction") {
        const response = await getWalletTransactions(params);
        if (response.success) {
          setTransactions(response.data);
          setTotalEntries(response.pagination?.total || 0);
        }
      } else if (activeTab === "withdraw") {
        const response = await getWithdrawalRequests(params);
        if (response.success) {
          setWithdrawRequests(response.data);
          setTotalEntries(response.pagination?.total || 0);
        }
      } else if (activeTab === "balance") {
        const response = await getAllSellers({ status: "Approved" });
        if (response.success) {
          setSellerBalances(response.data.map((s: any) => ({
             userId: s._id,
             userName: s.storeName,
             currentBalance: s.balance,
             pendingBalance: 0,
             totalEarnings: s.totalEarnings || 0,
             totalWithdrawn: s.totalWithdrawn || 0,
          })));
          setTotalEntries(response.data.length);
        }
      } else if (activeTab === "earning") {
         await fetchStats();
      }
    } catch (err: any) {
      console.error(`Error fetching ${activeTab} data:`, err);
      toast.error(`Failed to load ${activeTab} data.`);
    } finally {
      setLoading(false);
    }
  }, [activeTab, currentPage, entriesPerPage, statusFilter, searchQuery, fromDate, toDate, isAuthenticated, token, fetchStats]);

  useEffect(() => {
    fetchStats();
    fetchTabData();
  }, [fetchStats, fetchTabData]);

  const handleApproveWithdraw = async (id: string) => {
    if (window.confirm("Approve this withdrawal?")) {
      try {
        setProcessing(true);
        const response = await updateWithdrawalStatus(id, { status: "Approved" });
        if (response.success) {
          toast.success("Withdrawal approved!");
          fetchTabData();
          fetchStats();
        }
      } catch (err: any) {
        toast.error(err.response?.data?.message || "Failed to approve");
      } finally {
        setProcessing(false);
      }
    }
  };

  const handleRejectWithdraw = async (id: string) => {
    const remarks = prompt("Enter rejection remark:");
    if (remarks !== null) {
      try {
        setProcessing(true);
        const response = await updateWithdrawalStatus(id, { status: "Rejected", remarks });
        if (response.success) {
          toast.success("Withdrawal rejected!");
          fetchTabData();
          fetchStats();
        }
      } catch (err: any) {
        toast.error(err.response?.data?.message || "Failed to reject");
      } finally {
        setProcessing(false);
      }
    }
  };

  const handleCompleteWithdraw = async (id: string) => {
    if (window.confirm("Mark as Completed?")) {
      try {
        setProcessing(true);
        const response = await updateWithdrawalStatus(id, { status: "Completed" });
        if (response.success) {
          toast.success("Withdrawal completed!");
          fetchTabData();
        }
      } catch (err: any) {
        toast.error(err.response?.data?.message || "Failed to complete");
      } finally {
        setProcessing(false);
      }
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-neutral-800">Wallet Management</h1>
        <div className="text-sm">
          <span className="text-[var(--primary-color)]">Admin</span> / <span>Wallet</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-[var(--primary-color)] p-6 rounded-xl text-white shadow-lg">
          <h3 className="text-pink-100 text-sm font-medium">Total Earnings</h3>
          <p className="text-3xl font-bold mt-1">₹{stats.totalEarnings.toLocaleString()}</p>
        </div>
        <div className="bg-[var(--primary-color)] p-6 rounded-xl text-white shadow-lg">
          <h3 className="text-pink-100 text-sm font-medium">Paid Earnings</h3>
          <p className="text-3xl font-bold mt-1">₹{stats.paidEarnings.toLocaleString()}</p>
        </div>
        <div className="bg-yellow-600 p-6 rounded-xl text-white shadow-lg">
          <h3 className="text-yellow-100 text-sm font-medium">Pending Earnings</h3>
          <p className="text-3xl font-bold mt-1">₹{stats.pendingEarnings.toLocaleString()}</p>
        </div>
        <div className="bg-[var(--primary-color)] p-6 rounded-xl text-white shadow-lg">
          <h3 className="text-pink-100 text-sm font-medium">Seller Payouts</h3>
          <p className="text-3xl font-bold mt-1">₹{stats.thisMonthEarnings.toLocaleString()}</p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-neutral-200 overflow-hidden">
        <div className="flex border-b border-neutral-200">
          {[
            { id: "transaction", label: "Transactions" },
            { id: "withdraw", label: "Withdrawals" },
            { id: "balance", label: "Seller Balances" },
            { id: "earning", label: "Admin History" }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => { setActiveTab(tab.id as TabType); setCurrentPage(1); }}
              className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.id ? "border-[var(--primary-color)] text-[var(--primary-color)]" : "border-transparent text-neutral-500 hover:text-neutral-700"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="p-6">
          <div className="flex flex-col md:flex-row gap-4 mb-6">
            <input
              type="text"
              placeholder="Search..."
              className="px-4 py-2 border rounded-lg flex-1"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
            <select
              className="px-4 py-2 border rounded-lg"
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
            >
              <option value="All">All Status</option>
              {activeTab === 'withdraw' && (
                <>
                  <option value="Pending">Pending</option>
                  <option value="Approved">Approved</option>
                  <option value="Rejected">Rejected</option>
                  <option value="Completed">Completed</option>
                </>
              )}
            </select>
          </div>

          <div className="overflow-x-auto">
            {loading ? (
              <div className="py-20 text-center text-neutral-500">Loading...</div>
            ) : (
              <table className="min-w-full divide-y divide-neutral-200">
                <thead className="bg-neutral-50">
                  {activeTab === 'transaction' && (
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase">Date</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase">Seller</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase">Amount</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase">Status</th>
                    </tr>
                  )}
                  {activeTab === 'withdraw' && (
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase">Date</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase">Seller</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase">Amount</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase">Status</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase">Action</th>
                    </tr>
                  )}
                  {activeTab === 'balance' && (
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase">Seller Store</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase">Current Balance</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase">Total Earnings</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase">Total Withdrawn</th>
                    </tr>
                  )}
                  {activeTab === 'earning' && (
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase">Date</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase">Source</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase">Description</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase">Admin Amount</th>
                    </tr>
                  )}
                </thead>
                <tbody className="bg-white divide-y divide-neutral-200">
                  {activeTab === 'transaction' && transactions.map(tr => (
                    <tr key={tr._id} className="hover:bg-neutral-50 transition-colors">
                      <td className="px-6 py-4 text-sm">{new Date(tr.createdAt).toLocaleDateString()}</td>
                      <td className="px-6 py-4 text-sm font-medium">{tr.sellerId?.storeName || 'System'}</td>
                      <td className={`px-6 py-4 text-sm font-bold ${tr.type === 'Credit' ? 'text-[var(--primary-dark)]' : 'text-red-600'}`}>
                        {tr.type === 'Credit' ? '+' : '-'} ₹{tr.amount}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${tr.status === 'Completed' ? 'bg-[var(--primary-alpha-20)] text-[var(--primary-darker)]' : 'bg-yellow-100 text-yellow-700'}`}>
                          {tr.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {activeTab === 'withdraw' && withdrawRequests.map(req => (
                    <tr key={req._id} className="hover:bg-neutral-50 transition-colors">
                      <td className="px-6 py-4 text-sm">{new Date(req.createdAt).toLocaleDateString()}</td>
                      <td className="px-6 py-4 text-sm font-medium">{req.sellerId?.storeName}</td>
                      <td className="px-6 py-4 text-sm font-bold">₹{req.amount}</td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${req.status === 'Completed' || req.status === 'Approved' ? 'bg-[var(--primary-alpha-20)] text-[var(--primary-darker)]' : req.status === 'Pending' ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'}`}>
                          {req.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm">
                        {req.status === 'Pending' && (
                          <div className="flex gap-2">
                            <button onClick={() => handleApproveWithdraw(req._id)} disabled={processing} className="text-[var(--primary-dark)] font-bold hover:underline">Approve</button>
                            <button onClick={() => handleRejectWithdraw(req._id)} disabled={processing} className="text-red-600 font-bold hover:underline">Reject</button>
                          </div>
                        )}
                        {req.status === 'Approved' && (
                          <button onClick={() => handleCompleteWithdraw(req._id)} disabled={processing} className="text-[var(--primary-dark)] font-bold hover:underline">Mark Paid</button>
                        )}
                      </td>
                    </tr>
                  ))}
                  {activeTab === 'balance' && sellerBalances.map(bal => (
                    <tr key={bal.userId} className="hover:bg-neutral-50 transition-colors">
                      <td className="px-6 py-4 text-sm font-medium">{bal.userName}</td>
                      <td className="px-6 py-4 text-sm font-bold text-[var(--primary-dark)]">₹{bal.currentBalance.toLocaleString()}</td>
                      <td className="px-6 py-4 text-sm">₹{bal.totalEarnings.toLocaleString()}</td>
                      <td className="px-6 py-4 text-sm">₹{bal.totalWithdrawn.toLocaleString()}</td>
                    </tr>
                  ))}
                  {activeTab === 'earning' && adminEarnings.map(ea => (
                    <tr key={ea._id} className="hover:bg-neutral-50 transition-colors">
                      <td className="px-6 py-4 text-sm">{ea.date}</td>
                      <td className="px-6 py-4 text-sm font-medium text-[var(--primary-dark)]">{ea.source}</td>
                      <td className="px-6 py-4 text-sm text-neutral-500">{ea.description}</td>
                      <td className="px-6 py-4 text-sm font-bold text-[var(--primary-dark)]">₹{ea.amount.toLocaleString()}</td>
                    </tr>
                  ))}
                  {((activeTab === 'transaction' && transactions.length === 0) ||
                    (activeTab === 'withdraw' && withdrawRequests.length === 0) ||
                    (activeTab === 'balance' && sellerBalances.length === 0) ||
                    (activeTab === 'earning' && adminEarnings.length === 0)) && (
                    <tr>
                      <td colSpan={5} className="px-6 py-10 text-center text-neutral-500 uppercase text-xs tracking-widest font-bold">No Data Found</td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
          </div>

          {!loading && totalEntries > entriesPerPage && (
            <div className="mt-6 flex justify-between items-center text-sm text-neutral-500">
              <p>Showing records</p>
              <div className="flex gap-2">
                <button onClick={() => setCurrentPage(p => p - 1)} disabled={currentPage === 1} className="px-3 py-1 border rounded disabled:opacity-50">Prev</button>
                <button onClick={() => setCurrentPage(p => p + 1)} disabled={currentPage * entriesPerPage >= totalEntries} className="px-3 py-1 border rounded disabled:opacity-50">Next</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
