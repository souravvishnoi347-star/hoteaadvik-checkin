"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/utils/supabase";
import AdminSidebar from "@/components/AdminSidebar";

type Conversation = {
  id: number;
  created_at: string;
  customer_phone: string;
  customer_name: string;
  booking_id?: number | null;
  last_message: string;
  last_message_at: string;
  unread_count: number;
  ai_enabled: boolean;
};

type Message = {
  id: number;
  conversation_id: number;
  sender: "customer" | "ai" | "staff";
  message_text: string;
  status: string;
  created_at: string;
};

export default function WhatsAppAdminPage() {
  const router = useRouter();
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const [hotelSettings, setHotelSettings] = useState({ hotelName: "HOTEL AADVIK INN" });

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConv, setSelectedConv] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);

  const [searchQuery, setSearchQuery] = useState("");
  const [filterTab, setFilterTab] = useState<"All" | "Unread">("All");

  const [staffMessage, setStaffMessage] = useState("");
  const [isSending, setIsSending] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

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
        fetchConversations();
      }
    };
    checkSession();
  }, [router]);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const fetchConversations = async () => {
    try {
      const { data, error } = await supabase
        .from("WhatsAppConversations")
        .select("*")
        .order("last_message_at", { ascending: false });

      if (!error && data) {
        setConversations(data);
        if (!selectedConv && data.length > 0) {
          setSelectedConv(data[0]);
          fetchMessages(data[0].id);
        }
      }
    } catch (e) {
      console.error("Fetch conversations error:", e);
    }
  };

  const fetchMessages = async (convId: number) => {
    setIsLoadingMessages(true);
    try {
      const { data, error } = await supabase
        .from("WhatsAppMessages")
        .select("*")
        .eq("conversation_id", convId)
        .order("created_at", { ascending: true });

      if (!error && data) {
        setMessages(data);
      }
    } catch (e) {
      console.error("Fetch messages error:", e);
    } finally {
      setIsLoadingMessages(false);
    }
  };

  const handleSelectConversation = (conv: Conversation) => {
    setSelectedConv(conv);
    fetchMessages(conv.id);

    // Mark as read in DB
    if (conv.unread_count > 0) {
      supabase
        .from("WhatsAppConversations")
        .update({ unread_count: 0 })
        .eq("id", conv.id)
        .then(() => {
          setConversations(prev =>
            prev.map(c => (c.id === conv.id ? { ...c, unread_count: 0 } : c))
          );
        });
    }
  };

  const handleToggleAi = async () => {
    if (!selectedConv) return;
    const newStatus = !selectedConv.ai_enabled;

    const { error } = await supabase
      .from("WhatsAppConversations")
      .update({ ai_enabled: newStatus })
      .eq("id", selectedConv.id);

    if (!error) {
      setSelectedConv(prev => prev ? { ...prev, ai_enabled: newStatus } : null);
      setConversations(prev =>
        prev.map(c => (c.id === selectedConv.id ? { ...c, ai_enabled: newStatus } : c))
      );
    }
  };

  const handleSendStaffMessage = async (textToSend?: string) => {
    const text = (textToSend || staffMessage).trim();
    if (!text || !selectedConv || isSending) return;

    setIsSending(true);
    try {
      const res = await fetch("/api/whatsapp/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: selectedConv.customer_phone,
          guestName: selectedConv.customer_name,
          bookingId: selectedConv.booking_id,
          customMessage: text,
          sender: "staff"
        })
      });

      if (res.ok) {
        setStaffMessage("");
        fetchMessages(selectedConv.id);
        fetchConversations();
      } else {
        alert("Failed to send message. Check console or credentials.");
      }
    } catch (e) {
      console.error("Staff send error:", e);
    } finally {
      setIsSending(false);
    }
  };

  // Quick reply buttons
  const sendQuickReply = (type: string) => {
    if (!selectedConv) return;
    let reply = "";
    if (type === "wifi") {
      reply = `📶 *Hotel Aadvik Wi-Fi Details:*\nNetwork: *AadvikGuest*\nPassword: *Aadvik@2026*\nHigh-speed internet is active in your room! 🙏`;
    } else if (type === "checkout") {
      reply = `⏰ *Check-out Reminder:*\nStandard check-out time is *11:00 AM*. Please inform reception if you need luggage storage or late check-out. 🙏`;
    } else if (type === "location") {
      reply = `📍 *Hotel Location:*\nHaridwar Bypass Road, Near Railway Station, Haridwar.\nReception Contact: +91 9876543210. E-rickshaw to Har Ki Pauri takes 10 mins. 🗺️`;
    } else if (type === "food") {
      reply = `🍽️ *Dining & Room Service:*\nKitchen is open until *10:30 PM*. Please call frontdesk dial '9' to order fresh pure vegetarian food! 🍲`;
    }
    handleSendStaffMessage(reply);
  };

  const filteredConversations = conversations.filter(c => {
    const matchesSearch =
      c.customer_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.customer_phone.includes(searchQuery) ||
      (c.booking_id && c.booking_id.toString().includes(searchQuery));
    const matchesTab = filterTab === "All" || (filterTab === "Unread" && c.unread_count > 0);
    return matchesSearch && matchesTab;
  });

  // Calculate statistics
  const totalConversations = conversations.length;
  const aiAutoRepliesCount = messages.filter(m => m.sender === "ai").length;
  const activeAiCount = conversations.filter(c => c.ai_enabled).length;

  if (isCheckingSession) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-slate-50 flex-col md:flex-row relative min-w-0">
      <AdminSidebar activePath="/admin/whatsapp" hotelName={hotelSettings.hotelName} />

      <main className="flex-1 flex flex-col min-w-0 overflow-hidden z-0">
        <main className="flex-1 p-4 md:p-8 overflow-y-auto overflow-x-hidden">
          <div className="max-w-7xl mx-auto space-y-6">

            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 py-2 border-b border-slate-200 pb-6 mb-2">
              <div>
                <div className="flex items-center gap-3">
                  <h1 className="text-2xl font-bold text-[#0F172A] tracking-tight">WhatsApp AI Concierge & Inbox</h1>
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                    AI Active
                  </span>
                </div>
                <p className="text-slate-500 mt-1 text-sm">
                  Automated booking confirmations & AI-powered guest support for {hotelSettings.hotelName}.
                </p>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={fetchConversations}
                  className="w-10 h-10 bg-white hover:bg-slate-50 border border-slate-200 text-slate-600 rounded-full flex items-center justify-center shadow-sm transition"
                  title="Refresh Conversations"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Analytics Stats Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-slate-400 text-xs font-bold uppercase tracking-wider">Total Guests</p>
                  <div className="w-8 h-8 bg-blue-50 text-blue-600 rounded-lg flex items-center justify-center font-bold text-sm">
                    💬
                  </div>
                </div>
                <h3 className="text-3xl font-black text-slate-800">{totalConversations}</h3>
                <p className="text-xs text-slate-400 mt-1 font-medium">WhatsApp conversations</p>
              </div>

              <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-slate-400 text-xs font-bold uppercase tracking-wider">AI Bot Status</p>
                  <div className="w-8 h-8 bg-purple-50 text-purple-600 rounded-lg flex items-center justify-center font-bold text-sm">
                    🤖
                  </div>
                </div>
                <h3 className="text-3xl font-black text-indigo-700">{activeAiCount} Active</h3>
                <p className="text-xs text-slate-400 mt-1 font-medium">Auto-answering questions</p>
              </div>

              <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-slate-400 text-xs font-bold uppercase tracking-wider">Confirmations Sent</p>
                  <div className="w-8 h-8 bg-emerald-50 text-emerald-600 rounded-lg flex items-center justify-center font-bold text-sm">
                    ✅
                  </div>
                </div>
                <h3 className="text-3xl font-black text-emerald-600">{totalConversations}</h3>
                <p className="text-xs text-slate-400 mt-1 font-medium">Check-in receipts logged</p>
              </div>

              <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-slate-400 text-xs font-bold uppercase tracking-wider">Daily Meta Quota</p>
                  <div className="w-8 h-8 bg-amber-50 text-amber-600 rounded-lg flex items-center justify-center font-bold text-sm">
                    ⚡
                  </div>
                </div>
                <h3 className="text-3xl font-black text-slate-800">250 Messages</h3>
                <p className="text-xs text-emerald-600 mt-1 font-semibold">Tier 1 standard limit / day</p>
              </div>
            </div>

            {/* WhatsApp Web Two-Panel Chat UI */}
            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden grid grid-cols-1 md:grid-cols-12 h-[680px]">

              {/* Left Panel: Conversation List (4 columns) */}
              <div className="md:col-span-4 border-r border-slate-200 flex flex-col h-full bg-white">
                {/* Search & Tabs */}
                <div className="p-4 border-b border-slate-100 space-y-3">
                  <div className="relative">
                    <svg className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    <input
                      type="text"
                      placeholder="Search guest or phone..."
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-700"
                    />
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => setFilterTab("All")}
                      className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition ${
                        filterTab === "All" ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                      }`}
                    >
                      All Chats ({conversations.length})
                    </button>
                    <button
                      onClick={() => setFilterTab("Unread")}
                      className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition ${
                        filterTab === "Unread" ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                      }`}
                    >
                      Unread ({conversations.filter(c => c.unread_count > 0).length})
                    </button>
                  </div>
                </div>

                {/* Conversation List Items */}
                <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
                  {filteredConversations.length === 0 ? (
                    <div className="p-8 text-center text-slate-400 text-sm">
                      <p className="font-semibold text-slate-500">No conversations yet</p>
                      <p className="text-xs mt-1">Bookings from the frontdesk will automatically appear here.</p>
                    </div>
                  ) : (
                    filteredConversations.map(conv => {
                      const isSelected = selectedConv?.id === conv.id;
                      return (
                        <div
                          key={conv.id}
                          onClick={() => handleSelectConversation(conv)}
                          className={`p-4 cursor-pointer transition flex items-start gap-3 ${
                            isSelected ? "bg-indigo-50/60 border-l-4 border-indigo-600" : "hover:bg-slate-50"
                          }`}
                        >
                          <div className="w-10 h-10 rounded-full bg-slate-200 text-slate-700 font-bold flex items-center justify-center shrink-0">
                            {conv.customer_name ? conv.customer_name.charAt(0).toUpperCase() : "G"}
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-0.5">
                              <h4 className="text-sm font-bold text-slate-800 truncate">{conv.customer_name}</h4>
                              <span className="text-[10px] text-slate-400">
                                {new Date(conv.last_message_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                              </span>
                            </div>

                            <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-1">
                              <span>+{conv.customer_phone}</span>
                              {conv.booking_id && (
                                <span className="bg-slate-100 text-slate-600 px-1.5 py-0.2 rounded text-[10px] font-semibold">
                                  #{conv.booking_id}
                                </span>
                              )}
                            </div>

                            <p className="text-xs text-slate-500 truncate">
                              {conv.last_message || "No messages yet"}
                            </p>
                          </div>

                          {conv.unread_count > 0 && (
                            <span className="bg-emerald-500 text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center shrink-0">
                              {conv.unread_count}
                            </span>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Right Panel: Chat Stream (8 columns) */}
              <div className="md:col-span-8 flex flex-col h-full bg-slate-50/40">
                {selectedConv ? (
                  <>
                    {/* Chat Header */}
                    <div className="p-4 bg-white border-b border-slate-200 flex items-center justify-between shadow-sm">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-indigo-100 text-indigo-700 font-bold flex items-center justify-center">
                          {selectedConv.customer_name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="text-base font-bold text-slate-800">{selectedConv.customer_name}</h3>
                            {selectedConv.booking_id && (
                              <span className="bg-indigo-50 text-indigo-700 text-xs px-2 py-0.5 rounded-full font-bold">
                                Booking #{selectedConv.booking_id}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-500">+{selectedConv.customer_phone}</p>
                        </div>
                      </div>

                      {/* AI Switch & Manual Re-send */}
                      <div className="flex items-center gap-3">
                        <button
                          onClick={handleToggleAi}
                          className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold transition border ${
                            selectedConv.ai_enabled
                              ? "bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100"
                              : "bg-slate-100 text-slate-500 border-slate-200 hover:bg-slate-200"
                          }`}
                          title="Toggle AI Auto-reply for this guest"
                        >
                          <span>🤖</span>
                          AI Assistant: {selectedConv.ai_enabled ? "ON" : "OFF"}
                        </button>
                      </div>
                    </div>

                    {/* Messages Area */}
                    <div className="flex-1 p-6 overflow-y-auto space-y-4">
                      {isLoadingMessages ? (
                        <div className="text-center py-12 text-slate-400 text-sm">
                          Loading message history...
                        </div>
                      ) : messages.length === 0 ? (
                        <div className="text-center py-12 text-slate-400 text-sm">
                          No messages in this chat yet.
                        </div>
                      ) : (
                        messages.map(msg => {
                          const isCustomer = msg.sender === "customer";
                          const isAi = msg.sender === "ai";
                          const isStaff = msg.sender === "staff";

                          return (
                            <div
                              key={msg.id}
                              className={`flex flex-col ${isCustomer ? "items-start" : "items-end"}`}
                            >
                              <div
                                className={`max-w-[80%] sm:max-w-[70%] p-4 rounded-2xl shadow-sm text-sm leading-relaxed whitespace-pre-line ${
                                  isCustomer
                                    ? "bg-white border border-slate-200 text-slate-800 rounded-tl-none"
                                    : isAi
                                    ? "bg-indigo-600 text-white rounded-tr-none shadow-indigo-100"
                                    : "bg-emerald-600 text-white rounded-tr-none"
                                }`}
                              >
                                <div className="flex items-center justify-between gap-4 mb-1 border-b pb-1 border-white/20 text-[11px] font-semibold opacity-90">
                                  <span>
                                    {isCustomer ? "👤 Guest" : isAi ? "🤖 AI Receptionist" : "👔 Staff (You)"}
                                  </span>
                                  <span>
                                    {new Date(msg.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                                  </span>
                                </div>
                                {msg.message_text}
                              </div>
                            </div>
                          );
                        })
                      )}
                      <div ref={messagesEndRef} />
                    </div>

                    {/* Quick Reply Chips */}
                    <div className="px-4 py-2 bg-white border-t border-slate-100 flex items-center gap-2 overflow-x-auto no-scrollbar">
                      <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider shrink-0">Quick Send:</span>
                      <button
                        onClick={() => sendQuickReply("wifi")}
                        className="text-xs px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg shrink-0 font-medium transition"
                      >
                        📶 Wi-Fi
                      </button>
                      <button
                        onClick={() => sendQuickReply("checkout")}
                        className="text-xs px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg shrink-0 font-medium transition"
                      >
                        ⏰ Check-out Time
                      </button>
                      <button
                        onClick={() => sendQuickReply("location")}
                        className="text-xs px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg shrink-0 font-medium transition"
                      >
                        📍 Location / Map
                      </button>
                      <button
                        onClick={() => sendQuickReply("food")}
                        className="text-xs px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg shrink-0 font-medium transition"
                      >
                        🍽️ Food & Menu
                      </button>
                    </div>

                    {/* Chat Input */}
                    <div className="p-4 bg-white border-t border-slate-200 flex items-center gap-3">
                      <input
                        type="text"
                        placeholder="Type a manual reply as Hotel Staff..."
                        value={staffMessage}
                        onChange={e => setStaffMessage(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault();
                            handleSendStaffMessage();
                          }
                        }}
                        className="flex-1 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800"
                      />
                      <button
                        onClick={() => handleSendStaffMessage()}
                        disabled={isSending || !staffMessage.trim()}
                        className="px-5 py-3 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold rounded-xl text-sm transition flex items-center gap-2 shrink-0 shadow-sm"
                      >
                        {isSending ? (
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        ) : (
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                          </svg>
                        )}
                        Send
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
                    <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center text-3xl mb-4">
                      💬
                    </div>
                    <h3 className="text-lg font-bold text-slate-700">Select a Guest Conversation</h3>
                    <p className="text-sm text-slate-400 mt-1 max-w-sm">
                      Choose a customer from the left to view messages, toggle AI auto-replies, or send manual messages.
                    </p>
                  </div>
                )}
              </div>

            </div>

          </div>
        </main>
      </main>
    </div>
  );
}
