"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/utils/supabase";

type Booking = {
  id: number;
  created_at: string;
  check_in_date: string;
  check_out_date: string;
  status: string;
  total_amount?: number;
  agreed_price?: number;
  room_number?: string;
  payment_mode?: string;
};

type Guest = {
  id: number;
  booking_id: number;
  name: string;
  age: number;
  id_image_url: string;
  id_image_back_url?: string;
  phone: string;
};

type MergedBookingData = Booking & {
  primary_guest_name: string;
  primary_guest_phone: string;
  total_guests: number;
  guests: Guest[];
};

import dynamic from "next/dynamic";
import AdminSidebar from "@/components/AdminSidebar";

function AdminDashboard() {
  const router = useRouter();
  
  // Auth & Settings state
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const [hotelSettings, setHotelSettings] = useState({
    hotelName: "HOTEL AADVIK INN",
    hotelAddress: "OPP VERTERNITY HOSPITAL HARIDWAR 249401",
    gstin: "",
    contact: "+91 9719350125",
    gstPercentage: 0,
    extraBedCharge: 350
  });
  
  // Data state
  const [data, setData] = useState<MergedBookingData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [totalExpensesToday, setTotalExpensesToday] = useState(0);
  const [agentOutstanding, setAgentOutstanding] = useState(0);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState<MergedBookingData | null>(null);
  const [roomNumber, setRoomNumber] = useState("");
  const [roomType, setRoomType] = useState("");
  const [ratePerNight, setRatePerNight] = useState("");
  const [isExtraBed, setIsExtraBed] = useState(false);
  const [extraHours, setExtraHours] = useState("");
  const [extraHoursAmount, setExtraHoursAmount] = useState("");
  const [paymentMode, setPaymentMode] = useState("Cash");
  const [guestGst, setGuestGst] = useState("");
  const [isDownloading, setIsDownloading] = useState(false);
  const [isGuestsModalOpen, setIsGuestsModalOpen] = useState(false);
  const [selectedBookingForGuests, setSelectedBookingForGuests] = useState<MergedBookingData | null>(null);

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState("");
  const [dateFilter, setDateFilter] = useState("Today");
  const [customStartDate, setCustomStartDate] = useState("");
  const [customEndDate, setCustomEndDate] = useState("");

  // Edit Modal State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingBooking, setEditingBooking] = useState<MergedBookingData | null>(null);
  const [editCheckIn, setEditCheckIn] = useState("");
  const [editCheckOut, setEditCheckOut] = useState("");
  const [editRoomNumber, setEditRoomNumber] = useState("");
  const [editAgreedPrice, setEditAgreedPrice] = useState("");
  const [editGuests, setEditGuests] = useState<Guest[]>([]);

  const invoiceRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Load Settings
    if (typeof window !== "undefined") {
      const savedSettings = localStorage.getItem("hotelAadvikSettings");
      if (savedSettings) {
        try {
          setHotelSettings(JSON.parse(savedSettings));
        } catch (e) {}
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

    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT" || !session) {
        router.push("/admin/login");
      }
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, [router]);

  const fetchData = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const { data: bookingsData, error: bookingsError } = await supabase
        .from("Bookings")
        .select("*")
        .order("created_at", { ascending: false });

      if (bookingsError) throw new Error(bookingsError.message);

      const { data: guestsData, error: guestsError } = await supabase
        .from("Guests")
        .select("*")
        .order("id", { ascending: true });

      if (guestsError) throw new Error(guestsError.message);

      const merged: MergedBookingData[] = (bookingsData || []).map((booking: Booking) => {
        const relatedGuests = (guestsData || []).filter(
          (g: Guest) => g.booking_id === booking.id
        );
        
        const primaryGuestName = relatedGuests.length > 0 
          ? relatedGuests[0].name 
          : "Unknown";
          
        const primaryGuestPhone = relatedGuests.length > 0 
          ? relatedGuests[0].phone 
          : "";

        return {
          ...booking,
          primary_guest_name: primaryGuestName,
          primary_guest_phone: primaryGuestPhone,
          total_guests: relatedGuests.length,
          guests: relatedGuests
        };
      });

      setData(merged);

      // Fetch today's expenses
      const todayDateStr = new Date().toISOString().split('T')[0];
      const { data: expensesData, error: expensesError } = await supabase
        .from("Expenses")
        .select("amount")
        .eq("date", todayDateStr);
      
      if (!expensesError && expensesData) {
        const todayExp = expensesData.reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0);
        setTotalExpensesToday(todayExp);
      }

      // Fetch agents outstanding
      const { data: agentsData, error: agentsError } = await supabase
        .from("Agents")
        .select("total_credit, total_paid");

      if (!agentsError && agentsData) {
        const outstanding = agentsData.reduce((acc, curr) => {
           return acc + ((Number(curr.total_credit) || 0) - (Number(curr.total_paid) || 0));
        }, 0);
        setAgentOutstanding(outstanding);
      }
    } catch (err: any) {
      console.error(err);
      setError("Failed to fetch data. Ensure your session is valid and RLS allows SELECT.");
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setIsRefreshing(true);
    fetchData();
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/admin/login");
  };

  const handleDeleteBooking = async (bookingId: number) => {
    const password = window.prompt("Enter admin password to delete this booking:");
    if (password === null) return;
    
    if (password !== "admin1458") {
      alert("Incorrect password! Access denied.");
      return;
    }

    if (window.confirm("Are you sure you want to permanently delete this booking?")) {
      try {
        const { error: guestError } = await supabase.from('Guests').delete().eq('booking_id', bookingId);
        if (guestError) throw guestError;

        const { error: bookingError } = await supabase.from('Bookings').delete().eq('id', bookingId);
        if (bookingError) throw bookingError;

        alert("Booking deleted successfully.");
        fetchData();
      } catch (err: any) {
        console.error("Error deleting booking:", err);
        alert("Failed to delete booking: " + err.message);
      }
    }
  };

  const openEditModal = (booking: MergedBookingData) => {
    setEditingBooking(booking);
    setEditCheckIn(booking.check_in_date);
    setEditCheckOut(booking.check_out_date);
    setEditRoomNumber(booking.room_number || "");
    setEditAgreedPrice(booking.agreed_price ? booking.agreed_price.toString() : "");
    setEditGuests(JSON.parse(JSON.stringify(booking.guests)));
    setIsEditModalOpen(true);
  };

  const handleEditGuestChange = (guestId: number, field: 'name' | 'age', value: string) => {
    setEditGuests(prev => 
      prev.map(g => g.id === guestId ? { ...g, [field]: field === 'age' ? parseInt(value) || 0 : value } : g)
    );
  };

  const handleSaveEdit = async () => {
    if (!editingBooking) return;
    try {
      setIsLoading(true);
      const { error: bookingError } = await supabase
        .from('Bookings')
        .update({ 
          check_in_date: editCheckIn, 
          check_out_date: editCheckOut,
          room_number: editRoomNumber || null,
          agreed_price: editAgreedPrice ? parseFloat(editAgreedPrice) : null
        })
        .eq('id', editingBooking.id);
      
      if (bookingError) throw bookingError;

      for (const guest of editGuests) {
        const { error: guestError } = await supabase
          .from('Guests')
          .update({ name: guest.name, age: guest.age })
          .eq('id', guest.id);
        if (guestError) throw guestError;
      }

      alert("Booking updated successfully!");
      setIsEditModalOpen(false);
      fetchData();
    } catch (err: any) {
      console.error("Error saving edits:", err);
      alert("Failed to save changes: " + err.message);
      setIsLoading(false);
    }
  };

  const openGuestsModal = (booking: MergedBookingData) => {
    setSelectedBookingForGuests(booking);
    setIsGuestsModalOpen(true);
  };

  const openBillModal = (booking: MergedBookingData) => {
    setSelectedBooking(booking);
    setRoomNumber("");
    setRoomType("");
    setRatePerNight("");
    setPaymentMode("Cash");
    setGuestGst("");
    setExtraHours("");
    setExtraHoursAmount("");
    setIsModalOpen(true);
  };

  const handleDownloadPDF = async () => {
    if (!selectedBooking) return;
    setIsDownloading(true);
    try {
      const element = invoiceRef.current;
      if (!element) throw new Error("Invoice template not found");

      // Create a temporary print container with the invoice clone
      const printContainer = document.createElement('div');
      printContainer.id = 'print-container';
      printContainer.appendChild(element.cloneNode(true));
      document.body.appendChild(printContainer);

      // Print and clean up
      window.print();

      document.body.removeChild(printContainer);

      // Update booking status and payment_mode in Supabase
      try {
        await supabase.from("Bookings").update({ status: 'Checked-Out', payment_mode: paymentMode }).eq('id', selectedBooking.id);
        fetchData();
      } catch (err) {
        console.error("Failed to update status:", err);
      }

      setIsModalOpen(false);
      setIsDownloading(false);

    } catch (err: any) {
      console.error("PDF Initialization failed:", err);
      alert("Failed to start PDF: " + (err?.message || JSON.stringify(err)));
      setIsDownloading(false);
    }
  };

  // Calculations for Live Preview
  const getCalculations = () => {
    if (!selectedBooking) return { checkIn: "", checkOut: "", duration: 1, rate: 0, subtotal: 0, gstAmount: 0, grandTotal: 0, advance: 0, balance: 0, extraBedTotal: 0, extraHours: "0", extraHoursTotal: 0 };
    
    const checkInDate = new Date(selectedBooking.check_in_date);
    const checkOutDate = new Date(selectedBooking.check_out_date);
    const diffTime = Math.abs(checkOutDate.getTime() - checkInDate.getTime());
    let duration = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    if (duration === 0) duration = 1;

    const rate = parseFloat(ratePerNight) || 0;
    const extraBedTotal = isExtraBed ? ((hotelSettings.extraBedCharge || 350) * duration) : 0;
    
    const extraHoursTotal = parseFloat(extraHoursAmount) || 0;
    const subtotal = (rate * duration) + extraBedTotal + extraHoursTotal;
    const gstAmount = subtotal * ((hotelSettings.gstPercentage || 0) / 100);
    const grandTotal = subtotal + gstAmount;

    return {
      checkIn: checkInDate.toLocaleDateString(),
      checkOut: checkOutDate.toLocaleDateString(),
      duration,
      rate,
      subtotal,
      gstAmount,
      grandTotal,
      extraBedTotal,
      extraHours: extraHours || "0",
      extraHoursTotal
    };
  };

  const calc = getCalculations();

  const filteredData = data.filter((booking) => {
    const query = searchQuery.toLowerCase();
    const matchesSearch = 
      booking.id.toString().includes(query) || 
      booking.primary_guest_name.toLowerCase().includes(query);

    let matchesDate = true;
    if (dateFilter !== "All Time") {
      const today = new Date();
      today.setHours(0,0,0,0);

      const bookingDate = new Date(booking.check_in_date);
      bookingDate.setHours(0,0,0,0);

      if (dateFilter === "Today") {
        matchesDate = bookingDate.getTime() === today.getTime();
      } else if (dateFilter === "This Week") {
        const firstDayOfWeek = new Date(today.getTime());
        firstDayOfWeek.setDate(today.getDate() - today.getDay());
        matchesDate = bookingDate >= firstDayOfWeek;
      } else if (dateFilter === "This Month") {
        matchesDate = bookingDate.getMonth() === today.getMonth() && bookingDate.getFullYear() === today.getFullYear();
      } else if (dateFilter === "Custom Range") {
        const start = customStartDate ? new Date(customStartDate) : null;
        if (start) start.setHours(0,0,0,0);
        const end = customEndDate ? new Date(customEndDate) : null;
        if (end) end.setHours(23,59,59,999);
        
        if (start && end) {
          matchesDate = bookingDate >= start && bookingDate <= end;
        } else if (start) {
          matchesDate = bookingDate >= start;
        } else if (end) {
          matchesDate = bookingDate <= end;
        }
      }
    }

    return matchesSearch && matchesDate;
  });

  if (isCheckingSession) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-600 mb-4"></div>
        <p className="text-gray-500 font-medium">Verifying access...</p>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-slate-50 flex-col md:flex-row relative min-w-0">
      <AdminSidebar activePath="/admin" hotelName={hotelSettings.hotelName} />

      <main className="flex-1 flex flex-col min-w-0 overflow-hidden z-0">
        <main className="flex-1 p-4 md:p-8 overflow-y-auto overflow-x-hidden">
          <div className="max-w-7xl mx-auto space-y-6">
            {/* Clean Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 py-2 border-b border-slate-200 pb-6 mb-6">
              <div>
                <h1 className="text-2xl font-bold text-[#0F172A] tracking-tight">Dashboard</h1>
                <p className="text-slate-500 mt-1 text-sm">Here's what's happening at {hotelSettings.hotelName} today.</p>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={handleRefresh}
                  disabled={isRefreshing}
                  className="flex items-center justify-center w-10 h-10 bg-white hover:bg-slate-50 border border-slate-200 text-slate-500 rounded-full transition-all"
                  title="Refresh Data"
                >
                  <svg className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-[#3B82F6]' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Quick Stats Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
              {/* Bookings card */}
              <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <p className="text-slate-500 text-xs font-semibold uppercase tracking-widest">Total Bookings</p>
                    <div className="w-8 h-8 bg-blue-50 text-[#3B82F6] rounded flex items-center justify-center">
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0z"/></svg>
                    </div>
                  </div>
                  <div className="flex items-baseline gap-3">
                    <h2 className="text-5xl font-bold text-[#0F172A] tracking-tight">{filteredData.length}</h2>
                    <span className="text-xs font-medium text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full flex items-center gap-1">
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>
                      Active
                    </span>
                  </div>
                </div>
                <p className="text-slate-400 text-xs mt-6">
                  {filteredData.filter(b => b.status !== 'Checked-Out').length} currently active
                </p>
              </div>

              {/* Guests card */}
              <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <p className="text-slate-500 text-xs font-semibold uppercase tracking-widest">Total Guests</p>
                    <div className="w-8 h-8 bg-emerald-50 text-emerald-500 rounded flex items-center justify-center">
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z"/></svg>
                    </div>
                  </div>
                  <h2 className="text-5xl font-bold text-[#0F172A] tracking-tight">{filteredData.reduce((acc, curr) => acc + curr.total_guests, 0)}</h2>
                </div>
                <p className="text-slate-400 text-xs mt-6">
                  Recorded across all entries
                </p>
              </div>

              {/* Revenue card */}
              <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <p className="text-slate-500 text-xs font-semibold uppercase tracking-widest">Gross Revenue</p>
                    <div className="w-8 h-8 bg-[#C5A059]/10 text-[#C5A059] rounded flex items-center justify-center">
                      <span className="font-bold text-sm">₹</span>
                    </div>
                  </div>
                  <h2 className="text-4xl font-bold text-[#0F172A] tracking-tight">₹{filteredData.reduce((acc, curr) => acc + (Number(curr.agreed_price) || 0), 0).toLocaleString('en-IN')}</h2>
                </div>
                
                <div className="mt-6">
                  {(() => {
                    const total = filteredData.reduce((acc, curr) => acc + (Number(curr.agreed_price) || 0), 0);
                    const cash = filteredData.reduce((acc, curr) => curr.payment_mode === 'Credit' ? acc : acc + (Number(curr.agreed_price) || 0), 0);
                    const credit = total - cash;
                    const cashPct = total === 0 ? 0 : Math.round((cash / total) * 100);
                    const creditPct = total === 0 ? 0 : 100 - cashPct;
                    return (
                      <>
                        <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden flex">
                          <div className="h-full bg-[#0F172A]" style={{ width: `${cashPct}%` }}></div>
                          <div className="h-full bg-[#C5A059]" style={{ width: `${creditPct}%` }}></div>
                        </div>
                        <div className="flex justify-between mt-2 text-[10px] font-semibold text-slate-500 uppercase">
                          <span>{cashPct}% Cash</span>
                          <span>{creditPct}% Credit</span>
                        </div>
                      </>
                    );
                  })()}
                </div>
              </div>
            </div>

            {/* Secondary Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm flex flex-col justify-center">
                <p className="text-slate-500 text-xs font-semibold uppercase tracking-widest mb-2">Today's Expenses</p>
                <h3 className="text-3xl font-bold text-rose-600">₹{totalExpensesToday.toLocaleString('en-IN')}</h3>
              </div>
              
              <div className="bg-[#0F172A] border border-slate-800 rounded-xl p-6 shadow-md flex flex-col justify-center relative overflow-hidden group cursor-pointer" onClick={() => router.push('/admin/agents')}>
                <div className="absolute top-0 right-0 w-32 h-32 bg-[#C5A059]/10 rounded-bl-full -mr-8 -mt-8 transition-transform group-hover:scale-110"></div>
                <div className="relative z-10">
                  <h3 className="text-lg font-bold text-white mb-1">Agent Outstanding</h3>
                  <p className="text-slate-400 text-sm mb-4">Total pending commissions</p>
                  <div className="flex items-center gap-3">
                    <span className="bg-white text-[#0F172A] px-4 py-1.5 rounded text-sm font-bold">
                      ₹{agentOutstanding.toLocaleString('en-IN')}
                    </span>
                  </div>
                </div>
              </div>
            </div>

          {error && (
            <div className="mb-6 p-4 bg-red-50 text-red-600 rounded-xl border border-red-200 flex items-center gap-3">
              <svg className="w-5 h-5 shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd"/></svg>
              {error}
            </div>
          )}

          {/* Bookings Table Section */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="px-6 pt-6 pb-4 border-b border-slate-100">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                  <h2 className="text-lg font-bold text-slate-800">Booking Records</h2>
                  <p className="text-sm text-slate-400 mt-0.5">{filteredData.length} entries found</p>
                </div>
                <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
                  <div className="relative w-full sm:w-72">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                    </div>
                    <input
                      type="text"
                      placeholder="Search by name or ID..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-9 w-full py-2.5 px-4 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all outline-none text-slate-700"
                    />
            </div>
            
            <div className="w-full sm:w-auto flex flex-col sm:flex-row items-center gap-2">
              <select
                value={dateFilter}
                onChange={(e) => {
                  setDateFilter(e.target.value);
                  if (e.target.value !== "Custom Range") {
                    setCustomStartDate("");
                    setCustomEndDate("");
                  }
                }}
                className="w-full sm:w-auto py-2.5 px-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none font-semibold text-slate-700"
              >
                <option value="All Time">All Time</option>
                <option value="Today">Today's Check-ins</option>
                <option value="This Week">This Week</option>
                <option value="This Month">This Month</option>
                <option value="Custom Range">Custom Date Range</option>
              </select>

              {dateFilter === "Custom Range" && (
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <input
                    type="date"
                    value={customStartDate}
                    onChange={(e) => setCustomStartDate(e.target.value)}
                    className="w-full sm:w-auto py-2.5 px-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none font-medium text-slate-700"
                    title="Start Date"
                  />
                  <span className="text-slate-400 font-medium text-sm">to</span>
                  <input
                    type="date"
                    value={customEndDate}
                    onChange={(e) => setCustomEndDate(e.target.value)}
                    className="w-full sm:w-auto py-2.5 px-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none font-medium text-slate-700"
                    title="End Date"
                  />
                </div>
              )}
            </div>
                </div>
              </div>
            </div>

            <div className="overflow-x-auto w-full">
              <table className="min-w-[900px] w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100">
                    <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Booking ID</th>
                    <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Primary Guest</th>
                    <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Check In</th>
                    <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Check-Out</th>
                    <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Room No</th>
                    <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Agreed Price</th>
                    <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Total Guests</th>
                    <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {isLoading ? (
                    <tr>
                      <td colSpan={7} className="px-6 py-12 text-center text-gray-400">
                        <div className="flex justify-center mb-2">
                          <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-indigo-500"></div>
                        </div>
                        Loading bookings...
                      </td>
                    </tr>
                  ) : filteredData.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-6 py-12 text-center text-gray-400">
                        No bookings found matching your filters.
                      </td>
                    </tr>
                  ) : (
                    filteredData.map((booking) => (
                      <tr key={booking.id} className="hover:bg-gray-50/50 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-indigo-600">
                          #{booking.id}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-800 font-medium">
                          {booking.primary_guest_name}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                          {new Date(booking.check_in_date).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                          {new Date(booking.check_out_date).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-800">
                          {booking.room_number || '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-emerald-600 font-bold">
                          {booking.agreed_price ? `Rs. ${booking.agreed_price}` : '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                          <span className="bg-gray-100 text-gray-700 py-1 px-3 rounded-full text-xs font-semibold">
                            {booking.total_guests} Guest{booking.total_guests !== 1 ? 's' : ''}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          {booking.status === 'Checked-Out' ? (
                            <span className="bg-gray-100 text-gray-600 py-1 px-3 rounded-full text-xs font-bold uppercase tracking-wider">Checked-Out</span>
                          ) : (
                            <span className="bg-green-100 text-green-700 py-1 px-3 rounded-full text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 w-max">
                              <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span>
                              Checked-In
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-center">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() => openGuestsModal(booking)}
                              className="inline-flex items-center gap-1.5 bg-white border border-gray-200 text-gray-700 hover:text-emerald-600 hover:border-emerald-200 px-3 py-1.5 rounded-md text-xs font-medium shadow-sm transition-all hover:shadow"
                              title="View IDs"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                              </svg>
                              View IDs
                            </button>
                            <button
                              onClick={() => openBillModal(booking)}
                              className="inline-flex items-center gap-1.5 bg-white border border-gray-200 text-gray-700 hover:text-indigo-600 hover:border-indigo-200 px-3 py-1.5 rounded-md text-xs font-medium shadow-sm transition-all hover:shadow"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                              </svg>
                              Generate Bill
                            </button>
                            <button
                              onClick={() => openEditModal(booking)}
                              className="inline-flex items-center gap-1.5 bg-white border border-amber-200 text-amber-600 hover:bg-amber-50 hover:border-amber-300 px-3 py-1.5 rounded-md text-xs font-medium shadow-sm transition-all hover:shadow"
                              title="Edit Booking"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                            </button>
                            <button
                              onClick={() => handleDeleteBooking(booking.id)}
                              className="inline-flex items-center gap-1.5 bg-white border border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300 px-3 py-1.5 rounded-md text-xs font-medium shadow-sm transition-all hover:shadow"
                              title="Delete Booking"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
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
        </div>
        </main>
      </main>

      {/* Premium Live Preview Bill Generation Modal */}
      {isModalOpen && selectedBooking && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/80 backdrop-blur-sm overflow-hidden"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsModalOpen(false);
          }}
        >
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl max-h-[90vh] flex flex-col md:flex-row overflow-hidden animate-in fade-in zoom-in-95 duration-200 relative">
            
            {/* Left Column: Controls */}
            <div className="w-full md:w-1/3 p-6 border-r border-gray-100 bg-gray-50 overflow-y-auto flex flex-col">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold text-gray-800">Generate PDF Bill</h3>
                <button 
                  onClick={() => setIsModalOpen(false)}
                  className="text-gray-400 hover:text-gray-600 transition-colors p-1"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              
              <div className="space-y-5 flex-1">
                <div>
                  <label className="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-2">Room Number</label>
                  <input
                    type="text"
                    value={roomNumber}
                    onChange={(e) => setRoomNumber(e.target.value)}
                    placeholder="e.g. 101"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-600 focus:border-transparent outline-none transition-all text-sm text-gray-900 bg-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-2">Room Type</label>
                  <input
                    type="text"
                    value={roomType}
                    onChange={(e) => setRoomType(e.target.value)}
                    placeholder="e.g. Deluxe AC"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-600 focus:border-transparent outline-none transition-all text-sm text-gray-900 bg-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-2">Rate per Night (Rs)</label>
                  <input
                    type="number"
                    value={ratePerNight}
                    onChange={(e) => setRatePerNight(e.target.value)}
                    placeholder="e.g. 1500"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-600 focus:border-transparent outline-none transition-all text-sm text-gray-900 bg-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-2">Payment Mode</label>
                  <select
                    value={paymentMode}
                    onChange={(e) => setPaymentMode(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-600 focus:border-transparent outline-none transition-all text-sm text-gray-900 bg-white"
                  >
                    <option value="Cash">Cash</option>
                    <option value="UPI">UPI</option>
                    <option value="Credit Card">Credit Card</option>
                    <option value="Debit Card">Debit Card</option>
                    <option value="Bank Transfer">Bank Transfer</option>
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-2">Extra Hours</label>
                    <input type="number" value={extraHours} onChange={(e) => setExtraHours(e.target.value)} placeholder="e.g. 3" className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-600 outline-none transition-all text-sm text-gray-900 bg-white" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-2">Extra Hrs Charge</label>
                    <input type="number" value={extraHoursAmount} onChange={(e) => setExtraHoursAmount(e.target.value)} placeholder="e.g. 500" className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-600 outline-none transition-all text-sm text-gray-900 bg-white" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-2">Guest GSTIN (Optional)</label>
                  <input
                    type="text"
                    value={guestGst}
                    onChange={(e) => setGuestGst(e.target.value)}
                    placeholder="e.g. 22AAAAA0000A1Z5"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-600 focus:border-transparent outline-none transition-all text-sm text-gray-900 bg-white uppercase"
                  />
                </div>
                <div className="flex items-center mt-2">
                  <input
                    type="checkbox"
                    id="extraBed"
                    checked={isExtraBed}
                    onChange={(e) => setIsExtraBed(e.target.checked)}
                    className="w-4 h-4 text-amber-600 border-gray-300 rounded focus:ring-amber-500 cursor-pointer"
                  />
                  <label htmlFor="extraBed" className="ml-2 text-sm font-bold text-gray-700 cursor-pointer">
                    Add Extra Bed (Rs. {hotelSettings.extraBedCharge || 350}/night)
                  </label>
                </div>
              </div>

              <div className="pt-6 mt-6 border-t border-gray-200">
                <button
                  onClick={handleDownloadPDF}
                  disabled={!roomNumber || !roomType || !ratePerNight || isDownloading}
                  className="w-full flex items-center justify-center gap-2 bg-amber-700 hover:bg-amber-800 text-white font-bold py-4 px-4 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-md hover:shadow-lg"
                >
                  {isDownloading ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Generating PDF...
                    </>
                  ) : (
                    <>
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>
                      Download PDF Bill
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Right Column: Live PDF Preview */}
            <div className="w-full md:w-2/3 bg-gray-300 overflow-auto p-4 md:p-8 flex items-start justify-center relative inner-shadow">
              {/* Actual HTML Template that gets converted */}
              <div 
                ref={invoiceRef}
                id="invoice-template" 
                className="relative shrink-0 flex flex-col bg-white" 
                style={{ width: '210mm', minHeight: '297mm', padding: '15mm 20mm', color: '#0f172a', fontFamily: 'system-ui, -apple-system, sans-serif' }}
              >
                {/* Header */}
                <div className="flex justify-between items-start border-b-2 pb-6 mb-8" style={{ borderColor: '#e2e8f0' }}>
                  <div className="flex items-center gap-4">
                    <img src="/logo.png" alt="Hotel Logo" className="h-20 object-contain" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                    <div>
                      <h1 className="text-3xl font-extrabold tracking-tight" style={{ color: '#0f172a' }}>{hotelSettings.hotelName}</h1>
                      <p className="text-sm font-medium mt-1 text-slate-500">{hotelSettings.hotelAddress}</p>
                      {hotelSettings.gstin && (
                        <p className="text-sm font-semibold mt-1" style={{ color: '#334155' }}>GSTIN: {hotelSettings.gstin}</p>
                      )}
                      <p className="text-xs font-medium mt-1 text-slate-400">Contact: {hotelSettings.contact}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <h2 className="text-4xl font-black uppercase tracking-widest mb-2" style={{ color: '#1e3a8a' }}>INVOICE</h2>
                    <p className="text-sm font-bold" style={{ color: '#475569' }}>INV-{new Date().toISOString().slice(0,10).replace(/-/g,'')}-{selectedBooking.id.toString().padStart(4, '0')}</p>
                    <p className="text-sm font-medium mt-1" style={{ color: '#64748b' }}>Date: {new Date().toLocaleDateString()}</p>
                  </div>
                </div>

                {/* Info Section: Two Columns */}
                <div className="flex justify-between gap-8 mb-8">
                  <div className="w-1/2">
                    <h3 className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: '#94a3b8' }}>Bill To</h3>
                    <p className="font-bold text-lg" style={{ color: '#0f172a' }}>{selectedBooking.primary_guest_name}</p>
                    <p className="font-medium text-sm mt-1" style={{ color: '#475569' }}>Phone: {selectedBooking.primary_guest_phone || '—'}</p>
                    {guestGst && <p className="font-medium text-sm mt-1" style={{ color: '#475569' }}>GSTIN: {guestGst}</p>}
                  </div>
                  <div className="w-1/2 bg-slate-50 p-4 rounded-xl border" style={{ borderColor: '#f1f5f9' }}>
                    <h3 className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: '#94a3b8' }}>Stay Details</h3>
                    <div className="grid grid-cols-2 gap-y-2 text-sm">
                      <p className="font-medium text-slate-500">Check-in:</p>
                      <p className="font-semibold text-slate-800 text-right">{calc.checkIn}</p>
                      <p className="font-medium text-slate-500">Check-out:</p>
                      <p className="font-semibold text-slate-800 text-right">{calc.checkOut}</p>
                      <p className="font-medium text-slate-500">Duration:</p>
                      <p className="font-semibold text-slate-800 text-right">{calc.duration} Night(s)</p>
                      <p className="font-medium text-slate-500">Room Type:</p>
                      <p className="font-semibold text-slate-800 text-right">{roomType || '—'}</p>
                    </div>
                  </div>
                </div>

                {/* Charges Table */}
                <div className="mb-8">
                  <table className="w-full text-left text-sm border-collapse">
                    <thead>
                      <tr className="border-b-2" style={{ borderColor: '#cbd5e1' }}>
                        <th className="py-3 px-2 font-bold uppercase tracking-wider text-xs" style={{ color: '#475569' }}>Description</th>
                        <th className="py-3 px-2 font-bold uppercase tracking-wider text-xs text-center" style={{ color: '#475569' }}>Qty</th>
                        <th className="py-3 px-2 font-bold uppercase tracking-wider text-xs text-right" style={{ color: '#475569' }}>Rate</th>
                        <th className="py-3 px-2 font-bold uppercase tracking-wider text-xs text-right" style={{ color: '#475569' }}>Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-b" style={{ borderColor: '#f1f5f9' }}>
                        <td className="py-4 px-2 font-semibold" style={{ color: '#1e293b' }}>Room Charges (Room {roomNumber || '—'})</td>
                        <td className="py-4 px-2 text-center font-medium text-slate-600">{calc.duration}</td>
                        <td className="py-4 px-2 text-right font-medium text-slate-600">Rs. {calc.rate.toFixed(2)}</td>
                        <td className="py-4 px-2 text-right font-bold text-slate-800">Rs. {(calc.rate * calc.duration).toFixed(2)}</td>
                      </tr>
                      {isExtraBed && (
                        <tr className="border-b" style={{ borderColor: '#f1f5f9' }}>
                          <td className="py-4 px-2 font-semibold" style={{ color: '#1e293b' }}>Extra Bed Charge</td>
                          <td className="py-4 px-2 text-center font-medium text-slate-600">{calc.duration}</td>
                          <td className="py-4 px-2 text-right font-medium text-slate-600">Rs. {(hotelSettings.extraBedCharge || 350).toFixed(2)}</td>
                          <td className="py-4 px-2 text-right font-bold text-slate-800">Rs. {calc.extraBedTotal.toFixed(2)}</td>
                        </tr>
                      )}
                      {calc.extraHoursTotal > 0 && (
                        <tr className="border-b" style={{ borderColor: '#f1f5f9' }}>
                          <td className="py-4 px-2 font-semibold" style={{ color: '#1e293b' }}>Extra Hours Charge ({calc.extraHours} hrs)</td>
                          <td className="py-4 px-2 text-center font-medium text-slate-600">-</td>
                          <td className="py-4 px-2 text-right font-medium text-slate-600">-</td>
                          <td className="py-4 px-2 text-right font-bold text-slate-800">Rs. {calc.extraHoursTotal.toFixed(2)}</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Totals Section */}
                <div className="flex justify-end mb-8">
                  <div className="w-1/2 lg:w-2/5">
                    <div className="flex justify-between py-2 text-sm border-b" style={{ borderColor: '#f1f5f9' }}>
                      <span className="font-semibold text-slate-600">Subtotal</span>
                      <span className="font-bold text-slate-800">Rs. {calc.subtotal.toFixed(2)}</span>
                    </div>
                    {hotelSettings.gstPercentage > 0 && (
                      <div className="flex justify-between py-2 text-sm border-b" style={{ borderColor: '#f1f5f9' }}>
                        <span className="font-semibold text-slate-600">GST ({hotelSettings.gstPercentage}%)</span>
                        <span className="font-bold text-slate-800">Rs. {calc.gstAmount.toFixed(2)}</span>
                      </div>
                    )}
                    <div className="flex justify-between py-4 mt-2 bg-slate-50 px-4 rounded-xl items-center">
                      <span className="font-bold text-lg" style={{ color: '#1e3a8a' }}>Total Due</span>
                      <span className="font-black text-xl" style={{ color: '#1e3a8a' }}>Rs. {calc.grandTotal.toFixed(2)}</span>
                    </div>
                    <div className="text-right mt-2">
                      <span className="inline-block bg-green-100 text-green-800 text-xs px-2.5 py-1 rounded-full font-bold tracking-wide uppercase">
                        PAID VIA {paymentMode}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Footer */}
                <div className="mt-auto pt-8 border-t" style={{ borderColor: '#e2e8f0' }}>
                  <div className="flex justify-between items-end">
                    <div className="w-2/3">
                      <h3 className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: '#94a3b8' }}>Terms & Conditions</h3>
                      <ul className="text-[10px] space-y-1 font-medium text-slate-500 list-inside list-disc">
                        <li>Check-in time is 12:00 Noon. Check-out time is 11:00 AM.</li>
                        <li>Valid Government ID is required for all guests.</li>
                        <li>Any damages to hotel property will be charged to the guest.</li>
                        <li>Strictly no smoking inside the rooms.</li>
                      </ul>
                    </div>
                    <div className="text-right">
                      <div className="mt-8 border-t pt-2 px-6 inline-block" style={{ borderColor: '#94a3b8' }}>
                        <p className="text-xs text-slate-400">Authorized Signatory</p>
                      </div>
                    </div>
                  </div>
                </div>
                
              </div>
            </div>
          </div>
        </div>
      )}

      {/* View Guests / IDs Modal */}
      {isGuestsModalOpen && selectedBookingForGuests && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/80 backdrop-blur-sm overflow-hidden"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsGuestsModalOpen(false);
          }}
        >
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50 shrink-0">
              <h3 className="text-xl font-bold text-gray-800">Guest Details & IDs (Booking #{selectedBookingForGuests.id})</h3>
              <button 
                onClick={() => setIsGuestsModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors p-1"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-6 overflow-y-auto flex-1 bg-gray-50/50">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {selectedBookingForGuests.guests.map((guest, idx) => (
                  <div key={guest.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm flex flex-col">
                    <div className="p-4 border-b border-gray-100 bg-gray-50/50 flex justify-between items-start">
                      <div>
                        <h4 className="font-semibold text-gray-900">{guest.name} {idx === 0 ? "(Primary)" : ""}</h4>
                        <p className="text-xs text-gray-500 mt-1">Age: {guest.age} {guest.phone ? `| Phone: ${guest.phone}` : ''}</p>
                      </div>
                    </div>
                    <div className="p-4 flex-1 flex flex-col gap-4 bg-gray-100 min-h-[250px]">
                      {!guest.id_image_url && !guest.id_image_back_url ? (
                        <div className="flex-1 flex items-center justify-center">
                          <p className="text-gray-400 text-sm font-medium">No ID Image Uploaded</p>
                        </div>
                      ) : (
                        <div className="flex flex-col gap-4">
                          {guest.id_image_url && (
                            <div className="relative group">
                              <p className="text-xs font-semibold text-gray-500 mb-1 uppercase">Front Side</p>
                              <a href={guest.id_image_url} target="_blank" rel="noreferrer" className="block w-full relative cursor-pointer group-hover:shadow-lg transition-all rounded-lg overflow-hidden border border-slate-200">
                                <img loading="lazy" src={guest.id_image_url} alt={`${guest.name} ID Front`} className="w-full object-contain max-h-[250px] bg-white transition-transform duration-500 group-hover:scale-105" />
                                <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity rounded">
                                  <span className="text-white font-medium bg-black/70 px-3 py-1.5 rounded-lg text-xs flex items-center gap-2">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                                    Open Full Size
                                  </span>
                                </div>
                              </a>
                            </div>
                          )}
                          {guest.id_image_back_url && (
                            <div className="relative group pt-4 border-t border-gray-200">
                              <p className="text-xs font-semibold text-gray-500 mb-1 uppercase">Back Side</p>
                              <a href={guest.id_image_back_url} target="_blank" rel="noreferrer" className="block w-full relative cursor-pointer group-hover:shadow-lg transition-all rounded-lg overflow-hidden border border-slate-200">
                                <img loading="lazy" src={guest.id_image_back_url} alt={`${guest.name} ID Back`} className="w-full object-contain max-h-[250px] bg-white transition-transform duration-500 group-hover:scale-105" />
                                <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity rounded">
                                  <span className="text-white font-medium bg-black/70 px-3 py-1.5 rounded-lg text-xs flex items-center gap-2">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                                    Open Full Size
                                  </span>
                                </div>
                              </a>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Booking Modal */}
      {isEditModalOpen && editingBooking && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/80 backdrop-blur-sm overflow-y-auto"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsEditModalOpen(false);
          }}
        >
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200 my-8 max-h-[90vh]">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50 shrink-0">
              <h3 className="text-xl font-bold text-gray-800">Edit Booking #{editingBooking.id}</h3>
              <button 
                onClick={() => setIsEditModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors p-1"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto">
              <div className="space-y-6">
                <div>
                  <h4 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4 border-b pb-2">Booking Dates</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Check-in Date</label>
                      <input 
                        type="date" 
                        value={editCheckIn}
                        onChange={(e) => setEditCheckIn(e.target.value)}
                        className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none text-gray-900 bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Check-out Date</label>
                      <input 
                        type="date" 
                        value={editCheckOut}
                        onChange={(e) => setEditCheckOut(e.target.value)}
                        className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none text-gray-900 bg-white"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <h4 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4 border-b pb-2">Room & Price Details</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Room Number</label>
                      <input 
                        type="text" 
                        value={editRoomNumber}
                        onChange={(e) => setEditRoomNumber(e.target.value)}
                        placeholder="e.g. 101"
                        className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none text-gray-900 bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Agreed Price (Rs.)</label>
                      <input 
                        type="number" 
                        value={editAgreedPrice}
                        onChange={(e) => setEditAgreedPrice(e.target.value)}
                        placeholder="e.g. 1500"
                        className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none text-gray-900 bg-white"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <h4 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4 border-b pb-2">Guest Details</h4>
                  <div className="space-y-4">
                    {editGuests.map((guest, index) => (
                      <div key={guest.id} className="bg-gray-50 p-4 rounded-lg border border-gray-100 flex gap-4 items-start">
                        <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-sm shrink-0">
                          {index + 1}
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 flex-1">
                          <div className="md:col-span-2">
                            <label className="block text-xs font-medium text-gray-600 mb-1">Full Name</label>
                            <input 
                              type="text" 
                              value={guest.name}
                              onChange={(e) => handleEditGuestChange(guest.id, 'name', e.target.value)}
                              className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 outline-none text-sm text-gray-900 bg-white"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">Age</label>
                            <input 
                              type="number" 
                              value={guest.age}
                              onChange={(e) => handleEditGuestChange(guest.id, 'age', e.target.value)}
                              className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 outline-none text-sm text-gray-900 bg-white"
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 flex justify-end gap-3 shrink-0">
              <button 
                onClick={() => setIsEditModalOpen(false)}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 font-medium transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={handleSaveEdit}
                disabled={isLoading}
                className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium transition-colors shadow-sm disabled:opacity-50"
              >
                {isLoading ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default dynamic(() => Promise.resolve(AdminDashboard), { ssr: false });
