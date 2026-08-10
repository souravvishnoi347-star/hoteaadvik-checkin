"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/utils/supabase";
import AdminSidebar from "@/components/AdminSidebar";

type Expense = {
  id: number;
  created_at: string;
  date: string;
  expense_name: string;
  category: string;
  amount: number;
  mode: string;
  notes?: string;
};

const CATEGORIES = ["All Categories", "Food & Beverages", "Maintenance", "Utilities", "Staff", "Supplies", "Marketing", "Other"];

export default function ExpensesPage() {
  const router = useRouter();
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const [hotelSettings, setHotelSettings] = useState({ hotelName: "HOTEL AADVIK INN" });
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dateFilter, setDateFilter] = useState("Today");
  const [categoryFilter, setCategoryFilter] = useState("All Categories");
  const [searchQuery, setSearchQuery] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleteConfirm, setIsDeleteConfirm] = useState<number | null>(null);

  // New expense form
  const [formDate, setFormDate] = useState(new Date().toISOString().split("T")[0]);
  const [formName, setFormName] = useState("");
  const [formCategory, setFormCategory] = useState("Food & Beverages");
  const [formAmount, setFormAmount] = useState("");
  const [formMode, setFormMode] = useState("Cash");
  const [formNotes, setFormNotes] = useState("");

  useEffect(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("hotelAadvikSettings");
      if (saved) try { setHotelSettings(JSON.parse(saved)); } catch {}
    }
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push("/admin/login"); }
      else { setIsCheckingSession(false); fetchExpenses(); }
    };
    checkSession();
  }, [router]);

  const fetchExpenses = async () => {
    setIsLoading(true);
    const { data, error } = await supabase.from("Expenses").select("*").order("date", { ascending: false });
    if (!error && data) setExpenses(data);
    setIsLoading(false);
  };

  const filteredExpenses = expenses.filter((e) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const eDate = new Date(e.date);
    eDate.setHours(0, 0, 0, 0);

    let matchesDate = true;
    if (dateFilter === "Today") matchesDate = eDate.getTime() === today.getTime();
    else if (dateFilter === "This Week") {
      const weekStart = new Date(today);
      weekStart.setDate(today.getDate() - today.getDay());
      matchesDate = eDate >= weekStart;
    } else if (dateFilter === "This Month") {
      matchesDate = eDate.getMonth() === today.getMonth() && eDate.getFullYear() === today.getFullYear();
    }

    const matchesCategory = categoryFilter === "All Categories" || e.category === categoryFilter;
    const matchesSearch = e.expense_name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesDate && matchesCategory && matchesSearch;
  });

  const todayStr = new Date().toISOString().split("T")[0];
  const todayTotal = expenses.filter(e => e.date === todayStr).reduce((a, c) => a + Number(c.amount), 0);
  const thisMonthTotal = expenses.filter(e => {
    const d = new Date(e.date);
    const now = new Date();
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }).reduce((a, c) => a + Number(c.amount), 0);
  const allTimeTotal = expenses.reduce((a, c) => a + Number(c.amount), 0);

  const handleAddExpense = async () => {
    if (!formName || !formAmount || !formCategory) { alert("Please fill all required fields."); return; }
    setIsSaving(true);
    const { error } = await supabase.from("Expenses").insert({
      date: formDate,
      expense_name: formName,
      category: formCategory,
      amount: parseFloat(formAmount),
      mode: formMode,
      notes: formNotes || null,
    });
    setIsSaving(false);
    if (error) { alert("Failed to add expense: " + error.message); return; }
    setFormName(""); setFormAmount(""); setFormNotes(""); setFormMode("Cash");
    setFormDate(new Date().toISOString().split("T")[0]);
    setFormCategory("Food & Beverages");
    setIsModalOpen(false);
    fetchExpenses();
  };

  const handleDelete = async (id: number) => {
    const { error } = await supabase.from("Expenses").delete().eq("id", id);
    if (error) { alert("Failed to delete: " + error.message); return; }
    setIsDeleteConfirm(null);
    fetchExpenses();
  };

  if (isCheckingSession) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-50 flex-col md:flex-row relative">
      <AdminSidebar activePath="/admin/expenses" hotelName={hotelSettings.hotelName} />

      <main className="flex-1 flex flex-col overflow-hidden z-0">
        <main className="flex-1 p-4 md:p-8 overflow-y-auto">
          <div className="max-w-7xl mx-auto space-y-6">

            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white/70 backdrop-blur-md p-6 rounded-3xl border border-white/60 shadow-sm">
              <div>
                <h1 className="text-3xl font-extrabold text-slate-800 tracking-tight">Daily Expenses Tracker</h1>
                <p className="text-slate-500 mt-1">Log and manage daily hotel expenses.</p>
              </div>
              <button
                onClick={() => setIsModalOpen(true)}
                className="flex items-center gap-2 px-5 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-md shadow-indigo-200 transition-all"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                Add Expense
              </button>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
              <div className="bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-3xl p-6 text-white shadow-lg shadow-indigo-200 relative overflow-hidden">
                <div className="relative z-10">
                  <p className="text-indigo-100 text-sm font-medium uppercase tracking-wider mb-1">Today's Expenses</p>
                  <h2 className="text-3xl font-black">Rs. {todayTotal.toLocaleString("en-IN")}</h2>
                </div>
                <svg className="absolute right-[-10%] top-[-10%] w-32 h-32 text-white opacity-10" fill="currentColor" viewBox="0 0 20 20"><path d="M4 4a2 2 0 00-2 2v1h16V6a2 2 0 00-2-2H4z"/><path fillRule="evenodd" d="M18 9H2v5a2 2 0 002 2h12a2 2 0 002-2V9zM4 13a1 1 0 011-1h1a1 1 0 110 2H5a1 1 0 01-1-1zm5-1a1 1 0 100 2h1a1 1 0 100-2H9z" clipRule="evenodd"/></svg>
              </div>
              <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-3xl p-6 text-white shadow-lg shadow-emerald-200 relative overflow-hidden">
                <div className="relative z-10">
                  <p className="text-emerald-100 text-sm font-medium uppercase tracking-wider mb-1">This Month's Total</p>
                  <h2 className="text-3xl font-black">Rs. {thisMonthTotal.toLocaleString("en-IN")}</h2>
                </div>
                <svg className="absolute right-[-10%] top-[-10%] w-32 h-32 text-white opacity-10" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd"/></svg>
              </div>
              <div className="bg-gradient-to-br from-amber-500 to-orange-500 rounded-3xl p-6 text-white shadow-lg shadow-amber-200 relative overflow-hidden">
                <div className="relative z-10">
                  <p className="text-amber-100 text-sm font-medium uppercase tracking-wider mb-1">Total All Time</p>
                  <h2 className="text-3xl font-black">Rs. {allTimeTotal.toLocaleString("en-IN")}</h2>
                </div>
                <svg className="absolute right-[-10%] top-[-10%] w-32 h-32 text-white opacity-10" fill="currentColor" viewBox="0 0 20 20"><path d="M8.433 7.418c.155-.103.346-.196.567-.267v1.698a2.305 2.305 0 01-.567-.267C8.07 8.34 8 8.114 8 8c0-.114.07-.34.433-.582zM11 12.849v-1.698c.22.071.412.164.567.267.364.243.433.468.433.582 0 .114-.07.34-.433.582a2.305 2.305 0 01-.567.267z"/><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-13a1 1 0 10-2 0v.092a4.535 4.535 0 00-1.676.662C6.602 6.234 6 7.009 6 8c0 .99.602 1.765 1.324 2.246.48.32 1.054.545 1.676.662v1.941c-.391-.127-.68-.317-.843-.504a1 1 0 10-1.51 1.31c.562.649 1.413 1.077 2.353 1.253V15a1 1 0 102 0v-.092a4.535 4.535 0 001.676-.662C13.398 13.766 14 12.991 14 12c0-.99-.602-1.765-1.324-2.246A4.535 4.535 0 0011 9.092V7.151c.391.127.68.317.843.504a1 1 0 101.511-1.31c-.563-.649-1.413-1.077-2.354-1.253V5z" clipRule="evenodd"/></svg>
              </div>
            </div>

            {/* Records Table */}
            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="p-6 border-b border-slate-100">
                <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
                  <h2 className="text-xl font-bold text-slate-800">Expense Records</h2>
                  <div className="flex flex-wrap gap-3 items-center w-full sm:w-auto">
                    {["Today", "This Week", "This Month", "All Time"].map((f) => (
                      <button
                        key={f}
                        onClick={() => setDateFilter(f)}
                        className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                          dateFilter === f ? "bg-indigo-600 text-white shadow-md" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                        }`}
                      >
                        {f}
                      </button>
                    ))}
                    <select
                      value={categoryFilter}
                      onChange={(e) => setCategoryFilter(e.target.value)}
                      className="px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-700 bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
                    >
                      {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
                    </select>
                    <div className="relative">
                      <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
                      <input
                        type="text"
                        placeholder="Search expenses..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm text-slate-700 bg-white focus:ring-2 focus:ring-indigo-500 outline-none w-44"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100">
                      {["Date", "Expense Name", "Category", "Amount", "Mode", "Notes", "Actions"].map((h) => (
                        <th key={h} className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {isLoading ? (
                      <tr><td colSpan={7} className="text-center py-16 text-slate-500">Loading...</td></tr>
                    ) : filteredExpenses.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="text-center py-20">
                          <div className="flex flex-col items-center gap-3">
                            <svg className="w-12 h-12 text-slate-200" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
                            <p className="text-slate-400 font-medium">No expenses found for the selected filters.</p>
                          </div>
                        </td>
                      </tr>
                    ) : filteredExpenses.map((exp) => (
                      <tr key={exp.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-6 py-4 text-sm text-slate-600 whitespace-nowrap">{new Date(exp.date).toLocaleDateString("en-IN")}</td>
                        <td className="px-6 py-4 text-sm font-semibold text-slate-800">{exp.expense_name}</td>
                        <td className="px-6 py-4">
                          <span className="px-3 py-1 bg-indigo-50 text-indigo-700 rounded-full text-xs font-semibold">{exp.category}</span>
                        </td>
                        <td className="px-6 py-4 text-sm font-bold text-slate-800">Rs. {Number(exp.amount).toLocaleString("en-IN")}</td>
                        <td className="px-6 py-4">
                          <span className={`px-3 py-1 rounded-full text-xs font-semibold ${exp.mode === "Cash" ? "bg-emerald-50 text-emerald-700" : exp.mode === "UPI" ? "bg-blue-50 text-blue-700" : "bg-amber-50 text-amber-700"}`}>
                            {exp.mode}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-500 max-w-[150px] truncate">{exp.notes || "—"}</td>
                        <td className="px-6 py-4">
                          {isDeleteConfirm === exp.id ? (
                            <div className="flex items-center gap-2">
                              <button onClick={() => handleDelete(exp.id)} className="text-xs px-3 py-1.5 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700 transition">Confirm</button>
                              <button onClick={() => setIsDeleteConfirm(null)} className="text-xs px-3 py-1.5 bg-slate-200 text-slate-700 rounded-lg font-semibold hover:bg-slate-300 transition">Cancel</button>
                            </div>
                          ) : (
                            <button onClick={() => setIsDeleteConfirm(exp.id)} className="text-slate-400 hover:text-red-500 transition-colors p-1">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {filteredExpenses.length > 0 && (
                <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end">
                  <span className="text-sm font-bold text-slate-700">
                    Total: <span className="text-indigo-600">Rs. {filteredExpenses.reduce((a, c) => a + Number(c.amount), 0).toLocaleString("en-IN")}</span>
                  </span>
                </div>
              )}
            </div>
          </div>
        </main>
      </main>

      {/* Add Expense Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/70 backdrop-blur-sm" onClick={(e) => { if (e.target === e.currentTarget) setIsModalOpen(false); }}>
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center">
              <h2 className="text-xl font-bold text-slate-800">Add New Expense</h2>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600 p-1">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">Date *</label>
                  <input type="date" value={formDate} onChange={(e) => setFormDate(e.target.value)} className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800 bg-white" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">Amount (Rs) *</label>
                  <input type="number" value={formAmount} onChange={(e) => setFormAmount(e.target.value)} placeholder="e.g. 500" className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800 bg-white" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">Expense Name *</label>
                <input type="text" value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="e.g. Grocery purchase" className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800 bg-white" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">Category *</label>
                  <select value={formCategory} onChange={(e) => setFormCategory(e.target.value)} className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500 text-slate-700 bg-white">
                    {CATEGORIES.filter(c => c !== "All Categories").map((c) => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">Payment Mode</label>
                  <select value={formMode} onChange={(e) => setFormMode(e.target.value)} className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500 text-slate-700 bg-white">
                    {["Cash", "UPI", "Card", "Bank Transfer"].map((m) => <option key={m}>{m}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">Notes (Optional)</label>
                <textarea value={formNotes} onChange={(e) => setFormNotes(e.target.value)} placeholder="Any additional details..." rows={3} className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800 bg-white resize-none" />
              </div>
            </div>
            <div className="p-6 border-t border-slate-100 flex gap-3 justify-end">
              <button onClick={() => setIsModalOpen(false)} className="px-5 py-2.5 border border-slate-200 text-slate-600 font-semibold rounded-xl hover:bg-slate-50 transition-all">Cancel</button>
              <button onClick={handleAddExpense} disabled={isSaving} className="px-5 py-2.5 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 shadow-md shadow-indigo-200 transition-all disabled:opacity-60">
                {isSaving ? "Saving..." : "Add Expense"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
