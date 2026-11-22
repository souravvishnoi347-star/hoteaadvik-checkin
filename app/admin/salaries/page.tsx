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
  advance_balance?: number; // Total remaining advance to be recovered (e.g. 20000)
  default_monthly_deduction?: number; // e.g. 5000 per month
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
  paid_by: string; // "Hotel Cash Drawer", "Hotel Bank Account", "Amit Sir (Owner Personal)"
  payment_status: "Paid" | "Partial" | "Advance";
  notes?: string;
};

export type EmployeeAdvance = {
  id: number;
  created_at: string;
  employee_id: number;
  employee_name: string;
  amount: number;
  date: string;
  paid_by: string;
  payment_mode: string;
  monthly_deduction_plan?: number;
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

export const PAYMENT_ACCOUNTS = [
  "Hotel Cash Drawer",
  "Hotel Bank / QR Account",
  "Amit Sir (Owner Personal)"
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
  const [activeTab, setActiveTab] = useState<"payroll" | "employees" | "advances">("payroll");

  // State
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [salaries, setSalaries] = useState<SalaryRecord[]>([]);
  const [advances, setAdvances] = useState<EmployeeAdvance[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dbError, setDbError] = useState<string | null>(null);

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [filterAccount, setFilterAccount] = useState("All Accounts");

  // Add / Edit Employee Modal State
  const [isEmployeeModalOpen, setIsEmployeeModalOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [empName, setEmpName] = useState("");
  const [empRole, setEmpRole] = useState("Housekeeping");
  const [empPhone, setEmpPhone] = useState("");
  const [empSalary, setEmpSalary] = useState("");
  const [empJoining, setEmpJoining] = useState(new Date().toISOString().split("T")[0]);
  const [empIdProof, setEmpIdProof] = useState("");
  const [empInitialAdvance, setEmpInitialAdvance] = useState("0");
  const [empDeductionPlan, setEmpDeductionPlan] = useState("5000");
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
  const [payPaidBy, setPayPaidBy] = useState("Hotel Cash Drawer");
  const [payStatus, setPayStatus] = useState<"Paid" | "Partial" | "Advance">("Paid");
  const [payNotes, setPayNotes] = useState("");
  const [isSavingPay, setIsSavingPay] = useState(false);

  // Give Advance Modal State
  const [isAdvanceModalOpen, setIsAdvanceModalOpen] = useState(false);
  const [advEmpId, setAdvEmpId] = useState<number | "">("");
  const [advAmount, setAdvAmount] = useState("20000");
  const [advPlan, setAdvPlan] = useState("5000");
  const [advPaidBy, setAdvPaidBy] = useState("Hotel Cash Drawer");
  const [advDate, setAdvDate] = useState(new Date().toISOString().split("T")[0]);
  const [advMode, setAdvMode] = useState("Cash");
  const [advNotes, setAdvNotes] = useState("Salary advance request");
  const [isSavingAdv, setIsSavingAdv] = useState(false);

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

      // 3. Fetch Advances
      try {
        const { data: advData } = await supabase
          .from("EmployeeAdvances")
          .select("*")
          .order("date", { ascending: false });
        if (advData) {
          setAdvances(advData);
        }
      } catch (advE) {
        console.warn("EmployeeAdvances table notice:", advE);
      }
    } catch (e: any) {
      console.error("Error loading salary data:", e);
    } finally {
      setIsLoading(false);
    }
  };

  // Auto-fill salary & advance deduction when selecting employee in Disburse Salary Modal
  const handleSelectEmployeeForPayment = (empId: number) => {
    setPayEmployeeId(empId);
    const emp = employees.find((e) => e.id === empId);
    if (emp) {
      setPayBaseSalary(emp.monthly_salary.toString());

      // If employee has outstanding advance, auto-suggest the monthly deduction!
      const currentAdvance = Number(emp.advance_balance) || 0;
      if (currentAdvance > 0) {
        const monthlyPlan = Number(emp.default_monthly_deduction) || 5000;
        const suggestedDeduction = Math.min(monthlyPlan, currentAdvance);
        setPayAdvanceDeduction(suggestedDeduction.toString());
      } else {
        setPayAdvanceDeduction("0");
      }
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

  // Selected Employee Helper for Payment Modal
  const selectedPayEmp = employees.find((e) => e.id === payEmployeeId);
  const selectedPayEmpAdvance = Number(selectedPayEmp?.advance_balance) || 0;
  const deductionAmount = parseFloat(payAdvanceDeduction) || 0;
  const remainingAdvanceAfterPayment = Math.max(0, selectedPayEmpAdvance - deductionAmount);

  // Handle Save Employee
  const handleSaveEmployee = async () => {
    if (!empName.trim() || !empSalary) {
      alert("Please provide Employee Name and Monthly Salary.");
      return;
    }

    setIsSavingEmp(true);
    const initialAdv = parseFloat(empInitialAdvance) || 0;
    const plan = parseFloat(empDeductionPlan) || 5000;

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
            id_proof_number: empIdProof.trim() || null,
            advance_balance: initialAdv,
            default_monthly_deduction: plan
          })
          .eq("id", editingEmployee.id);

        if (error) {
          // Fallback if columns advance_balance not in DB yet
          if (error.message?.includes("advance_balance")) {
            await supabase
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
          } else {
            throw error;
          }
        }
      } else {
        const { data: newEmp, error } = await supabase.from("Employees").insert({
          name: empName.trim(),
          role: empRole,
          phone: empPhone.trim() || null,
          monthly_salary: parseFloat(empSalary) || 0,
          joining_date: empJoining || null,
          id_proof_number: empIdProof.trim() || null,
          status: "Active",
          advance_balance: initialAdv,
          default_monthly_deduction: plan
        }).select().single();

        if (error) {
          if (error.message?.includes("advance_balance")) {
            await supabase.from("Employees").insert({
              name: empName.trim(),
              role: empRole,
              phone: empPhone.trim() || null,
              monthly_salary: parseFloat(empSalary) || 0,
              joining_date: empJoining || null,
              id_proof_number: empIdProof.trim() || null,
              status: "Active"
            });
          } else {
            throw error;
          }
        } else if (newEmp && initialAdv > 0) {
          // Record initial advance entry
          try {
            await supabase.from("EmployeeAdvances").insert({
              employee_id: newEmp.id,
              employee_name: newEmp.name,
              amount: initialAdv,
              date: empJoining,
              paid_by: "Hotel Cash Drawer",
              payment_mode: "Cash",
              monthly_deduction_plan: plan,
              notes: "Initial advance balance recorded during staff entry"
            });
          } catch {}
        }
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
    setEmpInitialAdvance("0");
    setEmpDeductionPlan("5000");
  };

  const handleEditEmployee = (emp: Employee) => {
    setEditingEmployee(emp);
    setEmpName(emp.name);
    setEmpRole(emp.role);
    setEmpPhone(emp.phone || "");
    setEmpSalary(emp.monthly_salary.toString());
    setEmpJoining(emp.joining_date || new Date().toISOString().split("T")[0]);
    setEmpIdProof(emp.id_proof_number || "");
    setEmpInitialAdvance((emp.advance_balance || 0).toString());
    setEmpDeductionPlan((emp.default_monthly_deduction || 5000).toString());
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

  // Handle Giving a New Advance (e.g. ₹20,000 to staff)
  const handleSaveAdvance = async () => {
    if (!advEmpId || !advAmount) {
      alert("Please select employee and enter advance amount.");
      return;
    }
    const emp = employees.find((e) => e.id === advEmpId);
    if (!emp) return;

    setIsSavingAdv(true);
    const amountNum = parseFloat(advAmount) || 0;
    const planNum = parseFloat(advPlan) || 5000;

    try {
      // 1. Record in EmployeeAdvances table
      try {
        await supabase.from("EmployeeAdvances").insert({
          employee_id: emp.id,
          employee_name: emp.name,
          amount: amountNum,
          date: advDate,
          paid_by: advPaidBy,
          payment_mode: advMode,
          monthly_deduction_plan: planNum,
          notes: advNotes.trim() || null
        });
      } catch (e) {
        console.warn("EmployeeAdvances insert warning:", e);
      }

      // 2. Update employee's total advance_balance & default deduction plan
      const currentBal = Number(emp.advance_balance) || 0;
      const newBal = currentBal + amountNum;

      const { error: empErr } = await supabase
        .from("Employees")
        .update({
          advance_balance: newBal,
          default_monthly_deduction: planNum
        })
        .eq("id", emp.id);

      if (empErr && empErr.message?.includes("advance_balance")) {
        alert("Advance recorded! Please run 'supabase_advance_ledger.sql' in your Supabase SQL editor to create the advance tracking columns.");
      } else if (empErr) {
        throw empErr;
      }

      setIsAdvanceModalOpen(false);
      resetAdvanceForm();
      fetchData();
      alert(`✅ Recorded ₹${amountNum.toLocaleString("en-IN")} advance for ${emp.name}! It will automatically deduct ₹${planNum.toLocaleString("en-IN")}/month on salary disbursement.`);
    } catch (err: any) {
      alert("Failed to record advance: " + err.message);
    } finally {
      setIsSavingAdv(false);
    }
  };

  const resetAdvanceForm = () => {
    setAdvEmpId("");
    setAdvAmount("20000");
    setAdvPlan("5000");
    setAdvPaidBy("Hotel Cash Drawer");
    setAdvDate(new Date().toISOString().split("T")[0]);
    setAdvMode("Cash");
    setAdvNotes("Salary advance");
  };

  // Open advance modal directly for a specific employee
  const handleOpenAdvanceForEmp = (emp: Employee) => {
    setAdvEmpId(emp.id);
    setAdvPlan((emp.default_monthly_deduction || 5000).toString());
    setIsAdvanceModalOpen(true);
  };

  // Handle Record Salary Payment (with Auto-Advance Deduction)
  const handleSaveSalaryPayment = async () => {
    if (!payEmployeeId) {
      alert("Please select an employee.");
      return;
    }

    const emp = employees.find((e) => e.id === payEmployeeId);
    if (!emp) return;

    const netAmount = calcNetPay();
    const deductionNum = parseFloat(payAdvanceDeduction) || 0;

    setIsSavingPay(true);
    try {
      // 1. Record in Salaries table
      const { error } = await supabase.from("Salaries").insert({
        employee_id: emp.id,
        employee_name: emp.name,
        month_year: payMonth,
        base_salary: parseFloat(payBaseSalary) || 0,
        advance_deduction: deductionNum,
        bonus_overtime: parseFloat(payBonus) || 0,
        net_paid: netAmount,
        payment_date: payDate,
        payment_mode: payMode,
        paid_by: payPaidBy,
        payment_status: payStatus,
        notes: payNotes.trim() ? `${payNotes.trim()}${deductionNum > 0 ? ` (Advance Cut: ₹${deductionNum})` : ''}` : (deductionNum > 0 ? `Advance Cut: ₹${deductionNum}` : null)
      });

      if (error) throw error;

      // 2. Automatically decrease employee's advance balance if deduction was applied!
      if (deductionNum > 0 && emp.advance_balance && emp.advance_balance > 0) {
        const updatedAdvanceBal = Math.max(0, Number(emp.advance_balance) - deductionNum);
        try {
          await supabase
            .from("Employees")
            .update({ advance_balance: updatedAdvanceBal })
            .eq("id", emp.id);
        } catch (balErr) {
          console.warn("Advance balance decrement error:", balErr);
        }
      }

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
    setPayPaidBy("Hotel Cash Drawer");
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

  // Calculations
  const activeEmployees = employees.filter((e) => e.status === "Active");
  const totalMonthlyCommitment = activeEmployees.reduce((sum, e) => sum + (Number(e.monthly_salary) || 0), 0);

  const monthSalaries = salaries.filter((s) => s.month_year === selectedMonth);
  const totalMonthPaid = monthSalaries.reduce((sum, s) => sum + (Number(s.net_paid) || 0), 0);
  const pendingMonthBalance = totalMonthlyCommitment > totalMonthPaid ? totalMonthlyCommitment - totalMonthPaid : 0;

  // Advance Metrics across all staff
  const totalAdvanceOutstanding = employees.reduce((sum, e) => sum + (Number(e.advance_balance) || 0), 0);
  const employeesWithAdvance = employees.filter((e) => (Number(e.advance_balance) || 0) > 0);
  const totalAdvanceRecoveredThisMonth = monthSalaries.reduce((sum, s) => sum + (Number(s.advance_deduction) || 0), 0);

  // Filtered salary records
  const filteredSalaries = salaries.filter((s) => {
    const matchesMonth = selectedMonth === "All Months" || s.month_year === selectedMonth;
    const matchesSearch = s.employee_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (s.notes || "").toLowerCase().includes(searchQuery.toLowerCase());
    const matchesAccount = filterAccount === "All Accounts" || s.paid_by === filterAccount;
    return matchesMonth && matchesSearch && matchesAccount;
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
                  onClick={() => alert("Please run 'supabase_advance_ledger.sql' in your Supabase Dashboard SQL Editor.")}
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
                      Payroll, ₹20k advance recovery, monthly installments, and staff disbursements.
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
                <button
                  onClick={() => {
                    resetAdvanceForm();
                    setIsAdvanceModalOpen(true);
                  }}
                  className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4 py-2.5 bg-amber-50 hover:bg-amber-100 border border-amber-300 text-amber-900 font-bold rounded-xl text-xs sm:text-sm shadow-xs transition"
                >
                  <span>💸</span> Give Advance
                </button>

                <button
                  onClick={() => {
                    resetEmployeeForm();
                    setEditingEmployee(null);
                    setIsEmployeeModalOpen(true);
                  }}
                  className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4 py-2.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold rounded-xl text-xs sm:text-sm shadow-xs transition"
                >
                  <span>👤+</span> Add Employee
                </button>

                <button
                  onClick={() => {
                    resetPaymentForm();
                    setIsPaymentModalOpen(true);
                  }}
                  className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs sm:text-sm shadow-md shadow-indigo-100 transition"
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
                  {employees.filter(e => e.status === "Inactive").length} inactive staff
                </p>
              </div>

              {/* Advance Outstanding Banner */}
              <div
                className="bg-gradient-to-br from-amber-500 to-amber-600 p-5 rounded-2xl text-white shadow-xs flex flex-col justify-between cursor-pointer hover:shadow-md transition"
                onClick={() => setActiveTab("advances")}
              >
                <div>
                  <div className="flex items-center justify-between">
                    <p className="text-amber-100 text-xs font-bold uppercase tracking-wider">Staff Advances Due</p>
                    <span className="text-[10px] bg-white/20 px-2 py-0.5 rounded-full font-bold">
                      {employeesWithAdvance.length} Staff
                    </span>
                  </div>
                  <h3 className="text-2xl font-black mt-1">₹{totalAdvanceOutstanding.toLocaleString("en-IN")}</h3>
                </div>
                <p className="text-[11px] text-amber-100 mt-3 flex items-center justify-between">
                  <span>Recovered this month:</span>
                  <span className="font-bold">₹{totalAdvanceRecoveredThisMonth.toLocaleString("en-IN")}</span>
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
                <p className="text-[11px] text-slate-500 mt-3">Base monthly salary sum</p>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
                <div>
                  <p className="text-xs font-semibold text-emerald-600 uppercase tracking-wider">Paid for {selectedMonth}</p>
                  <h3 className="text-2xl font-black text-emerald-600 mt-1">₹{totalMonthPaid.toLocaleString("en-IN")}</h3>
                </div>
                <p className="text-[11px] text-slate-400 mt-3">
                  Pending: <span className="font-bold text-rose-500">₹{pendingMonthBalance.toLocaleString("en-IN")}</span>
                </p>
              </div>
            </div>

            {/* Navigation Tabs */}
            <div className="flex flex-wrap border-b border-slate-200 bg-white rounded-2xl px-3 pt-2 shadow-xs">
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
                onClick={() => setActiveTab("advances")}
                className={`flex items-center gap-2 px-5 py-3 text-xs sm:text-sm font-bold border-b-2 transition ${
                  activeTab === "advances"
                    ? "border-amber-500 text-amber-700 bg-amber-50/50 rounded-t-xl"
                    : "border-transparent text-slate-500 hover:text-slate-800"
                }`}
              >
                <span>💳</span> Advances Ledger ({employeesWithAdvance.length} Active)
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
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Disbursed Via</label>
                      <select
                        value={filterAccount}
                        onChange={(e) => setFilterAccount(e.target.value)}
                        className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500 shadow-xs"
                      >
                        <option value="All Accounts">All Accounts</option>
                        {PAYMENT_ACCOUNTS.map((a) => (
                          <option key={a} value={a}>{a}</option>
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
                        <th className="py-3.5 px-4">Base / Advance Cut / Bonus</th>
                        <th className="py-3.5 px-4">Net Paid</th>
                        <th className="py-3.5 px-4">Disbursed Via</th>
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
                                <div className="text-rose-600 font-bold bg-rose-50 px-1.5 py-0.5 rounded inline-block mt-0.5">
                                  - Advance Cut: ₹{rec.advance_deduction.toLocaleString("en-IN")}
                                </div>
                              )}
                              {rec.bonus_overtime > 0 && (
                                <div className="text-emerald-600 font-semibold mt-0.5">+ Bonus: ₹{rec.bonus_overtime.toLocaleString("en-IN")}</div>
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
                {employees.map((emp) => {
                  const hasAdvance = (Number(emp.advance_balance) || 0) > 0;
                  return (
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

                        {/* Advance Alert Banner on Employee Card */}
                        {hasAdvance && (
                          <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs">
                            <div className="flex justify-between items-center">
                              <span className="font-bold text-amber-900 flex items-center gap-1">
                                <span>⏳</span> Advance Outstanding:
                              </span>
                              <span className="font-black text-amber-900 text-sm">
                                ₹{Number(emp.advance_balance).toLocaleString("en-IN")}
                              </span>
                            </div>
                            <p className="text-[11px] text-amber-700 mt-0.5">
                              Auto-deduction plan: ₹{Number(emp.default_monthly_deduction || 5000).toLocaleString("en-IN")}/month
                            </p>
                          </div>
                        )}

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
                              <span className="text-slate-400">ID / Aadhaar:</span>
                              <span className="font-mono text-slate-600">{emp.id_proof_number}</span>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="mt-5 pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
                        <button
                          onClick={() => handleToggleEmployeeStatus(emp)}
                          className="text-xs font-semibold text-slate-500 hover:text-slate-800"
                        >
                          {emp.status === "Active" ? "Deactivate" : "Activate"}
                        </button>

                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => handleOpenAdvanceForEmp(emp)}
                            title="Give Advance to this Employee"
                            className="px-2.5 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 font-bold rounded-lg text-xs transition"
                          >
                            + Advance
                          </button>

                          <button
                            onClick={() => handleEditEmployee(emp)}
                            className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg text-xs transition"
                          >
                            Edit
                          </button>

                          <button
                            onClick={() => {
                              resetPaymentForm();
                              handleSelectEmployeeForPayment(emp.id);
                              setIsPaymentModalOpen(true);
                            }}
                            className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg text-xs shadow-xs transition"
                          >
                            Pay Salary
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* TAB 3: STAFF ADVANCES (EMI / LOAN RECOVERY LEDGER) */}
            {activeTab === "advances" && (
              <div className="space-y-6">
                <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-6">
                    <div>
                      <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                        <span>💳</span> Staff Advance Recovery Ledger (EMI Tracking)
                      </h2>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Manage ₹20,000 or custom advance given to staff. Auto-deducts ₹5,000/month (or custom amount) during monthly salary disbursement.
                      </p>
                    </div>

                    <button
                      onClick={() => {
                        resetAdvanceForm();
                        setIsAdvanceModalOpen(true);
                      }}
                      className="flex items-center gap-1.5 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-xl text-xs sm:text-sm shadow-xs transition"
                    >
                      <span>💸</span> Give New Advance
                    </button>
                  </div>

                  {/* Advance Summary Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                    <div className="p-4 bg-amber-50/70 border border-amber-200 rounded-2xl">
                      <p className="text-xs font-bold text-amber-900 uppercase tracking-wider">Total Advance Outstanding</p>
                      <h3 className="text-2xl font-black text-amber-900 mt-1">₹{totalAdvanceOutstanding.toLocaleString("en-IN")}</h3>
                      <p className="text-[11px] text-amber-700 mt-1">Money to be recovered from staff salaries</p>
                    </div>

                    <div className="p-4 bg-emerald-50/70 border border-emerald-200 rounded-2xl">
                      <p className="text-xs font-bold text-emerald-900 uppercase tracking-wider">Recovered This Month ({selectedMonth})</p>
                      <h3 className="text-2xl font-black text-emerald-800 mt-1">₹{totalAdvanceRecoveredThisMonth.toLocaleString("en-IN")}</h3>
                      <p className="text-[11px] text-emerald-700 mt-1">Deducted from monthly salary disbursements</p>
                    </div>

                    <div className="p-4 bg-indigo-50/70 border border-indigo-200 rounded-2xl">
                      <p className="text-xs font-bold text-indigo-900 uppercase tracking-wider">Staff With Active Advances</p>
                      <h3 className="text-2xl font-black text-indigo-900 mt-1">{employeesWithAdvance.length} Employees</h3>
                      <p className="text-[11px] text-indigo-700 mt-1">Currently paying monthly installments</p>
                    </div>
                  </div>

                  {/* Staff with Active Advances Table */}
                  <div className="overflow-x-auto border border-slate-200 rounded-2xl overflow-hidden">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                          <th className="py-3 px-4">Employee</th>
                          <th className="py-3 px-4">Role</th>
                          <th className="py-3 px-4">Monthly Salary</th>
                          <th className="py-3 px-4">Advance Due</th>
                          <th className="py-3 px-4">Monthly Deduction Plan</th>
                          <th className="py-3 px-4">Est. Months to Clear</th>
                          <th className="py-3 px-4 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-xs sm:text-sm text-slate-700">
                        {employees.map((emp) => {
                          const advDue = Number(emp.advance_balance) || 0;
                          const plan = Number(emp.default_monthly_deduction) || 5000;
                          const monthsLeft = advDue > 0 ? Math.ceil(advDue / plan) : 0;

                          return (
                            <tr key={emp.id} className={advDue > 0 ? "bg-amber-50/20 hover:bg-amber-50/40" : "hover:bg-slate-50"}>
                              <td className="py-3.5 px-4 font-bold text-slate-900">
                                {emp.name}
                                {advDue > 0 && (
                                  <span className="ml-2 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
                                    Active Loan
                                  </span>
                                )}
                              </td>
                              <td className="py-3.5 px-4 text-slate-500">{emp.role}</td>
                              <td className="py-3.5 px-4 font-semibold">₹{emp.monthly_salary.toLocaleString("en-IN")}</td>
                              <td className="py-3.5 px-4">
                                {advDue > 0 ? (
                                  <span className="font-black text-rose-600 text-sm">
                                    ₹{advDue.toLocaleString("en-IN")}
                                  </span>
                                ) : (
                                  <span className="text-emerald-600 font-bold text-xs">✓ Cleared / None</span>
                                )}
                              </td>
                              <td className="py-3.5 px-4 font-semibold text-slate-700">
                                {advDue > 0 ? `₹${plan.toLocaleString("en-IN")} / month` : "—"}
                              </td>
                              <td className="py-3.5 px-4 text-xs font-semibold text-slate-600">
                                {advDue > 0 ? `${monthsLeft} month(s)` : "—"}
                              </td>
                              <td className="py-3.5 px-4 text-right">
                                <button
                                  onClick={() => handleOpenAdvanceForEmp(emp)}
                                  className="px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 font-bold rounded-lg text-xs transition"
                                >
                                  + Give Advance
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* History of Advances Given */}
                  {advances.length > 0 && (
                    <div className="mt-8">
                      <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-3">
                        Recent Advances Given (History)
                      </h3>
                      <div className="overflow-x-auto border border-slate-200 rounded-2xl overflow-hidden">
                        <table className="w-full text-left border-collapse text-xs">
                          <thead>
                            <tr className="bg-slate-50 border-b border-slate-200 text-slate-400 font-bold uppercase">
                              <th className="py-2.5 px-3">Date</th>
                              <th className="py-2.5 px-3">Employee</th>
                              <th className="py-2.5 px-3">Amount Given</th>
                              <th className="py-2.5 px-3">Disbursed Via</th>
                              <th className="py-2.5 px-3">Deduction Plan</th>
                              <th className="py-2.5 px-3">Mode & Reason</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 text-slate-700">
                            {advances.map((a) => (
                              <tr key={a.id} className="hover:bg-slate-50">
                                <td className="py-2.5 px-3 whitespace-nowrap">{a.date ? new Date(a.date).toLocaleDateString("en-IN") : "—"}</td>
                                <td className="py-2.5 px-3 font-bold text-slate-800">{a.employee_name}</td>
                                <td className="py-2.5 px-3 font-black text-rose-600">₹{Number(a.amount).toLocaleString("en-IN")}</td>
                                <td className="py-2.5 px-3 font-semibold text-indigo-700">{a.paid_by}</td>
                                <td className="py-2.5 px-3 font-semibold">₹{a.monthly_deduction_plan || 5000}/month</td>
                                <td className="py-2.5 px-3 text-slate-500">
                                  <span>{a.payment_mode}</span>
                                  {a.notes && <span className="ml-1 text-slate-400">({a.notes})</span>}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

          </div>
        </div>
      </main>

      {/* MODAL 1: ADD / EDIT EMPLOYEE */}
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

              {/* Advance tracking fields on Employee entry */}
              <div className="p-3 bg-amber-50/70 rounded-2xl border border-amber-200 space-y-2">
                <p className="text-xs font-bold text-amber-900">Current Advance Balance & Monthly Plan</p>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] font-bold text-amber-800 uppercase">Advance Taken (₹)</label>
                    <input
                      type="number"
                      value={empInitialAdvance}
                      onChange={(e) => setEmpInitialAdvance(e.target.value)}
                      placeholder="e.g. 20000"
                      className="w-full px-3 py-1.5 rounded-lg border border-amber-300 text-xs bg-white font-bold outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-amber-800 uppercase">Monthly Deduction (₹)</label>
                    <input
                      type="number"
                      value={empDeductionPlan}
                      onChange={(e) => setEmpDeductionPlan(e.target.value)}
                      placeholder="e.g. 5000"
                      className="w-full px-3 py-1.5 rounded-lg border border-amber-300 text-xs bg-white font-bold outline-none"
                    />
                  </div>
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

      {/* MODAL 2: GIVE STAFF ADVANCE (LOAN) */}
      {isAdvanceModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 my-8">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-amber-50/50">
              <div>
                <h3 className="text-lg font-bold text-amber-950 flex items-center gap-1.5">
                  <span>💸</span> Give Salary Advance to Employee
                </h3>
                <p className="text-xs text-amber-800">Record ₹20k advance with ₹5k/month auto-deduction plan.</p>
              </div>
              <button
                onClick={() => setIsAdvanceModalOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-200/70 hover:bg-slate-200 text-slate-600 flex items-center justify-center"
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">Select Staff Member *</label>
                <select
                  value={advEmpId}
                  onChange={(e) => setAdvEmpId(parseInt(e.target.value))}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold outline-none focus:ring-2 focus:ring-amber-500 bg-white"
                >
                  <option value="">-- Choose Employee --</option>
                  {employees.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.name} ({e.role} - Current Advance: ₹{e.advance_balance || 0})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">Advance Amount (₹) *</label>
                  <input
                    type="number"
                    required
                    value={advAmount}
                    onChange={(e) => setAdvAmount(e.target.value)}
                    placeholder="e.g. 20000"
                    className="w-full px-4 py-2.5 rounded-xl border border-amber-300 text-base font-black text-rose-600 outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">Monthly Deduction (₹/mo) *</label>
                  <input
                    type="number"
                    required
                    value={advPlan}
                    onChange={(e) => setAdvPlan(e.target.value)}
                    placeholder="e.g. 5000"
                    className="w-full px-4 py-2.5 rounded-xl border border-amber-300 text-base font-black text-indigo-700 outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              </div>

              <div className="p-3 bg-amber-50 rounded-xl text-xs text-amber-900 leading-relaxed">
                ℹ️ If you give <strong>₹{Number(advAmount || 0).toLocaleString("en-IN")}</strong> and deduct <strong>₹{Number(advPlan || 5000).toLocaleString("en-IN")} per month</strong>, it will automatically deduct from salary for <strong>{Math.ceil(Number(advAmount || 0) / Number(advPlan || 5000))} months</strong> until balance becomes ₹0.
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">Disbursed Via (Account) *</label>
                  <select
                    value={advPaidBy}
                    onChange={(e) => setAdvPaidBy(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-xs sm:text-sm font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-amber-500"
                  >
                    {PAYMENT_ACCOUNTS.map((a) => <option key={a} value={a}>{a}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">Payment Mode</label>
                  <select
                    value={advMode}
                    onChange={(e) => setAdvMode(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-xs sm:text-sm outline-none focus:ring-2 focus:ring-amber-500 bg-white"
                  >
                    {PAYMENT_MODES.map((m) => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">Date Handed Over</label>
                  <input
                    type="date"
                    value={advDate}
                    onChange={(e) => setAdvDate(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-xs sm:text-sm outline-none focus:ring-2 focus:ring-amber-500 bg-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">Reason / Note</label>
                  <input
                    type="text"
                    value={advNotes}
                    onChange={(e) => setAdvNotes(e.target.value)}
                    placeholder="e.g. Festival / Medical emergency"
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-xs sm:text-sm outline-none focus:ring-2 focus:ring-amber-500 bg-white"
                  />
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-slate-100 flex gap-2 justify-end bg-slate-50/50">
              <button
                onClick={() => setIsAdvanceModalOpen(false)}
                className="px-4 py-2 border border-slate-200 text-slate-600 text-xs sm:text-sm font-semibold rounded-xl hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveAdvance}
                disabled={isSavingAdv || !advEmpId}
                className="px-5 py-2 bg-amber-500 hover:bg-amber-600 text-white text-xs sm:text-sm font-bold rounded-xl shadow-xs transition disabled:opacity-60"
              >
                {isSavingAdv ? "Recording..." : "Save Advance Record"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: DISBURSE / RECORD SALARY PAYMENT */}
      {isPaymentModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 my-8">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <div>
                <h3 className="text-lg font-bold text-slate-800">Disburse Monthly Salary</h3>
                <p className="text-xs text-slate-400">Automatic ₹5,000 advance cut (customizable) & net pay computation.</p>
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

              {/* Advance Detection Alert Box */}
              {selectedPayEmp && selectedPayEmpAdvance > 0 && (
                <div className="p-3.5 bg-amber-50 border border-amber-300 rounded-2xl">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-bold text-amber-900 flex items-center gap-1.5">
                      <span>⏳</span> Active Advance Due:
                    </span>
                    <span className="text-base font-black text-rose-600">
                      ₹{selectedPayEmpAdvance.toLocaleString("en-IN")}
                    </span>
                  </div>
                  <div className="mt-2 pt-2 border-t border-amber-200 flex justify-between items-center text-[11px] text-amber-800">
                    <span>Deducting this month: <strong>₹{deductionAmount.toLocaleString("en-IN")}</strong></span>
                    <span>Remaining after payment: <strong>₹{remainingAdvanceAfterPayment.toLocaleString("en-IN")}</strong></span>
                  </div>
                </div>
              )}

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
                    <label className="block text-[11px] font-bold text-rose-600 uppercase">Advance Cut (₹)</label>
                    <input
                      type="number"
                      value={payAdvanceDeduction}
                      onChange={(e) => setPayAdvanceDeduction(e.target.value)}
                      placeholder="0"
                      className="w-full px-3 py-2 bg-white rounded-lg border border-rose-300 text-sm font-bold text-rose-700 outline-none focus:ring-2 focus:ring-rose-500"
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
                  <span className="text-xs font-bold text-slate-600">Net Salary Paid to Staff:</span>
                  <span className="text-xl font-black text-indigo-700">₹{calcNetPay().toLocaleString("en-IN")}</span>
                </div>
              </div>

              {/* Account Paid From */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Disbursed Via (Account) *
                  </label>
                  <select
                    value={payPaidBy}
                    onChange={(e) => setPayPaidBy(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-xs sm:text-sm font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    {PAYMENT_ACCOUNTS.map((a) => (
                      <option key={a} value={a}>{a}</option>
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
                  placeholder="e.g. Paid via GPay / 5k advance deducted"
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
                <span className="text-slate-400">Disbursed Via:</span>
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
                  <div className="flex justify-between text-rose-600 font-bold bg-rose-50 px-2 py-0.5 rounded">
                    <span>Advance Installment Deducted:</span>
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
