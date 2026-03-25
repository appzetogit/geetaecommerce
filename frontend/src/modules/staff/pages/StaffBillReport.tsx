import React, { useMemo, useState } from "react";
import { detectModuleFromPath } from "../../../utils/moduleAuth";
import { deletePOSStaffBills, getPOSStaffBills, StaffModule } from "../../../utils/staffSession";
import { toast } from "react-hot-toast";

const StaffBillReport: React.FC = () => {
  const moduleType = (detectModuleFromPath() === "seller" ? "seller" : "admin") as StaffModule;
  const [staffFilter, setStaffFilter] = useState("all");
  const [billSearch, setBillSearch] = useState("");
  const [dateFilter, setDateFilter] = useState("all");
  const [selectedBill, setSelectedBill] = useState<any>(null);
  const [selectedBillIds, setSelectedBillIds] = useState<Set<string>>(new Set());
  const [refreshKey, setRefreshKey] = useState(0);
  const [editMode, setEditMode] = useState(false);
  const [draftById, setDraftById] = useState<
    Record<
      string,
      {
        staffName?: string;
        paymentMode?: string;
        totalAmount?: number;
      }
    >
  >({});

  const bills = useMemo(() => getPOSStaffBills(moduleType), [moduleType, refreshKey]);

  const uniqueStaffNames = useMemo(() => {
    return Array.from(new Set(bills.map((b) => b.staffName).filter(Boolean)));
  }, [bills]);

  const filteredBills = useMemo(() => {
    const now = new Date();
    return bills.filter((bill) => {
      if (staffFilter !== "all" && bill.staffName !== staffFilter) return false;
      if (
        billSearch.trim() &&
        !String(bill.billNumber || "")
          .toLowerCase()
          .includes(billSearch.trim().toLowerCase())
      ) {
        return false;
      }

      if (dateFilter !== "all") {
        const billDate = new Date(bill.createdAt);
        if (dateFilter === "today") {
          if (billDate.toDateString() !== now.toDateString()) return false;
        }
        if (dateFilter === "last7") {
          const diff = now.getTime() - billDate.getTime();
          if (diff > 7 * 24 * 60 * 60 * 1000) return false;
        }
      }

      return true;
    });
  }, [bills, staffFilter, billSearch, dateFilter]);

  const totalAmount = filteredBills.reduce((sum, bill) => sum + Number(bill.totalAmount || 0), 0);

  const allSelected =
    filteredBills.length > 0 && filteredBills.every((bill) => selectedBillIds.has(bill.id));

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedBillIds(new Set(filteredBills.map((bill) => bill.id)));
    } else {
      setSelectedBillIds(new Set());
    }
  };

  const handleSelectBill = (id: string) => {
    setSelectedBillIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleDeleteSelected = () => {
    if (selectedBillIds.size === 0) return;
    const ok = window.confirm(`Delete ${selectedBillIds.size} selected item(s)?`);
    if (!ok) return;

    const ids = Array.from(selectedBillIds);
    deletePOSStaffBills(moduleType, ids);
    setSelectedBillIds(new Set());
    if (selectedBill?.id && ids.includes(selectedBill.id)) setSelectedBill(null);
    setRefreshKey((k) => k + 1);
    toast.success("Selected items deleted");
  };

  const updateDraft = (
    id: string,
    patch: { staffName?: string; paymentMode?: string; totalAmount?: number }
  ) => {
    setDraftById((prev) => ({ ...prev, [id]: { ...(prev[id] || {}), ...patch } }));
  };

  const handleToggleEditMode = () => {
    if (!editMode) {
      setEditMode(true);
      return;
    }

    const editedIds = Object.keys(draftById);
    if (editedIds.length === 0) {
      setEditMode(false);
      return;
    }

    const storageKey = `${moduleType}_pos_staff_bills`;
    const existing = getPOSStaffBills(moduleType);
    const next = existing.map((bill) => {
      const draft = draftById[bill.id];
      if (!draft) return bill;
      return {
        ...bill,
        ...(draft.staffName !== undefined ? { staffName: draft.staffName } : {}),
        ...(draft.paymentMode !== undefined ? { paymentMode: draft.paymentMode } : {}),
        ...(draft.totalAmount !== undefined ? { totalAmount: draft.totalAmount } : {}),
      };
    });

    localStorage.setItem(storageKey, JSON.stringify(next));
    setDraftById({});
    setEditMode(false);
    setRefreshKey((k) => k + 1);
    toast.success("Bills updated");
  };

  return (
    <div className="p-4 sm:p-6 space-y-6 bg-gray-50 min-h-screen">
      <div className="bg-white border border-gray-100 rounded-2xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Staff Bill Report</h1>
          <p className="text-sm text-gray-500 mt-1">
            Separate report for staff-created POS bills
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={handleToggleEditMode}
            className={`inline-flex items-center px-4 py-2 text-xs font-black rounded-xl active:scale-95 transition-all shadow-sm text-white ${
              editMode ? "bg-indigo-700" : "bg-indigo-600 hover:bg-indigo-700"
            }`}
          >
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
            {editMode ? "Done Editing" : "Bulk Edit"}
          </button>
          <button
            onClick={handleDeleteSelected}
            disabled={selectedBillIds.size === 0}
            className="px-4 py-2 rounded-xl bg-rose-600 text-white font-semibold hover:bg-rose-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Delete{selectedBillIds.size > 0 ? ` (${selectedBillIds.size})` : ""}
          </button>
          <button
            onClick={() => setRefreshKey((k) => k + 1)}
            className="px-4 py-2 rounded-xl bg-[#f187b5] text-white font-semibold hover:bg-[#db76a3] transition-colors"
          >
            Refresh
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <p className="text-xs text-gray-500 uppercase font-bold">Total Bills</p>
          <p className="text-2xl font-bold text-gray-800 mt-1">{filteredBills.length}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <p className="text-xs text-gray-500 uppercase font-bold">Total Sales</p>
          <p className="text-2xl font-bold text-gray-800 mt-1">Rs {totalAmount.toLocaleString()}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <p className="text-xs text-gray-500 uppercase font-bold">Module</p>
          <p className="text-2xl font-bold text-gray-800 mt-1 capitalize">{moduleType}</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <div className="p-4 border-b border-gray-100 grid grid-cols-1 md:grid-cols-3 gap-2">
          <select
            value={staffFilter}
            onChange={(e) => setStaffFilter(e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:border-[#f187b5]"
          >
            <option value="all">All Staff</option>
            {uniqueStaffNames.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>

          <select
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:border-[#f187b5]"
          >
            <option value="all">All Dates</option>
            <option value="today">Today</option>
            <option value="last7">Last 7 Days</option>
          </select>

          <input
            type="text"
            value={billSearch}
            onChange={(e) => setBillSearch(e.target.value)}
            placeholder="Search bill number"
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:border-[#f187b5]"
          />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-gray-50/70">
              <tr>
                <th className="px-5 py-3 text-[10px] font-bold text-gray-500 uppercase w-10">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={(e) => handleSelectAll(e.target.checked)}
                    className="w-4 h-4 text-[#f187b5] rounded border-gray-300 focus:ring-[#f187b5]"
                  />
                </th>
                <th className="px-5 py-3 text-[10px] font-bold text-gray-500 uppercase">Bill No</th>
                <th className="px-5 py-3 text-[10px] font-bold text-gray-500 uppercase">Staff Name</th>
                <th className="px-5 py-3 text-[10px] font-bold text-gray-500 uppercase">Date</th>
                <th className="px-5 py-3 text-[10px] font-bold text-gray-500 uppercase">Products</th>
                <th className="px-5 py-3 text-[10px] font-bold text-gray-500 uppercase">Payment</th>
                <th className="px-5 py-3 text-[10px] font-bold text-gray-500 uppercase">Amount</th>
                <th className="px-5 py-3 text-[10px] font-bold text-gray-500 uppercase">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredBills.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-5 py-10 text-center text-sm text-gray-400">
                    No staff bills found
                  </td>
                </tr>
              ) : (
                filteredBills.map((bill) => (
                  <tr key={bill.id} className="hover:bg-gray-50">
                    <td className="px-5 py-3 w-10" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selectedBillIds.has(bill.id)}
                        onChange={() => handleSelectBill(bill.id)}
                        className="w-4 h-4 text-[#f187b5] rounded border-gray-300 focus:ring-[#f187b5]"
                      />
                    </td>
                    <td className="px-5 py-3 font-semibold text-gray-800">{bill.billNumber}</td>
                    <td className="px-5 py-3 text-sm text-gray-700">
                      {editMode ? (
                        <input
                          value={draftById[bill.id]?.staffName ?? bill.staffName ?? ""}
                          onChange={(e) => updateDraft(bill.id, { staffName: e.target.value })}
                          className="w-full max-w-[220px] border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                        />
                      ) : (
                        bill.staffName
                      )}
                    </td>
                    <td className="px-5 py-3 text-xs text-gray-500">
                      {new Date(bill.createdAt).toLocaleString("en-IN")}
                    </td>
                    <td className="px-5 py-3 text-sm text-gray-700">{bill.numberOfProducts}</td>
                    <td className="px-5 py-3 text-sm text-gray-700">
                      {editMode ? (
                        <select
                          value={draftById[bill.id]?.paymentMode ?? bill.paymentMode ?? ""}
                          onChange={(e) => updateDraft(bill.id, { paymentMode: e.target.value })}
                          className="w-full max-w-[180px] border border-gray-200 rounded-lg px-3 py-2 text-sm font-semibold text-gray-700 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                        >
                          <option value="">Select</option>
                          <option value="Cash">Cash</option>
                          <option value="UPI">UPI</option>
                          <option value="Card">Card</option>
                          <option value="Net Banking">Net Banking</option>
                        </select>
                      ) : (
                        bill.paymentMode
                      )}
                    </td>
                    <td className="px-5 py-3 font-semibold text-gray-900">
                      {editMode ? (
                        <div className="flex items-center gap-2 max-w-[180px]">
                          <span className="text-gray-500 font-bold">Rs</span>
                          <input
                            type="number"
                            value={draftById[bill.id]?.totalAmount ?? Number(bill.totalAmount || 0)}
                            onChange={(e) =>
                              updateDraft(bill.id, { totalAmount: Number(e.target.value || 0) })
                            }
                            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                          />
                        </div>
                      ) : (
                        <>Rs {Number(bill.totalAmount || 0).toLocaleString()}</>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      <button
                        onClick={() => setSelectedBill(bill)}
                        className="px-3 py-1.5 rounded-lg bg-[#f187b5]/10 text-[#f187b5] text-xs font-semibold hover:bg-[#f187b5]/20"
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {selectedBill && (
        <div className="fixed inset-0 z-[70] bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-xl rounded-2xl overflow-hidden shadow-2xl">
            <div className="p-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="font-bold text-gray-800">Staff Bill Details</h3>
              <button onClick={() => setSelectedBill(null)} className="text-gray-400 hover:text-gray-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="p-4 space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-2">
                <div><span className="text-gray-500">Bill:</span> <span className="font-semibold">{selectedBill.billNumber}</span></div>
                <div><span className="text-gray-500">Staff:</span> <span className="font-semibold">{selectedBill.staffName}</span></div>
                <div><span className="text-gray-500">Payment:</span> <span className="font-semibold">{selectedBill.paymentMode}</span></div>
                <div><span className="text-gray-500">Date:</span> <span className="font-semibold">{new Date(selectedBill.createdAt).toLocaleString("en-IN")}</span></div>
              </div>

              <div className="border border-gray-100 rounded-xl overflow-hidden">
                <div className="px-3 py-2 bg-gray-50 text-xs font-semibold text-gray-600 uppercase">Products</div>
                <div className="max-h-52 overflow-y-auto divide-y divide-gray-100">
                  {(selectedBill.items || []).map((item: any, idx: number) => (
                    <div key={`${item.productName}-${idx}`} className="px-3 py-2 flex justify-between">
                      <span className="text-gray-700">{item.productName} x{item.qty}</span>
                      <span className="font-semibold text-gray-900">Rs {Number(item.price || 0).toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="text-right">
                <p className="text-base font-bold text-gray-900">Total: Rs {Number(selectedBill.totalAmount || 0).toLocaleString()}</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StaffBillReport;
