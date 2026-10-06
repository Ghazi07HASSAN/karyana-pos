'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

interface Product {
  id: string;
  name: string;
  barcode: string;
  unit: string;
  wholesale_price: number;
  retail_price: number;
  stock_quantity: number;
  min_stock_alert: number;
}

export default function StockPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  // New Item Form State
  const [showAddModal, setShowAddModal] = useState(false);
  const [newItem, setNewItem] = useState({
    name: '',
    barcode: '',
    unit: 'kg',
    wholesale_price: 0,
    retail_price: 0,
    stock_quantity: 0,
    min_stock_alert: 5,
  });

  // Restock Form State
  const [showRestockModal, setShowRestockModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [restockData, setRestockData] = useState({
    quantity_added: 0,
    purchase_price: 0,
    supplier_name: '',
  });

  // Fetch Products
  const fetchProducts = async () => {
    setLoading(true);
    const { data, error } = await supabase.from('products').select('*').order('name');
    if (error) console.error('Error fetching products:', error);
    else setProducts(data || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  // 1. Add New Product
  const handleAddProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    const { error } = await supabase.from('products').insert([newItem]);
    if (error) alert('Error adding product: ' + error.message);
    else {
      alert('Product Added Successfully!');
      setShowAddModal(false);
      setNewItem({
        name: '',
        barcode: '',
        unit: 'kg',
        wholesale_price: 0,
        retail_price: 0,
        stock_quantity: 0,
        min_stock_alert: 5,
      });
      fetchProducts();
    }
  };

  // 2. Add Restock (Trigger automatically updates stock_quantity in DB)
  const handleRestock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProduct) return;

    const { error } = await supabase.from('stock_logs').insert([
      {
        product_id: selectedProduct.id,
        quantity_added: Number(restockData.quantity_added),
        purchase_price: Number(restockData.purchase_price),
        supplier_name: restockData.supplier_name,
      },
    ]);

    if (error) alert('Error adding stock log: ' + error.message);
    else {
      alert('Stock Updated Successfully!');
      setShowRestockModal(false);
      setRestockData({ quantity_added: 0, purchase_price: 0, supplier_name: '' });
      fetchProducts();
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto font-sans">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Wholesale Karyana Stock</h1>
          <p className="text-gray-500 text-sm">Manage Items & Add Restock Entry</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-semibold shadow"
        >
          + Add New Item
        </button>
      </div>

      {/* Stock Table */}
      {loading ? (
        <p className="text-gray-500">Loading Stock...</p>
      ) : (
        <div className="overflow-x-auto bg-white rounded-lg shadow">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-100 border-b text-gray-700 text-sm">
                <th className="p-3">Item Name</th>
                <th className="p-3">Unit</th>
                <th className="p-3">Wholesale Price</th>
                <th className="p-3">Retail Price</th>
                <th className="p-3">Available Stock</th>
                <th className="p-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {products.map((p) => (
                <tr key={p.id} className="border-b hover:bg-gray-50 text-sm">
                  <td className="p-3 font-semibold text-gray-800">
                    {p.name}
                    {p.stock_quantity <= p.min_stock_alert && (
                      <span className="ml-2 px-2 py-0.5 bg-red-100 text-red-600 text-xs rounded-full">
                        Low Stock
                      </span>
                    )}
                  </td>
                  <td className="p-3 uppercase text-gray-600">{p.unit}</td>
                  <td className="p-3">Rs. {p.wholesale_price}</td>
                  <td className="p-3 font-medium text-green-700">Rs. {p.retail_price}</td>
                  <td
                    className={`p-3 font-bold ${
                      p.stock_quantity <= p.min_stock_alert ? 'text-red-600' : 'text-gray-800'
                    }`}
                  >
                    {p.stock_quantity} {p.unit}
                  </td>
                  <td className="p-3">
                    <button
                      onClick={() => {
                        setSelectedProduct(p);
                        setShowRestockModal(true);
                      }}
                      className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-xs"
                    >
                      + Add Stock
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* MODAL 1: Add New Product */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-md shadow-xl">
            <h2 className="text-lg font-bold mb-4 text-gray-800">Add New Karyana Item</h2>
            <form onSubmit={handleAddProduct} className="space-y-3">
              <input
                type="text"
                placeholder="Item Name (e.g., Ghee 1kg)"
                required
                className="w-full border p-2 rounded text-sm"
                value={newItem.name}
                onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
              />
              <div className="grid grid-cols-2 gap-2">
                <select
                  className="border p-2 rounded text-sm"
                  value={newItem.unit}
                  onChange={(e) => setNewItem({ ...newItem, unit: e.target.value })}
                >
                  <option value="kg">kg</option>
                  <option value="packet">packet</option>
                  <option value="carton">carton</option>
                  <option value="ltr">ltr</option>
                  <option value="pcs">pcs</option>
                  <option value="dozen">dozen</option>
                </select>
                <input
                  type="text"
                  placeholder="Barcode (Optional)"
                  className="border p-2 rounded text-sm"
                  value={newItem.barcode}
                  onChange={(e) => setNewItem({ ...newItem, barcode: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-gray-500">Wholesale Price</label>
                  <input
                    type="number"
                    required
                    className="w-full border p-2 rounded text-sm"
                    value={newItem.wholesale_price}
                    onChange={(e) =>
                      setNewItem({ ...newItem, wholesale_price: Number(e.target.value) })
                    }
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500">Retail Sale Price</label>
                  <input
                    type="number"
                    required
                    className="w-full border p-2 rounded text-sm"
                    value={newItem.retail_price}
                    onChange={(e) =>
                      setNewItem({ ...newItem, retail_price: Number(e.target.value) })
                    }
                  />
                </div>
              </div>
              <div>
                <label className="text-xs text-gray-500">Initial Stock Qty</label>
                <input
                  type="number"
                  required
                  className="w-full border p-2 rounded text-sm"
                  value={newItem.stock_quantity}
                  onChange={(e) =>
                    setNewItem({ ...newItem, stock_quantity: Number(e.target.value) })
                  }
                />
              </div>
              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 border rounded text-sm text-gray-600"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-green-600 text-white rounded text-sm font-semibold"
                >
                  Save Item
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: Add Stock (Restock) */}
      {showRestockModal && selectedProduct && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-md shadow-xl">
            <h2 className="text-lg font-bold mb-1 text-gray-800">Add Stock</h2>
            <p className="text-sm text-gray-500 mb-4">Item: <span className="font-semibold">{selectedProduct.name}</span></p>
            <form onSubmit={handleRestock} className="space-y-3">
              <div>
                <label className="text-xs text-gray-500">New Quantity Added ({selectedProduct.unit})</label>
                <input
                  type="number"
                  required
                  className="w-full border p-2 rounded text-sm"
                  value={restockData.quantity_added}
                  onChange={(e) =>
                    setRestockData({ ...restockData, quantity_added: Number(e.target.value) })
                  }
                />
              </div>
              <div>
                <label className="text-xs text-gray-500">Purchase Cost Per Unit (Rs.)</label>
                <input
                  type="number"
                  required
                  className="w-full border p-2 rounded text-sm"
                  value={restockData.purchase_price}
                  onChange={(e) =>
                    setRestockData({ ...restockData, purchase_price: Number(e.target.value) })
                  }
                />
              </div>
              <div>
                <label className="text-xs text-gray-500">Supplier Name / Mandi Name</label>
                <input
                  type="text"
                  placeholder="e.g. Akbari Mandi Dealer"
                  className="w-full border p-2 rounded text-sm"
                  value={restockData.supplier_name}
                  onChange={(e) =>
                    setRestockData({ ...restockData, supplier_name: e.target.value })
                  }
                />
              </div>
              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowRestockModal(false)}
                  className="px-4 py-2 border rounded text-sm text-gray-600"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded text-sm font-semibold"
                >
                  Add Stock
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}