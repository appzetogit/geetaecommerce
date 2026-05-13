import { useState } from 'react';
import { toast } from 'react-hot-toast';

interface FundTransfer {
  id: string; // Changed to string for flexibility
  name: string;
  mobile: string;
  openingBalance: number;
  closingBalance: number;
  amount: number;
  type: 'Credit' | 'Debit';
  message: string;
  date: string;
}

export default function AdminFundTransfer() {
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [selectedDeliveryBoy, setSelectedDeliveryBoy] = useState('all');
  const [selectedMethod, setSelectedMethod] = useState('all');
  const [entriesPerPage, setEntriesPerPage] = useState(10);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [showModal, setShowModal] = useState(false);

  // New Fund Transfer Form State
  const [newTransfer, setNewTransfer] = useState({
    deliveryBoy: '',
    amount: '',
    message: '',
    date: new Date().toISOString().split('T')[0]
  });

  // Dummy Initial Data
  const [fundTransfers, setFundTransfers] = useState<FundTransfer[]>([
    {
      id: "1001",
      name: "Rahul Kumar",
      mobile: "9876543210",
      openingBalance: 5000,
      closingBalance: 4500,
      amount: 500,
      type: "Debit",
      message: "Cash deposited",
      date: "2024-02-15",
    },
    {
      id: "1002",
      name: "Amit Singh",
      mobile: "9812345678",
      openingBalance: 1200,
      closingBalance: 2200,
      amount: 1000,
      type: "Credit",
      message: "Bonus added",
      date: "2024-02-14",
    },
     {
      id: "1003",
      name: "Suresh",
      mobile: "9988776655",
      openingBalance: 200,
      closingBalance: 200,
      amount: 0,
      type: "Credit",
      message: "Account Verified",
      date: "2024-02-13",
    }
  ]);

  // Delivery Boys list (Mock)
  const deliveryBoys = [
    { id: '1', name: 'Rahul Kumar', mobile: '9876543210' },
    { id: '2', name: 'Amit Singh', mobile: '9812345678' },
    { id: '3', name: 'Suresh', mobile: '9988776655' },
  ];

  const handleAddTransfer = (e: React.FormEvent) => {
    e.preventDefault();

    if (!newTransfer.deliveryBoy || !newTransfer.amount || !newTransfer.date) {
      toast.error('Please fill all required fields');
      return;
    }

    const selectedBoy = deliveryBoys.find(b => b.name === newTransfer.deliveryBoy);
    const amountNum = parseFloat(newTransfer.amount);

    const newEntry: FundTransfer = {
      id: (Math.floor(Math.random() * 9000) + 1000).toString(),
      name: newTransfer.deliveryBoy,
      mobile: selectedBoy ? selectedBoy.mobile : 'N/A',
      openingBalance: 0, // Mock logic
      closingBalance: amountNum, // Mock logic
      amount: amountNum,
      type: 'Credit', // Assuming credit for fund transfer
      message: newTransfer.message,
      date: newTransfer.date,
    };

    setFundTransfers([newEntry, ...fundTransfers]);
    setShowModal(false);
    setNewTransfer({
      deliveryBoy: '',
      amount: '',
      message: '',
      date: new Date().toISOString().split('T')[0]
    });
    toast.success('Fund transfer added successfully');
  };

  const filteredTransfers = fundTransfers.filter(transfer => {
    const matchesSearch =
      transfer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      transfer.mobile.includes(searchTerm) ||
      transfer.id.includes(searchTerm);

    const matchesBoy = selectedDeliveryBoy === 'all' || transfer.name === selectedDeliveryBoy;

    // Date filtering logic would go here if needed, keeping simple for UI demo

    return matchesSearch && matchesBoy;
  });

  const totalPages = Math.ceil(filteredTransfers.length / entriesPerPage);
  const startIndex = (currentPage - 1) * entriesPerPage;
  const endIndex = startIndex + entriesPerPage;
  const displayedTransfers = filteredTransfers.slice(startIndex, endIndex);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="rounded-t-lg px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-4" style={{ backgroundColor: 'var(--primary-color)' }}>
        <h1 className="text-white text-xl font-bold">View Fund Transfer</h1>
        <button
          onClick={() => setShowModal(true)}
          className="bg-white text-[var(--primary-color)] px-4 py-2 rounded-lg text-sm font-bold shadow-sm hover:bg-neutral-50 transition-colors flex items-center gap-2"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19"></line>
            <line x1="5" y1="12" x2="19" y2="12"></line>
          </svg>
          Add Fund Transfer
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

            {/* Delivery Boy Filter */}
            <select
              value={selectedDeliveryBoy}
              onChange={(e) => setSelectedDeliveryBoy(e.target.value)}
              className="px-3 py-2 border border-neutral-300 rounded text-sm focus:outline-none focus:border-[var(--primary-color)] min-w-[150px]"
            >
              <option value="all">All Delivery Boy</option>
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
              <option value="all">Total Method</option>
              <option value="Cash">Cash</option>
              <option value="Online">Online</option>
            </select>

             <button className="bg-neutral-800 text-white px-4 py-2 rounded text-sm hover:bg-neutral-700">Filter</button>
             <button className="bg-neutral-200 text-neutral-700 px-4 py-2 rounded text-sm hover:bg-neutral-300">Reset</button>

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
                <input
                  type="text"
                  placeholder="Search..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="px-3 py-2 border border-neutral-300 rounded text-sm focus:outline-none focus:border-[var(--primary-color)]"
                />
                <button
                  className="text-white px-4 py-2 rounded text-sm flex items-center gap-2 transition-colors"
                  style={{ backgroundColor: 'var(--primary-color)' }}
                >
                  Export
                   <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                    <polyline points="7 10 12 15 17 10"></polyline>
                    <line x1="12" y1="15" x2="12" y2="3"></line>
                  </svg>
                </button>
             </div>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-neutral-50 border-b border-neutral-200">
              <tr>
                {['ID', 'Name', 'Mobile', 'Opening Balance', 'Closing Balance', 'Amount', 'Type', 'Message', 'Date'].map((header) => (
                  <th key={header} className="px-6 py-3 text-left text-xs font-bold text-neutral-600 uppercase tracking-wider">
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200">
              {displayedTransfers.length > 0 ? (
                displayedTransfers.map((item) => (
                  <tr key={item.id} className="hover:bg-neutral-50 transition-colors">
                    <td className="px-6 py-4 text-sm text-neutral-900 font-medium">#{item.id}</td>
                    <td className="px-6 py-4 text-sm text-neutral-900">{item.name}</td>
                    <td className="px-6 py-4 text-sm text-neutral-600">{item.mobile}</td>
                    <td className="px-6 py-4 text-sm text-neutral-900">₹{item.openingBalance}</td>
                    <td className="px-6 py-4 text-sm text-neutral-900">₹{item.closingBalance}</td>
                    <td className="px-6 py-4 text-sm font-bold text-neutral-900">₹{item.amount}</td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        item.type === 'Credit'
                          ? 'bg-[var(--primary-alpha-20)] text-[var(--primary-darker)]'
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {item.type}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-neutral-600 max-w-xs truncate">{item.message}</td>
                    <td className="px-6 py-4 text-sm text-neutral-600">{item.date}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={9} className="px-6 py-8 text-center text-sm text-neutral-500">
                    No records found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Footer / Pagination */}
        <div className="px-6 py-4 border-t border-neutral-200 flex items-center justify-between">
           <div className="text-sm text-neutral-600">
             Showing {startIndex + 1} to {Math.min(endIndex, filteredTransfers.length)} of {filteredTransfers.length} entries
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

      {/* Add Fund Transfer Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
             {/* Modal Header */}
             <div className="px-6 py-4 border-b border-neutral-100 flex items-center justify-between" style={{ backgroundColor: 'var(--primary-color)' }}>
                <h3 className="font-bold text-white">Add Fund Transfer</h3>
                <button onClick={() => setShowModal(false)} className="text-white hover:bg-white/20 rounded-full p-1 transition-colors">
                   <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                     <line x1="18" y1="6" x2="6" y2="18"></line>
                     <line x1="6" y1="6" x2="18" y2="18"></line>
                   </svg>
                </button>
             </div>

             {/* Modal Body */}
             <form onSubmit={handleAddTransfer} className="p-6 space-y-4">
                <div>
                   <label className="block text-sm font-bold text-neutral-700 mb-1">Select Delivery Boy <span className="text-red-500">*</span></label>
                   <select
                      value={newTransfer.deliveryBoy}
                      onChange={(e) => setNewTransfer({...newTransfer, deliveryBoy: e.target.value})}
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
                   <label className="block text-sm font-bold text-neutral-700 mb-1">Amount <span className="text-red-500">*</span></label>
                   <input
                      type="number"
                      value={newTransfer.amount}
                      onChange={(e) => setNewTransfer({...newTransfer, amount: e.target.value})}
                      className="w-full px-3 py-2 border border-neutral-300 rounded focus:outline-none focus:border-[var(--primary-color)]"
                      placeholder="Enter amount"
                      required
                   />
                </div>

                <div>
                   <label className="block text-sm font-bold text-neutral-700 mb-1">Message</label>
                   <textarea
                      value={newTransfer.message}
                      onChange={(e) => setNewTransfer({...newTransfer, message: e.target.value})}
                      className="w-full px-3 py-2 border border-neutral-300 rounded focus:outline-none focus:border-[var(--primary-color)]"
                      rows={3}
                      placeholder="Enter a message or remark"
                   />
                </div>

                <div>
                   <label className="block text-sm font-bold text-neutral-700 mb-1">Date <span className="text-red-500">*</span></label>
                   <input
                      type="date"
                      value={newTransfer.date}
                      onChange={(e) => setNewTransfer({...newTransfer, date: e.target.value})}
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
    </div>
  );
}
