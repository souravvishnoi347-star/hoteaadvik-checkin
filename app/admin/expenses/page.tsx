"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/utils/supabase";
import AdminSidebar from "@/components/AdminSidebar";

export type Expense = {
  id: number;
  created_at: string;
  date: string;
  expense_name: string;
  category: string;
  amount: number;
  mode: string;
  paid_to?: string;
  paid_by?: string;
  bill_number?: string;
  notes?: string;
};

export const EXPENSE_CATEGORIES = [
  "Building Rent & Lease",
  "Maintenance & Repairs",
  "Food & Kitchen Supplies",
  "Utilities & Electricity",
  "Housekeeping & Amenities",
  "Staff Wages & Daily Food",
  "Marketing & Commissions",
  "Government & License Fees",
  "Other Miscellaneous"
];

export const PARTNERS_LIST = [
  "Amit Sir (Partner 1)",
  "Partner 2",
  "Partner 3",
  "Hotel Cash Drawer",
  "Hotel Bank Account"
];

const CATEGORY_COLORS: { [key: string]: { bg: string; text: string; icon: string } } = {
  "Building Rent & Lease": { bg: "bg-purple-50 border-purple-200", text: "text-purple-700", icon: "🏢" },
  "Maintenance & Repairs": { bg: "bg-amber-50 border-amber-200", text: "text-amber-800", icon: "🛠️" },
  "Food & Kitchen Supplies": { bg: "bg-emerald-50 border-emerald-200", text: "text-emerald-700", icon: "🍲" },
  "Utilities & Electricity": { bg: "bg-blue-50 border-blue-200", text: "text-blue-700", icon: "⚡" },
  "Housekeeping & Amenities": { bg: "bg-cyan-50 border-cyan-200", text: "text-cyan-700", icon: "🛏️" },
  "Staff Wages & Daily Food": { bg: "bg-indigo-50 border-indigo-200", text: "text-indigo-700", icon: "👥" },
  "Marketing & Commissions": { bg: "bg-rose-50 border-rose-200", text: "text-rose-700", icon: "🚗" },
  "Government & License Fees": { bg: "bg-orange-50 border-orange-200", text: "text-orange-700", icon: "⚖️" },
  "Other Miscellaneous": { bg: "bg-slate-100 border-slate-200", text: "text-slate-700", icon: "📦" }
};

export default function ExpensesPage() {
  const router = useRouter();
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const [hotelSettings, setHotelSettings] = useState({ hotelName: "HOTEL AADVIK INN" });

  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filters
  const [dateFilter, setDateFilter] = useState("This Month");
  const [categoryFilter, setCategoryFilter] = useState("All Categories");
  const [partnerFilter, setPartnerFilter] = useState("All Payers");
  const [searchQuery, setSearchQuery] = useState("");
  const [activeView, setActiveView] = useState<"records" | "partners" | "analytics">("records");

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleteConfirm, setIsDeleteConfirm] = useState<number | null>(null);

  // Form Fields
  const [formDate, setFormDate] = useState(new Date().toISOString().split("T")[0]);
  const [formName, setFormName] = useState("");
  const [formCategory, setFormCategory] = useState("Food & Kitchen Supplies");
  const [formAmount, setFormAmount] = useState("");
  const [formMode, setFormMode] = useState("Cash");
  const [formPaidTo, setFormPaidTo] = useState("");
  const [formPaidBy, setFormPaidBy] = useState("Amit Sir (Partner 1)");
  const [formBillNumber, setFormBillNumber] = useState("");
  const [formNotes, setFormNotes] = useState("");

  useEffect(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("hotelAadvikSettings");
      if (saved) {
        try { setHotelSettings(JSON.parse(saved)); } catch {}
      }
    }

    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push("/admin/login");
      } else {
        setIsCheckingSession(false);
        fetchExpenses();
      }
    };
    checkSession();
  }, [router]);

  const fetchExpenses = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("Expenses")
        .select("*")
        .order("date", { ascending: false });

      if (!error && data) {
        // Parse metadata fallbacks if columns didn't exist in early schema
        const normalized: Expense[] = data.map((exp: any) => {
          let paidTo = exp.paid_to || "";
          let paidBy = exp.paid_by || "Hotel Cash Drawer";
          let billNumber = exp.bill_number || "";
          let cleanNotes = exp.notes || "";

          // Check for legacy encoded notes [Paid By: ... | Paid To: ...]
          if (cleanNotes.startsWith("[") && cleanNotes.includes("]")) {
            const closingIdx = cleanNotes.indexOf("]");
            const metaStr = cleanNotes.slice(1, closingIdx);
            cleanNotes = cleanNotes.slice(closingIdx + 1).trim();

            const pMatch = metaStr.match(/Paid By:\s*([^|]+)/i);
            if (pMatch && !exp.paid_by) paidBy = pMatch[1].trim();

            const tMatch = metaStr.match(/Paid To:\s*([^|]+)/i);
            if (tMatch && !exp.paid_to) paidTo = tMatch[1].trim();

            const bMatch = metaStr.match(/Bill:\s*([^|]+)/i);
            if (bMatch && !exp.bill_number) billNumber = bMatch[1].trim();
          }

          return {
            ...exp,
            paid_to: paidTo,
            paid_by: paidBy,
            bill_number: billNumber,
            notes: cleanNotes
          };
        });

        setExpenses(normalized);
      }
    } catch (e) {
      console.error("Error loading expenses:", e);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddExpense = async () => {
    if (!formName.trim() || !formAmount || !formCategory) {
      alert("Please provide Expense Title, Category, and Amount.");
      return;
    }

    setIsSaving(true);
    const amountVal = parseFloat(formAmount);

    // Prepare payload
    const expensePayload: any = {
      date: formDate,
      expense_name: formName.trim(),
      category: formCategory,
      amount: amountVal,
      mode: formMode,
      paid_to: formPaidTo.trim() || null,
      paid_by: formPaidBy,
      bill_number: formBillNumber.trim() || null,
      notes: formNotes.trim() || null
    };

    try {
      // 1. Try insert with full partner fields
      const { error: insertErr } = await supabase.from("Expenses").insert(expensePayload);

      if (insertErr) {
        // If columns 'paid_to' or 'paid_by' don't exist yet in Supabase, fallback to metadata in notes
        if (insertErr.message?.includes("paid_to") || insertErr.message?.includes("paid_by") || insertErr.message?.includes("bill_number")) {
          const encodedNotes = `[Paid By: ${formPaidBy} | Paid To: ${formPaidTo || 'N/A'} | Bill: ${formBillNumber || 'N/A'}] ${formNotes.trim()}`;
          const fallbackPayload = {
            date: formDate,
            expense_name: formName.trim(),
            category: formCategory,
            amount: amountVal,
            mode: formMode,
            notes: encodedNotes
          };
          const { error: fallbackErr } = await supabase.from("Expenses").insert(fallbackPayload);
          if (fallbackErr) throw fallbackErr;
        } else {
          throw insertErr;
        }
      }

      // Reset Form
      setFormName("");
      setFormAmount("");
      setFormPaidTo("");
      setFormBillNumber("");
      setFormNotes("");
      setFormDate(new Date().toISOString().split("T")[0]);
      setIsModalOpen(false);
      fetchExpenses();
    } catch (err: any) {
      alert("Failed to record expense: " + (err.message || "Unknown error"));
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    const { error } = await supabase.from("Expenses").delete().eq("id", id);
    if (error) {
      alert("Failed to delete expense: " + error.message);
    } else {
      setIsDeleteConfirm(null);
      fetchExpenses();
    }
  };

  // Filter Logic
  const filteredExpenses = expenses.filter((e) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);

    const eDate = new Date(e.date);
    eDate.setHours(0, 0, 0, 0);

    let matchesDate = true;
    if (dateFilter === "Today") {
      matchesDate = eDate.getTime() === today.getTime();
    } else if (dateFilter === "Yesterday") {
      matchesDate = eDate.getTime() === yesterday.getTime();
    } else if (dateFilter === "This Week") {
      const weekStart = new Date(today);
      weekStart.setDate(today.getDate() - today.getDay());
      matchesDate = eDate >= weekStart;
    } else if (dateFilter === "This Month") {
      matchesDate = eDate.getMonth() === today.getMonth() && eDate.getFullYear() === today.getFullYear();
    }

    const matchesCategory = categoryFilter === "All Categories" || e.category === categoryFilter;
    const matchesPartner = partnerFilter === "All Payers" || e.paid_by === partnerFilter;
    const matchesSearch =
      e.expense_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (e.paid_to || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      (e.bill_number || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      (e.notes || "").toLowerCase().includes(searchQuery.toLowerCase());

    return matchesDate && matchesCategory && matchesPartner && matchesSearch;
  });

  // Analytics Metrics
  const todayStr = new Date().toISOString().split("T")[0];
  const todayTotal = expenses.filter((e) => e.date === todayStr).reduce((a, c) => a + Number(c.amount), 0);

  const thisMonthExpenses = expenses.filter((e) => {
    const d = new Date(e.date);
    const now = new Date();
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });
  const thisMonthTotal = thisMonthExpenses.reduce((a, c) => a + Number(c.amount), 0);
  const allTimeTotal = expenses.reduce((a, c) => a + Number(c.amount), 0);

  // Partner Wise Breakdown for current filtered set
  const partnerBreakdown = PARTNERS_LIST.map((partner) => {
    const total = filteredExpenses
      .filter((e) => e.paid_by === partner)
      .reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
    const count = filteredExpenses.filter((e) => e.paid_by === partner).length;
    return { partner, total, count };
  });

  // Category Breakdown for current filtered set
  const categoryBreakdown = EXPENSE_CATEGORIES.map((cat) => {
    const total = filteredExpenses
      .filter((e) => e.category === cat)
      .reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
    const count = filteredExpenses.filter((e) => e.category === cat).length;
    const pct = filteredExpenses.length > 0 && thisMonthTotal > 0
      ? Math.round((total / filteredExpenses.reduce((a, c) => a + Number(c.amount), 0)) * 100)
      : 0;
    return { category: cat, total, count, pct };
  }).filter((c) => c.total > 0).sort((a, b) => b.total - a.total);

  // CSV Export
  const exportToCSV = () => {
    const headers = ["Date", "Expense Title", "Category", "Amount", "Paid To", "Paid By", "Mode", "Bill No", "Notes"];
    const rows = filteredExpenses.map((e) => [
      e.date,
      `"${e.expense_name.replace(/"/g, '""')}"`,
      `"${e.category}"`,
      e.amount,
      `"${(e.paid_to || '').replace(/"/g, '""')}"`,
      `"${(e.paid_by || '').replace(/"/g, '""')}"`,
      e.mode,
      `"${(e.bill_number || '').replace(/"/g, '""')}"`,
      `"${(e.notes || '').replace(/"/g, '""')}"`
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Hotel_Aadvik_Expenses_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (isCheckingSession) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-slate-50 flex-col md:flex-row relative font-sans">
      <AdminSidebar activePath="/admin/expenses" hotelName={hotelSettings.hotelName} />

      <main className="flex-1 flex flex-col overflow-hidden z-0">
        <div className="flex-1 p-4 md:p-8 overflow-y-auto">
          <div className="max-w-7xl mx-auto space-y-6">

            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white/80 backdrop-blur-md p-6 rounded-3xl border border-slate-200 shadow-xs">
              <div>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-rose-50 border border-rose-100 text-rose-600 flex items-center justify-center text-xl">
                    🧾
                  </div>
                  <div>
                    <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-800 tracking-tight">Hotel Expenses & Outflow</h1>
                    <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                      Rent, maintenance, kitchen, utilities, and 3-partner financial transparency.
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
                <button
                  onClick={exportToCSV}
                  className="flex items-center gap-1.5 px-4 py-2.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold rounded-xl text-xs sm:text-sm shadow-xs transition"
                >
                  📥 Export CSV
                </button>

                <button
                  onClick={() => setIsModalOpen(true)}
                  className="flex items-center gap-2 px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl text-xs sm:text-sm shadow-md shadow-rose-100 transition"
                >
                  <span>➕</span> Add New Expense
                </button>
              </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-gradient-to-br from-rose-500 to-rose-600 rounded-3xl p-6 text-white shadow-lg shadow-rose-100 relative overflow-hidden">
                <div className="relative z-10">
                  <p className="text-rose-100 text-xs font-bold uppercase tracking-wider mb-1">Today&apos;s Expenses</p>
                  <h2 className="text-3xl font-black">₹{todayTotal.toLocaleString("en-IN")}</h2>
                </div>
                <span className="absolute right-4 bottom-2 text-6xl opacity-15">📅</span>
              </div>

              <div className="bg-gradient-to-br from-indigo-600 to-indigo-700 rounded-3xl p-6 text-white shadow-lg shadow-indigo-100 relative overflow-hidden">
                <div className="relative z-10">
                  <p className="text-indigo-100 text-xs font-bold uppercase tracking-wider mb-1">This Month&apos;s Outflow</p>
                  <h2 className="text-3xl font-black">₹{thisMonthTotal.toLocaleString("en-IN")}</h2>
                </div>
                <span className="absolute right-4 bottom-2 text-6xl opacity-15">📊</span>
              </div>

              <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-3xl p-6 text-white shadow-lg shadow-slate-200 relative overflow-hidden">
                <div className="relative z-10">
                  <p className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-1">Filtered Expense Total</p>
                  <h2 className="text-3xl font-black text-amber-400">
                    ₹{filteredExpenses.reduce((a, c) => a + Number(c.amount), 0).toLocaleString("en-IN")}
                  </h2>
                </div>
                <span className="absolute right-4 bottom-2 text-6xl opacity-15">💰</span>
              </div>
            </div>

            {/* Navigation Tabs */}
            <div className="flex border-b border-slate-200 bg-white rounded-2xl px-3 pt-2 shadow-xs">
              <button
                onClick={() => setActiveView("records")}
                className={`flex items-center gap-2 px-5 py-3 text-xs sm:text-sm font-bold border-b-2 transition ${
                  activeView === "records"
                    ? "border-rose-600 text-rose-600"
                    : "border-transparent text-slate-500 hover:text-slate-800"
                }`}
              >
                <span>📋</span> Expense Records ({filteredExpenses.length})
              </button>

              <button
                onClick={() => setActiveView("partners")}
                className={`flex items-center gap-2 px-5 py-3 text-xs sm:text-sm font-bold border-b-2 transition ${
                  activeView === "partners"
                    ? "border-rose-600 text-rose-600"
                    : "border-transparent text-slate-500 hover:text-slate-800"
                }`}
              >
                <span>🤝</span> Partner Spends & Ledger
              </button>

              <button
                onClick={() => setActiveView("analytics")}
                className={`flex items-center gap-2 px-5 py-3 text-xs sm:text-sm font-bold border-b-2 transition ${
                  activeView === "analytics"
                    ? "border-rose-600 text-rose-600"
                    : "border-transparent text-slate-500 hover:text-slate-800"
                }`}
              >
                <span>📊</span> Category Breakdown
              </button>
            </div>

            {/* VIEW 1: EXPENSE RECORDS */}
            {activeView === "records" && (
              <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
                {/* Filters */}
                <div className="p-5 border-b border-slate-100 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 bg-slate-50/50">
                  <div className="flex flex-wrap items-center gap-2.5 w-full lg:w-auto">
                    {/* Date presets */}
                    {["Today", "Yesterday", "This Week", "This Month", "All Time"].map((f) => (
                      <button
                        key={f}
                        onClick={() => setDateFilter(f)}
                        className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition shadow-2xs ${
                          dateFilter === f
                            ? "bg-rose-600 text-white shadow-rose-100"
                            : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-100"
                        }`}
                      >
                        {f}
                      </button>
                    ))}

                    <select
                      value={categoryFilter}
                      onChange={(e) => setCategoryFilter(e.target.value)}
                      className="px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-rose-500"
                    >
                      <option value="All Categories">All Categories</option>
                      {EXPENSE_CATEGORIES.map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>

                    <select
                      value={partnerFilter}
                      onChange={(e) => setPartnerFilter(e.target.value)}
                      className="px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-rose-500"
                    >
                      <option value="All Payers">All Payers / Partners</option>
                      {PARTNERS_LIST.map((p) => (
                        <option key={p} value={p}>{p}</option>
                      ))}
                    </select>
                  </div>

                  <div className="relative w-full lg:w-72">
                    <input
                      type="text"
                      placeholder="Search title, vendor, bill #..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-700 outline-none focus:ring-2 focus:ring-rose-500 shadow-xs"
                    />
                    <span className="absolute left-3 top-2.5 text-slate-400">🔍</span>
                  </div>
                </div>

                {/* Table */}
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                        <th className="py-3.5 px-4">Date</th>
                        <th className="py-3.5 px-4">Expense Details</th>
                        <th className="py-3.5 px-4">Category</th>
                        <th className="py-3.5 px-4">Amount</th>
                        <th className="py-3.5 px-4">Paid By (Partner)</th>
                        <th className="py-3.5 px-4">Vendor / Bill #</th>
                        <th className="py-3.5 px-4">Mode</th>
                        <th className="py-3.5 px-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs sm:text-sm text-slate-700">
                      {isLoading ? (
                        <tr>
                          <td colSpan={8} className="text-center py-12 text-slate-400">Loading expenses...</td>
                        </tr>
                      ) : filteredExpenses.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="text-center py-16">
                            <div className="flex flex-col items-center gap-2">
                              <span className="text-4xl text-slate-300">🧾</span>
                              <p className="font-semibold text-slate-600">No expenses recorded for these filters.</p>
                              <p className="text-xs text-slate-400">Click &ldquo;Add New Expense&rdquo; above to record an outflow.</p>
                            </div>
                          </td>
                        </tr>
                      ) : (
                        filteredExpenses.map((exp) => {
                          const catBadge = CATEGORY_COLORS[exp.category] || CATEGORY_COLORS["Other Miscellaneous"];
                          return (
                            <tr key={exp.id} className="hover:bg-slate-50/80 transition-colors">
                              <td className="py-3.5 px-4 whitespace-nowrap text-xs text-slate-500">
                                {exp.date ? new Date(exp.date).toLocaleDateString("en-IN") : "—"}
                              </td>
                              <td className="py-3.5 px-4">
                                <p className="font-bold text-slate-800">{exp.expense_name}</p>
                                {exp.notes && (
                                  <p className="text-[11px] text-slate-400 mt-0.5 truncate max-w-[200px]">{exp.notes}</p>
                                )}
                              </td>
                              <td className="py-3.5 px-4">
                                <span className={`px-2.5 py-1 rounded-lg text-xs font-semibold border inline-flex items-center gap-1.5 whitespace-nowrap ${catBadge.bg} ${catBadge.text}`}>
                                  <span>{catBadge.icon}</span> {exp.category}
                                </span>
                              </td>
                              <td className="py-3.5 px-4">
                                <span className="font-black text-rose-600 text-base">
                                  ₹{Number(exp.amount).toLocaleString("en-IN")}
                                </span>
                              </td>
                              <td className="py-3.5 px-4">
                                <span className="px-2.5 py-1 bg-indigo-50 border border-indigo-100 text-indigo-700 rounded-lg text-xs font-bold whitespace-nowrap">
                                  👤 {exp.paid_by || "Hotel Cash"}
                                </span>
                              </td>
                              <td className="py-3.5 px-4 text-xs">
                                <div className="text-slate-800 font-semibold">{exp.paid_to || "—"}</div>
                                {exp.bill_number && (
                                  <div className="text-[11px] font-mono text-slate-400 mt-0.5">#{exp.bill_number}</div>
                                )}
                              </td>
                              <td className="py-3.5 px-4">
                                <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded-md text-xs font-semibold">
                                  {exp.mode}
                                </span>
                              </td>
                              <td className="py-3.5 px-4 text-right">
                                {isDeleteConfirm === exp.id ? (
                                  <div className="flex items-center justify-end gap-1.5">
                                    <button
                                      onClick={() => handleDelete(exp.id)}
                                      className="text-xs px-2.5 py-1 bg-red-600 text-white rounded-lg font-bold hover:bg-red-700 transition"
                                    >
                                      Delete
                                    </button>
                                    <button
                                      onClick={() => setIsDeleteConfirm(null)}
                                      className="text-xs px-2.5 py-1 bg-slate-200 text-slate-700 rounded-lg font-semibold hover:bg-slate-300 transition"
                                    >
                                      No
                                    </button>
                                  </div>
                                ) : (
                                  <button
                                    onClick={() => setIsDeleteConfirm(exp.id)}
                                    title="Delete Expense"
                                    className="p-1 text-slate-400 hover:text-red-500 rounded-lg transition"
                                  >
                                    🗑️
                                  </button>
                                )}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>

                {filteredExpenses.length > 0 && (
                  <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-between items-center text-xs sm:text-sm font-bold text-slate-700">
                    <span>Showing {filteredExpenses.length} entries</span>
                    <span>
                      Total: <span className="text-rose-600 text-base font-black">
                        ₹{filteredExpenses.reduce((a, c) => a + Number(c.amount), 0).toLocaleString("en-IN")}
                      </span>
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* VIEW 2: PARTNERS SPENDS & CAPITAL TRANSPARENCY */}
            {activeView === "partners" && (
              <div className="space-y-6">
                <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-6">
                    <div>
                      <h2 className="text-lg font-bold text-slate-800">Partners Expense Accountability Ledger</h2>
                      <p className="text-xs text-slate-500">
                        Tracks exact money paid by each of the 3 partners from their own pocket vs. hotel drawer for <span className="font-bold text-rose-600">{dateFilter}</span>.
                      </p>
                    </div>

                    <div className="flex gap-2">
                      {["Today", "This Month", "All Time"].map((f) => (
                        <button
                          key={f}
                          onClick={() => setDateFilter(f)}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                            dateFilter === f ? "bg-rose-600 text-white" : "bg-slate-100 text-slate-600"
                          }`}
                        >
                          {f}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {partnerBreakdown.map((pb) => (
                      <div key={pb.partner} className="p-5 rounded-2xl border border-slate-200 bg-slate-50/50 flex flex-col justify-between">
                        <div>
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-indigo-700 uppercase tracking-wider">
                              {pb.partner}
                            </span>
                            <span className="text-[11px] text-slate-400 font-semibold">{pb.count} expenses</span>
                          </div>
                          <h3 className="text-2xl font-black text-slate-900 mt-2">₹{pb.total.toLocaleString("en-IN")}</h3>
                        </div>

                        <div className="mt-4 pt-3 border-t border-slate-200/60 text-xs text-slate-500">
                          {pb.total > 0 ? (
                            <span className="text-emerald-700 font-semibold">
                              ✓ {((pb.total / (filteredExpenses.reduce((a, c) => a + Number(c.amount), 0) || 1)) * 100).toFixed(1)}% of total filtered outflow
                            </span>
                          ) : (
                            <span className="text-slate-400">No expenses recorded</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Partnership Reconciliation Note */}
                  <div className="mt-6 p-4 bg-indigo-50/60 border border-indigo-100 rounded-2xl">
                    <h4 className="text-xs font-bold text-indigo-900 uppercase tracking-wider flex items-center gap-1.5">
                      <span>💡</span> Partner Profit & Capital Equalization
                    </h4>
                    <p className="text-xs text-indigo-800/80 mt-1 leading-relaxed">
                      All partners can view every rupee spent. If one partner pays hotel rent or groceries from their personal UPI or cash, it is recorded here under their name so they can be reimbursed directly from the month&apos;s Gross Profits!
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* VIEW 3: CATEGORY ANALYTICS */}
            {activeView === "analytics" && (
              <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-6">
                <div>
                  <h2 className="text-lg font-bold text-slate-800">Expense Distribution by Category</h2>
                  <p className="text-xs text-slate-500">Breakdown of operational costs for {dateFilter}.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {categoryBreakdown.map((cat) => {
                    const badge = CATEGORY_COLORS[cat.category] || CATEGORY_COLORS["Other Miscellaneous"];
                    return (
                      <div key={cat.category} className="p-4 rounded-2xl border border-slate-100 bg-slate-50/50 space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="flex items-center gap-2 text-sm font-bold text-slate-800">
                            <span>{badge.icon}</span> {cat.category}
                          </span>
                          <span className="text-sm font-black text-rose-600">
                            ₹{cat.total.toLocaleString("en-IN")}
                          </span>
                        </div>

                        <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                          <div
                            className="bg-rose-500 h-full rounded-full transition-all"
                            style={{
                              width: `${(cat.total / (filteredExpenses.reduce((a, c) => a + Number(c.amount), 0) || 1)) * 100}%`
                            }}
                          ></div>
                        </div>

                        <div className="flex justify-between text-[11px] text-slate-400">
                          <span>{cat.count} transactions</span>
                          <span>
                            {((cat.total / (filteredExpenses.reduce((a, c) => a + Number(c.amount), 0) || 1)) * 100).toFixed(1)}% of total
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

          </div>
        </div>
      </main>

      {/* ADD EXPENSE MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 my-8">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <div>
                <h3 className="text-lg font-bold text-slate-800">Record New Hotel Expense</h3>
                <p className="text-xs text-slate-400">Track rent, maintenance, food & partner out-of-pocket costs.</p>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-200/70 hover:bg-slate-200 text-slate-600 flex items-center justify-center"
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">Date *</label>
                  <input
                    type="date"
                    required
                    value={formDate}
                    onChange={(e) => setFormDate(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-xs sm:text-sm outline-none focus:ring-2 focus:ring-rose-500 bg-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">Amount (₹) *</label>
                  <input
                    type="number"
                    required
                    value={formAmount}
                    onChange={(e) => setFormAmount(e.target.value)}
                    placeholder="e.g. 2500"
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-bold text-rose-600 outline-none focus:ring-2 focus:ring-rose-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">Expense Title / Description *</label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g. Hotel building rent / 5 LPG gas cylinders / Plumber work"
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-rose-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">Category *</label>
                  <select
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-xs sm:text-sm outline-none focus:ring-2 focus:ring-rose-500 bg-white font-medium"
                  >
                    {EXPENSE_CATEGORIES.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">Payment Mode</label>
                  <select
                    value={formMode}
                    onChange={(e) => setFormMode(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-xs sm:text-sm outline-none focus:ring-2 focus:ring-rose-500 bg-white"
                  >
                    {["Cash", "UPI", "Bank Transfer", "Card", "Cheque"].map((m) => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Partner Who Paid - Key Requirement! */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-indigo-900 uppercase tracking-wider mb-1.5">
                    Paid By (Partner / Account) *
                  </label>
                  <select
                    value={formPaidBy}
                    onChange={(e) => setFormPaidBy(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl border border-indigo-200 bg-indigo-50/50 text-xs sm:text-sm font-bold text-indigo-900 outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    {PARTNERS_LIST.map((p) => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">Paid To (Vendor / Person)</label>
                  <input
                    type="text"
                    value={formPaidTo}
                    onChange={(e) => setFormPaidTo(e.target.value)}
                    placeholder="e.g. Landlord Sharma Ji / Indian Oil"
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-xs sm:text-sm outline-none focus:ring-2 focus:ring-rose-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">Bill / Receipt / Slip No. (Optional)</label>
                <input
                  type="text"
                  value={formBillNumber}
                  onChange={(e) => setFormBillNumber(e.target.value)}
                  placeholder="e.g. INV-2026-881 or Parchi #4"
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-xs sm:text-sm font-mono outline-none focus:ring-2 focus:ring-rose-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">Notes / Purpose (Optional)</label>
                <textarea
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  placeholder="Any details to keep track for the partners..."
                  rows={2}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-xs sm:text-sm outline-none focus:ring-2 focus:ring-rose-500 resize-none"
                />
              </div>
            </div>

            <div className="p-6 border-t border-slate-100 flex gap-2 justify-end bg-slate-50/50">
              <button
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 border border-slate-200 text-slate-600 text-xs sm:text-sm font-semibold rounded-xl hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                onClick={handleAddExpense}
                disabled={isSaving}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs sm:text-sm font-bold rounded-xl shadow-xs transition disabled:opacity-60"
              >
                {isSaving ? "Saving..." : "Record Expense"}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
