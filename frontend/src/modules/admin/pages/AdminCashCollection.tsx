import { useState } from "react";
import { toast } from 'react-hot-toast';

interface CashCollection {
  id: string;
  name: string;
  orderId: string;
  total: number;
  amount: number;
  remark: string;
  dateTime: string;
}

export default function AdminCashCollection() {
  const [cashCollections, setCashCollections] = useState<CashCollection[]>([
    {
      id: "1001",
      name: "Rahul Kumar",
      orderId: "ORD-9876",
      total: 1250,
      amount: 1250,
      remark: "Full payment received",
      dateTime: "2024-02-15 14:30:00"
    },
    {
      id: "1002",
      name: "Amit Singh",
      orderId: "ORD-9877",
      total: 500,
      amount: 500,
      remark: "Received cash",
      dateTime: "2024-02-14 10:15:00"
    }
  ]);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [selectedDeliveryBoy, setSelectedDeliveryBoy] = useState("all");
  const [selectedMethod, setSelectedMethod] = useState("all");
  const [entriesPerPage, setEntriesPerPage] = useState(10);
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [showModal, setShowModal] = useState(false);

  // New Collection Form State
  const [newCollection, setNewCollection] = useState({
      deliveryBoy: '',
      orderId: '',
      total: '',
      amount: '',
      remark: '',
      dateTime: new Date().toISOString().slice(0, 16) // yyyy-MM-ddThh:mm
  });

  const deliveryBoys = [
    { id: "1", name: "Rahul Kumar" },
    { id: "2", name: "Amit Singh" },
    { id: "3", name: "Suresh" },
  ];

   const handleAddCollection = (e: React.FormEvent) => {
    e.preventDefault();

    if (!newCollection.deliveryBoy || !newCollection.orderId || !newCollection.amount || !newCollection.total || !newCollection.dateTime) {
      toast.error('Please fill all required fields');
      return;
    }

    const newEntry: CashCollection = {
      id: (Math.floor(Math.random() * 9000) + 1000).toString(),
      name: newCollection.deliveryBoy,
      orderId: newCollection.orderId,
      total: parseFloat(newCollection.total),
      amount: parseFloat(newCollection.amount),
      remark: newCollection.remark,
      dateTime: newCollection.dateTime.replace('T', ' '),
    };

    setCashCollections([newEntry, ...cashCollections]);
    setShowModal(false);
    setNewCollection({
      deliveryBoy: '',
      orderId: '',
      total: '',
      amount: '',
      remark: '',
      dateTime: new Date().toISOString().slice(0, 16)
    });
    toast.success('Cash collection added successfully');
  };


  const filteredCollections = cashCollections.filter(item => {
    const matchesSearch =
      item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.orderId.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.id.includes(searchTerm);

    const matchesBoy = selectedDeliveryBoy === 'all' || item.name === selectedDeliveryBoy;

    return matchesSearch && matchesBoy;
  });

  const totalPages = Math.ceil(filteredCollections.length / entriesPerPage);
  const startIndex = (currentPage - 1) * entriesPerPage;
  const endIndex = startIndex + entriesPerPage;
  const displayedCollections = filteredCollections.slice(startIndex, endIndex);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="rounded-t-lg px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-4" style={{ backgroundColor: 'var(--primary-color)' }}>
        <h1 className="text-white text-xl font-bold">Delivery Boy Cash Collection List</h1>
         <button
          onClick={() => setShowModal(true)}
          className="bg-white text-[var(--primary-color)] px-4 py-2 rounded-lg text-sm font-bold shadow-sm hover:bg-neutral-50 transition-colors flex items-center gap-2"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19"></line>
            <line x1="5" y1="12" x2="19" y2="12"></line>
          </svg>
          Add Cash Collection
        </button>
      </div>

      {/* Main Content */}
      <div className="bg-white rounded-lg shadow-sm border border-neutral-200">
        {/* Filters */}
        <div className="p-4 border-b border-neutral-200 space-y-4">
           <div className="flex flex-wrap items-center gap-4">
               {/* Date Range */}
              <div className="flex items-center gap-2">
                 <span className="text-sm font-medium text-neutral-600">From Date</span>
                 <input
                   type="date"
                   value={fromDate}
                   onChange={(e) => setFromDate(e.target.value)}
                   className="px-3 py-2 border border-neutral-300 rounded text-sm focus:outline-none focus:border-[var(--primary-color)]"
                 />
                 <span className="text-sm font-medium text-neutral-600">To Date</span>
                 <input
                   type="date"
                   value={toDate}
                   onChange={(e) => setToDate(e.target.value)}
                   className="px-3 py-2 border border-neutral-300 rounded text-sm focus:outline-none focus:border-[var(--primary-color)]"
                 />
              </div>
                <button
                    onClick={() => {setFromDate(''); setToDate('');}}
                    className="bg-neutral-800 text-white px-3 py-2 rounded text-sm hover:bg-neutral-700">
                    Clear
                </button>

                 {/* Delivery Boy Filter */}
                <select
                  value={selectedDeliveryBoy}
                  onChange={(e) => setSelectedDeliveryBoy(e.target.value)}
                  className="px-3 py-2 border border-neutral-300 rounded text-sm focus:outline-none focus:border-[var(--primary-color)] min-w-[150px]"
                >
                  <option value="all">All Delivery Boys</option>
                  {deliveryBoys.map(boy => (
                    <option key={boy.id} value={boy.name}>{boy.name}</option>
                  ))}
                </select>

                {/* Method Filter */}
                <select
                  value={selectedMethod}
                  onChange={(e) => setSelectedMethod(e.target.value)}
                  className="px-3 py-2 border border-neutral-300 rounded text-sm focus:outline-none focus:border-[var(--primary-color)] min-w-[120px]"
                >
                  <option value="all">All Method</option>
                  <option value="Cash">Cash</option>
                  <option value="Online">Online</option>
                </select>

           </div>

            <div className="flex flex-wrap items-center justify-between gap-4 mt-4">
                 <div className="flex items-center gap-2">
                    <span className="text-sm text-neutral-600">Per Page</span>
                    <select
                      value={entriesPerPage}
                      onChange={(e) => setEntriesPerPage(Number(e.target.value))}
                      className="px-2 py-1 border border-neutral-300 rounded text-sm focus:outline-none focus:border-[var(--primary-color)]"
                    >
                      <option value={10}>10</option>
                      <option value={20}>20</option>
                      <option value={50}>50</option>
                    </select>
                 </div>

                 <div className="flex items-center gap-2">
                     <button
                      className="text-white px-4 py-2 rounded text-sm flex items-center gap-2 transition-colors mr-2"
                      style={{ backgroundColor: 'var(--primary-color)' }}
                    >
                      Export
                       <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                        <polyline points="7 10 12 15 17 10"></polyline>
                        <line x1="12" y1="15" x2="12" y2="3"></line>
                      </svg>
                    </button>

                    <input
                      type="text"
                      placeholder="Search..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="px-3 py-2 border border-neutral-300 rounded text-sm focus:outline-none focus:border-[var(--primary-color)]"
                    />
                 </div>
            </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1000px]">
            <thead className="bg-neutral-50 border-b border-neutral-200">
               <tr>
                {['ID', 'Name', 'Order ID', 'Total', 'Amount', 'Remark', 'Date Time'].map((header) => (
                  <th key={header} className="px-6 py-3 text-left text-xs font-bold text-neutral-600 uppercase tracking-wider">
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200">
             {displayedCollections.length > 0 ? (
                displayedCollections.map((item) => (
                  <tr key={item.id} className="hover:bg-neutral-50 transition-colors">
                     <td className="px-6 py-4 text-sm text-neutral-900 font-medium">#{item.id}</td>
                     <td className="px-6 py-4 text-sm text-neutral-900">{item.name}</td>
                     <td className="px-6 py-4 text-sm text-neutral-600">{item.orderId}</td>
                     <td className="px-6 py-4 text-sm text-neutral-900 font-medium">₹{item.total.toFixed(2)}</td>
                     <td className="px-6 py-4 text-sm font-bold text-neutral-900">₹{item.amount.toFixed(2)}</td>
                     <td className="px-6 py-4 text-sm text-neutral-600 max-w-xs truncate">{item.remark}</td>
                     <td className="px-6 py-4 text-sm text-neutral-600">{item.dateTime}</td>
                  </tr>
                ))
              ) : (
                <tr>
                   <td colSpan={7} className="px-6 py-8 text-center text-sm text-neutral-500">
                    No data available in table
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Footer / Pagination */}
        <div className="px-6 py-4 border-t border-neutral-200 flex items-center justify-between">
           <div className="text-sm text-neutral-600">
             Showing {startIndex + 1} to {Math.min(endIndex, filteredCollections.length)} of {filteredCollections.length} entries
           </div>

           <div className="flex gap-2">
             <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-3 py-1 border border-neutral-300 rounded text-sm disabled:opacity-50 hover:bg-neutral-50"
             >
               Previous
             </button>
             <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages || totalPages === 0}
                className="px-3 py-1 border border-neutral-300 rounded text-sm disabled:opacity-50 hover:bg-neutral-50"
             >
               Next
             </button>
           </div>
        </div>
      </div>

       {/* Add Cash Collection Modal */}
       {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
           <div className="bg-white rounded-lg shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
              {/* Modal Header */}
              <div className="px-6 py-4 border-b border-neutral-100 flex items-center justify-between" style={{ backgroundColor: 'var(--primary-color)' }}>
                  <h3 className="font-bold text-white">Add Cash Collection</h3>
                  <button onClick={() => setShowModal(false)} className="text-white hover:bg-white/20 rounded-full p-1 transition-colors">
                     <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                       <line x1="18" y1="6" x2="6" y2="18"></line>
                       <line x1="6" y1="6" x2="18" y2="18"></line>
                     </svg>
                  </button>
              </div>

               {/* Modal Body */}
               <form onSubmit={handleAddCollection} className="p-6 space-y-4">
                   <div>
                       <label className="block text-sm font-bold text-neutral-700 mb-1">Select Delivery Boy <span className="text-red-500">*</span></label>
                       <select
                          value={newCollection.deliveryBoy}
                          onChange={(e) => setNewCollection({...newCollection, deliveryBoy: e.target.value})}
                          className="w-full px-3 py-2 border border-neutral-300 rounded focus:outline-none focus:border-[var(--primary-color)]"
                          required
                       >
                         <option value="">Select Delivery Boy</option>
                         {deliveryBoys.map(boy => (
                            <option key={boy.id} value={boy.name}>{boy.name}</option>
                         ))}
                       </select>
                    </div>

                    <div>
                       <label className="block text-sm font-bold text-neutral-700 mb-1">Order ID <span className="text-red-500">*</span></label>
                       <input
                          type="text"
                          value={newCollection.orderId}
                          onChange={(e) => setNewCollection({...newCollection, orderId: e.target.value})}
                          className="w-full px-3 py-2 border border-neutral-300 rounded focus:outline-none focus:border-[var(--primary-color)]"
                          placeholder="ORD-XXXX"
                          required
                       />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                           <label className="block text-sm font-bold text-neutral-700 mb-1">Total Amount <span className="text-red-500">*</span></label>
                           <input
                              type="number"
                              value={newCollection.total}
                              onChange={(e) => setNewCollection({...newCollection, total: e.target.value})}
                              className="w-full px-3 py-2 border border-neutral-300 rounded focus:outline-none focus:border-[var(--primary-color)]"
                              required
                           />
                        </div>
                        <div>
                           <label className="block text-sm font-bold text-neutral-700 mb-1">Collected Amount <span className="text-red-500">*</span></label>
                           <input
                              type="number"
                              value={newCollection.amount}
                              onChange={(e) => setNewCollection({...newCollection, amount: e.target.value})}
                              className="w-full px-3 py-2 border border-neutral-300 rounded focus:outline-none focus:border-[var(--primary-color)]"
                              required
                           />
                        </div>
                    </div>

                    <div>
                       <label className="block text-sm font-bold text-neutral-700 mb-1">Remark</label>
                       <textarea
                          value={newCollection.remark}
                          onChange={(e) => setNewCollection({...newCollection, remark: e.target.value})}
                          className="w-full px-3 py-2 border border-neutral-300 rounded focus:outline-none focus:border-[var(--primary-color)]"
                          rows={2}
                          placeholder="Optional remark"
                       />
                    </div>

                    <div>
                       <label className="block text-sm font-bold text-neutral-700 mb-1">Date Time <span className="text-red-500">*</span></label>
                       <input
                          type="datetime-local"
                          value={newCollection.dateTime}
                          onChange={(e) => setNewCollection({...newCollection, dateTime: e.target.value})}
                          className="w-full px-3 py-2 border border-neutral-300 rounded focus:outline-none focus:border-[var(--primary-color)]"
                          required
                       />
                    </div>

                    <div className="flex justify-end gap-3 pt-4">
                       <button
                         type="button"
                         onClick={() => setShowModal(false)}
                         className="px-4 py-2 text-sm font-medium text-neutral-600 bg-neutral-100 hover:bg-neutral-200 rounded transition-colors"
                       >
                         Cancel
                       </button>
                       <button
                         type="submit"
                         className="px-4 py-2 text-sm font-bold text-white rounded shadow-md transition-colors"
                         style={{ backgroundColor: 'var(--primary-color)' }}
                       >
                         Submit
                       </button>
                    </div>
               </form>
           </div>
        </div>
       )}

      {/* Footer */}
      <div className="text-center text-sm text-neutral-500 py-4">
        Copyright © 2025. Developed By{' '}
        <a href="#" className="font-medium hover:text-[var(--primary-color)] transition-colors" style={{ color: 'var(--primary-color)' }}>
          Geeta Stores - 10 Minute App
        </a>
      </div>
    </div>
  );
}
