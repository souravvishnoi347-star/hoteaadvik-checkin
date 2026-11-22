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

export const PAYMENT_ACCOUNTS = [
  "Hotel Cash Drawer",
  "Hotel Bank / QR Account",
  "Amit Sir (Owner Personal)"
];

const CATEGORY_COLORS: { [key: string]: { bg: string; text: string; icon: string } } = {
  "Building Rent & Lease": { bg: "bg-slate-100 border-slate-200", text: "text-slate-800", icon: "🏢" },
  "Maintenance & Repairs": { bg: "bg-amber-50 border-amber-200", text: "text-amber-800", icon: "🛠️" },
  "Food & Kitchen Supplies": { bg: "bg-emerald-50 border-emerald-200", text: "text-emerald-800", icon: "🍲" },
  "Utilities & Electricity": { bg: "bg-blue-50 border-blue-200", text: "text-blue-800", icon: "⚡" },
  "Housekeeping & Amenities": { bg: "bg-cyan-50 border-cyan-200", text: "text-cyan-800", icon: "🛏️" },
  "Staff Wages & Daily Food": { bg: "bg-indigo-50 border-indigo-200", text: "text-indigo-800", icon: "👥" },
  "Marketing & Commissions": { bg: "bg-orange-50 border-orange-200", text: "text-orange-800", icon: "🚗" },
  "Government & License Fees": { bg: "bg-purple-50 border-purple-200", text: "text-purple-800", icon: "⚖️" },
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
  const [accountFilter, setAccountFilter] = useState("All Accounts");
  const [searchQuery, setSearchQuery] = useState("");
  const [activeView, setActiveView] = useState<"records" | "analytics">("records");

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
  const [formPaidBy, setFormPaidBy] = useState("Hotel Cash Drawer");
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
        // Clean metadata fallbacks if needed
        const normalized: Expense[] = data.map((exp: any) => {
          let paidTo = exp.paid_to || "";
          let paidBy = exp.paid_by || "Hotel Cash Drawer";
          let billNumber = exp.bill_number || "";
          let cleanNotes = exp.notes || "";

          // Legacy cleaner
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
      const { error: insertErr } = await supabase.from("Expenses").insert(expensePayload);

      if (insertErr) {
        if (insertErr.message?.includes("paid_to") || insertErr.message?.includes("paid_by") || insertErr.message?.includes("bill_number")) {
          const fallbackPayload = {
            date: formDate,
            expense_name: formName.trim(),
            category: formCategory,
            amount: amountVal,
            mode: formMode,
            notes: formNotes.trim() || null
          };
          const { error: fallbackErr } = await supabase.from("Expenses").insert(fallbackPayload);
          if (fallbackErr) throw fallbackErr;
        } else {
          throw insertErr;
        }
      }

      // Reset Form & Refresh
      setFormName("");
      setFormAmount("");
      setFormPaidTo("");
      setFormBillNumber("");
      setFormNotes("");
      setIsModalOpen(false);
      fetchExpenses();
    } catch (err: any) {
      alert("Failed to save expense: " + (err.message || "Unknown error"));
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      const { error } = await supabase.from("Expenses").delete().eq("id", id);
      if (error) throw error;
      setExpenses((prev) => prev.filter((e) => e.id !== id));
      setIsDeleteConfirm(null);
    } catch (err: any) {
      alert("Failed to delete expense: " + err.message);
    }
  };

  // Filter Logic
  const filteredExpenses = expenses.filter((e) => {
    let matchesDate = true;
    const expDate = new Date(e.date);
    const now = new Date();

    if (dateFilter === "Today") {
      const todayStr = now.toISOString().split("T")[0];
      matchesDate = e.date === todayStr;
    } else if (dateFilter === "Yesterday") {
      const yDate = new Date();
      yDate.setDate(now.getDate() - 1);
      matchesDate = e.date === yDate.toISOString().split("T")[0];
    } else if (dateFilter === "This Week") {
      const firstDay = new Date(now.setDate(now.getDate() - now.getDay()));
      firstDay.setHours(0, 0, 0, 0);
      matchesDate = expDate >= firstDay;
    } else if (dateFilter === "This Month") {
      matchesDate = expDate.getMonth() === now.getMonth() && expDate.getFullYear() === now.getFullYear();
    }

    const matchesCategory = categoryFilter === "All Categories" || e.category === categoryFilter;
    const matchesAccount = accountFilter === "All Accounts" || e.paid_by === accountFilter;
    const matchesSearch =
      e.expense_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (e.paid_to || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      (e.bill_number || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      (e.notes || "").toLowerCase().includes(searchQuery.toLowerCase());

    return matchesDate && matchesCategory && matchesAccount && matchesSearch;
  });

  // KPI Metrics
  const todayStr = new Date().toISOString().split("T")[0];
  const todayTotal = expenses
    .filter((e) => e.date === todayStr)
    .reduce((a, c) => a + Number(c.amount), 0);

  const thisMonthExpenses = expenses.filter((e) => {
    const d = new Date(e.date);
    const now = new Date();
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });
  const thisMonthTotal = thisMonthExpenses.reduce((a, c) => a + Number(c.amount), 0);
  const filteredTotal = filteredExpenses.reduce((a, c) => a + Number(c.amount), 0);

  // Category Breakdown
  const categoryBreakdown = EXPENSE_CATEGORIES.map((cat) => {
    const total = filteredExpenses
      .filter((e) => e.category === cat)
      .reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
    const count = filteredExpenses.filter((e) => e.category === cat).length;
    const totalFiltered = filteredExpenses.reduce((a, c) => a + Number(c.amount), 0);
    const pct = totalFiltered > 0 ? Math.round((total / totalFiltered) * 100) : 0;
    return { category: cat, total, count, pct };
  }).filter((c) => c.total > 0).sort((a, b) => b.total - a.total);

  // CSV Export
  const exportToCSV = () => {
    const headers = ["Date", "Expense Title", "Category", "Amount", "Paid Via", "Paid To", "Mode", "Bill No", "Notes"];
    const rows = filteredExpenses.map((e) => [
      e.date,
      `"${e.expense_name.replace(/"/g, '""')}"`,
      `"${e.category}"`,
      e.amount,
      `"${(e.paid_by || '').replace(/"/g, '""')}"`,
      `"${(e.paid_to || '').replace(/"/g, '""')}"`,
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
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-slate-50 flex-col md:flex-row relative min-w-0">
      <AdminSidebar activePath="/admin/expenses" hotelName={hotelSettings.hotelName} />

      <main className="flex-1 flex flex-col min-w-0 overflow-hidden z-0">
        <main className="flex-1 p-4 md:p-8 overflow-y-auto overflow-x-hidden">
          <div className="max-w-7xl mx-auto space-y-6">

            {/* Clean Header - Matches Dashboard Theme */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 py-2 border-b border-slate-200 pb-6 mb-6">
              <div>
                <h1 className="text-2xl font-bold text-[#0F172A] tracking-tight">Expenses</h1>
                <p className="text-slate-500 mt-1 text-sm">
                  Track hotel rent, maintenance, food & kitchen, utilities, and daily outflows.
                </p>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={exportToCSV}
                  className="flex items-center gap-1.5 px-3.5 py-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-semibold text-xs rounded-xl shadow-xs transition"
                  title="Export to CSV"
                >
                  <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  Export CSV
                </button>

                <button
                  onClick={() => setIsModalOpen(true)}
                  className="flex items-center gap-1.5 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs rounded-xl shadow-xs transition cursor-pointer"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Add Expense
                </button>
              </div>
            </div>

            {/* Quick Stats Cards - Matches Dashboard Theme */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
              {/* Today's Expenses */}
              <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <p className="text-slate-500 text-xs font-semibold uppercase tracking-widest">Today&apos;s Expenses</p>
                    <div className="w-8 h-8 bg-rose-50 text-rose-500 rounded flex items-center justify-center">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                      </svg>
                    </div>
                  </div>
                  <h2 className="text-4xl font-bold text-[#0F172A] tracking-tight">₹{todayTotal.toLocaleString("en-IN")}</h2>
                </div>
                <p className="text-slate-400 text-xs mt-6">Expenses recorded for today</p>
              </div>

              {/* This Month's Outflow */}
              <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <p className="text-slate-500 text-xs font-semibold uppercase tracking-widest">This Month&apos;s Outflow</p>
                    <div className="w-8 h-8 bg-blue-50 text-[#3B82F6] rounded flex items-center justify-center">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                      </svg>
                    </div>
                  </div>
                  <h2 className="text-4xl font-bold text-[#0F172A] tracking-tight">₹{thisMonthTotal.toLocaleString("en-IN")}</h2>
                </div>
                <p className="text-slate-400 text-xs mt-6">Total expenses this calendar month</p>
              </div>

              {/* Filtered Outflow */}
              <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <p className="text-slate-500 text-xs font-semibold uppercase tracking-widest">Filtered Total</p>
                    <div className="w-8 h-8 bg-[#C5A059]/10 text-[#C5A059] rounded flex items-center justify-center">
                      <span className="font-bold text-sm">₹</span>
                    </div>
                  </div>
                  <h2 className="text-4xl font-bold text-[#0F172A] tracking-tight">₹{filteredTotal.toLocaleString("en-IN")}</h2>
                </div>
                <p className="text-slate-400 text-xs mt-6">{filteredExpenses.length} filtered entries found</p>
              </div>
            </div>

            {/* Navigation Tabs (Dashboard Segmented Control) */}
            <div className="flex items-center gap-1 bg-slate-200/70 p-1 rounded-xl w-fit">
              <button
                onClick={() => setActiveView("records")}
                className={`px-4 py-2 rounded-lg text-xs font-semibold transition ${
                  activeView === "records"
                    ? "bg-white text-[#0F172A] shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Expense Records ({filteredExpenses.length})
              </button>

              <button
                onClick={() => setActiveView("analytics")}
                className={`px-4 py-2 rounded-lg text-xs font-semibold transition ${
                  activeView === "analytics"
                    ? "bg-white text-[#0F172A] shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Category Breakdown
              </button>
            </div>

            {/* VIEW 1: EXPENSE RECORDS */}
            {activeView === "records" && (
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                {/* Filters */}
                <div className="px-6 pt-6 pb-4 border-b border-slate-100">
                  <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
                    <div className="flex flex-wrap items-center gap-2">
                      {/* Date presets */}
                      {["Today", "Yesterday", "This Week", "This Month", "All Time"].map((f) => (
                        <button
                          key={f}
                          onClick={() => setDateFilter(f)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                            dateFilter === f
                              ? "bg-slate-900 text-white font-semibold"
                              : "bg-slate-50 border border-slate-200 text-slate-600 hover:bg-slate-100"
                          }`}
                        >
                          {f}
                        </button>
                      ))}

                      <select
                        value={categoryFilter}
                        onChange={(e) => setCategoryFilter(e.target.value)}
                        className="py-1.5 px-3 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-700 outline-none focus:ring-2 focus:ring-slate-900"
                      >
                        <option value="All Categories">All Categories</option>
                        {EXPENSE_CATEGORIES.map((c) => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>

                      <select
                        value={accountFilter}
                        onChange={(e) => setAccountFilter(e.target.value)}
                        className="py-1.5 px-3 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-700 outline-none focus:ring-2 focus:ring-slate-900"
                      >
                        <option value="All Accounts">All Accounts</option>
                        {PAYMENT_ACCOUNTS.map((a) => (
                          <option key={a} value={a}>{a}</option>
                        ))}
                      </select>
                    </div>

                    <div className="relative w-full lg:w-72">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                      </div>
                      <input
                        type="text"
                        placeholder="Search title, vendor, bill #..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-9 w-full py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 outline-none focus:ring-2 focus:ring-slate-900 transition-all"
                      />
                    </div>
                  </div>
                </div>

                {/* Table */}
                <div className="overflow-x-auto w-full">
                  <table className="min-w-[850px] w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-100">
                        <th className="px-6 py-3.5 text-xs font-bold text-slate-500 uppercase tracking-wider">Date</th>
                        <th className="px-6 py-3.5 text-xs font-bold text-slate-500 uppercase tracking-wider">Expense Details</th>
                        <th className="px-6 py-3.5 text-xs font-bold text-slate-500 uppercase tracking-wider">Category</th>
                        <th className="px-6 py-3.5 text-xs font-bold text-slate-500 uppercase tracking-wider">Amount</th>
                        <th className="px-6 py-3.5 text-xs font-bold text-slate-500 uppercase tracking-wider">Paid Via</th>
                        <th className="px-6 py-3.5 text-xs font-bold text-slate-500 uppercase tracking-wider">Vendor / Bill #</th>
                        <th className="px-6 py-3.5 text-xs font-bold text-slate-500 uppercase tracking-wider">Mode</th>
                        <th className="px-6 py-3.5 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-sm text-slate-700">
                      {isLoading ? (
                        <tr>
                          <td colSpan={8} className="text-center py-12 text-slate-400">Loading expenses...</td>
                        </tr>
                      ) : filteredExpenses.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="text-center py-16">
                            <div className="flex flex-col items-center gap-2">
                              <span className="text-3xl text-slate-300">🧾</span>
                              <p className="font-semibold text-slate-600 text-sm">No expenses recorded for these filters.</p>
                              <p className="text-xs text-slate-400">Click &ldquo;Add Expense&rdquo; above to record an outflow.</p>
                            </div>
                          </td>
                        </tr>
                      ) : (
                        filteredExpenses.map((exp) => {
                          const catBadge = CATEGORY_COLORS[exp.category] || CATEGORY_COLORS["Other Miscellaneous"];
                          return (
                            <tr key={exp.id} className="hover:bg-slate-50/50 transition-colors">
                              <td className="px-6 py-4 whitespace-nowrap text-xs text-slate-500 font-medium">
                                {exp.date ? new Date(exp.date).toLocaleDateString("en-IN") : "—"}
                              </td>
                              <td className="px-6 py-4">
                                <p className="font-semibold text-slate-800 text-sm">{exp.expense_name}</p>
                                {exp.notes && (
                                  <p className="text-xs text-slate-400 mt-0.5 truncate max-w-[220px]">{exp.notes}</p>
                                )}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <span className={`px-2.5 py-1 rounded-full text-xs font-medium border inline-flex items-center gap-1.5 ${catBadge.bg} ${catBadge.text}`}>
                                  <span>{catBadge.icon}</span> {exp.category}
                                </span>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <span className="font-bold text-[#0F172A] text-sm">
                                  ₹{Number(exp.amount).toLocaleString("en-IN")}
                                </span>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <span className="px-2.5 py-1 bg-slate-100 text-slate-700 rounded-md text-xs font-medium">
                                  {exp.paid_by || "Hotel Cash Drawer"}
                                </span>
                              </td>
                              <td className="px-6 py-4 text-xs whitespace-nowrap">
                                <div className="text-slate-800 font-medium">{exp.paid_to || "—"}</div>
                                {exp.bill_number && (
                                  <div className="text-[11px] font-mono text-slate-400 mt-0.5">#{exp.bill_number}</div>
                                )}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-xs font-medium">
                                  {exp.mode}
                                </span>
                              </td>
                              <td className="px-6 py-4 text-right whitespace-nowrap">
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
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                    </svg>
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
                  <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-between items-center text-xs sm:text-sm font-semibold text-slate-700">
                    <span>Showing {filteredExpenses.length} entries</span>
                    <span>
                      Total Outflow: <span className="text-[#0F172A] text-sm font-bold ml-1">
                        ₹{filteredExpenses.reduce((a, c) => a + Number(c.amount), 0).toLocaleString("en-IN")}
                      </span>
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* VIEW 2: CATEGORY ANALYTICS */}
            {activeView === "analytics" && (
              <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-6">
                <div>
                  <h2 className="text-lg font-bold text-slate-800">Expense Distribution by Category</h2>
                  <p className="text-xs text-slate-500 mt-0.5">Breakdown of operational costs for {dateFilter}.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {categoryBreakdown.map((cat) => {
                    const badge = CATEGORY_COLORS[cat.category] || CATEGORY_COLORS["Other Miscellaneous"];
                    return (
                      <div key={cat.category} className="p-4 rounded-xl border border-slate-100 bg-slate-50/50 space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                            <span>{badge.icon}</span> {cat.category}
                          </span>
                          <span className="text-sm font-bold text-[#0F172A]">
                            ₹{cat.total.toLocaleString("en-IN")}
                          </span>
                        </div>

                        <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                          <div
                            className="bg-[#0F172A] h-full rounded-full transition-all"
                            style={{
                              width: `${(cat.total / (filteredExpenses.reduce((a, c) => a + Number(c.amount), 0) || 1)) * 100}%`
                            }}
                          ></div>
                        </div>

                        <div className="flex justify-between text-xs text-slate-400">
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
        </main>
      </main>

      {/* ADD EXPENSE MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden border border-slate-100 my-8">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <div>
                <h3 className="font-bold text-slate-800 text-lg">Record New Expense</h3>
                <p className="text-xs text-slate-400">Track rent, maintenance, food, utilities & daily outflows.</p>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center transition"
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">Date *</label>
                  <input
                    type="date"
                    required
                    value={formDate}
                    onChange={(e) => setFormDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs sm:text-sm outline-none focus:ring-2 focus:ring-[#0F172A] bg-slate-50 text-slate-700"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">Amount (₹) *</label>
                  <input
                    type="number"
                    required
                    value={formAmount}
                    onChange={(e) => setFormAmount(e.target.value)}
                    placeholder="e.g. 2500"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm font-bold text-slate-900 outline-none focus:ring-2 focus:ring-[#0F172A] bg-slate-50"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">Expense Title / Description *</label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g. Hotel building rent / 5 LPG gas cylinders / Plumber work"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-[#0F172A] bg-slate-50 text-slate-700"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">Category *</label>
                  <select
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs sm:text-sm outline-none focus:ring-2 focus:ring-[#0F172A] bg-slate-50 font-medium text-slate-700"
                  >
                    {EXPENSE_CATEGORIES.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">Payment Mode</label>
                  <select
                    value={formMode}
                    onChange={(e) => setFormMode(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs sm:text-sm outline-none focus:ring-2 focus:ring-[#0F172A] bg-slate-50 text-slate-700"
                  >
                    {["Cash", "UPI", "Bank Transfer", "Card", "Cheque"].map((m) => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">
                    Paid Via (Account)
                  </label>
                  <select
                    value={formPaidBy}
                    onChange={(e) => setFormPaidBy(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs sm:text-sm font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-[#0F172A]"
                  >
                    {PAYMENT_ACCOUNTS.map((a) => (
                      <option key={a} value={a}>{a}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">Paid To (Vendor / Person)</label>
                  <input
                    type="text"
                    value={formPaidTo}
                    onChange={(e) => setFormPaidTo(e.target.value)}
                    placeholder="e.g. Landlord Sharma Ji / Indian Oil"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs sm:text-sm outline-none focus:ring-2 focus:ring-[#0F172A] bg-slate-50 text-slate-700"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">Bill / Receipt / Slip No. (Optional)</label>
                <input
                  type="text"
                  value={formBillNumber}
                  onChange={(e) => setFormBillNumber(e.target.value)}
                  placeholder="e.g. INV-2026-881 or Parchi #4"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs sm:text-sm font-mono outline-none focus:ring-2 focus:ring-[#0F172A] bg-slate-50 text-slate-700"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">Notes / Purpose (Optional)</label>
                <textarea
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  placeholder="Any additional details..."
                  rows={2}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs sm:text-sm outline-none focus:ring-2 focus:ring-[#0F172A] bg-slate-50 resize-none text-slate-700"
                />
              </div>
            </div>

            <div className="px-6 py-4 border-t border-slate-100 flex gap-2 justify-end bg-slate-50/50">
              <button
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 border border-slate-200 text-slate-600 text-xs sm:text-sm font-semibold rounded-xl hover:bg-slate-100 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleAddExpense}
                disabled={isSaving}
                className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs sm:text-sm font-semibold rounded-xl shadow-xs transition disabled:opacity-60"
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
