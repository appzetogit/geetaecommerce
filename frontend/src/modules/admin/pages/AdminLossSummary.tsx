import React, { useState, useEffect } from "react";
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface LossData {
  _id: string;
  date: string;
  productName: string;
  weight: string;
  quantity: number;
  reason: string;
}

type DateFilterType = 'today' | 'tomorrow' | 'last7days' | 'last30days' | 'alltime' | 'custom';

const AdminLossSummary = () => {
  const [data, setData] = useState<LossData[]>([]);
  const [filteredData, setFilteredData] = useState<LossData[]>([]);
  const [loading, setLoading] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState("");
  const [dateFilterType, setDateFilterType] = useState<DateFilterType>('alltime');
  const [customDateRange, setCustomDateRange] = useState({ start: "", end: "" });
  const [showCustomDatePicker, setShowCustomDatePicker] = useState(false);
  const [showAddLossModal, setShowAddLossModal] = useState(false);

  // Add Loss Form State
  const [newLoss, setNewLoss] = useState({
    date: new Date().toISOString().split('T')[0],
    productName: "",
    weight: "Piece",
    quantity: 0,
    reason: "Missing"
  });

  // Dummy data for demonstration
  useEffect(() => {
    const dummyData: LossData[] = [
      {
        _id: "1",
        date: "2026-02-03",
        productName: "H6 smart watch 650",
        weight: "Piece",
        quantity: 1,
        reason: "Missing"
      },
      {
        _id: "2",
        date: "2026-02-03",
        productName: "BENKI lighter 780",
        weight: "Piece",
        quantity: 4,
        reason: "Missing"
      }
    ];
    setData(dummyData);
    setFilteredData(dummyData);
  }, []);

  // Filter data based on search
  useEffect(() => {
    let filtered = [...data];

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(item =>
        item.productName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.reason.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.date.includes(searchTerm)
      );
    }

    setFilteredData(filtered);
  }, [searchTerm, data]);

  const handleCellEdit = (id: string, field: keyof LossData, value: any) => {
    setFilteredData(prev => prev.map(item =>
      item._id === id ? { ...item, [field]: value } : item
    ));
    setData(prev => prev.map(item =>
      item._id === id ? { ...item, [field]: value } : item
    ));
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedRows(new Set(filteredData.map(item => item._id)));
    } else {
      setSelectedRows(new Set());
    }
  };

  const handleSelectRow = (id: string) => {
    const newSelected = new Set(selectedRows);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedRows(newSelected);
  };

  const handleDateFilterChange = (type: DateFilterType) => {
    setDateFilterType(type);
    if (type === 'custom') {
      setShowCustomDatePicker(true);
    } else {
      setShowCustomDatePicker(false);
    }
  };

  const handleAddLoss = () => {
    const newLossEntry: LossData = {
      _id: Date.now().toString(),
      ...newLoss
    };

    setData(prev => [newLossEntry, ...prev]);
    setFilteredData(prev => [newLossEntry, ...prev]);

    // Reset form
    setNewLoss({
      date: new Date().toISOString().split('T')[0],
      productName: "",
      weight: "Piece",
      quantity: 0,
      reason: "Missing"
    });

    setShowAddLossModal(false);
  };

  const downloadExcel = () => {
    const worksheet = XLSX.utils.json_to_sheet(filteredData.map(item => ({
      "Date": item.date,
      "Product Name": item.productName,
      "Weight/UOM": item.weight,
      "Quantity": item.quantity,
      "Reason": item.reason
    })));

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Loss Summary");
    XLSX.writeFile(workbook, `Loss_Summary_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const downloadPDF = () => {
    const doc = new jsPDF('landscape');

    doc.setFontSize(18);
    doc.text('Loss Summary Report', 14, 15);
    doc.setFontSize(10);
    doc.text(`Generated on: ${new Date().toLocaleString()}`, 14, 22);

    const tableData = filteredData.map(item => [
      item.date,
      item.productName,
      item.weight,
      item.quantity.toString(),
      item.reason
    ]);

    autoTable(doc, {
      head: [['Date', 'Product Name', 'Weight/UOM', 'Quantity', 'Reason']],
      body: tableData,
      startY: 28,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [239, 68, 68] }
    });

    doc.save(`Loss_Summary_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Header Section */}
      <div className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Loss Summary</h1>
              <p className="text-sm text-gray-500 mt-1">Track and manage inventory losses</p>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setShowAddLossModal(true)}
                className="inline-flex items-center px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 active:scale-95 transition-all shadow-sm">
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                </svg>
                Add Loss
              </button>

              <button
                onClick={() => setEditMode(!editMode)}
                className="inline-flex items-center px-4 py-2 bg-purple-600 text-white text-sm font-semibold rounded-lg hover:bg-purple-700 active:scale-95 transition-all shadow-sm">
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                </svg>
                {editMode ? 'Done Editing' : 'Bulk Edit'}
              </button>

              <button
                onClick={downloadExcel}
                className="inline-flex items-center px-4 py-2 bg-green-600 text-white text-sm font-semibold rounded-lg hover:bg-green-700 active:scale-95 transition-all shadow-sm">
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Excel
              </button>

              <button
                onClick={downloadPDF}
                className="inline-flex items-center px-4 py-2 bg-red-600 text-white text-sm font-semibold rounded-lg hover:bg-red-700 active:scale-95 transition-all shadow-sm">
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
                PDF
              </button>
            </div>
          </div>

          {/* Date Filter Tabs */}
          <div className="mt-4 flex flex-wrap items-center gap-2 bg-gray-50 p-2 rounded-lg">
            <button
              onClick={() => handleDateFilterChange('today')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                dateFilterType === 'today'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-white/50'
              }`}>
              Today
            </button>
            <button
              onClick={() => handleDateFilterChange('tomorrow')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                dateFilterType === 'tomorrow'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-white/50'
              }`}>
              Tomorrow
            </button>
            <button
              onClick={() => handleDateFilterChange('last7days')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                dateFilterType === 'last7days'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-white/50'
              }`}>
              Last 7 Days
            </button>
            <button
              onClick={() => handleDateFilterChange('last30days')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                dateFilterType === 'last30days'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-white/50'
              }`}>
              Last 30 Days
            </button>
            <button
              onClick={() => handleDateFilterChange('alltime')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                dateFilterType === 'alltime'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-white/50'
              }`}>
              All Time
            </button>
            <button
              onClick={() => handleDateFilterChange('custom')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                dateFilterType === 'custom'
                  ? 'bg-teal-600 text-white shadow-sm'
                  : 'text-teal-600 hover:bg-teal-50'
              }`}>
              Custom
            </button>
            <button className="p-2 text-teal-600 hover:bg-teal-50 rounded-lg transition-all">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
              </svg>
            </button>
          </div>

          {/* Custom Date Range Picker */}
          {showCustomDatePicker && (
            <div className="mt-4 p-4 bg-teal-50 rounded-lg border border-teal-200">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1.5">Start Date</label>
                  <input
                    type="date"
                    value={customDateRange.start}
                    onChange={(e) => setCustomDateRange({ ...customDateRange, start: e.target.value })}
                    className="w-full px-4 py-2.5 text-sm border border-gray-300 rounded-lg focus:border-teal-500 focus:ring-2 focus:ring-teal-200 outline-none transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1.5">End Date</label>
                  <input
                    type="date"
                    value={customDateRange.end}
                    onChange={(e) => setCustomDateRange({ ...customDateRange, end: e.target.value })}
                    className="w-full px-4 py-2.5 text-sm border border-gray-300 rounded-lg focus:border-teal-500 focus:ring-2 focus:ring-teal-200 outline-none transition-all"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Search Filter */}
          <div className="mt-4">
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Search</label>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by product name, date, or reason..."
              className="w-full px-4 py-2.5 text-sm border border-gray-300 rounded-lg focus:border-pink-500 focus:ring-2 focus:ring-pink-200 outline-none transition-all"
            />
          </div>
        </div>
      </div>

      {/* Table Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gradient-to-r from-red-50 to-orange-50 border-b-2 border-red-200">
                  {editMode && (
                    <th className="px-3 py-3 text-left sticky left-0 bg-red-50 z-10">
                      <input
                        type="checkbox"
                        checked={selectedRows.size === filteredData.length && filteredData.length > 0}
                        onChange={(e) => handleSelectAll(e.target.checked)}
                        className="w-4 h-4 text-pink-600 rounded border-gray-300 focus:ring-pink-500"
                      />
                    </th>
                  )}
                  <th className="px-3 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider sticky left-0 bg-red-50 z-10">Date</th>
                  <th className="px-3 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">Product Name</th>
                  <th className="px-3 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">Weight/UOM</th>
                  <th className="px-3 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider bg-red-100">Quantity</th>
                  <th className="px-3 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">Reason</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredData.length === 0 ? (
                  <tr>
                    <td colSpan={editMode ? 7 : 6} className="px-6 py-12 text-center text-gray-400 text-sm">
                      No loss records found
                    </td>
                  </tr>
                ) : (
                  filteredData.map((item) => (
                    <tr key={item._id} className="hover:bg-red-50/30 transition-colors">
                      {editMode && (
                        <td className="px-3 py-3 sticky left-0 bg-white">
                          <input
                            type="checkbox"
                            checked={selectedRows.has(item._id)}
                            onChange={() => handleSelectRow(item._id)}
                            className="w-4 h-4 text-pink-600 rounded border-gray-300 focus:ring-pink-500"
                          />
                        </td>
                      )}
                      <td className="px-3 py-3 sticky left-0 bg-white">
                        {editMode ? (
                          <input
                            type="date"
                            value={item.date}
                            onChange={(e) => handleCellEdit(item._id, 'date', e.target.value)}
                            className="w-full px-2 py-1 text-sm border border-gray-200 rounded focus:border-pink-500 focus:ring-1 focus:ring-pink-500 outline-none"
                          />
                        ) : (
                          <span className="text-sm text-gray-900">{item.date}</span>
                        )}
                      </td>
                      <td className="px-3 py-3">
                        {editMode ? (
                          <input
                            type="text"
                            value={item.productName}
                            onChange={(e) => handleCellEdit(item._id, 'productName', e.target.value)}
                            className="w-full px-2 py-1 text-sm border border-gray-200 rounded focus:border-pink-500 focus:ring-1 focus:ring-pink-500 outline-none font-semibold"
                          />
                        ) : (
                          <span className="text-sm font-semibold text-gray-900">{item.productName}</span>
                        )}
                      </td>
                      <td className="px-3 py-3">
                        {editMode ? (
                          <input
                            type="text"
                            value={item.weight}
                            onChange={(e) => handleCellEdit(item._id, 'weight', e.target.value)}
                            className="w-20 px-2 py-1 text-sm border border-gray-200 rounded focus:border-pink-500 focus:ring-1 focus:ring-pink-500 outline-none"
                          />
                        ) : (
                          <span className="text-xs px-2 py-1 bg-gray-100 text-gray-700 rounded-full font-medium">{item.weight}</span>
                        )}
                      </td>
                      <td className="px-3 py-3 bg-red-100">
                        {editMode ? (
                          <input
                            type="number"
                            value={item.quantity}
                            onChange={(e) => handleCellEdit(item._id, 'quantity', parseInt(e.target.value))}
                            className="w-20 px-2 py-1 text-sm border border-gray-200 rounded focus:border-pink-500 focus:ring-1 focus:ring-pink-500 outline-none font-bold text-red-700"
                          />
                        ) : (
                          <span className="text-sm font-bold text-red-700">{item.quantity}</span>
                        )}
                      </td>
                      <td className="px-3 py-3">
                        {editMode ? (
                          <input
                            type="text"
                            value={item.reason}
                            onChange={(e) => handleCellEdit(item._id, 'reason', e.target.value)}
                            className="w-full px-2 py-1 text-sm border border-gray-200 rounded focus:border-pink-500 focus:ring-1 focus:ring-pink-500 outline-none"
                          />
                        ) : (
                          <span className="text-xs px-2 py-1 bg-orange-100 text-orange-700 rounded-full font-medium">{item.reason}</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-6">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 hover:shadow-md transition-shadow">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Total Loss Records</p>
            <p className="text-3xl font-black text-red-600 mt-2">
              {filteredData.length}
            </p>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 hover:shadow-md transition-shadow">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Total Items Lost</p>
            <p className="text-3xl font-black text-orange-600 mt-2">
              {filteredData.reduce((sum, item) => sum + item.quantity, 0)}
            </p>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 hover:shadow-md transition-shadow">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Unique Products</p>
            <p className="text-3xl font-black text-purple-600 mt-2">
              {new Set(filteredData.map(item => item.productName)).size}
            </p>
          </div>
        </div>
      </div>

      {/* Add Loss Modal */}
      {showAddLossModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">Add Loss Record</h2>
              <button
                onClick={() => setShowAddLossModal(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Date</label>
                <input
                  type="date"
                  value={newLoss.date}
                  onChange={(e) => setNewLoss({ ...newLoss, date: e.target.value })}
                  className="w-full px-4 py-2.5 text-sm border border-gray-300 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Product Name</label>
                <input
                  type="text"
                  value={newLoss.productName}
                  onChange={(e) => setNewLoss({ ...newLoss, productName: e.target.value })}
                  placeholder="Enter product name"
                  className="w-full px-4 py-2.5 text-sm border border-gray-300 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Weight/UOM</label>
                <select
                  value={newLoss.weight}
                  onChange={(e) => setNewLoss({ ...newLoss, weight: e.target.value })}
                  className="w-full px-4 py-2.5 text-sm border border-gray-300 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all">
                  <option value="Piece">Piece</option>
                  <option value="kg">kg</option>
                  <option value="ltr">ltr</option>
                  <option value="gm">gm</option>
                  <option value="ml">ml</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Quantity</label>
                <input
                  type="number"
                  value={newLoss.quantity}
                  onChange={(e) => setNewLoss({ ...newLoss, quantity: parseInt(e.target.value) })}
                  placeholder="Enter quantity"
                  min="0"
                  className="w-full px-4 py-2.5 text-sm border border-gray-300 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Reason</label>
                <select
                  value={newLoss.reason}
                  onChange={(e) => setNewLoss({ ...newLoss, reason: e.target.value })}
                  className="w-full px-4 py-2.5 text-sm border border-gray-300 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all">
                  <option value="Missing">Missing</option>
                  <option value="Damaged">Damaged</option>
                  <option value="Expired">Expired</option>
                  <option value="Theft">Theft</option>
                  <option value="Broken">Broken</option>
                  <option value="Other">Other</option>
                </select>
              </div>
            </div>

            <div className="sticky bottom-0 bg-gray-50 px-6 py-4 flex gap-3">
              <button
                onClick={() => setShowAddLossModal(false)}
                className="flex-1 px-4 py-2.5 bg-gray-200 text-gray-700 text-sm font-semibold rounded-lg hover:bg-gray-300 active:scale-95 transition-all">
                Cancel
              </button>
              <button
                onClick={handleAddLoss}
                disabled={!newLoss.productName || newLoss.quantity <= 0}
                className="flex-1 px-4 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed">
                Add Loss
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminLossSummary;
