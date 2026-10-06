'use client';

import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useReactToPrint } from 'react-to-print';

interface Product {
  id: string;
  name: string;
  barcode: string;
  unit: string;
  retail_price: number;
  stock_quantity: number;
}

interface Customer {
  id?: string;
  name: string;
  phone: string;
}

interface CartItem {
  product: Product;
  quantity: number;
  subtotal: number;
}

export default function POSPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  
  // Customer Details
  const [customer, setCustomer] = useState<Customer>({ name: '', phone: '' });
  const [existingCustomers, setExistingCustomers] = useState<Customer[]>([]);
  
  // Payment Details
  const [discount, setDiscount] = useState(0);
  const [paidAmount, setPaidAmount] = useState(0);
  const [paymentType, setPaymentType] = useState<'CASH' | 'UDHAAR' | 'PARTIAL'>('CASH');
  const [lastBill, setLastBill] = useState<any>(null);

  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchProducts();
    fetchCustomers();
  }, []);

  const fetchProducts = async () => {
    const { data } = await supabase.from('products').select('*');
    setProducts(data || []);
  };

  const fetchCustomers = async () => {
    const { data } = await supabase.from('customers').select('*');
    setExistingCustomers(data || []);
  };

  // Cart Management
  const addToCart = (product: Product) => {
    const existing = cart.find((item) => item.product.id === product.id);
    if (existing) {
      setCart(
        cart.map((item) =>
          item.product.id === product.id
            ? {
                ...item,
                quantity: item.quantity + 1,
                subtotal: (item.quantity + 1) * item.product.retail_price,
              }
            : item
        )
      );
    } else {
      setCart([
        ...cart,
        { product, quantity: 1, subtotal: product.retail_price },
      ]);
    }
  };

  const updateQuantity = (productId: string, qty: number) => {
    if (qty <= 0) {
      setCart(cart.filter((item) => item.product.id !== productId));
      return;
    }
    setCart(
      cart.map((item) =>
        item.product.id === productId
          ? {
              ...item,
              quantity: qty,
              subtotal: qty * item.product.retail_price,
            }
          : item
      )
    );
  };

  // Calculations
  const grossTotal = cart.reduce((sum, item) => sum + item.subtotal, 0);
  const netTotal = Math.max(0, grossTotal - discount);
  
  const calculateUdhaar = () => {
    if (paymentType === 'CASH') return 0;
    if (paymentType === 'UDHAAR') return netTotal;
    return Math.max(0, netTotal - paidAmount);
  };

  const actualPaid = paymentType === 'CASH' ? netTotal : paymentType === 'UDHAAR' ? 0 : paidAmount;
  const udhaarAmount = calculateUdhaar();

  // Print Setup
  const handlePrint = useReactToPrint({
    contentRef: printRef,
  });

  // Submit Bill
  const handleCheckout = async () => {
    if (cart.length === 0) return alert('Cart is empty!');
    if ((paymentType === 'UDHAAR' || paymentType === 'PARTIAL') && !customer.name) {
      return alert('Customer name is required for Udhaar transaction!');
    }

    try {
      let customerId = customer.id;

      // 1. Save / Get Customer if phone/name provided
      if (!customerId && customer.name) {
        const { data: newCust, error: custErr } = await supabase
          .from('customers')
          .insert([{ name: customer.name, phone: customer.phone }])
          .select()
          .single();

        if (custErr) throw custErr;
        customerId = newCust.id;
      }

      // 2. Save Bill Entry
      const { data: bill, error: billErr } = await supabase
        .from('bills')
        .insert([
          {
            customer_id: customerId || null,
            total_amount: netTotal,
            discount: discount,
            paid_amount: actualPaid,
            udhaar_amount: udhaarAmount,
            payment_status: paymentType,
          },
        ])
        .select()
        .single();

      if (billErr) throw billErr;

      // 3. Save Bill Items (DB Triggers will automatically reduce product stock)
      const billItemsData = cart.map((item) => ({
        bill_id: bill.id,
        product_id: item.product.id,
        product_name: item.product.name,
        quantity: item.quantity,
        unit_price: item.product.retail_price,
        subtotal: item.subtotal,
      }));

      const { error: itemsErr } = await supabase.from('bill_items').insert(billItemsData);
      if (itemsErr) throw itemsErr;

      // Set Bill data for printing
      setLastBill({
        billNumber: bill.bill_number,
        date: new Date().toLocaleString('en-PK'),
        customerName: customer.name || 'Walk-in Customer',
        customerPhone: customer.phone || 'N/A',
        items: cart,
        grossTotal,
        discount,
        netTotal,
        paidAmount: actualPaid,
        udhaarAmount,
        paymentType,
      });

      alert('Bill Generated Successfully!');
      
      // Auto trigger print
      setTimeout(() => {
        handlePrint();
      }, 300);

      // Reset state
      setCart([]);
      setCustomer({ name: '', phone: '' });
      setDiscount(0);
      setPaidAmount(0);
      fetchProducts();
      fetchCustomers();
    } catch (err: any) {
      alert('Checkout Failed: ' + err.message);
    }
  };

  const filteredProducts = products.filter(
    (p) =>
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.barcode && p.barcode.includes(searchQuery))
  );

  return (
    <div className="p-4 max-w-7xl mx-auto font-sans grid grid-cols-1 md:grid-cols-12 gap-4">
      {/* LEFT SIDE: Product Search & Grid (7 Columns) */}
      <div className="md:col-span-7 bg-white p-4 rounded-lg shadow">
        <h1 className="text-xl font-bold mb-3 text-gray-800">POS Billing Counter</h1>
        
        <input
          type="text"
          placeholder="Search by product name or scan barcode..."
          className="w-full border p-2.5 rounded-lg mb-4 text-sm focus:ring-2 focus:ring-green-500 outline-none"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-[500px] overflow-y-auto">
          {filteredProducts.map((p) => (
            <button
              key={p.id}
              onClick={() => addToCart(p)}
              disabled={p.stock_quantity <= 0}
              className={`p-3 text-left border rounded-lg transition hover:shadow-md ${
                p.stock_quantity <= 0 ? 'bg-gray-100 opacity-60 cursor-not-allowed' : 'bg-white hover:border-green-500'
              }`}
            >
              <div className="font-semibold text-gray-800 text-sm">{p.name}</div>
              <div className="text-xs text-gray-500 font-mono">Stock: {p.stock_quantity} {p.unit}</div>
              <div className="text-sm font-bold text-green-700 mt-1">Rs. {p.retail_price}</div>
            </button>
          ))}
        </div>
      </div>

      {/* RIGHT SIDE: Cart, Customer & Payment (5 Columns) */}
      <div className="md:col-span-5 bg-white p-4 rounded-lg shadow flex flex-col justify-between">
        <div>
          <h2 className="text-lg font-bold text-gray-800 border-b pb-2 mb-3">Cart Summary</h2>

          {/* Cart Items List */}
          <div className="max-h-48 overflow-y-auto mb-4 border-b pb-2 space-y-2">
            {cart.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-4">No items added to cart</p>
            ) : (
              cart.map((item) => (
                <div key={item.product.id} className="flex justify-between items-center text-sm">
                  <div>
                    <div className="font-semibold text-gray-800">{item.product.name}</div>
                    <div className="text-xs text-gray-500">Rs. {item.product.retail_price} / {item.product.unit}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => updateQuantity(item.product.id, item.quantity - 1)}
                      className="bg-gray-200 px-2 rounded text-xs font-bold"
                    >
                      -
                    </button>
                    <span className="font-semibold">{item.quantity}</span>
                    <button
                      onClick={() => updateQuantity(item.product.id, item.quantity + 1)}
                      className="bg-gray-200 px-2 rounded text-xs font-bold"
                    >
                      +
                    </button>
                    <span className="w-16 text-right font-bold text-gray-800">Rs. {item.subtotal}</span>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Customer Selection */}
          <div className="space-y-2 mb-4 bg-gray-50 p-3 rounded-lg border">
            <h3 className="text-xs font-bold uppercase text-gray-500">Customer Details</h3>
            <input
              type="text"
              placeholder="Customer Name"
              className="w-full border p-1.5 rounded text-sm bg-white"
              value={customer.name}
              onChange={(e) => setCustomer({ ...customer, name: e.target.value })}
            />
            <input
              type="text"
              placeholder="Mobile Phone Number"
              className="w-full border p-1.5 rounded text-sm bg-white"
              value={customer.phone}
              onChange={(e) => setCustomer({ ...customer, phone: e.target.value })}
            />
          </div>

          {/* Payment Type & Discount */}
          <div className="space-y-2">
            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={() => setPaymentType('CASH')}
                className={`py-1.5 rounded text-xs font-bold border ${
                  paymentType === 'CASH' ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-700'
                }`}
              >
                CASH
              </button>
              <button
                onClick={() => setPaymentType('UDHAAR')}
                className={`py-1.5 rounded text-xs font-bold border ${
                  paymentType === 'UDHAAR' ? 'bg-red-600 text-white' : 'bg-gray-100 text-gray-700'
                }`}
              >
                FULL UDHAAR
              </button>
              <button
                onClick={() => setPaymentType('PARTIAL')}
                className={`py-1.5 rounded text-xs font-bold border ${
                  paymentType === 'PARTIAL' ? 'bg-orange-500 text-white' : 'bg-gray-100 text-gray-700'
                }`}
              >
                PARTIAL
              </button>
            </div>

            {paymentType === 'PARTIAL' && (
              <div>
                <label className="text-xs text-gray-500">Cash Received (Rs.)</label>
                <input
                  type="number"
                  className="w-full border p-1.5 rounded text-sm"
                  value={paidAmount}
                  onChange={(e) => setPaidAmount(Number(e.target.value))}
                />
              </div>
            )}

            <div className="flex justify-between items-center text-sm pt-2">
              <span className="text-gray-500">Discount (Rs.):</span>
              <input
                type="number"
                className="w-24 border p-1 rounded text-right text-sm font-semibold"
                value={discount}
                onChange={(e) => setDiscount(Number(e.target.value))}
              />
            </div>
          </div>
        </div>

        {/* Bill Total & Checkout */}
        <div className="pt-4 border-t mt-4">
          <div className="flex justify-between text-sm mb-1">
            <span className="text-gray-500">Gross Total:</span>
            <span className="font-semibold">Rs. {grossTotal}</span>
          </div>
          {udhaarAmount > 0 && (
            <div className="flex justify-between text-sm text-red-600 font-semibold mb-1">
              <span>Udhaar Balance:</span>
              <span>Rs. {udhaarAmount}</span>
            </div>
          )}
          <div className="flex justify-between text-lg font-bold text-gray-900 mb-4">
            <span>Net Payable:</span>
            <span>Rs. {netTotal}</span>
          </div>

          <button
            onClick={handleCheckout}
            className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 rounded-lg shadow transition"
          >
            Generate Bill & Print Receipt
          </button>
        </div>
      </div>

      {/* HIDDEN THERMAL PRINT RECEIPT COMPONENT (80mm width) */}
      <div className="hidden">
        <div ref={printRef} className="p-4 w-[80mm] text-black font-mono text-xs leading-tight">
          <div className="text-center mb-3">
            <h2 className="text-base font-bold uppercase">AL-MADINA WHOLESALE KARYANA</h2>
            <p className="text-[10px]">Main Bazaar, Wholesale Market</p>
            <p className="text-[10px]">Phone: 0300-1234567</p>
            <div className="border-b border-dashed border-black my-2"></div>
          </div>

          {lastBill && (
            <>
              <div className="mb-2 space-y-0.5">
                <div>Bill #: <span className="font-bold">{lastBill.billNumber}</span></div>
                <div>Date: {lastBill.date}</div>
                <div>Customer: {lastBill.customerName}</div>
                <div>Phone: {lastBill.customerPhone}</div>
              </div>

              <div className="border-b border-dashed border-black my-2"></div>

              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-black">
                    <th className="py-1">Item</th>
                    <th className="text-center">Qty</th>
                    <th className="text-right">Price</th>
                  </tr>
                </thead>
                <tbody>
                  {lastBill.items.map((item: CartItem, i: number) => (
                    <tr key={i}>
                      <td className="py-1">{item.product.name}</td>
                      <td className="text-center">{item.quantity}</td>
                      <td className="text-right">{item.subtotal}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="border-b border-dashed border-black my-2"></div>

              <div className="space-y-1">
                <div className="flex justify-between">
                  <span>Gross Total:</span>
                  <span>Rs. {lastBill.grossTotal}</span>
                </div>
                {lastBill.discount > 0 && (
                  <div className="flex justify-between">
                    <span>Discount:</span>
                    <span>- Rs. {lastBill.discount}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-sm pt-1 border-t border-black">
                  <span>Net Total:</span>
                  <span>Rs. {lastBill.netTotal}</span>
                </div>
                <div className="flex justify-between">
                  <span>Paid Amount:</span>
                  <span>Rs. {lastBill.paidAmount}</span>
                </div>
                {lastBill.udhaarAmount > 0 && (
                  <div className="flex justify-between font-bold">
                    <span>Udhaar Added:</span>
                    <span>Rs. {lastBill.udhaarAmount}</span>
                  </div>
                )}
              </div>

              <div className="border-b border-dashed border-black my-2"></div>
              <p className="text-center text-[10px] mt-2">Shukriya! Phir Tashreef Layein.</p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}