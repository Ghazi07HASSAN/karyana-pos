'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

interface Customer {
  id: string;
  name: string;
  phone: string;
  address?: string;
  current_balance: number;
}

interface Bill {
  id: string;
  bill_number: number;
  total_amount: number;
  paid_amount: number;
  udhaar_amount: number;
  payment_status: string;
  created_at: string;
}

interface UdhaarPayment {
  id: string;
  amount_paid: number;
  payment_method: string;
  note?: string;
  created_at: string;
}

export default function KhataPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  // Selected Customer Ledger Data
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [customerBills, setCustomerBills] = useState<Bill[]>([]);
  const [customerPayments, setCustomerPayments] = useState<UdhaarPayment[]>([]);
  const [showLedgerModal, setShowLedgerModal] = useState(false);

  // Payment Entry State
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentData, setPaymentData] = useState({
    amount_paid: 0,
    payment_method: 'CASH',
    note: '',
  });

  useEffect(() => {
    fetchCustomers();
  }, []);

  const fetchCustomers = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('customers')
      .select('*')
      .order('current_balance', { ascending: false });

    if (error) console.error('Error fetching customers:', error);
    else setCustomers(data || []);
    setLoading(false);
  };

  // Customer ka Ledger Data (Bills & Payment History) Fetch karna
  const openCustomerLedger = async (customer: Customer) => {
    setSelectedCustomer(customer);
    setShowLedgerModal(true);

    // Fetch Bills for Customer
    const { data: bills } = await supabase
      .from('bills')
      .select('*')
      .eq('customer_id', customer.id)
      .order('created_at', { ascending: false });

    // Fetch Udhaar Payments History
    const { data: payments } = await supabase
      .from('udhaar_payments')
      .select('*')
      .eq('customer_id', customer.id)
      .order('created_at', { ascending: false });

    setCustomerBills(bills || []);
    setCustomerPayments(payments || []);
  };

  // Udhaar Wapsi Jama Karne ki Entry
  const handleCollectPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomer) return;
    if (paymentData.amount_paid <= 0) return alert('Invalid amount!');

    try {
      const { error } = await supabase.from('udhaar_payments').insert([
        {
          customer_id: selectedCustomer.id,
          amount_paid: Number(paymentData.amount_paid),
          payment_method: paymentData.payment_method,
          note: paymentData.note,
        },
      ]);

      if (error) throw error;

      alert('Payment Recorded Successfully!');
      setShowPaymentModal(false);
      setPaymentData({ amount_paid: 0, payment_method: 'CASH', note: '' });

      // Refresh data
      fetchCustomers();
      openCustomerLedger({
        ...selectedCustomer,
        current_balance: selectedCustomer.current_balance - Number(paymentData.amount_paid),
      });
    } catch (err: any) {
      alert('Failed to record payment: ' + err.message);
    }
  };

  const filteredCustomers = customers.filter(
    (c) =>
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (c.phone && c.phone.includes(searchQuery))
  );

  const totalMarketUdhaar = customers.reduce((sum, c) => sum + Number(c.current_balance), 0);

  return (
    <div className="p-6 max-w-7xl mx-auto font-sans">
      {/* Header & Total Udhaar Summary */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Udhaar Khata & Customer Ledger</h1>
          <p className="text-gray-500 text-sm">Customer wise balance and billing history</p>
        </div>
        
        <div className="bg-red-50 border border-red-200 px-4 py-2 rounded-lg text-right">
          <div className="text-xs font-semibold text-red-600 uppercase">Total Market Udhaar</div>
          <div className="text-xl font-bold text-red-700">Rs. {totalMarketUdhaar.toLocaleString()}</div>
        </div>
      </div>

      {/* Search Bar */}
      <input
        type="text"
        placeholder="Search customer by name or phone..."
        className="w-full border p-2.5 rounded-lg mb-6 text-sm focus:ring-2 focus:ring-red-500 outline-none"
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
      />

      {/* Customer List Table */}
      {loading ? (
        <p className="text-gray-500">Loading Khata Records...</p>
      ) : (
        <div className="overflow-x-auto bg-white rounded-lg shadow">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-100 border-b text-gray-700 text-sm">
                <th className="p-3">Customer Name</th>
                <th className="p-3">Phone Number</th>
                <th className="p-3">Current Udhaar Balance</th>
                <th className="p-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredCustomers.length === 0 ? (
                <tr>
                  <td colSpan={4} className="p-4 text-center text-gray-400 text-sm">
                    No customers found
                  </td>
                </tr>
              ) : (
                filteredCustomers.map((c) => (
                  <tr key={c.id} className="border-b hover:bg-gray-50 text-sm">
                    <td className="p-3 font-semibold text-gray-800">{c.name}</td>
                    <td className="p-3 text-gray-600 font-mono">{c.phone || 'N/A'}</td>
                    <td className="p-3">
                      <span
                        className={`font-bold px-2 py-1 rounded ${
                          c.current_balance > 0
                            ? 'bg-red-100 text-red-700'
                            : 'bg-green-100 text-green-700'
                        }`}
                      >
                        Rs. {Number(c.current_balance).toLocaleString()}
                      </span>
                    </td>
                    <td className="p-3 flex gap-2">
                      <button
                        onClick={() => openCustomerLedger(c)}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-xs font-medium"
                      >
                        View Ledger History
                      </button>
                      {c.current_balance > 0 && (
                        <button
                          onClick={() => {
                            setSelectedCustomer(c);
                            setShowPaymentModal(true);
                          }}
                          className="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded text-xs font-medium"
                        >
                          + Collect Udhaar
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* MODAL 1: Customer Complete Ledger (Bills & Udhaar Deposit History) */}
      {showLedgerModal && selectedCustomer && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-3xl shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b pb-3 mb-4">
              <div>
                <h2 className="text-xl font-bold text-gray-800">{selectedCustomer.name} - Khata Ledger</h2>
                <p className="text-xs text-gray-500">Phone: {selectedCustomer.phone || 'N/A'}</p>
              </div>
              <div className="text-right">
                <span className="text-xs text-gray-500 block">Remaining Balance</span>
                <span className="text-lg font-bold text-red-600">
                  Rs. {Number(selectedCustomer.current_balance).toLocaleString()}
                </span>
              </div>
            </div>

            {/* Udhaar Collection Quick Button inside Ledger */}
            {selectedCustomer.current_balance > 0 && (
              <div className="mb-4 flex justify-end">
                <button
                  onClick={() => setShowPaymentModal(true)}
                  className="bg-green-600 hover:bg-green-700 text-white px-4 py-1.5 rounded text-xs font-bold shadow"
                >
                  + Receive Udhaar Payment
                </button>
              </div>
            )}

            {/* Bill History Section */}
            <div className="mb-6">
              <h3 className="text-sm font-bold text-gray-700 mb-2 border-b pb-1">
                Bill History ({customerBills.length})
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="p-2 border">Bill #</th>
                      <th className="p-2 border">Date</th>
                      <th className="p-2 border">Total Amount</th>
                      <th className="p-2 border">Paid</th>
                      <th className="p-2 border">Udhaar Added</th>
                      <th className="p-2 border">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {customerBills.map((b) => (
                      <tr key={b.id} className="border-b">
                        <td className="p-2 border font-bold">#{b.bill_number}</td>
                        <td className="p-2 border">{new Date(b.created_at).toLocaleDateString()}</td>
                        <td className="p-2 border font-medium">Rs. {b.total_amount}</td>
                        <td className="p-2 border text-green-600">Rs. {b.paid_amount}</td>
                        <td className="p-2 border text-red-600 font-bold">Rs. {b.udhaar_amount}</td>
                        <td className="p-2 border uppercase font-bold text-[10px]">
                          <span
                            className={`px-1.5 py-0.5 rounded ${
                              b.payment_status === 'PAID'
                                ? 'bg-green-100 text-green-700'
                                : 'bg-red-100 text-red-700'
                            }`}
                          >
                            {b.payment_status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Payment Received History Section */}
            <div>
              <h3 className="text-sm font-bold text-gray-700 mb-2 border-b pb-1">
                Udhaar Payment Deposit Log ({customerPayments.length})
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="p-2 border">Date</th>
                      <th className="p-2 border">Amount Received</th>
                      <th className="p-2 border">Payment Method</th>
                      <th className="p-2 border">Note</th>
                    </tr>
                  </thead>
                  <tbody>
                    {customerPayments.map((p) => (
                      <tr key={p.id} className="border-b bg-green-50/50">
                        <td className="p-2 border">{new Date(p.created_at).toLocaleString()}</td>
                        <td className="p-2 border font-bold text-green-700">Rs. {p.amount_paid}</td>
                        <td className="p-2 border uppercase">{p.payment_method}</td>
                        <td className="p-2 border text-gray-500">{p.note || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex justify-end pt-4 mt-4 border-t">
              <button
                onClick={() => setShowLedgerModal(false)}
                className="px-4 py-1.5 bg-gray-200 text-gray-700 rounded text-xs font-semibold"
              >
                Close Ledger
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: Collect Udhaar Payment Form */}
      {showPaymentModal && selectedCustomer && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-[60]">
          <div className="bg-white rounded-lg p-6 w-full max-w-md shadow-2xl">
            <h2 className="text-lg font-bold text-gray-800 mb-1">Receive Udhaar Payment</h2>
            <p className="text-xs text-gray-500 mb-4">
              Customer: <span className="font-bold text-gray-800">{selectedCustomer.name}</span> (Current Balance: Rs. {selectedCustomer.current_balance})
            </p>

            <form onSubmit={handleCollectPayment} className="space-y-3">
              <div>
                <label className="text-xs text-gray-500">Amount Received (Rs.)</label>
                <input
                  type="number"
                  required
                  max={selectedCustomer.current_balance}
                  className="w-full border p-2 rounded text-sm font-bold text-green-700"
                  value={paymentData.amount_paid}
                  onChange={(e) =>
                    setPaymentData({ ...paymentData, amount_paid: Number(e.target.value) })
                  }
                />
              </div>

              <div>
                <label className="text-xs text-gray-500">Payment Method</label>
                <select
                  className="w-full border p-2 rounded text-sm bg-white"
                  value={paymentData.payment_method}
                  onChange={(e) =>
                    setPaymentData({ ...paymentData, payment_method: e.target.value })
                  }
                >
                  <option value="CASH">Cash</option>
                  <option value="JAZZCASH">JazzCash / EasyPaisa</option>
                  <option value="BANK">Bank Transfer</option>
                </select>
              </div>

              <div>
                <label className="text-xs text-gray-500">Note / Reference (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g., Received via JazzCash Transaction ID"
                  className="w-full border p-2 rounded text-sm"
                  value={paymentData.note}
                  onChange={(e) => setPaymentData({ ...paymentData, note: e.target.value })}
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setShowPaymentModal(false)}
                  className="px-4 py-2 border rounded text-xs text-gray-600"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded text-xs font-bold"
                >
                  Save Entry & Update Balance
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}