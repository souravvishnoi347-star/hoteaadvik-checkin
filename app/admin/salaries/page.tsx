"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/utils/supabase";
import AdminSidebar from "@/components/AdminSidebar";

export type Employee = {
  id: number;
  created_at: string;
  name: string;
  role: string;
  phone?: string;
  monthly_salary: number;
  joining_date?: string;
  id_proof_number?: string;
  status: "Active" | "Inactive";
};

export type SalaryRecord = {
  id: number;
  created_at: string;
  employee_id: number;
  employee_name: string;
  month_year: string; // e.g. "Nov 2026"
  base_salary: number;
  advance_deduction: number;
  bonus_overtime: number;
  net_paid: number;
  payment_date: string;
  payment_mode: string;
  paid_by: string; // "Amit Sir (Partner 1)", "Partner 2", "Partner 3", "Hotel Cash", etc.
  payment_status: "Paid" | "Partial" | "Advance";
  notes?: string;
};

const ROLES = [
  "Manager",
  "Receptionist / Frontdesk",
  "Head Cook",
  "Kitchen Helper",
  "Housekeeping",
  "Room Boy",
  "Security / Guard",
  "Maintenance / Electrician",
  "Other"
];

const PARTNERS = [
  "Amit Sir (Partner 1)",
  "Partner 2",
  "Partner 3",
  "Hotel Cash Drawer",
  "Hotel Bank Account"
];

const PAYMENT_MODES = ["Cash", "UPI (GPay/PhonePe)", "Bank Transfer", "Cheque"];

// Generate recent 12 months for dropdown
function getRecentMonths(): string[] {
  const months: string[] = [];
  const date = new Date();
  for (let i = 0; i < 12; i++) {
    const d = new Date(date.getFullYear(), date.getMonth() - i, 1);
    const label = d.toLocaleString("en-US", { month: "short", year: "numeric" });
    months.push(label);
  }
  return months;
}

export default function SalariesPage() {
  const router = useRouter();
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const [hotelSettings, setHotelSettings] = useState({ hotelName: "HOTEL AADVIK INN" });

  const recentMonths = getRecentMonths();
  const [selectedMonth, setSelectedMonth] = useState<string>(recentMonths[0]);
  const [activeTab, setActiveTab] = useState<"payroll" | "employees" | "partners">("payroll");

  // State
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [salaries, setSalaries] = useState<SalaryRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dbError, setDbError] = useState<string | null>(null);

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [filterPayer, setFilterPayer] = useState("All Payers");

  // Add / Edit Employee Modal State
  const [isEmployeeModalOpen, setIsEmployeeModalOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [empName, setEmpName] = useState("");
  const [empRole, setEmpRole] = useState("Housekeeping");
  const [empPhone, setEmpPhone] = useState("");
  const [empSalary, setEmpSalary] = useState("");
  const [empJoining, setEmpJoining] = useState(new Date().toISOString().split("T")[0]);
  const [empIdProof, setEmpIdProof] = useState("");
  const [isSavingEmp, setIsSavingEmp] = useState(false);

  // Record Salary Payment Modal State
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [payEmployeeId, setPayEmployeeId] = useState<number | "">("");
  const [payMonth, setPayMonth] = useState(recentMonths[0]);
  const [payBaseSalary, setPayBaseSalary] = useState("0");
  const [payAdvanceDeduction, setPayAdvanceDeduction] = useState("0");
  const [payBonus, setPayBonus] = useState("0");
  const [payDate, setPayDate] = useState(new Date().toISOString().split("T")[0]);
  const [payMode, setPayMode] = useState("Cash");
  const [payPaidBy, setPayPaidBy] = useState("Amit Sir (Partner 1)");
  const [payStatus, setPayStatus] = useState<"Paid" | "Partial" | "Advance">("Paid");
  const [payNotes, setPayNotes] = useState("");
  const [isSavingPay, setIsSavingPay] = useState(false);

  // Print voucher modal
  const [viewVoucher, setViewVoucher] = useState<SalaryRecord | null>(null);

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
        fetchData();
      }
    };
    checkSession();
  }, [router]);

  const fetchData = async () => {
    setIsLoading(true);
    setDbError(null);

    try {
      // 1. Fetch Employees
      const { data: empData, error: empErr } = await supabase
        .from("Employees")
        .select("*")
        .order("name", { ascending: true });

      if (empErr) {
        console.warn("Employees fetch notice:", empErr);
        if (empErr.message?.includes("does not exist") || empErr.code === "42P01") {
          setDbError("Employees table not yet initialized in Supabase. Please run supabase_salary_and_expenses_v2.sql in your Supabase SQL Editor.");
        }
      } else if (empData) {
        setEmployees(empData);
      }

      // 2. Fetch Salaries
      const { data: salData, error: salErr } = await supabase
        .from("Salaries")
        .select("*")
        .order("payment_date", { ascending: false });

      if (salErr) {
        console.warn("Salaries fetch notice:", salErr);
      } else if (salData) {
        setSalaries(salData);
      }
    } catch (e: any) {
      console.error("Error loading salary data:", e);
    } finally {
      setIsLoading(false);
    }
  };

  // Auto-fill base salary when selecting employee in Payment Modal
  const handleSelectEmployeeForPayment = (empId: number) => {
    setPayEmployeeId(empId);
    const emp = employees.find((e) => e.id === empId);
    if (emp) {
      setPayBaseSalary(emp.monthly_salary.toString());
    }
  };

  // Calculations for Payment Modal
  const calcNetPay = () => {
    const base = parseFloat(payBaseSalary) || 0;
    const deduction = parseFloat(payAdvanceDeduction) || 0;
    const bonus = parseFloat(payBonus) || 0;
    const net = base - deduction + bonus;
    return net > 0 ? net : 0;
  };

  // Handle Save Employee
  const handleSaveEmployee = async () => {
    if (!empName.trim() || !empSalary) {
      alert("Please provide Employee Name and Monthly Salary.");
      return;
    }

    setIsSavingEmp(true);
    try {
      if (editingEmployee) {
        const { error } = await supabase
          .from("Employees")
          .update({
            name: empName.trim(),
            role: empRole,
            phone: empPhone.trim() || null,
            monthly_salary: parseFloat(empSalary) || 0,
            joining_date: empJoining || null,
            id_proof_number: empIdProof.trim() || null
          })
          .eq("id", editingEmployee.id);

        if (error) throw error;
      } else {
        const { error } = await supabase.from("Employees").insert({
          name: empName.trim(),
          role: empRole,
          phone: empPhone.trim() || null,
          monthly_salary: parseFloat(empSalary) || 0,
          joining_date: empJoining || null,
          id_proof_number: empIdProof.trim() || null,
          status: "Active"
        });

        if (error) throw error;
      }

      setIsEmployeeModalOpen(false);
      setEditingEmployee(null);
      resetEmployeeForm();
      fetchData();
    } catch (err: any) {
      alert("Failed to save employee: " + (err.message || "Unknown error"));
    } finally {
      setIsSavingEmp(false);
    }
  };

  const resetEmployeeForm = () => {
    setEmpName("");
    setEmpRole("Housekeeping");
    setEmpPhone("");
    setEmpSalary("");
    setEmpJoining(new Date().toISOString().split("T")[0]);
    setEmpIdProof("");
  };

  const handleEditEmployee = (emp: Employee) => {
    setEditingEmployee(emp);
    setEmpName(emp.name);
    setEmpRole(emp.role);
    setEmpPhone(emp.phone || "");
    setEmpSalary(emp.monthly_salary.toString());
    setEmpJoining(emp.joining_date || new Date().toISOString().split("T")[0]);
    setEmpIdProof(emp.id_proof_number || "");
    setIsEmployeeModalOpen(true);
  };

  const handleToggleEmployeeStatus = async (emp: Employee) => {
    const newStatus = emp.status === "Active" ? "Inactive" : "Active";
    const { error } = await supabase
      .from("Employees")
      .update({ status: newStatus })
      .eq("id", emp.id);

    if (error) {
      alert("Failed to update status: " + error.message);
    } else {
      fetchData();
    }
  };

  // Handle Record Salary Payment
  const handleSaveSalaryPayment = async () => {
    if (!payEmployeeId) {
      alert("Please select an employee.");
      return;
    }

    const emp = employees.find((e) => e.id === payEmployeeId);
    if (!emp) return;

    const netAmount = calcNetPay();

    setIsSavingPay(true);
    try {
      const { error } = await supabase.from("Salaries").insert({
        employee_id: emp.id,
        employee_name: emp.name,
        month_year: payMonth,
        base_salary: parseFloat(payBaseSalary) || 0,
        advance_deduction: parseFloat(payAdvanceDeduction) || 0,
        bonus_overtime: parseFloat(payBonus) || 0,
        net_paid: netAmount,
        payment_date: payDate,
        payment_mode: payMode,
        paid_by: payPaidBy,
        payment_status: payStatus,
        notes: payNotes.trim() || null
      });

      if (error) throw error;

      setIsPaymentModalOpen(false);
      resetPaymentForm();
      fetchData();
    } catch (err: any) {
      alert("Failed to record salary: " + (err.message || "Unknown error"));
    } finally {
      setIsSavingPay(false);
    }
  };

  const resetPaymentForm = () => {
    setPayEmployeeId("");
    setPayBaseSalary("0");
    setPayAdvanceDeduction("0");
    setPayBonus("0");
    setPayDate(new Date().toISOString().split("T")[0]);
    setPayMode("Cash");
    setPayPaidBy("Amit Sir (Partner 1)");
    setPayStatus("Paid");
    setPayNotes("");
  };

  const handleDeleteSalaryRecord = async (id: number) => {
    if (!window.confirm("Are you sure you want to delete this salary disbursement record?")) return;
    const { error } = await supabase.from("Salaries").delete().eq("id", id);
    if (error) {
      alert("Failed to delete record: " + error.message);
    } else {
      fetchData();
    }
  };

  // Calculations for current selected month
  const activeEmployees = employees.filter((e) => e.status === "Active");
  const totalMonthlyCommitment = activeEmployees.reduce((sum, e) => sum + (Number(e.monthly_salary) || 0), 0);

  const monthSalaries = salaries.filter((s) => s.month_year === selectedMonth);
  const totalMonthPaid = monthSalaries.reduce((sum, s) => sum + (Number(s.net_paid) || 0), 0);
  const pendingMonthBalance = totalMonthlyCommitment > totalMonthPaid ? totalMonthlyCommitment - totalMonthPaid : 0;

  // Filtered salary records
  const filteredSalaries = salaries.filter((s) => {
    const matchesMonth = selectedMonth === "All Months" || s.month_year === selectedMonth;
    const matchesSearch = s.employee_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (s.notes || "").toLowerCase().includes(searchQuery.toLowerCase());
    const matchesPayer = filterPayer === "All Payers" || s.paid_by === filterPayer;
    return matchesMonth && matchesSearch && matchesPayer;
  });

  // Partner Wise Breakdown for selected month
  const partnerBreakdown = PARTNERS.map((partner) => {
    const total = monthSalaries
      .filter((s) => s.paid_by === partner)
      .reduce((sum, s) => sum + (Number(s.net_paid) || 0), 0);
    const count = monthSalaries.filter((s) => s.paid_by === partner).length;
    return { partner, total, count };
  });

  if (isCheckingSession) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-slate-50 flex-col md:flex-row relative font-sans">
      <AdminSidebar activePath="/admin/salaries" hotelName={hotelSettings.hotelName} />

      <main className="flex-1 flex flex-col overflow-hidden z-0">
        <div className="flex-1 p-4 md:p-8 overflow-y-auto">
          <div className="max-w-7xl mx-auto space-y-6">

            {/* DB Error / Notice banner */}
            {dbError && (
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <span className="text-xl">⚠️</span>
                  <div>
                    <h4 className="text-sm font-bold text-amber-900">Database Setup Required for Salaries</h4>
                    <p className="text-xs text-amber-700 mt-0.5">{dbError}</p>
                  </div>
                </div>
                <button
                  onClick={() => alert("Please run the script 'supabase_salary_and_expenses_v2.sql' provided in your project root inside your Supabase Dashboard SQL Editor.")}
                  className="px-3 py-1.5 bg-amber-600 text-white font-semibold text-xs rounded-xl shadow-xs shrink-0"
                >
                  View Migration Info
                </button>
              </div>
            )}

            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white/80 backdrop-blur-md p-6 rounded-3xl border border-slate-200/80 shadow-xs">
              <div>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center text-xl">
                    💼
                  </div>
                  <div>
                    <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-800 tracking-tight">Staff & Salaries Ledger</h1>
                    <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                      Employee payroll, monthly disbursements, and 3-partner financial transparency.
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
                <button
                  onClick={() => {
                    resetEmployeeForm();
                    setEditingEmployee(null);
                    setIsEmployeeModalOpen(true);
                  }}
                  className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold rounded-xl text-xs sm:text-sm shadow-xs transition"
                >
                  <span>👤+</span> Add Employee
                </button>

                <button
                  onClick={() => {
                    resetPaymentForm();
                    setIsPaymentModalOpen(true);
                  }}
                  className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs sm:text-sm shadow-md shadow-indigo-100 transition"
                >
                  <span>💰</span> Disburse Salary
                </button>
              </div>
            </div>

            {/* KPI Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
                <div>
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Active Staff</p>
                  <h3 className="text-2xl font-black text-slate-800 mt-1">{activeEmployees.length} Members</h3>
                </div>
                <p className="text-[11px] text-slate-500 mt-3 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block"></span>
                  {employees.filter(e => e.status === "Inactive").length} inactive / former staff
                </p>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Monthly Commitment</p>
                    <span className="text-[11px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md">{selectedMonth}</span>
                  </div>
                  <h3 className="text-2xl font-black text-slate-800 mt-1">₹{totalMonthlyCommitment.toLocaleString("en-IN")}</h3>
                </div>
                <p className="text-[11px] text-slate-500 mt-3">Sum of base monthly salaries</p>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
                <div>
                  <p className="text-xs font-semibold text-emerald-600 uppercase tracking-wider">Paid for {selectedMonth}</p>
                  <h3 className="text-2xl font-black text-emerald-600 mt-1">₹{totalMonthPaid.toLocaleString("en-IN")}</h3>
                </div>
                <div className="w-full bg-slate-100 h-1.5 rounded-full mt-3 overflow-hidden">
                  <div
                    className="bg-emerald-500 h-full rounded-full transition-all"
                    style={{
                      width: `${totalMonthlyCommitment > 0 ? Math.min(100, Math.round((totalMonthPaid / totalMonthlyCommitment) * 100)) : 0}%`
                    }}
                  ></div>
                </div>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
                <div>
                  <p className="text-xs font-semibold text-rose-500 uppercase tracking-wider">Pending Dues</p>
                  <h3 className="text-2xl font-black text-rose-600 mt-1">₹{pendingMonthBalance.toLocaleString("en-IN")}</h3>
                </div>
                <p className="text-[11px] text-slate-400 mt-3">Remaining to disburse this month</p>
              </div>
            </div>

            {/* Navigation Tabs */}
            <div className="flex border-b border-slate-200 bg-white rounded-2xl px-3 pt-2 shadow-xs">
              <button
                onClick={() => setActiveTab("payroll")}
                className={`flex items-center gap-2 px-5 py-3 text-xs sm:text-sm font-bold border-b-2 transition ${
                  activeTab === "payroll"
                    ? "border-indigo-600 text-indigo-600"
                    : "border-transparent text-slate-500 hover:text-slate-800"
                }`}
              >
                <span>📜</span> Salary Disbursements ({filteredSalaries.length})
              </button>

              <button
                onClick={() => setActiveTab("employees")}
                className={`flex items-center gap-2 px-5 py-3 text-xs sm:text-sm font-bold border-b-2 transition ${
                  activeTab === "employees"
                    ? "border-indigo-600 text-indigo-600"
                    : "border-transparent text-slate-500 hover:text-slate-800"
                }`}
              >
                <span>👥</span> Staff Directory ({employees.length})
              </button>

              <button
                onClick={() => setActiveTab("partners")}
                className={`flex items-center gap-2 px-5 py-3 text-xs sm:text-sm font-bold border-b-2 transition ${
                  activeTab === "partners"
                    ? "border-indigo-600 text-indigo-600"
                    : "border-transparent text-slate-500 hover:text-slate-800"
                }`}
              >
                <span>🤝</span> Partner Contributions
              </button>
            </div>

            {/* TAB 1: PAYROLL / DISBURSEMENT HISTORY */}
            {activeTab === "payroll" && (
              <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
                {/* Filters */}
                <div className="p-5 border-b border-slate-100 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 bg-slate-50/50">
                  <div className="flex flex-wrap items-center gap-2.5 w-full lg:w-auto">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Month</label>
                      <select
                        value={selectedMonth}
                        onChange={(e) => setSelectedMonth(e.target.value)}
                        className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500 shadow-xs"
                      >
                        <option value="All Months">All Months</option>
                        {recentMonths.map((m) => (
                          <option key={m} value={m}>{m}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Paid By (Partner)</label>
                      <select
                        value={filterPayer}
                        onChange={(e) => setFilterPayer(e.target.value)}
                        className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500 shadow-xs"
                      >
                        <option value="All Payers">All Payers</option>
                        {PARTNERS.map((p) => (
                          <option key={p} value={p}>{p}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="relative w-full lg:w-72">
                    <input
                      type="text"
                      placeholder="Search employee or notes..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500 shadow-xs"
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
                        <th className="py-3.5 px-4">Employee</th>
                        <th className="py-3.5 px-4">Month</th>
                        <th className="py-3.5 px-4">Base / Deduction / Bonus</th>
                        <th className="py-3.5 px-4">Net Paid</th>
                        <th className="py-3.5 px-4">Paid By (Partner)</th>
                        <th className="py-3.5 px-4">Mode & Status</th>
                        <th className="py-3.5 px-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs sm:text-sm text-slate-700">
                      {isLoading ? (
                        <tr>
                          <td colSpan={8} className="text-center py-12 text-slate-400">Loading payroll records...</td>
                        </tr>
                      ) : filteredSalaries.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="text-center py-16">
                            <div className="flex flex-col items-center gap-2">
                              <span className="text-4xl text-slate-300">💸</span>
                              <p className="font-semibold text-slate-600">No salary records found for {selectedMonth}.</p>
                              <p className="text-xs text-slate-400">Click &ldquo;Disburse Salary&rdquo; above to record a payment.</p>
                            </div>
                          </td>
                        </tr>
                      ) : (
                        filteredSalaries.map((rec) => (
                          <tr key={rec.id} className="hover:bg-slate-50/80 transition-colors">
                            <td className="py-3.5 px-4 whitespace-nowrap text-xs text-slate-500">
                              {rec.payment_date ? new Date(rec.payment_date).toLocaleDateString("en-IN") : "—"}
                            </td>
                            <td className="py-3.5 px-4">
                              <p className="font-bold text-slate-800">{rec.employee_name}</p>
                              {rec.notes && <p className="text-[11px] text-slate-400 mt-0.5 truncate max-w-[180px]">{rec.notes}</p>}
                            </td>
                            <td className="py-3.5 px-4">
                              <span className="px-2.5 py-1 bg-slate-100 text-slate-700 rounded-lg text-xs font-semibold">
                                {rec.month_year}
                              </span>
                            </td>
                            <td className="py-3.5 px-4 text-xs">
                              <div>Base: ₹{rec.base_salary.toLocaleString("en-IN")}</div>
                              {rec.advance_deduction > 0 && (
                                <div className="text-rose-500">- Advance: ₹{rec.advance_deduction.toLocaleString("en-IN")}</div>
                              )}
                              {rec.bonus_overtime > 0 && (
                                <div className="text-emerald-600">+ Bonus: ₹{rec.bonus_overtime.toLocaleString("en-IN")}</div>
                              )}
                            </td>
                            <td className="py-3.5 px-4">
                              <span className="font-black text-slate-900 text-base">
                                ₹{rec.net_paid.toLocaleString("en-IN")}
                              </span>
                            </td>
                            <td className="py-3.5 px-4">
                              <span className="px-2.5 py-1 bg-indigo-50 border border-indigo-100 text-indigo-700 rounded-lg text-xs font-bold whitespace-nowrap">
                                👤 {rec.paid_by}
                              </span>
                            </td>
                            <td className="py-3.5 px-4">
                              <div className="flex flex-col gap-1 items-start">
                                <span className="text-xs text-slate-600 font-medium">💳 {rec.payment_mode}</span>
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                                  rec.payment_status === "Paid"
                                    ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                    : rec.payment_status === "Advance"
                                    ? "bg-amber-50 text-amber-700 border border-amber-200"
                                    : "bg-blue-50 text-blue-700 border border-blue-200"
                                }`}>
                                  {rec.payment_status}
                                </span>
                              </div>
                            </td>
                            <td className="py-3.5 px-4 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  onClick={() => setViewVoucher(rec)}
                                  title="View Salary Slip"
                                  className="p-1.5 text-slate-500 hover:text-indigo-600 rounded-lg hover:bg-slate-100 transition"
                                >
                                  📄 Slip
                                </button>
                                <button
                                  onClick={() => handleDeleteSalaryRecord(rec.id)}
                                  title="Delete Record"
                                  className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition"
                                >
                                  🗑️
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* TAB 2: STAFF DIRECTORY */}
            {activeTab === "employees" && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {employees.map((emp) => (
                  <div
                    key={emp.id}
                    className={`bg-white rounded-3xl p-6 border transition shadow-xs flex flex-col justify-between ${
                      emp.status === "Active" ? "border-slate-200 hover:shadow-md" : "border-slate-200 opacity-60 bg-slate-50"
                    }`}
                  >
                    <div>
                      <div className="flex items-start justify-between">
                        <div>
                          <span className="px-2.5 py-0.5 bg-indigo-50 text-indigo-700 rounded-md text-[11px] font-bold uppercase tracking-wider">
                            {emp.role}
                          </span>
                          <h3 className="text-lg font-bold text-slate-900 mt-2">{emp.name}</h3>
                          <p className="text-xs text-slate-500 mt-0.5">📞 {emp.phone || "No phone recorded"}</p>
                        </div>
                        <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                          emp.status === "Active" ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-slate-200 text-slate-600"
                        }`}>
                          {emp.status}
                        </span>
                      </div>

                      <div className="mt-4 pt-4 border-t border-slate-100 space-y-2 text-xs">
                        <div className="flex justify-between">
                          <span className="text-slate-400">Monthly Base Salary:</span>
                          <span className="font-bold text-slate-800 text-sm">₹{emp.monthly_salary.toLocaleString("en-IN")}</span>
                        </div>
                        {emp.joining_date && (
                          <div className="flex justify-between">
                            <span className="text-slate-400">Joined:</span>
                            <span className="text-slate-600">{new Date(emp.joining_date).toLocaleDateString("en-IN")}</span>
                          </div>
                        )}
                        {emp.id_proof_number && (
                          <div className="flex justify-between">
                            <span className="text-slate-400">ID Proof / Aadhaar:</span>
                            <span className="font-mono text-slate-600">{emp.id_proof_number}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between">
                      <button
                        onClick={() => handleToggleEmployeeStatus(emp)}
                        className="text-xs font-semibold text-slate-500 hover:text-slate-800"
                      >
                        {emp.status === "Active" ? "Deactivate" : "Activate"}
                      </button>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleEditEmployee(emp)}
                          className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg text-xs transition"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => {
                            resetPaymentForm();
                            setPayEmployeeId(emp.id);
                            setPayBaseSalary(emp.monthly_salary.toString());
                            setIsPaymentModalOpen(true);
                          }}
                          className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg text-xs shadow-xs transition"
                        >
                          Pay Salary
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* TAB 3: PARTNER SALARY CONTRIBUTIONS */}
            {activeTab === "partners" && (
              <div className="space-y-6">
                <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-6">
                    <div>
                      <h2 className="text-lg font-bold text-slate-800">Partner Salary Disbursed Ledger</h2>
                      <p className="text-xs text-slate-500">
                        Tracks which partner paid out of their own pocket vs. hotel cash for <span className="font-bold text-indigo-600">{selectedMonth}</span>.
                      </p>
                    </div>

                    <select
                      value={selectedMonth}
                      onChange={(e) => setSelectedMonth(e.target.value)}
                      className="px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 outline-none"
                    >
                      {recentMonths.map((m) => (
                        <option key={m} value={m}>{m}</option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {partnerBreakdown.map((pb) => (
                      <div key={pb.partner} className="p-5 rounded-2xl border border-slate-200 bg-slate-50/50 flex flex-col justify-between">
                        <div>
                          <p className="text-xs font-bold text-indigo-700 uppercase tracking-wider">{pb.partner}</p>
                          <h3 className="text-2xl font-black text-slate-900 mt-2">₹{pb.total.toLocaleString("en-IN")}</h3>
                        </div>
                        <div className="mt-4 pt-3 border-t border-slate-200/60 flex justify-between text-xs text-slate-500">
                          <span>Salaries Handled:</span>
                          <span className="font-semibold text-slate-700">{pb.count} payments</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

          </div>
        </div>
      </main>

      {/* MODAL: ADD / EDIT EMPLOYEE */}
      {isEmployeeModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <h3 className="text-lg font-bold text-slate-800">
                {editingEmployee ? "Edit Employee" : "Add New Employee"}
              </h3>
              <button
                onClick={() => setIsEmployeeModalOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-200/70 hover:bg-slate-200 text-slate-600 flex items-center justify-center"
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">Full Name *</label>
                <input
                  type="text"
                  required
                  value={empName}
                  onChange={(e) => setEmpName(e.target.value)}
                  placeholder="e.g. Ramesh Kumar"
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">Role / Position *</label>
                  <select
                    value={empRole}
                    onChange={(e) => setEmpRole(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-xs sm:text-sm outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                  >
                    {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">Monthly Salary (₹) *</label>
                  <input
                    type="number"
                    required
                    value={empSalary}
                    onChange={(e) => setEmpSalary(e.target.value)}
                    placeholder="e.g. 15000"
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">Phone Number</label>
                  <input
                    type="tel"
                    value={empPhone}
                    onChange={(e) => setEmpPhone(e.target.value)}
                    placeholder="9876543210"
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">Joining Date</label>
                  <input
                    type="date"
                    value={empJoining}
                    onChange={(e) => setEmpJoining(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-xs sm:text-sm outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">Aadhaar / ID Card Number</label>
                <input
                  type="text"
                  value={empIdProof}
                  onChange={(e) => setEmpIdProof(e.target.value)}
                  placeholder="e.g. 4930 1234 5678"
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-mono outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            <div className="p-6 border-t border-slate-100 flex gap-2 justify-end bg-slate-50/50">
              <button
                onClick={() => setIsEmployeeModalOpen(false)}
                className="px-4 py-2 border border-slate-200 text-slate-600 text-xs sm:text-sm font-semibold rounded-xl hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEmployee}
                disabled={isSavingEmp}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs sm:text-sm font-bold rounded-xl shadow-xs transition disabled:opacity-60"
              >
                {isSavingEmp ? "Saving..." : editingEmployee ? "Update Employee" : "Save Employee"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: DISBURSE / RECORD SALARY PAYMENT */}
      {isPaymentModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 my-8">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <div>
                <h3 className="text-lg font-bold text-slate-800">Disburse Salary Payment</h3>
                <p className="text-xs text-slate-400">Record staff salary disbursement with partner transparency.</p>
              </div>
              <button
                onClick={() => setIsPaymentModalOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-200/70 hover:bg-slate-200 text-slate-600 flex items-center justify-center"
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">Select Employee *</label>
                  <select
                    value={payEmployeeId}
                    onChange={(e) => handleSelectEmployeeForPayment(parseInt(e.target.value))}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-xs sm:text-sm font-semibold outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                  >
                    <option value="">-- Choose Employee --</option>
                    {activeEmployees.map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.name} ({e.role} - ₹{e.monthly_salary})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">Salary Month *</label>
                  <select
                    value={payMonth}
                    onChange={(e) => setPayMonth(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-xs sm:text-sm font-semibold outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                  >
                    {recentMonths.map((m) => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Salary Breakdown Inputs */}
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/70 space-y-3">
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 uppercase">Base Salary (₹)</label>
                    <input
                      type="number"
                      value={payBaseSalary}
                      onChange={(e) => setPayBaseSalary(e.target.value)}
                      className="w-full px-3 py-2 bg-white rounded-lg border border-slate-200 text-sm font-semibold outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-rose-500 uppercase">Advance/Cut (₹)</label>
                    <input
                      type="number"
                      value={payAdvanceDeduction}
                      onChange={(e) => setPayAdvanceDeduction(e.target.value)}
                      placeholder="0"
                      className="w-full px-3 py-2 bg-white rounded-lg border border-slate-200 text-sm font-semibold outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-emerald-600 uppercase">Bonus/Tip (₹)</label>
                    <input
                      type="number"
                      value={payBonus}
                      onChange={(e) => setPayBonus(e.target.value)}
                      placeholder="0"
                      className="w-full px-3 py-2 bg-white rounded-lg border border-slate-200 text-sm font-semibold outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-200 flex justify-between items-center">
                  <span className="text-xs font-bold text-slate-600">Net Disbursed Amount:</span>
                  <span className="text-xl font-black text-indigo-700">₹{calcNetPay().toLocaleString("en-IN")}</span>
                </div>
              </div>

              {/* Partner Who Paid - Key Requirement! */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-indigo-900 uppercase tracking-wider mb-1.5">
                    Paid By (Partner / Account) *
                  </label>
                  <select
                    value={payPaidBy}
                    onChange={(e) => setPayPaidBy(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl border border-indigo-200 bg-indigo-50/50 text-xs sm:text-sm font-bold text-indigo-900 outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    {PARTNERS.map((p) => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">Payment Mode</label>
                  <select
                    value={payMode}
                    onChange={(e) => setPayMode(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-xs sm:text-sm outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                  >
                    {PAYMENT_MODES.map((m) => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">Payment Date</label>
                  <input
                    type="date"
                    value={payDate}
                    onChange={(e) => setPayDate(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-xs sm:text-sm outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">Payment Status</label>
                  <select
                    value={payStatus}
                    onChange={(e) => setPayStatus(e.target.value as any)}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-xs sm:text-sm outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                  >
                    <option value="Paid">Full Salary Paid</option>
                    <option value="Partial">Partial Payment</option>
                    <option value="Advance">Advance Disbursement</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">Notes / Transaction Reference</label>
                <input
                  type="text"
                  value={payNotes}
                  onChange={(e) => setPayNotes(e.target.value)}
                  placeholder="e.g. Paid via PhonePe / cash hand-over / slip #12"
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-xs sm:text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            <div className="p-6 border-t border-slate-100 flex gap-2 justify-end bg-slate-50/50">
              <button
                onClick={() => setIsPaymentModalOpen(false)}
                className="px-4 py-2 border border-slate-200 text-slate-600 text-xs sm:text-sm font-semibold rounded-xl hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveSalaryPayment}
                disabled={isSavingPay || !payEmployeeId}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs sm:text-sm font-bold rounded-xl shadow-xs transition disabled:opacity-60"
              >
                {isSavingPay ? "Recording..." : "Record Disbursement"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* VOUCHER / SLIP PREVIEW MODAL */}
      {viewVoucher && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden p-6 relative">
            <button
              onClick={() => setViewVoucher(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600"
            >
              ✕
            </button>

            <div className="text-center border-b border-slate-100 pb-4">
              <h2 className="text-lg font-black text-slate-900 tracking-tight">{hotelSettings.hotelName}</h2>
              <p className="text-[11px] text-slate-400 uppercase tracking-widest mt-0.5">Staff Salary Voucher</p>
            </div>

            <div className="py-4 space-y-3 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-400">Employee Name:</span>
                <span className="font-bold text-slate-800">{viewVoucher.employee_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Salary Month:</span>
                <span className="font-semibold text-slate-700">{viewVoucher.month_year}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Disbursement Date:</span>
                <span className="text-slate-700">{new Date(viewVoucher.payment_date).toLocaleDateString("en-IN")}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Paid By (Partner):</span>
                <span className="font-bold text-indigo-700">{viewVoucher.paid_by}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Payment Mode:</span>
                <span className="text-slate-700">{viewVoucher.payment_mode}</span>
              </div>

              <div className="pt-3 border-t border-slate-100 space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-slate-500">Base Salary:</span>
                  <span className="font-semibold">₹{viewVoucher.base_salary.toLocaleString("en-IN")}</span>
                </div>
                {viewVoucher.advance_deduction > 0 && (
                  <div className="flex justify-between text-rose-500">
                    <span>Advance / Cut:</span>
                    <span>- ₹{viewVoucher.advance_deduction.toLocaleString("en-IN")}</span>
                  </div>
                )}
                {viewVoucher.bonus_overtime > 0 && (
                  <div className="flex justify-between text-emerald-600">
                    <span>Bonus / Overtime:</span>
                    <span>+ ₹{viewVoucher.bonus_overtime.toLocaleString("en-IN")}</span>
                  </div>
                )}
                <div className="flex justify-between pt-2 border-t border-slate-200 text-sm font-black text-slate-900">
                  <span>Net Amount Paid:</span>
                  <span className="text-indigo-700">₹{viewVoucher.net_paid.toLocaleString("en-IN")}</span>
                </div>
              </div>

              {viewVoucher.notes && (
                <div className="p-2.5 bg-slate-50 rounded-xl text-[11px] text-slate-600">
                  <span className="font-bold">Remarks:</span> {viewVoucher.notes}
                </div>
              )}
            </div>

            <div className="pt-4 border-t border-slate-100 flex gap-2">
              <button
                onClick={() => window.print()}
                className="flex-1 py-2 bg-indigo-600 text-white font-bold rounded-xl text-xs hover:bg-indigo-700 transition"
              >
                🖨️ Print Slip
              </button>
              <button
                onClick={() => setViewVoucher(null)}
                className="px-4 py-2 bg-slate-100 text-slate-600 font-semibold rounded-xl text-xs hover:bg-slate-200 transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
