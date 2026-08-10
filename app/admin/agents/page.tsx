"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/utils/supabase";
import AdminSidebar from "@/components/AdminSidebar";

type Agent = {
  id: number;
  created_at: string;
  name: string;
  phone?: string;
  total_guests: number;
  total_credit: number;
  total_paid: number;
  status: string;
};

export default function AgentsPage() {
  const router = useRouter();
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const [hotelSettings, setHotelSettings] = useState({ hotelName: "HOTEL AADVIK INN" });
  const [agents, setAgents] = useState<Agent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("All Status");
  const [activeTab, setActiveTab] = useState("Agents List");

  // Add agent modal
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [formName, setFormName] = useState("");
  const [formPhone, setFormPhone] = useState("");

  // Pay modal
  const [isPayModalOpen, setIsPayModalOpen] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [payAmount, setPayAmount] = useState("");
  const [isPaying, setIsPaying] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("hotelAadvikSettings");
      if (saved) try { setHotelSettings(JSON.parse(saved)); } catch {}
    }
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push("/admin/login"); }
      else { setIsCheckingSession(false); fetchAgents(); }
    };
    checkSession();
  }, [router]);

  const fetchAgents = async () => {
    setIsLoading(true);
    const { data, error } = await supabase.from("Agents").select("*").order("created_at", { ascending: false });
    if (!error && data) setAgents(data);
    setIsLoading(false);
  };

  const filteredAgents = agents.filter((a) => {
    const matchesSearch = a.name.toLowerCase().includes(searchQuery.toLowerCase()) || (a.phone || "").includes(searchQuery);
    const matchesStatus = statusFilter === "All Status" || a.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const activeAgentsCount = agents.filter(a => a.status === "Active").length;
  const totalOutstanding = agents.reduce((acc, a) => acc + (Number(a.total_credit) - Number(a.total_paid)), 0);
  const totalPaid = agents.reduce((acc, a) => acc + Number(a.total_paid), 0);

  const handleAddAgent = async () => {
    if (!formName) { alert("Please enter the agent name."); return; }
    setIsSaving(true);
    const { error } = await supabase.from("Agents").insert({ name: formName, phone: formPhone || null });
    setIsSaving(false);
    if (error) { alert("Failed to add agent: " + error.message); return; }
    setFormName(""); setFormPhone("");
    setIsAddModalOpen(false);
    fetchAgents();
  };

  const handleOpenPay = (agent: Agent) => {
    setSelectedAgent(agent);
    setPayAmount("");
    setIsPayModalOpen(true);
  };

  const handleRecordPayment = async () => {
    if (!selectedAgent || !payAmount) { alert("Enter a valid amount."); return; }
    const amount = parseFloat(payAmount);
    if (isNaN(amount) || amount <= 0) { alert("Invalid amount."); return; }
    setIsPaying(true);
    const newPaid = Number(selectedAgent.total_paid) + amount;
    const { error } = await supabase.from("Agents").update({ total_paid: newPaid }).eq("id", selectedAgent.id);
    setIsPaying(false);
    if (error) { alert("Failed to record payment: " + error.message); return; }
    setIsPayModalOpen(false);
    fetchAgents();
  };

  const handleAddCredit = async (agent: Agent) => {
    const amount = window.prompt(`Add credit to ${agent.name} (Rs):`, "");
    if (!amount) return;
    const credit = parseFloat(amount);
    if (isNaN(credit) || credit <= 0) { alert("Invalid amount."); return; }
    const newCredit = Number(agent.total_credit) + credit;
    const newGuests = Number(agent.total_guests) + 1;
    const { error } = await supabase.from("Agents").update({ total_credit: newCredit, total_guests: newGuests }).eq("id", agent.id);
    if (error) { alert("Failed to add credit: " + error.message); return; }
    fetchAgents();
  };

  const handleToggleStatus = async (agent: Agent) => {
    const newStatus = agent.status === "Active" ? "Inactive" : "Active";
    const { error } = await supabase.from("Agents").update({ status: newStatus }).eq("id", agent.id);
    if (error) { alert("Failed to update status."); return; }
    fetchAgents();
  };

  const handleDeleteAgent = async (agent: Agent) => {
    if (!window.confirm(`Are you sure you want to delete ${agent.name}? This action cannot be undone.`)) return;
    const { error } = await supabase.from("Agents").delete().eq("id", agent.id);
    if (error) { alert("Failed to delete agent: " + error.message); return; }
    fetchAgents();
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
      <AdminSidebar activePath="/admin/agents" hotelName={hotelSettings.hotelName} />

      <main className="flex-1 flex flex-col overflow-hidden z-0">
        <main className="flex-1 p-4 md:p-8 overflow-y-auto">
          <div className="max-w-7xl mx-auto space-y-6">

            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white/70 backdrop-blur-md p-6 rounded-3xl border border-white/60 shadow-sm">
              <div>
                <h1 className="text-3xl font-extrabold text-slate-800 tracking-tight">Agent Management</h1>
                <p className="text-slate-500 mt-1">Manage agents, commissions & payments</p>
              </div>
              <button
                onClick={() => setIsAddModalOpen(true)}
                className="flex items-center gap-2 px-5 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-md shadow-indigo-200 transition-all"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" /></svg>
                Add Agent
              </button>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
              <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm flex items-center gap-4">
                <div className="w-12 h-12 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600 shrink-0">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Active Agents</p>
                  <h3 className="text-2xl font-black text-slate-800">{activeAgentsCount}</h3>
                </div>
              </div>

              <div className="bg-white rounded-2xl p-5 border border-rose-200 shadow-sm flex items-center gap-4">
                <div className="w-12 h-12 bg-rose-50 rounded-xl flex items-center justify-center text-rose-500 shrink-0">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Outstanding Credit</p>
                  <h3 className="text-2xl font-black text-rose-600">₹{totalOutstanding.toLocaleString("en-IN")}</h3>
                </div>
              </div>

              <div className="bg-white rounded-2xl p-5 border border-emerald-200 shadow-sm flex items-center gap-4">
                <div className="w-12 h-12 bg-emerald-50 rounded-xl flex items-center justify-center text-emerald-500 shrink-0">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Total Cash Paid</p>
                  <h3 className="text-2xl font-black text-emerald-600">₹{totalPaid.toLocaleString("en-IN")}</h3>
                </div>
              </div>
            </div>

            {/* Tabs & Table */}
            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
              {/* Tab Navigation */}
              <div className="p-6 border-b border-slate-100">
                <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
                  <div className="flex gap-1 bg-slate-100 p-1 rounded-xl">
                    {["Agents List", "Reports"].map((tab) => (
                      <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                          activeTab === tab ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700"
                        }`}
                      >
                        {tab}
                      </button>
                    ))}
                  </div>
                  <div className="flex gap-3 items-center w-full sm:w-auto">
                    <div className="relative flex-1 sm:flex-none">
                      <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
                      <input
                        type="text"
                        placeholder="Search agents..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-9 pr-4 py-2 border border-slate-200 rounded-xl text-sm text-slate-700 bg-white focus:ring-2 focus:ring-indigo-500 outline-none w-44"
                      />
                    </div>
                    <select
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value)}
                      className="px-3 py-2 border border-slate-200 rounded-xl text-sm text-slate-700 bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
                    >
                      <option>All Status</option>
                      <option>Active</option>
                      <option>Inactive</option>
                    </select>
                  </div>
                </div>
              </div>

              {activeTab === "Agents List" && (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-100">
                        {["Agent", "Phone", "Guests", "Credit", "Paid", "Balance", "Status", "Actions"].map((h) => (
                          <th key={h} className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {isLoading ? (
                        <tr><td colSpan={8} className="text-center py-16 text-slate-500">Loading...</td></tr>
                      ) : filteredAgents.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="text-center py-20">
                            <div className="flex flex-col items-center gap-3">
                              <svg className="w-14 h-14 text-slate-200" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                              <p className="text-slate-500 font-semibold">No agents found</p>
                              <p className="text-slate-400 text-sm">Add your first agent to get started</p>
                            </div>
                          </td>
                        </tr>
                      ) : filteredAgents.map((agent) => {
                        const balance = Number(agent.total_credit) - Number(agent.total_paid);
                        return (
                          <tr key={agent.id} className="hover:bg-slate-50 transition-colors">
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-3">
                                <div className="w-9 h-9 bg-indigo-100 text-indigo-700 rounded-full flex items-center justify-center font-bold text-sm shrink-0">
                                  {agent.name.charAt(0).toUpperCase()}
                                </div>
                                <span className="font-semibold text-slate-800 text-sm">{agent.name}</span>
                              </div>
                            </td>
                            <td className="px-6 py-4 text-sm text-slate-600">{agent.phone || "—"}</td>
                            <td className="px-6 py-4 text-sm text-slate-700 font-semibold">{agent.total_guests}</td>
                            <td className="px-6 py-4 text-sm font-semibold text-slate-800">₹{Number(agent.total_credit).toLocaleString("en-IN")}</td>
                            <td className="px-6 py-4 text-sm font-semibold text-emerald-600">₹{Number(agent.total_paid).toLocaleString("en-IN")}</td>
                            <td className="px-6 py-4 text-sm font-bold text-rose-600">₹{balance.toLocaleString("en-IN")}</td>
                            <td className="px-6 py-4">
                              <button onClick={() => handleToggleStatus(agent)} className={`px-3 py-1.5 rounded-full text-xs font-bold transition-colors ${agent.status === "Active" ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200" : "bg-slate-100 text-slate-500 hover:bg-slate-200"}`}>
                                • {agent.status}
                              </button>
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-2">
                                <button onClick={() => handleAddCredit(agent)} title="Add Credit" className="text-xs px-3 py-1.5 bg-indigo-50 text-indigo-700 rounded-lg font-semibold hover:bg-indigo-100 transition">+ Credit</button>
                                <button onClick={() => handleOpenPay(agent)} title="Record Payment" className="text-xs px-3 py-1.5 bg-emerald-50 text-emerald-700 rounded-lg font-semibold hover:bg-emerald-100 transition">Pay</button>
                                <button onClick={() => handleDeleteAgent(agent)} title="Delete Agent" className="text-xs px-2 py-1.5 bg-rose-50 text-rose-600 rounded-lg font-semibold hover:bg-rose-100 transition">
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {activeTab === "Reports" && (
                <div className="p-8">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div className="bg-slate-50 rounded-2xl p-6 border border-slate-200">
                      <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wide mb-4">Summary</h3>
                      <div className="space-y-3">
                        <div className="flex justify-between"><span className="text-slate-600 text-sm">Total Agents</span><span className="font-bold text-slate-800">{agents.length}</span></div>
                        <div className="flex justify-between"><span className="text-slate-600 text-sm">Active Agents</span><span className="font-bold text-emerald-600">{activeAgentsCount}</span></div>
                        <div className="flex justify-between"><span className="text-slate-600 text-sm">Inactive Agents</span><span className="font-bold text-slate-400">{agents.length - activeAgentsCount}</span></div>
                        <div className="border-t border-slate-200 pt-3 flex justify-between"><span className="text-slate-600 text-sm">Total Guests Referred</span><span className="font-bold text-slate-800">{agents.reduce((a, c) => a + Number(c.total_guests), 0)}</span></div>
                      </div>
                    </div>
                    <div className="bg-slate-50 rounded-2xl p-6 border border-slate-200">
                      <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wide mb-4">Financials</h3>
                      <div className="space-y-3">
                        <div className="flex justify-between"><span className="text-slate-600 text-sm">Total Credit Given</span><span className="font-bold text-slate-800">₹{agents.reduce((a, c) => a + Number(c.total_credit), 0).toLocaleString("en-IN")}</span></div>
                        <div className="flex justify-between"><span className="text-slate-600 text-sm">Total Paid Out</span><span className="font-bold text-emerald-600">₹{totalPaid.toLocaleString("en-IN")}</span></div>
                        <div className="border-t border-slate-200 pt-3 flex justify-between"><span className="text-slate-600 text-sm font-bold">Net Outstanding</span><span className="font-black text-rose-600">₹{totalOutstanding.toLocaleString("en-IN")}</span></div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </main>
      </main>

      {/* Add Agent Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/70 backdrop-blur-sm" onClick={(e) => { if (e.target === e.currentTarget) setIsAddModalOpen(false); }}>
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center">
              <h2 className="text-xl font-bold text-slate-800">Add New Agent</h2>
              <button onClick={() => setIsAddModalOpen(false)} className="text-slate-400 hover:text-slate-600 p-1">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">Agent Name *</label>
                <input type="text" value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="e.g. Ramesh Kumar" className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800 bg-white" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">Phone Number</label>
                <input type="tel" value={formPhone} onChange={(e) => setFormPhone(e.target.value)} placeholder="e.g. 9876543210" className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800 bg-white" />
              </div>
            </div>
            <div className="p-6 border-t border-slate-100 flex gap-3 justify-end">
              <button onClick={() => setIsAddModalOpen(false)} className="px-5 py-2.5 border border-slate-200 text-slate-600 font-semibold rounded-xl hover:bg-slate-50 transition-all">Cancel</button>
              <button onClick={handleAddAgent} disabled={isSaving} className="px-5 py-2.5 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 shadow-md shadow-indigo-200 transition-all disabled:opacity-60">
                {isSaving ? "Adding..." : "Add Agent"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Record Payment Modal */}
      {isPayModalOpen && selectedAgent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/70 backdrop-blur-sm" onClick={(e) => { if (e.target === e.currentTarget) setIsPayModalOpen(false); }}>
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center">
              <div>
                <h2 className="text-xl font-bold text-slate-800">Record Payment</h2>
                <p className="text-slate-500 text-sm mt-1">{selectedAgent.name}</p>
              </div>
              <button onClick={() => setIsPayModalOpen(false)} className="text-slate-400 hover:text-slate-600 p-1">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="bg-slate-50 rounded-2xl p-4">
                <div className="flex justify-between text-sm mb-1"><span className="text-slate-500">Total Credit</span><span className="font-bold">₹{Number(selectedAgent.total_credit).toLocaleString("en-IN")}</span></div>
                <div className="flex justify-between text-sm mb-1"><span className="text-slate-500">Already Paid</span><span className="font-bold text-emerald-600">₹{Number(selectedAgent.total_paid).toLocaleString("en-IN")}</span></div>
                <div className="border-t border-slate-200 mt-2 pt-2 flex justify-between text-sm"><span className="font-bold text-slate-700">Balance Due</span><span className="font-black text-rose-600">₹{(Number(selectedAgent.total_credit) - Number(selectedAgent.total_paid)).toLocaleString("en-IN")}</span></div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">Amount to Pay (Rs) *</label>
                <input type="number" value={payAmount} onChange={(e) => setPayAmount(e.target.value)} placeholder="Enter amount" className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-emerald-500 text-slate-800 bg-white" />
              </div>
            </div>
            <div className="p-6 border-t border-slate-100 flex gap-3 justify-end">
              <button onClick={() => setIsPayModalOpen(false)} className="px-5 py-2.5 border border-slate-200 text-slate-600 font-semibold rounded-xl hover:bg-slate-50 transition-all">Cancel</button>
              <button onClick={handleRecordPayment} disabled={isPaying} className="px-5 py-2.5 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 shadow-md shadow-emerald-200 transition-all disabled:opacity-60">
                {isPaying ? "Saving..." : "Record Payment"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
