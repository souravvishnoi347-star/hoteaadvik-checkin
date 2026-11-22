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
  paid_by: string; // "Hotel Cash Drawer", "Hotel Bank / QR Account", "Amit Sir (Owner Personal)"
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
  const [advNotes, setAdvNotes] = useState("Salary advance");
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

  const handleSelectEmployeeForPayment = (empId: number) => {
    setPayEmployeeId(empId);
    const emp = employees.find((e) => e.id === empId);
    if (emp) {
      setPayBaseSalary(emp.monthly_salary.toString());
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

  const calcNetPay = () => {
    const base = parseFloat(payBaseSalary) || 0;
    const deduction = parseFloat(payAdvanceDeduction) || 0;
    const bonus = parseFloat(payBonus) || 0;
    const net = base - deduction + bonus;
    return net > 0 ? net : 0;
  };

  const selectedPayEmp = employees.find((e) => e.id === payEmployeeId);
  const selectedPayEmpAdvance = Number(selectedPayEmp?.advance_balance) || 0;
  const deductionAmount = parseFloat(payAdvanceDeduction) || 0;
  const remainingAdvanceAfterPayment = Math.max(0, selectedPayEmpAdvance - deductionAmount);

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
    const { error } = await supabase.from("Employees").update({ status: newStatus }).eq("id", emp.id);
    if (!error) fetchData();
  };

  const handleSaveAdvance = async () => {
    if (!advEmpId || !advAmount) {
      alert("Please select staff member and advance amount.");
      return;
    }

    const emp = employees.find((e) => e.id === Number(advEmpId));
    if (!emp) return;

    setIsSavingAdv(true);
    const amountNum = parseFloat(advAmount) || 0;
    const planNum = parseFloat(advPlan) || 5000;

    try {
      const { error: advErr } = await supabase.from("EmployeeAdvances").insert({
        employee_id: emp.id,
        employee_name: emp.name,
        amount: amountNum,
        date: advDate,
        paid_by: advPaidBy,
        payment_mode: advMode,
        monthly_deduction_plan: planNum,
        notes: advNotes.trim() || null
      });

      if (advErr) console.warn("Advance entry notice:", advErr);

      const currentBalance = Number(emp.advance_balance) || 0;
      const newTotalAdvance = currentBalance + amountNum;

      await supabase
        .from("Employees")
        .update({
          advance_balance: newTotalAdvance,
          default_monthly_deduction: planNum
        })
        .eq("id", emp.id);

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

  const handleOpenAdvanceForEmp = (emp: Employee) => {
    setAdvEmpId(emp.id);
    setAdvPlan((emp.default_monthly_deduction || 5000).toString());
    setIsAdvanceModalOpen(true);
  };

  const handleSaveSalaryPayment = async () => {
    if (!payEmployeeId) {
      alert("Please select an employee.");
      return;
    }

    const emp = employees.find((e) => e.id === Number(payEmployeeId));
    if (!emp) return;

    setIsSavingPay(true);
    const base = Number(payBaseSalary) || 0;
    const advCut = Number(payAdvanceDeduction) || 0;
    const bonus = Number(payBonus) || 0;
    const net = Math.max(0, base - advCut + bonus);

    try {
      const salaryPayload: any = {
        employee_id: emp.id,
        employee_name: emp.name,
        month_year: payMonth,
        base_salary: base,
        advance_deduction: advCut,
        bonus_overtime: bonus,
        net_paid: net,
        payment_date: payDate,
        payment_mode: payMode,
        paid_by: payPaidBy,
        payment_status: payStatus,
        notes: payNotes.trim() || null
      };

      const { data: savedSalary, error: salErr } = await supabase
        .from("Salaries")
        .insert(salaryPayload)
        .select()
        .single();

      if (salErr) {
        const fallbackPayload = {
          employee_id: emp.id,
          employee_name: emp.name,
          month_year: payMonth,
          base_salary: base,
          advance_deduction: advCut,
          bonus_overtime: bonus,
          net_paid: net,
          payment_date: payDate,
          payment_mode: payMode,
          notes: `[Paid Via: ${payPaidBy}] ${payNotes.trim()}`
        };
        const { error: fbErr } = await supabase.from("Salaries").insert(fallbackPayload);
        if (fbErr) throw fbErr;
      }

      if (advCut > 0) {
        const currentBal = Number(emp.advance_balance) || 0;
        const newBal = Math.max(0, currentBal - advCut);
        await supabase
          .from("Employees")
          .update({ advance_balance: newBal })
          .eq("id", emp.id);
      }

      setIsPaymentModalOpen(false);
      resetPaymentForm();
      fetchData();

      if (savedSalary) {
        setViewVoucher(savedSalary);
      } else {
        alert(`✅ Salary disbursement recorded for ${emp.name}! Net Paid: ₹${net.toLocaleString("en-IN")}`);
      }
    } catch (err: any) {
      alert("Failed to record salary: " + err.message);
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
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-slate-50 flex-col md:flex-row relative min-w-0">
      <AdminSidebar activePath="/admin/salaries" hotelName={hotelSettings.hotelName} />

      <main className="flex-1 flex flex-col min-w-0 overflow-hidden z-0">
        <main className="flex-1 p-4 md:p-8 overflow-y-auto overflow-x-hidden">
          <div className="max-w-7xl mx-auto space-y-6">

            {/* DB Error Notice */}
            {dbError && (
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <span className="text-xl">⚠️</span>
                  <div>
                    <h4 className="text-sm font-bold text-amber-900">Database Setup Notice</h4>
                    <p className="text-xs text-amber-700 mt-0.5">{dbError}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Clean Header - Matches Dashboard Theme */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 py-2 border-b border-slate-200 pb-6 mb-6">
              <div>
                <h1 className="text-2xl font-bold text-[#0F172A] tracking-tight">Staff & Salaries</h1>
                <p className="text-slate-500 mt-1 text-sm">
                  Staff directory, advances tracking, and monthly payroll disbursements.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <button
                  onClick={() => {
                    resetAdvanceForm();
                    setIsAdvanceModalOpen(true);
                  }}
                  className="flex items-center gap-1.5 px-3.5 py-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-semibold text-xs rounded-xl shadow-xs transition"
                >
                  <svg className="w-4 h-4 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Give Advance
                </button>

                <button
                  onClick={() => {
                    resetEmployeeForm();
                    setEditingEmployee(null);
                    setIsEmployeeModalOpen(true);
                  }}
                  className="flex items-center gap-1.5 px-3.5 py-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-semibold text-xs rounded-xl shadow-xs transition"
                >
                  <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                  </svg>
                  Add Employee
                </button>

                <button
                  onClick={() => {
                    resetPaymentForm();
                    setIsPaymentModalOpen(true);
                  }}
                  className="flex items-center gap-1.5 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs rounded-xl shadow-xs transition cursor-pointer"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                  Disburse Salary
                </button>
              </div>
            </div>

            {/* Quick Stats Cards - Matches Dashboard Theme */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {/* Active Staff */}
              <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <p className="text-slate-500 text-xs font-semibold uppercase tracking-widest">Active Staff</p>
                    <div className="w-8 h-8 bg-blue-50 text-[#3B82F6] rounded flex items-center justify-center">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                      </svg>
                    </div>
                  </div>
                  <h2 className="text-4xl font-bold text-[#0F172A] tracking-tight">{activeEmployees.length}</h2>
                </div>
                <p className="text-slate-400 text-xs mt-6">
                  {employees.filter((e) => e.status === "Inactive").length} inactive staff records
                </p>
              </div>

              {/* Staff Advances Due */}
              <div
                className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm flex flex-col justify-between cursor-pointer hover:border-amber-300 transition"
                onClick={() => setActiveTab("advances")}
              >
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <p className="text-slate-500 text-xs font-semibold uppercase tracking-widest">Staff Advances Due</p>
                    <div className="w-8 h-8 bg-amber-50 text-amber-600 rounded flex items-center justify-center">
                      <span className="font-bold text-sm">₹</span>
                    </div>
                  </div>
                  <h2 className="text-4xl font-bold text-[#0F172A] tracking-tight">₹{totalAdvanceOutstanding.toLocaleString("en-IN")}</h2>
                </div>
                <div className="mt-6 flex justify-between text-xs text-slate-500">
                  <span>Recovered this month:</span>
                  <span className="font-bold text-slate-700">₹{totalAdvanceRecoveredThisMonth.toLocaleString("en-IN")}</span>
                </div>
              </div>

              {/* Base Monthly Commitment */}
              <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <p className="text-slate-500 text-xs font-semibold uppercase tracking-widest">Base Commitment</p>
                    <div className="w-8 h-8 bg-slate-100 text-slate-700 rounded flex items-center justify-center">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                      </svg>
                    </div>
                  </div>
                  <h2 className="text-4xl font-bold text-[#0F172A] tracking-tight">₹{totalMonthlyCommitment.toLocaleString("en-IN")}</h2>
                </div>
                <p className="text-slate-400 text-xs mt-6">Fixed monthly payroll for {selectedMonth}</p>
              </div>

              {/* Paid for Month */}
              <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <p className="text-slate-500 text-xs font-semibold uppercase tracking-widest">Paid for {selectedMonth}</p>
                    <div className="w-8 h-8 bg-emerald-50 text-emerald-500 rounded flex items-center justify-center">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                  </div>
                  <h2 className="text-4xl font-bold text-emerald-600 tracking-tight">₹{totalMonthPaid.toLocaleString("en-IN")}</h2>
                </div>
                <p className="text-slate-400 text-xs mt-6">
                  Pending: <span className="font-semibold text-slate-700">₹{pendingMonthBalance.toLocaleString("en-IN")}</span>
                </p>
              </div>
            </div>

            {/* Navigation Tabs (Dashboard Segmented Control) */}
            <div className="flex items-center gap-1 bg-slate-200/70 p-1 rounded-xl w-fit">
              <button
                onClick={() => setActiveTab("payroll")}
                className={`px-4 py-2 rounded-lg text-xs font-semibold transition ${
                  activeTab === "payroll"
                    ? "bg-white text-[#0F172A] shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Salary Disbursements ({filteredSalaries.length})
              </button>

              <button
                onClick={() => setActiveTab("employees")}
                className={`px-4 py-2 rounded-lg text-xs font-semibold transition ${
                  activeTab === "employees"
                    ? "bg-white text-[#0F172A] shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Staff Directory ({employees.length})
              </button>

              <button
                onClick={() => setActiveTab("advances")}
                className={`px-4 py-2 rounded-lg text-xs font-semibold transition ${
                  activeTab === "advances"
                    ? "bg-white text-[#0F172A] shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Advances Ledger ({employeesWithAdvance.length})
              </button>
            </div>

            {/* TAB 1: PAYROLL / DISBURSEMENT HISTORY */}
            {activeTab === "payroll" && (
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                {/* Filters */}
                <div className="px-6 pt-6 pb-4 border-b border-slate-100">
                  <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <select
                        value={selectedMonth}
                        onChange={(e) => setSelectedMonth(e.target.value)}
                        className="py-1.5 px-3 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-700 outline-none focus:ring-2 focus:ring-slate-900"
                      >
                        <option value="All Months">All Months</option>
                        {recentMonths.map((m) => (
                          <option key={m} value={m}>{m}</option>
                        ))}
                      </select>

                      <select
                        value={filterAccount}
                        onChange={(e) => setFilterAccount(e.target.value)}
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
                        placeholder="Search employee or notes..."
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
                        <th className="px-6 py-3.5 text-xs font-bold text-slate-500 uppercase tracking-wider">Employee</th>
                        <th className="px-6 py-3.5 text-xs font-bold text-slate-500 uppercase tracking-wider">Month</th>
                        <th className="px-6 py-3.5 text-xs font-bold text-slate-500 uppercase tracking-wider">Base / Advance Cut / Bonus</th>
                        <th className="px-6 py-3.5 text-xs font-bold text-slate-500 uppercase tracking-wider">Net Paid</th>
                        <th className="px-6 py-3.5 text-xs font-bold text-slate-500 uppercase tracking-wider">Disbursed Via</th>
                        <th className="px-6 py-3.5 text-xs font-bold text-slate-500 uppercase tracking-wider">Mode & Status</th>
                        <th className="px-6 py-3.5 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-sm text-slate-700">
                      {isLoading ? (
                        <tr>
                          <td colSpan={8} className="text-center py-12 text-slate-400">Loading payroll records...</td>
                        </tr>
                      ) : filteredSalaries.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="text-center py-16">
                            <div className="flex flex-col items-center gap-2">
                              <span className="text-3xl text-slate-300">💸</span>
                              <p className="font-semibold text-slate-600 text-sm">No salary records found for {selectedMonth}.</p>
                              <p className="text-xs text-slate-400">Click &ldquo;Disburse Salary&rdquo; above to record a payment.</p>
                            </div>
                          </td>
                        </tr>
                      ) : (
                        filteredSalaries.map((rec) => (
                          <tr key={rec.id} className="hover:bg-slate-50/50 transition-colors">
                            <td className="px-6 py-4 whitespace-nowrap text-xs text-slate-500 font-medium">
                              {rec.payment_date ? new Date(rec.payment_date).toLocaleDateString("en-IN") : "—"}
                            </td>
                            <td className="px-6 py-4">
                              <p className="font-semibold text-slate-800 text-sm">{rec.employee_name}</p>
                              {rec.notes && <p className="text-xs text-slate-400 mt-0.5 truncate max-w-[200px]">{rec.notes}</p>}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className="px-2.5 py-1 bg-slate-100 text-slate-700 rounded-md text-xs font-medium">
                                {rec.month_year}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-xs whitespace-nowrap">
                              <div>Base: ₹{rec.base_salary.toLocaleString("en-IN")}</div>
                              {rec.advance_deduction > 0 && (
                                <div className="text-rose-600 font-semibold mt-0.5">
                                  - Cut: ₹{rec.advance_deduction.toLocaleString("en-IN")}
                                </div>
                              )}
                              {rec.bonus_overtime > 0 && (
                                <div className="text-emerald-600 font-semibold mt-0.5">+ Bonus: ₹{rec.bonus_overtime.toLocaleString("en-IN")}</div>
                              )}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className="font-bold text-[#0F172A] text-sm">
                                ₹{rec.net_paid.toLocaleString("en-IN")}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className="px-2.5 py-1 bg-slate-100 text-slate-700 rounded-md text-xs font-medium">
                                {rec.paid_by}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-slate-600 font-medium">{rec.payment_mode}</span>
                                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
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
                            <td className="px-6 py-4 text-right whitespace-nowrap">
                              <div className="flex items-center justify-end gap-2">
                                <button
                                  onClick={() => setViewVoucher(rec)}
                                  title="View Salary Slip"
                                  className="px-2.5 py-1 text-slate-600 hover:text-slate-900 border border-slate-200 rounded-lg hover:bg-slate-50 text-xs font-medium transition"
                                >
                                  Slip
                                </button>
                                <button
                                  onClick={() => handleDeleteSalaryRecord(rec.id)}
                                  title="Delete Record"
                                  className="p-1 text-slate-400 hover:text-rose-600 rounded-lg transition"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                  </svg>
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
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {employees.map((emp) => {
                  const hasAdvance = (Number(emp.advance_balance) || 0) > 0;
                  return (
                    <div
                      key={emp.id}
                      className={`bg-white rounded-xl p-5 border transition shadow-sm flex flex-col justify-between ${
                        emp.status === "Active" ? "border-slate-200 hover:shadow-md" : "border-slate-200 opacity-60 bg-slate-50"
                      }`}
                    >
                      <div>
                        <div className="flex items-start justify-between">
                          <div>
                            <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded text-[11px] font-semibold uppercase tracking-wider">
                              {emp.role}
                            </span>
                            <h3 className="text-base font-bold text-slate-900 mt-2">{emp.name}</h3>
                            <p className="text-xs text-slate-500 mt-0.5">{emp.phone || "No phone recorded"}</p>
                          </div>
                          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                            emp.status === "Active" ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-slate-200 text-slate-600"
                          }`}>
                            {emp.status}
                          </span>
                        </div>

                        {/* Advance Alert Banner */}
                        {hasAdvance && (
                          <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs">
                            <div className="flex justify-between items-center">
                              <span className="font-semibold text-amber-900">Advance Due:</span>
                              <span className="font-bold text-amber-900 text-sm">
                                ₹{Number(emp.advance_balance).toLocaleString("en-IN")}
                              </span>
                            </div>
                            <p className="text-[11px] text-amber-700 mt-0.5">
                              Plan: ₹{Number(emp.default_monthly_deduction || 5000).toLocaleString("en-IN")}/month cut
                            </p>
                          </div>
                        )}

                        <div className="mt-4 pt-3 border-t border-slate-100 space-y-1.5 text-xs">
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
                              <span className="text-slate-400">ID / Proof:</span>
                              <span className="font-mono text-slate-600">{emp.id_proof_number}</span>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                        <button
                          onClick={() => handleToggleEmployeeStatus(emp)}
                          className="text-xs font-semibold text-slate-400 hover:text-slate-700"
                        >
                          {emp.status === "Active" ? "Deactivate" : "Activate"}
                        </button>

                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => handleOpenAdvanceForEmp(emp)}
                            title="Give Advance"
                            className="px-2.5 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 font-semibold rounded-lg text-xs transition"
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
                            className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white font-semibold rounded-lg text-xs shadow-xs transition"
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

            {/* TAB 3: STAFF ADVANCES LEDGER */}
            {activeTab === "advances" && (
              <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-6">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                  <div>
                    <h2 className="text-lg font-bold text-slate-800">Staff Advance Recovery Ledger</h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Track staff advances and monthly installment deductions during salary payments.
                    </p>
                  </div>

                  <button
                    onClick={() => {
                      resetAdvanceForm();
                      setIsAdvanceModalOpen(true);
                    }}
                    className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white font-semibold rounded-xl text-xs shadow-xs transition"
                  >
                    Give Advance
                  </button>
                </div>

                {/* Advance Summary Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Advance Outstanding</p>
                    <h3 className="text-2xl font-bold text-[#0F172A] mt-1">₹{totalAdvanceOutstanding.toLocaleString("en-IN")}</h3>
                    <p className="text-xs text-slate-400 mt-1">Remaining to be recovered from staff</p>
                  </div>

                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Recovered This Month ({selectedMonth})</p>
                    <h3 className="text-2xl font-bold text-emerald-600 mt-1">₹{totalAdvanceRecoveredThisMonth.toLocaleString("en-IN")}</h3>
                    <p className="text-xs text-slate-400 mt-1">Deducted from salary disbursements</p>
                  </div>

                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Staff With Active Advances</p>
                    <h3 className="text-2xl font-bold text-[#0F172A] mt-1">{employeesWithAdvance.length} Employees</h3>
                    <p className="text-xs text-slate-400 mt-1">Currently paying installments</p>
                  </div>
                </div>

                {/* Staff with Active Advances Table */}
                <div className="overflow-x-auto w-full border border-slate-100 rounded-xl">
                  <table className="min-w-[750px] w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-100">
                        <th className="px-6 py-3.5 text-xs font-bold text-slate-500 uppercase tracking-wider">Employee</th>
                        <th className="px-6 py-3.5 text-xs font-bold text-slate-500 uppercase tracking-wider">Role</th>
                        <th className="px-6 py-3.5 text-xs font-bold text-slate-500 uppercase tracking-wider">Monthly Salary</th>
                        <th className="px-6 py-3.5 text-xs font-bold text-slate-500 uppercase tracking-wider">Advance Due</th>
                        <th className="px-6 py-3.5 text-xs font-bold text-slate-500 uppercase tracking-wider">Monthly Deduction Plan</th>
                        <th className="px-6 py-3.5 text-xs font-bold text-slate-500 uppercase tracking-wider">Est. Duration</th>
                        <th className="px-6 py-3.5 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-sm text-slate-700">
                      {employees.map((emp) => {
                        const advDue = Number(emp.advance_balance) || 0;
                        const plan = Number(emp.default_monthly_deduction) || 5000;
                        const monthsLeft = advDue > 0 ? Math.ceil(advDue / plan) : 0;

                        return (
                          <tr key={emp.id} className="hover:bg-slate-50/50 transition-colors">
                            <td className="px-6 py-4 font-semibold text-slate-900 whitespace-nowrap">
                              {emp.name}
                              {advDue > 0 && (
                                <span className="ml-2 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                                  Active Loan
                                </span>
                              )}
                            </td>
                            <td className="px-6 py-4 text-slate-500 whitespace-nowrap">{emp.role}</td>
                            <td className="px-6 py-4 font-medium whitespace-nowrap">₹{emp.monthly_salary.toLocaleString("en-IN")}</td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              {advDue > 0 ? (
                                <span className="font-bold text-slate-900 text-sm">
                                  ₹{advDue.toLocaleString("en-IN")}
                                </span>
                              ) : (
                                <span className="text-emerald-600 font-semibold text-xs">✓ Cleared</span>
                              )}
                            </td>
                            <td className="px-6 py-4 font-medium text-slate-700 whitespace-nowrap">
                              {advDue > 0 ? `₹${plan.toLocaleString("en-IN")} / mo` : "—"}
                            </td>
                            <td className="px-6 py-4 text-xs font-medium text-slate-500 whitespace-nowrap">
                              {advDue > 0 ? `${monthsLeft} month(s)` : "—"}
                            </td>
                            <td className="px-6 py-4 text-right whitespace-nowrap">
                              <button
                                onClick={() => handleOpenAdvanceForEmp(emp)}
                                className="px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 font-semibold rounded-lg text-xs transition"
                              >
                                + Advance
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
                    <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
                      Recent Advances Given (History)
                    </h3>
                    <div className="overflow-x-auto w-full border border-slate-100 rounded-xl">
                      <table className="min-w-[700px] w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-100 text-slate-500 font-bold uppercase">
                            <th className="px-4 py-2.5">Date</th>
                            <th className="px-4 py-2.5">Employee</th>
                            <th className="px-4 py-2.5">Amount Given</th>
                            <th className="px-4 py-2.5">Disbursed Via</th>
                            <th className="px-4 py-2.5">Deduction Plan</th>
                            <th className="px-4 py-2.5">Mode & Reason</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-slate-700">
                          {advances.map((a) => (
                            <tr key={a.id} className="hover:bg-slate-50/50">
                              <td className="px-4 py-2.5 whitespace-nowrap text-slate-500">{a.date ? new Date(a.date).toLocaleDateString("en-IN") : "—"}</td>
                              <td className="px-4 py-2.5 font-semibold text-slate-800">{a.employee_name}</td>
                              <td className="px-4 py-2.5 font-bold text-slate-900">₹{Number(a.amount).toLocaleString("en-IN")}</td>
                              <td className="px-4 py-2.5 font-medium">{a.paid_by}</td>
                              <td className="px-4 py-2.5">₹{a.monthly_deduction_plan || 5000}/mo</td>
                              <td className="px-4 py-2.5 text-slate-500">
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
            )}

          </div>
        </main>
      </main>

      {/* MODAL 1: ADD / EDIT EMPLOYEE */}
      {isEmployeeModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden border border-slate-100 my-8">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <h3 className="font-bold text-slate-800 text-lg">
                {editingEmployee ? "Edit Employee" : "Add New Employee"}
              </h3>
              <button
                onClick={() => setIsEmployeeModalOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center transition"
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">Full Name *</label>
                <input
                  type="text"
                  required
                  value={empName}
                  onChange={(e) => setEmpName(e.target.value)}
                  placeholder="e.g. Ramesh Kumar"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-[#0F172A] bg-slate-50 text-slate-700"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">Role / Position *</label>
                  <select
                    value={empRole}
                    onChange={(e) => setEmpRole(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs sm:text-sm outline-none focus:ring-2 focus:ring-[#0F172A] bg-slate-50 text-slate-700"
                  >
                    {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">Monthly Salary (₹) *</label>
                  <input
                    type="number"
                    required
                    value={empSalary}
                    onChange={(e) => setEmpSalary(e.target.value)}
                    placeholder="e.g. 15000"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm font-semibold outline-none focus:ring-2 focus:ring-[#0F172A] bg-slate-50 text-slate-900"
                  />
                </div>
              </div>

              {/* Advance tracking fields on Employee entry */}
              <div className="p-3 bg-amber-50/70 rounded-xl border border-amber-200 space-y-2">
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
                  <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">Phone Number</label>
                  <input
                    type="tel"
                    value={empPhone}
                    onChange={(e) => setEmpPhone(e.target.value)}
                    placeholder="9876543210"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-[#0F172A] bg-slate-50 text-slate-700"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">Joining Date</label>
                  <input
                    type="date"
                    value={empJoining}
                    onChange={(e) => setEmpJoining(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs sm:text-sm outline-none focus:ring-2 focus:ring-[#0F172A] bg-slate-50 text-slate-700"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">Aadhaar / ID Card Number</label>
                <input
                  type="text"
                  value={empIdProof}
                  onChange={(e) => setEmpIdProof(e.target.value)}
                  placeholder="e.g. 4930 1234 5678"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm font-mono outline-none focus:ring-2 focus:ring-[#0F172A] bg-slate-50 text-slate-700"
                />
              </div>
            </div>

            <div className="px-6 py-4 border-t border-slate-100 flex gap-2 justify-end bg-slate-50/50">
              <button
                onClick={() => setIsEmployeeModalOpen(false)}
                className="px-4 py-2 border border-slate-200 text-slate-600 text-xs sm:text-sm font-semibold rounded-xl hover:bg-slate-100 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEmployee}
                disabled={isSavingEmp}
                className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs sm:text-sm font-semibold rounded-xl shadow-xs transition disabled:opacity-60"
              >
                {isSavingEmp ? "Saving..." : editingEmployee ? "Update Employee" : "Save Employee"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: GIVE STAFF ADVANCE (LOAN) */}
      {isAdvanceModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden border border-slate-100 my-8">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <div>
                <h3 className="font-bold text-slate-800 text-lg">Give Salary Advance</h3>
                <p className="text-xs text-slate-400">Record staff advance with automatic monthly deduction plan.</p>
              </div>
              <button
                onClick={() => setIsAdvanceModalOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center transition"
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">Select Staff Member *</label>
                <select
                  value={advEmpId}
                  onChange={(e) => setAdvEmpId(parseInt(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm font-semibold outline-none focus:ring-2 focus:ring-[#0F172A] bg-slate-50 text-slate-700"
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
                  <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">Advance Amount (₹) *</label>
                  <input
                    type="number"
                    required
                    value={advAmount}
                    onChange={(e) => setAdvAmount(e.target.value)}
                    placeholder="e.g. 20000"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-base font-bold text-slate-900 outline-none focus:ring-2 focus:ring-[#0F172A] bg-slate-50"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">Monthly Deduction (₹/mo) *</label>
                  <input
                    type="number"
                    required
                    value={advPlan}
                    onChange={(e) => setAdvPlan(e.target.value)}
                    placeholder="e.g. 5000"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-base font-bold text-slate-900 outline-none focus:ring-2 focus:ring-[#0F172A] bg-slate-50"
                  />
                </div>
              </div>

              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-600 leading-relaxed">
                ℹ️ Handing over <strong>₹{Number(advAmount || 0).toLocaleString("en-IN")}</strong> with <strong>₹{Number(advPlan || 5000).toLocaleString("en-IN")}/month</strong> deduction will clear across <strong>{Math.ceil(Number(advAmount || 0) / Number(advPlan || 5000))} months</strong>.
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">Disbursed Via (Account) *</label>
                  <select
                    value={advPaidBy}
                    onChange={(e) => setAdvPaidBy(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs sm:text-sm font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-[#0F172A]"
                  >
                    {PAYMENT_ACCOUNTS.map((a) => <option key={a} value={a}>{a}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">Payment Mode</label>
                  <select
                    value={advMode}
                    onChange={(e) => setAdvMode(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs sm:text-sm outline-none focus:ring-2 focus:ring-[#0F172A] bg-slate-50 text-slate-700"
                  >
                    {PAYMENT_MODES.map((m) => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">Date Handed Over</label>
                  <input
                    type="date"
                    value={advDate}
                    onChange={(e) => setAdvDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs sm:text-sm outline-none focus:ring-2 focus:ring-[#0F172A] bg-slate-50 text-slate-700"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">Reason / Note</label>
                  <input
                    type="text"
                    value={advNotes}
                    onChange={(e) => setAdvNotes(e.target.value)}
                    placeholder="e.g. Festival / Medical emergency"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs sm:text-sm outline-none focus:ring-2 focus:ring-[#0F172A] bg-slate-50 text-slate-700"
                  />
                </div>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-slate-100 flex gap-2 justify-end bg-slate-50/50">
              <button
                onClick={() => setIsAdvanceModalOpen(false)}
                className="px-4 py-2 border border-slate-200 text-slate-600 text-xs sm:text-sm font-semibold rounded-xl hover:bg-slate-100 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveAdvance}
                disabled={isSavingAdv || !advEmpId}
                className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs sm:text-sm font-semibold rounded-xl shadow-xs transition disabled:opacity-60"
              >
                {isSavingAdv ? "Recording..." : "Save Advance Record"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: DISBURSE / RECORD SALARY PAYMENT */}
      {isPaymentModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden border border-slate-100 my-8">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <div>
                <h3 className="font-bold text-slate-800 text-lg">Disburse Monthly Salary</h3>
                <p className="text-xs text-slate-400">Automatic advance recovery calculation and voucher generation.</p>
              </div>
              <button
                onClick={() => setIsPaymentModalOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center transition"
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">Select Employee *</label>
                  <select
                    value={payEmployeeId}
                    onChange={(e) => handleSelectEmployeeForPayment(parseInt(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs sm:text-sm font-semibold outline-none focus:ring-2 focus:ring-[#0F172A] bg-slate-50 text-slate-700"
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
                  <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">Salary Month *</label>
                  <select
                    value={payMonth}
                    onChange={(e) => setPayMonth(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs sm:text-sm font-semibold outline-none focus:ring-2 focus:ring-[#0F172A] bg-slate-50 text-slate-700"
                  >
                    {recentMonths.map((m) => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Advance Detection Alert Box */}
              {selectedPayEmp && selectedPayEmpAdvance > 0 && (
                <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-semibold text-amber-900">Active Advance Due:</span>
                    <span className="text-base font-bold text-slate-900">
                      ₹{selectedPayEmpAdvance.toLocaleString("en-IN")}
                    </span>
                  </div>
                  <div className="mt-2 pt-2 border-t border-amber-200 flex justify-between items-center text-xs text-amber-800">
                    <span>Deducting this month: <strong>₹{deductionAmount.toLocaleString("en-IN")}</strong></span>
                    <span>Remaining after: <strong>₹{remainingAdvanceAfterPayment.toLocaleString("en-IN")}</strong></span>
                  </div>
                </div>
              )}

              {/* Salary Breakdown Inputs */}
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Base Salary (₹)</label>
                    <input
                      type="number"
                      value={payBaseSalary}
                      onChange={(e) => setPayBaseSalary(e.target.value)}
                      className="w-full px-3 py-2 bg-white rounded-lg border border-slate-200 text-sm font-semibold outline-none focus:ring-2 focus:ring-[#0F172A]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-rose-600 uppercase mb-1">Advance Cut (₹)</label>
                    <input
                      type="number"
                      value={payAdvanceDeduction}
                      onChange={(e) => setPayAdvanceDeduction(e.target.value)}
                      placeholder="0"
                      className="w-full px-3 py-2 bg-white rounded-lg border border-rose-200 text-sm font-bold text-rose-700 outline-none focus:ring-2 focus:ring-rose-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-emerald-600 uppercase mb-1">Bonus/Tip (₹)</label>
                    <input
                      type="number"
                      value={payBonus}
                      onChange={(e) => setPayBonus(e.target.value)}
                      placeholder="0"
                      className="w-full px-3 py-2 bg-white rounded-lg border border-slate-200 text-sm font-semibold outline-none focus:ring-2 focus:ring-[#0F172A]"
                    />
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-200 flex justify-between items-center">
                  <span className="text-xs font-semibold text-slate-600">Net Salary Paid to Staff:</span>
                  <span className="text-xl font-bold text-[#0F172A]">₹{calcNetPay().toLocaleString("en-IN")}</span>
                </div>
              </div>

              {/* Account Paid From */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                    Disbursed Via (Account) *
                  </label>
                  <select
                    value={payPaidBy}
                    onChange={(e) => setPayPaidBy(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs sm:text-sm font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-[#0F172A]"
                  >
                    {PAYMENT_ACCOUNTS.map((a) => (
                      <option key={a} value={a}>{a}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">Payment Mode</label>
                  <select
                    value={payMode}
                    onChange={(e) => setPayMode(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs sm:text-sm outline-none focus:ring-2 focus:ring-[#0F172A] bg-slate-50 text-slate-700"
                  >
                    {PAYMENT_MODES.map((m) => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">Payment Date</label>
                  <input
                    type="date"
                    value={payDate}
                    onChange={(e) => setPayDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs sm:text-sm outline-none focus:ring-2 focus:ring-[#0F172A] bg-slate-50 text-slate-700"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">Payment Status</label>
                  <select
                    value={payStatus}
                    onChange={(e) => setPayStatus(e.target.value as any)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs sm:text-sm outline-none focus:ring-2 focus:ring-[#0F172A] bg-slate-50 text-slate-700"
                  >
                    <option value="Paid">Full Salary Paid</option>
                    <option value="Partial">Partial Payment</option>
                    <option value="Advance">Advance Disbursement</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">Notes / Transaction Reference</label>
                <input
                  type="text"
                  value={payNotes}
                  onChange={(e) => setPayNotes(e.target.value)}
                  placeholder="e.g. Paid via GPay / 5k advance deducted"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs sm:text-sm outline-none focus:ring-2 focus:ring-[#0F172A] bg-slate-50 text-slate-700"
                />
              </div>
            </div>

            <div className="px-6 py-4 border-t border-slate-100 flex gap-2 justify-end bg-slate-50/50">
              <button
                onClick={() => setIsPaymentModalOpen(false)}
                className="px-4 py-2 border border-slate-200 text-slate-600 text-xs sm:text-sm font-semibold rounded-xl hover:bg-slate-100 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveSalaryPayment}
                disabled={isSavingPay || !payEmployeeId}
                className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs sm:text-sm font-semibold rounded-xl shadow-xs transition disabled:opacity-60"
              >
                {isSavingPay ? "Recording..." : "Record Disbursement"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* VOUCHER / SLIP PREVIEW MODAL */}
      {viewVoucher && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden p-6 relative border border-slate-100">
            <button
              onClick={() => setViewVoucher(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600"
            >
              ✕
            </button>

            <div className="text-center border-b border-slate-100 pb-4">
              <h2 className="text-lg font-bold text-[#0F172A] tracking-tight">{hotelSettings.hotelName}</h2>
              <p className="text-xs text-slate-400 uppercase tracking-widest mt-0.5">Staff Salary Voucher</p>
            </div>

            <div className="py-4 space-y-2.5 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-400">Employee Name:</span>
                <span className="font-semibold text-slate-800">{viewVoucher.employee_name}</span>
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
                <span className="font-semibold text-slate-800">{viewVoucher.paid_by}</span>
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
                  <div className="flex justify-between text-rose-600 font-semibold bg-rose-50 px-2 py-0.5 rounded">
                    <span>Advance Installment Deducted:</span>
                    <span>- ₹{viewVoucher.advance_deduction.toLocaleString("en-IN")}</span>
                  </div>
                )}
                {viewVoucher.bonus_overtime > 0 && (
                  <div className="flex justify-between text-emerald-600 font-medium">
                    <span>Bonus / Overtime:</span>
                    <span>+ ₹{viewVoucher.bonus_overtime.toLocaleString("en-IN")}</span>
                  </div>
                )}
                <div className="flex justify-between pt-2 border-t border-slate-200 text-sm font-bold text-slate-900">
                  <span>Net Amount Paid:</span>
                  <span className="text-[#0F172A]">₹{viewVoucher.net_paid.toLocaleString("en-IN")}</span>
                </div>
              </div>

              {viewVoucher.notes && (
                <div className="p-2.5 bg-slate-50 rounded-xl text-xs text-slate-600">
                  <span className="font-semibold">Remarks:</span> {viewVoucher.notes}
                </div>
              )}
            </div>

            <div className="pt-4 border-t border-slate-100 flex gap-2">
              <button
                onClick={() => window.print()}
                className="flex-1 py-2 bg-slate-900 text-white font-semibold rounded-xl text-xs hover:bg-slate-800 transition"
              >
                Print Slip
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
