import { useState, useEffect } from "react";
import {
  getReturnRequests,
  processReturnRequest,
  ReturnRequest
} from "../../../services/api/admin/adminOrderService";
import { getDeliveryBoys, DeliveryBoy } from "../../../services/api/admin/adminDeliveryService";
import { useToast } from "../../../context/ToastContext";

export default function AdminReturnRequests() {
  const { showToast } = useToast();
  const [requests, setRequests] = useState<ReturnRequest[]>([]);
  const [deliveryBoys, setDeliveryBoys] = useState<DeliveryBoy[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null);
  const [selectedDeliveryBoy, setSelectedDeliveryBoy] = useState("");

  useEffect(() => {
    fetchRequests();
    fetchDeliveryBoys();
  }, []);

  const fetchRequests = async () => {
    try {
      setLoading(true);
      const response = await getReturnRequests({ requestType: "Return" });
      if (response.success) {
        setRequests(response.data);
      }
    } catch (error: any) {
      showToast(error.message || "Failed to fetch return requests", "error");
    } finally {
      setLoading(false);
    }
  };

  const fetchDeliveryBoys = async () => {
    try {
      const response = await getDeliveryBoys({ status: "Active" });
      if (response.success) {
        setDeliveryBoys(response.data);
      }
    } catch (error) {
      console.error("Failed to fetch delivery boys", error);
    }
  };

  const handleAcceptClick = (id: string) => {
    setSelectedRequestId(id);
    setShowAssignModal(true);
  };

  const handleConfirmAccept = async () => {
    if (!selectedRequestId || !selectedDeliveryBoy) {
      showToast("Please select a delivery boy", "error");
      return;
    }

    try {
      const response = await processReturnRequest(selectedRequestId, {
        status: "Approved",
        deliveryBoyId: selectedDeliveryBoy
      });

      if (response.success) {
        showToast("Return request approved and assigned", "success");
        setShowAssignModal(false);
        setSelectedRequestId(null);
        setSelectedDeliveryBoy("");
        fetchRequests();
      }
    } catch (error: any) {
      showToast(error.message || "Failed to process request", "error");
    }
  };

  const handleReject = async (id: string) => {
    const reason = prompt("Enter Rejection Reason:");
    if (!reason) return;

    try {
      const response = await processReturnRequest(id, {
        status: "Rejected",
        rejectionReason: reason
      });

      if (response.success) {
        showToast("Return request rejected", "success");
        fetchRequests();
      }
    } catch (error: any) {
      showToast(error.message || "Failed to reject request", "error");
    }
  };

  const filteredRequests = requests.filter(r =>
    (r.orderNumber || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
    (r.userName || "").toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
            <h1 className="text-2xl font-bold text-gray-800">Return Requests</h1>
            <p className="text-sm text-gray-500">Manage customer return requests</p>
        </div>

        <div className="flex gap-2">
           <input
             type="text"
             placeholder="Search Order ID or User..."
             className="border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
             value={searchTerm}
             onChange={(e) => setSearchTerm(e.target.value)}
           />
        </div>
      </div>

      {/* Content */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Order ID</th>
                <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase">User</th>
                <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Product</th>
                <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Qty</th>
                <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Reason</th>
                <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Status</th>
                <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-10 text-center text-gray-500">
                    Loading requests...
                  </td>
                </tr>
              ) : filteredRequests.map((request) => (
                <tr key={request._id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">{request.orderNumber}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{request.userName}</td>
                  <td className="px-6 py-4 text-sm text-gray-600 truncate max-w-[200px]">{request.productName}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{request.quantity}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{request.reason}</td>
                  <td className="px-6 py-4">
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        request.status === "Approved" || request.status === "Completed"
                          ? "bg-green-100 text-green-800"
                          : request.status === "Rejected"
                          ? "bg-red-100 text-red-800"
                          : "bg-yellow-100 text-yellow-800"
                      }`}
                    >
                      {request.status}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex gap-2">
                       {request.status === 'Pending' && (
                           <>
                             <button
                                onClick={() => handleAcceptClick(request._id)}
                                className="px-3 py-1 bg-green-600 text-white text-xs rounded hover:bg-green-700 transition-colors"
                             >
                               Accept
                             </button>
                             <button
                                onClick={() => handleReject(request._id)}
                                className="px-3 py-1 bg-red-600 text-white text-xs rounded hover:bg-red-700 transition-colors"
                             >
                               Reject
                             </button>
                           </>
                       )}
                       {request.status !== 'Pending' && (
                           <button className="px-3 py-1 bg-gray-100 text-gray-600 text-xs rounded hover:bg-gray-200 transition-colors">
                            View
                           </button>
                       )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!loading && filteredRequests.length === 0 && (
              <div className="p-8 text-center text-gray-500">
                  No return requests found.
              </div>
          )}
        </div>
      </div>

      {/* Assign Modal */}
      {showAssignModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Assign Delivery Boy for Pickup</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Select Delivery Boy</label>
                <select
                  className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500 outline-none"
                  value={selectedDeliveryBoy}
                  onChange={(e) => setSelectedDeliveryBoy(e.target.value)}
                >
                  <option value="">Select Delivery Boy</option>
                  {deliveryBoys.map(db => (
                    <option key={db._id} value={db._id}>{db.name} ({db.city})</option>
                  ))}
                </select>
              </div>
              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setShowAssignModal(false)}
                  className="flex-1 px-4 py-2 border rounded-lg text-gray-600 hover:bg-gray-50 font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmAccept}
                  className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium disabled:opacity-50"
                  disabled={!selectedDeliveryBoy}
                >
                  Confirm & Approve
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
