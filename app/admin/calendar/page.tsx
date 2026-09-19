"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/utils/supabase";
import AdminSidebar from "@/components/AdminSidebar";

export interface RoomConfig {
  number: string;
  type: string;
  capacity: number;
  bedType: string;
  badgeColor: string;
}

export const ROOMS: RoomConfig[] = [
  {
    number: "201",
    type: "Triple Occupancy",
    capacity: 3,
    bedType: "3 Beds",
    badgeColor: "bg-blue-50 text-blue-700 border-blue-200"
  },
  {
    number: "202",
    type: "Triple Occupancy",
    capacity: 3,
    bedType: "3 Beds",
    badgeColor: "bg-blue-50 text-blue-700 border-blue-200"
  },
  {
    number: "203",
    type: "Double Bed Room",
    capacity: 2,
    bedType: "Double Bed",
    badgeColor: "bg-emerald-50 text-emerald-700 border-emerald-200"
  },
  {
    number: "204",
    type: "Four Bed Room",
    capacity: 4,
    bedType: "4 Beds",
    badgeColor: "bg-purple-50 text-purple-700 border-purple-200"
  },
  {
    number: "205",
    type: "Triple Occupancy",
    capacity: 3,
    bedType: "3 Beds",
    badgeColor: "bg-blue-50 text-blue-700 border-blue-200"
  },
  {
    number: "206",
    type: "Double Bed Room",
    capacity: 2,
    bedType: "Double Bed",
    badgeColor: "bg-emerald-50 text-emerald-700 border-emerald-200"
  },
  {
    number: "207",
    type: "Four Bed Room",
    capacity: 4,
    bedType: "4 Beds",
    badgeColor: "bg-purple-50 text-purple-700 border-purple-200"
  }
];

type Booking = {
  id: number;
  created_at: string;
  check_in_date: string;
  check_out_date: string;
  status: string; // 'reserved' | 'checked_in' | 'checked_out'
  total_amount?: number;
  agreed_price?: number;
  advance_amount?: number;
  balance_amount?: number;
  room_number?: string;
  payment_mode?: string;
};

type Guest = {
  id: number;
  booking_id: number;
  name: string;
  age: number;
  id_image_url?: string;
  id_image_back_url?: string;
  phone?: string;
};

type MergedBooking = Booking & {
  primary_guest_name: string;
  primary_guest_phone: string;
  total_guests: number;
  guests: Guest[];
  calculated_advance: number;
  calculated_balance: number;
};

export default function CalendarPage() {
  const router = useRouter();
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const [hotelSettings, setHotelSettings] = useState({
    hotelName: "HOTEL AADVIK INN",
    hotelAddress: "OPP VERTERNITY HOSPITAL HARIDWAR 249401",
    contact: "+91 9719350125"
  });

  // Calendar Date State
  const [currentYear, setCurrentYear] = useState<number>(new Date().getFullYear());
  const [currentMonth, setCurrentMonth] = useState<number>(new Date().getMonth());
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "reserved" | "checked_in">("all");

  // Data State
  const [bookings, setBookings] = useState<MergedBooking[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Modals
  const [selectedBooking, setSelectedBooking] = useState<MergedBooking | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

  // Quick Reservation / Advance Booking Modal State
  const [isNewBookingModalOpen, setIsNewBookingModalOpen] = useState(false);
  const [newRoomNumber, setNewRoomNumber] = useState("201");
  const [newCheckIn, setNewCheckIn] = useState("");
  const [newCheckOut, setNewCheckOut] = useState("");
  const [newGuestName, setNewGuestName] = useState("");
  const [newGuestPhone, setNewGuestPhone] = useState("");
  const [newGuestAge, setNewGuestAge] = useState("28");
  const [newAgreedPrice, setNewAgreedPrice] = useState("1500");
  const [newAdvancePaid, setNewAdvancePaid] = useState("500");
  const [newAdvanceMode, setNewAdvanceMode] = useState("UPI (GPay/PhonePe)");
  const [newBookingType, setNewBookingType] = useState<"reserved" | "checked_in">("reserved");
  const [isSavingBooking, setIsSavingBooking] = useState(false);

  // Check-In Modal State (When guest arrives)
  const [isCheckInActionOpen, setIsCheckInActionOpen] = useState(false);
  const [collectedBalanceAmount, setCollectedBalanceAmount] = useState("");
  const [balancePaymentMode, setBalancePaymentMode] = useState("Cash");
  const [isProcessingCheckIn, setIsProcessingCheckIn] = useState(false);

  // Room Shift Modal State
  const [isShiftModalOpen, setIsShiftModalOpen] = useState(false);
  const [targetShiftRoom, setTargetShiftRoom] = useState("202");
  const [isProcessingShift, setIsProcessingShift] = useState(false);

  const todayRowRef = useRef<HTMLTableRowElement>(null);

  // Normalize date string to YYYY-MM-DD
  const normalizeDateStr = (dateStr?: string | null): string => {
    if (!dateStr) return "";
    const trimmed = dateStr.trim();
    if (trimmed.length >= 10 && trimmed.charAt(4) === "-" && trimmed.charAt(7) === "-") {
      return trimmed.slice(0, 10);
    }
    const d = new Date(trimmed);
    if (!isNaN(d.getTime())) {
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      return `${year}-${month}-${day}`;
    }
    return trimmed;
  };

  useEffect(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("hotelAadvikSettings");
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          setHotelSettings(prev => ({ ...prev, ...parsed }));
        } catch (e) {}
      }
    }

    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push("/admin/login");
      } else {
        setIsCheckingSession(false);
        fetchCalendarData();
      }
    };
    checkSession();
  }, [router]);

  const fetchCalendarData = async () => {
    try {
      setIsLoading(true);
      const { data: bookingsData, error: bError } = await supabase
        .from("Bookings")
        .select("*")
        .order("created_at", { ascending: false });

      if (bError) throw bError;

      const { data: guestsData, error: gError } = await supabase
        .from("Guests")
        .select("*")
        .order("id", { ascending: true });

      if (gError) throw gError;

      const merged: MergedBooking[] = (bookingsData || []).map((b: any) => {
        const related = (guestsData || []).filter((g: Guest) => g.booking_id === b.id);
        
        // Parse advance and balance
        let adv = Number(b.advance_amount) || 0;
        let bal = Number(b.balance_amount) || 0;

        // If not in columns, try parsing from payment_mode fallback (e.g. "Adv: 500 | Bal: 1000")
        if (!adv && b.payment_mode && b.payment_mode.includes("Adv:")) {
          const match = b.payment_mode.match(/Adv:\s*₹?(\d+)/i);
          if (match && match[1]) adv = parseFloat(match[1]);
        }

        const totalTariff = Number(b.agreed_price) || Number(b.total_amount) || 0;
        if (!bal && totalTariff > 0) {
          bal = Math.max(0, totalTariff - adv);
        }

        return {
          ...b,
          primary_guest_name: related.length > 0 ? related[0].name : "Guest",
          primary_guest_phone: related.length > 0 ? (related[0].phone || "") : "",
          total_guests: related.length,
          guests: related,
          calculated_advance: adv,
          calculated_balance: bal
        };
      });

      setBookings(merged);
    } catch (err: any) {
      console.error("Error fetching calendar data:", err);
    } finally {
      setIsLoading(false);
    }
  };

  // Generate days for the selected month
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const monthDates: { dateStr: string; dayNum: number; dayName: string; isToday: boolean; isWeekend: boolean }[] = [];
  
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  for (let d = 1; d <= daysInMonth; d++) {
    const dateObj = new Date(currentYear, currentMonth, d);
    const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    const dayName = dateObj.toLocaleDateString("en-US", { weekday: "short" });
    const isWeekend = dateObj.getDay() === 0 || dateObj.getDay() === 6;
    monthDates.push({
      dateStr,
      dayNum: d,
      dayName,
      isToday: dateStr === todayStr,
      isWeekend
    });
  }

  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  const handlePrevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear(prev => prev - 1);
    } else {
      setCurrentMonth(prev => prev - 1);
    }
  };

  const handleNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear(prev => prev + 1);
    } else {
      setCurrentMonth(prev => prev + 1);
    }
  };

  const handleJumpToToday = () => {
    const now = new Date();
    setCurrentYear(now.getFullYear());
    setCurrentMonth(now.getMonth());
    setTimeout(() => {
      todayRowRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 100);
  };

  // Check booking occupancy for a room on date
  const getBookingForRoomAndDate = (roomNum: string, dateStr: string) => {
    return bookings.find(b => {
      if (!b.room_number) return false;
      const cleanRoom = b.room_number.toString().trim();
      if (cleanRoom !== roomNum) return false;

      // Status filter
      if (statusFilter === "reserved" && b.status !== "reserved") return false;
      if (statusFilter === "checked_in" && b.status !== "checked_in") return false;

      const checkIn = normalizeDateStr(b.check_in_date);
      const checkOut = normalizeDateStr(b.check_out_date);

      if (!checkIn) return false;

      // Search filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = b.primary_guest_name.toLowerCase().includes(q);
        const matchPhone = b.primary_guest_phone.includes(q);
        const matchRoom = cleanRoom.includes(q);
        if (!matchName && !matchPhone && !matchRoom) return false;
      }

      if (checkIn === checkOut) {
        return dateStr === checkIn;
      }
      return dateStr >= checkIn && dateStr < checkOut;
    });
  };

  // Check if date is checkout day
  const getCheckoutForRoomAndDate = (roomNum: string, dateStr: string) => {
    return bookings.find(b => {
      if (!b.room_number) return false;
      const cleanRoom = b.room_number.toString().trim();
      if (cleanRoom !== roomNum) return false;
      const checkIn = normalizeDateStr(b.check_in_date);
      const checkOut = normalizeDateStr(b.check_out_date);
      return checkOut === dateStr && checkIn !== checkOut;
    });
  };

  // Metrics
  const roomsOccupiedToday = ROOMS.filter(r => {
    const b = getBookingForRoomAndDate(r.number, todayStr);
    return b && b.status === "checked_in";
  }).length;

  const roomsReservedToday = ROOMS.filter(r => {
    const b = getBookingForRoomAndDate(r.number, todayStr);
    return b && b.status === "reserved";
  }).length;

  const roomsAvailableToday = ROOMS.length - (roomsOccupiedToday + roomsReservedToday);

  // Quick Open Modal
  const handleOpenNewReservation = (roomNum: string, dateStr?: string) => {
    setNewRoomNumber(roomNum);
    const startDate = dateStr || todayStr;
    setNewCheckIn(startDate);
    
    // Default checkout: 1 day later
    const nextDay = new Date(startDate);
    nextDay.setDate(nextDay.getDate() + 1);
    const nextDayStr = `${nextDay.getFullYear()}-${String(nextDay.getMonth() + 1).padStart(2, "0")}-${String(nextDay.getDate()).padStart(2, "0")}`;
    setNewCheckOut(nextDayStr);

    setNewGuestName("");
    setNewGuestPhone("");
    setNewGuestAge("28");
    setNewAgreedPrice("1500");
    setNewAdvancePaid("500");
    setNewAdvanceMode("UPI (GPay/PhonePe)");
    setNewBookingType("reserved"); // Default to advance phone booking!
    setIsNewBookingModalOpen(true);
  };

  // Create Reservation with Advance Payment
  const handleCreateReservation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGuestName.trim()) {
      alert("Please enter guest name.");
      return;
    }
    if (!newCheckIn || !newCheckOut) {
      alert("Please select check-in and check-out dates.");
      return;
    }

    const agreed = parseFloat(newAgreedPrice) || 0;
    const advance = parseFloat(newAdvancePaid) || 0;
    const balance = Math.max(0, agreed - advance);

    try {
      setIsSavingBooking(true);

      const paymentString = `${newAdvanceMode} (Adv: ₹${advance} | Bal: ₹${balance})`;

      // 1. Try inserting with advance_amount and balance_amount
      let bData: any = null;
      let bError: any = null;

      const payloadWithCols = {
        check_in_date: newCheckIn,
        check_out_date: newCheckOut,
        agreed_price: agreed,
        advance_amount: advance,
        balance_amount: balance,
        payment_mode: paymentString,
        room_number: newRoomNumber,
        status: newBookingType
      };

      const res = await supabase.from("Bookings").insert(payloadWithCols).select().single();
      
      if (res.error) {
        // Fallback without advance_amount column if schema not yet updated
        const fallbackPayload = {
          check_in_date: newCheckIn,
          check_out_date: newCheckOut,
          agreed_price: agreed,
          payment_mode: paymentString,
          room_number: newRoomNumber,
          status: newBookingType
        };
        const fallbackRes = await supabase.from("Bookings").insert(fallbackPayload).select().single();
        if (fallbackRes.error) throw fallbackRes.error;
        bData = fallbackRes.data;
      } else {
        bData = res.data;
      }

      // 2. Insert primary guest
      const { error: gError } = await supabase
        .from("Guests")
        .insert({
          booking_id: bData.id,
          name: newGuestName.trim(),
          age: parseInt(newGuestAge) || 28,
          phone: newGuestPhone.trim()
        });

      if (gError) throw gError;

      alert(`✅ Room ${newRoomNumber} successfully booked for ${newGuestName}!\nAdvance Received: ₹${advance}\nBalance Due on Arrival: ₹${balance}`);
      setIsNewBookingModalOpen(false);
      fetchCalendarData();
    } catch (err: any) {
      console.error("Error creating booking:", err);
      alert("Failed to create booking: " + err.message);
    } finally {
      setIsSavingBooking(false);
    }
  };

  // Check In Guest & Collect Balance
  const handleCompleteCheckIn = async () => {
    if (!selectedBooking) return;
    try {
      setIsProcessingCheckIn(true);
      const balPaid = parseFloat(collectedBalanceAmount) || 0;
      const newBalance = Math.max(0, selectedBooking.calculated_balance - balPaid);

      const updatedPaymentMode = `${selectedBooking.payment_mode || ""} | Checked-In: +₹${balPaid} (${balancePaymentMode})`;

      // Update booking to 'checked_in'
      const { error } = await supabase
        .from("Bookings")
        .update({
          status: "checked_in",
          balance_amount: newBalance,
          payment_mode: updatedPaymentMode
        })
        .eq("id", selectedBooking.id);

      if (error) {
        // Fallback update
        await supabase
          .from("Bookings")
          .update({
            status: "checked_in",
            payment_mode: updatedPaymentMode
          })
          .eq("id", selectedBooking.id);
      }

      alert(`🎉 Guest ${selectedBooking.primary_guest_name} has been Checked In successfully to Room ${selectedBooking.room_number}!`);
      setIsCheckInActionOpen(false);
      setIsDetailModalOpen(false);
      fetchCalendarData();
    } catch (err: any) {
      alert("Error completing check in: " + err.message);
    } finally {
      setIsProcessingCheckIn(false);
    }
  };

  // Shift Room
  const handleShiftRoom = async () => {
    if (!selectedBooking) return;
    try {
      setIsProcessingShift(true);
      const { error } = await supabase
        .from("Bookings")
        .update({ room_number: targetShiftRoom })
        .eq("id", selectedBooking.id);

      if (error) throw error;

      alert(`Room successfully changed to Room ${targetShiftRoom}!`);
      setIsShiftModalOpen(false);
      setIsDetailModalOpen(false);
      fetchCalendarData();
    } catch (err: any) {
      alert("Failed to shift room: " + err.message);
    } finally {
      setIsProcessingShift(false);
    }
  };

  // Delete / Cancel Booking
  const handleDeleteBooking = async (bookingId: number) => {
    const password = window.prompt("Enter admin PIN/password to cancel/delete booking:");
    if (password === null) return;
    if (password !== "admin1458" && password !== "9999") {
      alert("Incorrect password! Access denied.");
      return;
    }

    if (window.confirm("Are you sure you want to remove this booking from the calendar?")) {
      try {
        await supabase.from("Guests").delete().eq("booking_id", bookingId);
        await supabase.from("Bookings").delete().eq("id", bookingId);
        alert("Booking removed successfully.");
        setIsDetailModalOpen(false);
        fetchCalendarData();
      } catch (err: any) {
        alert("Failed to delete booking: " + err.message);
      }
    }
  };

  // Send WhatsApp Booking Confirmation
  const handleSendWhatsAppConfirmation = (booking: MergedBooking) => {
    const cleanPhone = booking.primary_guest_phone.replace(/\D/g, "");
    if (!cleanPhone || cleanPhone.length < 10) {
      alert("Guest phone number is not available or invalid.");
      return;
    }
    const phoneWithCode = cleanPhone.startsWith("91") ? cleanPhone : `91${cleanPhone}`;

    const msg = `Namaste ${booking.primary_guest_name}! 🙏\n\nYour booking at *${hotelSettings.hotelName}* is confirmed.\n\n🏨 *Room:* ${booking.room_number}\n📅 *Check-In:* ${booking.check_in_date}\n📅 *Check-Out:* ${booking.check_out_date}\n💰 *Total Tariff:* ₹${booking.agreed_price || 0}\n💳 *Advance Received:* ₹${booking.calculated_advance}\n💵 *Balance on Arrival:* ₹${booking.calculated_balance}\n\n📍 *Address:* ${hotelSettings.hotelAddress}\n📞 *Contact:* ${hotelSettings.contact}\n\nWe look forward to welcoming you to Haridwar!`;

    const whatsappUrl = `https://wa.me/${phoneWithCode}?text=${encodeURIComponent(msg)}`;
    window.open(whatsappUrl, "_blank");
  };

  if (isCheckingSession) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#C5A059] mb-4"></div>
        <p className="text-slate-400 font-medium text-sm">Verifying access...</p>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-slate-50 flex-col md:flex-row relative overflow-hidden font-sans">
      <AdminSidebar activePath="/admin/calendar" hotelName={hotelSettings.hotelName} />

      <main className="flex-1 flex flex-col h-full overflow-hidden bg-slate-100">
        
        {/* Top Header & Metrics Bar */}
        <header className="bg-white border-b border-slate-200 px-6 py-3.5 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 shrink-0 shadow-xs z-30">
          <div>
            <div className="flex items-center gap-3">
              <span className="p-2 bg-amber-50 rounded-xl text-[#C5A059] border border-amber-200 shadow-2xs">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </span>
              <div>
                <h1 className="text-xl font-bold text-slate-800 tracking-tight flex items-center gap-2">
                  Room Booking Calendar
                  <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                    7 Rooms
                  </span>
                </h1>
                <p className="text-xs text-slate-500 font-medium">
                  Advance Bookings & In-House Occupancy Matrix
                </p>
              </div>
            </div>
          </div>

          {/* Quick Metrics Bar */}
          <div className="flex items-center gap-3">
            <div className="bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-1.5 flex items-center gap-3 shadow-2xs">
              <div className="text-center">
                <p className="text-[10px] uppercase font-bold text-slate-400">Total Rooms</p>
                <p className="text-sm font-bold text-slate-800">7</p>
              </div>
              <div className="h-6 w-px bg-slate-200" />
              <div className="text-center">
                <p className="text-[10px] uppercase font-bold text-emerald-600">In-House</p>
                <p className="text-sm font-bold text-emerald-700">{roomsOccupiedToday}</p>
              </div>
              <div className="h-6 w-px bg-slate-200" />
              <div className="text-center">
                <p className="text-[10px] uppercase font-bold text-amber-600">Advance Due</p>
                <p className="text-sm font-bold text-amber-700">{roomsReservedToday}</p>
              </div>
              <div className="h-6 w-px bg-slate-200" />
              <div className="text-center">
                <p className="text-[10px] uppercase font-bold text-blue-600">Vacant</p>
                <p className="text-sm font-bold text-blue-700">{roomsAvailableToday}</p>
              </div>
            </div>

            <button
              onClick={() => handleOpenNewReservation("201")}
              className="flex items-center gap-2 px-4 py-2 bg-[#0F172A] hover:bg-slate-800 text-[#C5A059] font-bold text-xs rounded-xl shadow-xs transition-all cursor-pointer"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              + New Advance Booking
            </button>
          </div>
        </header>

        {/* Date Navigation & Search Subheader */}
        <div className="bg-slate-50 border-b border-slate-200 px-6 py-2.5 flex flex-wrap items-center justify-between gap-3 shrink-0 z-20">
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrevMonth}
              className="p-1.5 bg-white border border-slate-300 hover:bg-slate-100 rounded-lg text-slate-700 transition-colors shadow-2xs cursor-pointer"
              title="Previous Month"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>

            <div className="bg-white border border-slate-300 rounded-lg px-3.5 py-1 shadow-2xs flex items-center gap-2 min-w-[160px] justify-center">
              <span className="text-xs font-bold text-slate-800">
                {monthNames[currentMonth]} {currentYear}
              </span>
            </div>

            <button
              onClick={handleNextMonth}
              className="p-1.5 bg-white border border-slate-300 hover:bg-slate-100 rounded-lg text-slate-700 transition-colors shadow-2xs cursor-pointer"
              title="Next Month"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>

            <button
              onClick={handleJumpToToday}
              className="px-2.5 py-1 bg-amber-500/10 text-amber-800 hover:bg-amber-500/20 border border-amber-300 rounded-lg text-xs font-bold transition-colors ml-1 cursor-pointer"
            >
              Today
            </button>

            {/* Filter Tabs */}
            <div className="ml-3 hidden sm:flex items-center bg-white border border-slate-200 rounded-lg p-0.5 shadow-2xs text-[11px] font-semibold text-slate-600">
              <button
                onClick={() => setStatusFilter("all")}
                className={`px-2.5 py-1 rounded-md transition-all ${statusFilter === "all" ? "bg-slate-900 text-white" : "hover:text-slate-900"}`}
              >
                All
              </button>
              <button
                onClick={() => setStatusFilter("reserved")}
                className={`px-2.5 py-1 rounded-md transition-all ${statusFilter === "reserved" ? "bg-amber-600 text-white" : "hover:text-slate-900"}`}
              >
                Advance Booked
              </button>
              <button
                onClick={() => setStatusFilter("checked_in")}
                className={`px-2.5 py-1 rounded-md transition-all ${statusFilter === "checked_in" ? "bg-emerald-600 text-white" : "hover:text-slate-900"}`}
              >
                In-House
              </button>
            </div>
          </div>

          {/* Search bar & Legend */}
          <div className="flex items-center gap-3">
            <div className="relative">
              <input
                type="text"
                placeholder="Search guest, phone, room..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 pr-3 py-1 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500 w-56 shadow-2xs"
              />
              <svg className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>

            {/* Legend */}
            <div className="hidden xl:flex items-center gap-2 text-[10px] font-semibold text-slate-600 bg-white border border-slate-200 px-3 py-1 rounded-lg shadow-2xs">
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500" /> Advance Paid (Awaiting)
              </span>
              <span className="text-slate-300">|</span>
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> In-House (Checked In)
              </span>
              <span className="text-slate-300">|</span>
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-full bg-slate-300" /> Available
              </span>
            </div>
          </div>
        </div>

        {/* Scrollable Calendar Matrix Container with TRUE STICKY HEADERS */}
        <div className="flex-1 overflow-auto bg-slate-100 p-3">
          <div className="bg-white rounded-xl shadow-sm border border-slate-300 min-w-[1100px]">
            <table className="w-full border-separate border-spacing-0 text-left">
              
              {/* STICKY ROOM NUMBER HEADER BAR (Sticks when scrolling down) */}
              <thead>
                <tr>
                  {/* Top-Left Corner Cell: Sticky in BOTH X and Y directions (z-30) */}
                  <th className="sticky top-0 left-0 z-30 w-32 p-3 text-center text-xs font-bold uppercase tracking-wider text-slate-300 bg-slate-950 border-b border-r border-slate-800 shadow-sm">
                    <div className="flex items-center justify-center gap-1.5">
                      <svg className="w-4 h-4 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      Date
                    </div>
                  </th>

                  {/* 7 Room Columns (Sticky Y direction, z-20) */}
                  {ROOMS.map((room) => (
                    <th
                      key={room.number}
                      className="sticky top-0 z-20 p-2.5 text-center bg-slate-900 border-b border-r border-slate-800 last:border-r-0 min-w-[145px] shadow-sm"
                    >
                      <div className="flex flex-col items-center">
                        <span className="text-base font-extrabold text-white tracking-tight">
                          Room {room.number}
                        </span>
                        <span className={`mt-1 text-[10px] font-bold px-2 py-0.5 rounded-full border shadow-2xs ${room.badgeColor}`}>
                          {room.type}
                        </span>
                        <span className="text-[10px] text-slate-400 font-medium mt-0.5">
                          {room.bedType} • Max {room.capacity}
                        </span>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>

              {/* Rows: Dates along the Left (Sticky X direction, z-10) */}
              <tbody>
                {monthDates.map((dayItem) => {
                  const isCurrentDay = dayItem.isToday;

                  return (
                    <tr
                      key={dayItem.dateStr}
                      ref={isCurrentDay ? todayRowRef : null}
                      className={`transition-colors ${
                        isCurrentDay
                          ? "bg-amber-50/60"
                          : dayItem.isWeekend
                          ? "bg-slate-50/70"
                          : "bg-white"
                      }`}
                    >
                      {/* Left Sticky Date Cell (z-10) */}
                      <td
                        className={`sticky left-0 z-10 p-2 text-center border-b border-r border-slate-200 font-medium transition-colors ${
                          isCurrentDay
                            ? "bg-amber-100 text-amber-950 font-bold border-r-amber-300 border-b-amber-200"
                            : dayItem.isWeekend
                            ? "bg-slate-100 text-slate-700"
                            : "bg-white text-slate-800"
                        }`}
                      >
                        <div className="flex flex-col items-center">
                          <div className="flex items-baseline gap-1">
                            <span className="text-sm font-extrabold">{dayItem.dayNum}</span>
                            <span className="text-xs uppercase text-slate-500 font-bold">
                              {monthNames[currentMonth].slice(0, 3)}
                            </span>
                          </div>
                          <span className={`text-[10px] font-semibold uppercase ${isCurrentDay ? "text-amber-800" : "text-slate-400"}`}>
                            {dayItem.dayName}
                          </span>
                          {isCurrentDay && (
                            <span className="mt-0.5 text-[9px] bg-amber-500 text-white font-extrabold px-1.5 py-0.2 rounded-full uppercase tracking-wider shadow-2xs">
                              Today
                            </span>
                          )}
                        </div>
                      </td>

                      {/* 7 Room Columns for this Date */}
                      {ROOMS.map((room) => {
                        const booking = getBookingForRoomAndDate(room.number, dayItem.dateStr);
                        const checkoutBooking = !booking ? getCheckoutForRoomAndDate(room.number, dayItem.dateStr) : null;

                        const isReserved = booking?.status === "reserved";
                        const isCheckedIn = booking?.status === "checked_in";

                        return (
                          <td
                            key={room.number}
                            className="p-1 border-b border-r border-slate-200 last:border-r-0 align-top h-16 relative"
                          >
                            {booking ? (
                              isReserved ? (
                                // STAGE 1: Advance Booking / Reserved Cell (Amber/Orange theme)
                                <div
                                  onClick={() => {
                                    setSelectedBooking(booking);
                                    setIsDetailModalOpen(true);
                                  }}
                                  className="w-full h-full min-h-[56px] bg-amber-50 hover:bg-amber-100/80 border border-amber-300 rounded-xl p-2 flex flex-col justify-between cursor-pointer transition-all shadow-2xs group"
                                >
                                  <div className="flex items-center justify-between gap-1">
                                    <span className="text-xs font-extrabold text-amber-950 truncate max-w-[95px] group-hover:text-amber-900">
                                      {booking.primary_guest_name}
                                    </span>
                                    <span className="text-[9px] font-bold bg-amber-200 text-amber-900 px-1.5 py-0.2 rounded-md uppercase tracking-wider shrink-0">
                                      Advance
                                    </span>
                                  </div>

                                  <div className="flex items-center justify-between text-[10px] font-medium text-amber-800 mt-1">
                                    <span className="text-emerald-700 font-bold">
                                      Adv: ₹{booking.calculated_advance}
                                    </span>
                                    {booking.calculated_balance > 0 && (
                                      <span className="text-rose-600 font-extrabold">
                                        Due: ₹{booking.calculated_balance}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              ) : (
                                // STAGE 2: Checked In / In-House (Emerald Green theme)
                                <div
                                  onClick={() => {
                                    setSelectedBooking(booking);
                                    setIsDetailModalOpen(true);
                                  }}
                                  className="w-full h-full min-h-[56px] bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 rounded-xl p-2 flex flex-col justify-between cursor-pointer transition-all shadow-2xs group"
                                >
                                  <div className="flex items-center justify-between gap-1">
                                    <span className="text-xs font-extrabold text-emerald-950 truncate max-w-[95px] group-hover:text-emerald-800">
                                      {booking.primary_guest_name}
                                    </span>
                                    <span className="text-[9px] font-bold bg-emerald-200 text-emerald-900 px-1.5 py-0.2 rounded-md uppercase tracking-wider shrink-0">
                                      In-House
                                    </span>
                                  </div>

                                  <div className="flex items-center justify-between text-[10px] text-emerald-700 mt-1">
                                    <span className="truncate max-w-[70px]">
                                      {booking.primary_guest_phone || "Checked In"}
                                    </span>
                                    {booking.agreed_price && (
                                      <span className="font-extrabold text-emerald-900">
                                        ₹{booking.agreed_price}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              )
                            ) : checkoutBooking ? (
                              // Checkout Today Indicator
                              <div
                                onClick={() => handleOpenNewReservation(room.number, dayItem.dateStr)}
                                className="w-full h-full min-h-[56px] bg-slate-50/80 hover:bg-amber-50 border border-slate-300 border-dashed rounded-xl p-1.5 flex flex-col justify-between cursor-pointer transition-all shadow-2xs group"
                              >
                                <div className="flex items-center justify-between text-[10px] text-slate-700 font-bold">
                                  <span className="truncate">Out: {checkoutBooking.primary_guest_name}</span>
                                  <span className="text-[9px] bg-slate-200 px-1 rounded text-slate-700">Out</span>
                                </div>
                                <div className="text-[10px] text-amber-700 font-semibold text-center group-hover:text-amber-900">
                                  + Book for tonight
                                </div>
                              </div>
                            ) : (
                              // Vacant Cell
                              <div
                                onClick={() => handleOpenNewReservation(room.number, dayItem.dateStr)}
                                className="w-full h-full min-h-[56px] rounded-xl border border-transparent hover:border-slate-300 hover:bg-slate-50 flex items-center justify-center cursor-pointer transition-all group p-1 text-slate-300 hover:text-slate-600"
                                title={`Book Room ${room.number} on ${dayItem.dateStr}`}
                              >
                                <span className="opacity-0 group-hover:opacity-100 text-xs font-semibold flex items-center gap-1 transition-opacity">
                                  <svg className="w-3.5 h-3.5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                  </svg>
                                  <span className="text-amber-800 text-[11px] font-bold">Book</span>
                                </span>
                              </div>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Modal 1: Booking Details & Advance Payment Manager */}
        {isDetailModalOpen && selectedBooking && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-xs overflow-y-auto"
            onClick={(e) => {
              if (e.target === e.currentTarget) setIsDetailModalOpen(false);
            }}
          >
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-150">
              
              {/* Modal Header */}
              <div className={`px-6 py-4 flex items-center justify-between border-b ${selectedBooking.status === "reserved" ? "bg-amber-900 text-white border-amber-800" : "bg-slate-900 text-white border-slate-800"}`}>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-bold">
                      Room {selectedBooking.room_number || "Unassigned"}
                    </h3>
                    <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider ${selectedBooking.status === "reserved" ? "bg-amber-400 text-amber-950" : "bg-emerald-400 text-emerald-950"}`}>
                      {selectedBooking.status === "reserved" ? "⏳ Advance Paid (Awaiting Arrival)" : "✓ Checked In (In-House)"}
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 mt-0.5">
                    {ROOMS.find(r => r.number === selectedBooking.room_number)?.type || "Standard Room"} • Booking #{selectedBooking.id}
                  </p>
                </div>
                <button
                  onClick={() => setIsDetailModalOpen(false)}
                  className="text-slate-300 hover:text-white p-1 rounded-lg hover:bg-black/20 transition-colors cursor-pointer"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-6 space-y-4">
                
                {/* ADVANCE PAYMENT & BALANCE STATUS CARD */}
                <div className="bg-gradient-to-r from-slate-50 to-amber-50/40 border border-slate-200 rounded-xl p-4 shadow-2xs">
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div>
                      <p className="text-[10px] uppercase font-bold text-slate-400">Total Tariff</p>
                      <p className="text-base font-extrabold text-slate-800">
                        ₹{selectedBooking.agreed_price || selectedBooking.total_amount || 0}
                      </p>
                    </div>
                    <div className="border-x border-slate-200">
                      <p className="text-[10px] uppercase font-bold text-emerald-600">Advance Paid</p>
                      <p className="text-base font-extrabold text-emerald-700">
                        ₹{selectedBooking.calculated_advance}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase font-bold text-rose-500">Balance Due</p>
                      <p className="text-base font-extrabold text-rose-600">
                        ₹{selectedBooking.calculated_balance}
                      </p>
                    </div>
                  </div>
                  {selectedBooking.payment_mode && (
                    <p className="text-[11px] text-slate-500 text-center mt-2.5 border-t border-slate-200/80 pt-2 font-medium">
                      💳 Note: {selectedBooking.payment_mode}
                    </p>
                  )}
                </div>

                {/* PRIMARY ACTION: If Guest is in 'reserved' stage, show big Check-In button */}
                {selectedBooking.status === "reserved" && (
                  <div className="bg-emerald-50 border border-emerald-300 rounded-xl p-4 flex flex-col gap-2 shadow-xs">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs font-extrabold text-emerald-950">
                          Guest has arrived at reception?
                        </p>
                        <p className="text-[11px] text-emerald-700 font-medium">
                          Collect remaining balance (₹{selectedBooking.calculated_balance}) and complete check-in.
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setCollectedBalanceAmount(selectedBooking.calculated_balance.toString());
                        setIsCheckInActionOpen(true);
                      }}
                      className="w-full mt-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors cursor-pointer flex items-center justify-center gap-2"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      Collect Balance & Complete Check-In
                    </button>
                  </div>
                )}

                {/* Stay Dates Box */}
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 flex items-center justify-between text-xs">
                  <div>
                    <p className="text-[10px] uppercase font-bold text-slate-400">Check-In</p>
                    <p className="font-bold text-slate-800">{selectedBooking.check_in_date}</p>
                  </div>
                  <div className="flex flex-col items-center">
                    <span className="text-slate-400 font-bold">➔</span>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] uppercase font-bold text-slate-400">Check-Out</p>
                    <p className="font-bold text-slate-800">{selectedBooking.check_out_date}</p>
                  </div>
                </div>

                {/* Primary Guest Details */}
                <div className="bg-white border border-slate-200 rounded-xl p-3.5 space-y-2 text-xs">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500">Guest Name:</span>
                    <span className="font-bold text-slate-900">{selectedBooking.primary_guest_name}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500">Phone Number:</span>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900">{selectedBooking.primary_guest_phone || "Not provided"}</span>
                      {selectedBooking.primary_guest_phone && (
                        <a
                          href={`tel:${selectedBooking.primary_guest_phone}`}
                          className="text-blue-600 hover:underline text-[11px] font-semibold"
                        >
                          Call
                        </a>
                      )}
                    </div>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500">Total Guests:</span>
                    <span className="font-bold text-slate-900">{selectedBooking.total_guests} Guest(s)</span>
                  </div>
                </div>

                {/* 1-Click WhatsApp Confirmation & Room Shift */}
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => handleSendWhatsAppConfirmation(selectedBooking)}
                    className="flex items-center justify-center gap-2 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs rounded-xl transition-colors cursor-pointer shadow-xs"
                  >
                    <span>📲 WhatsApp Slip</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setTargetShiftRoom(selectedBooking.room_number === "201" ? "202" : "201");
                      setIsShiftModalOpen(true);
                    }}
                    className="flex items-center justify-center gap-2 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs rounded-xl transition-colors cursor-pointer border border-slate-200"
                  >
                    <span>🔄 Shift Room</span>
                  </button>
                </div>
              </div>

              {/* Modal Footer Actions */}
              <div className="bg-slate-50 border-t border-slate-200 px-6 py-3.5 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => handleDeleteBooking(selectedBooking.id)}
                  className="px-3 py-2 bg-rose-50 text-rose-700 hover:bg-rose-100 font-bold text-xs rounded-xl border border-rose-200 transition-colors cursor-pointer"
                >
                  Cancel Booking
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => router.push(`/admin`)}
                    className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl transition-colors cursor-pointer"
                  >
                    Dashboard
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsDetailModalOpen(false)}
                    className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold text-xs rounded-xl transition-colors cursor-pointer"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Modal 2: Check-In Balance Collection Dialog */}
        {isCheckInActionOpen && selectedBooking && (
          <div
            className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs"
            onClick={(e) => {
              if (e.target === e.currentTarget) setIsCheckInActionOpen(false);
            }}
          >
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150">
              <div className="bg-emerald-700 text-white px-6 py-4 flex justify-between items-center">
                <h3 className="text-base font-bold flex items-center gap-2">
                  ✓ Confirm Guest Arrival & Check In
                </h3>
                <button onClick={() => setIsCheckInActionOpen(false)} className="text-emerald-100 hover:text-white cursor-pointer">
                  ✕
                </button>
              </div>

              <div className="p-6 space-y-4">
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs space-y-1">
                  <p><span className="text-slate-500">Guest:</span> <strong>{selectedBooking.primary_guest_name}</strong></p>
                  <p><span className="text-slate-500">Room:</span> <strong>Room {selectedBooking.room_number}</strong></p>
                  <p><span className="text-slate-500">Already Paid Advance:</span> <strong className="text-emerald-700">₹{selectedBooking.calculated_advance}</strong></p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Balance Amount Collected Now (₹)
                  </label>
                  <input
                    type="number"
                    value={collectedBalanceAmount}
                    onChange={(e) => setCollectedBalanceAmount(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm font-bold text-emerald-800 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Payment Mode
                  </label>
                  <select
                    value={balancePaymentMode}
                    onChange={(e) => setBalancePaymentMode(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-semibold bg-white text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  >
                    <option value="Cash">Cash</option>
                    <option value="UPI (GPay / PhonePe / Paytm)">UPI (GPay / PhonePe / Paytm)</option>
                    <option value="Credit / Debit Card">Credit / Debit Card</option>
                    <option value="Bank Transfer">Bank Transfer</option>
                  </select>
                </div>
              </div>

              <div className="bg-slate-50 border-t border-slate-200 px-6 py-3.5 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsCheckInActionOpen(false)}
                  className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold text-xs rounded-xl cursor-pointer"
                >
                  Back
                </button>
                <button
                  type="button"
                  disabled={isProcessingCheckIn}
                  onClick={handleCompleteCheckIn}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all cursor-pointer flex items-center gap-1.5"
                >
                  {isProcessingCheckIn ? "Processing..." : "Complete Check-In"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal 3: Room Shift Dialog */}
        {isShiftModalOpen && selectedBooking && (
          <div
            className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs"
            onClick={(e) => {
              if (e.target === e.currentTarget) setIsShiftModalOpen(false);
            }}
          >
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in-95 duration-150">
              <div className="bg-slate-900 text-white px-5 py-3.5 flex justify-between items-center">
                <h3 className="text-sm font-bold">Shift Guest Room</h3>
                <button onClick={() => setIsShiftModalOpen(false)} className="text-slate-400 hover:text-white cursor-pointer">
                  ✕
                </button>
              </div>

              <div className="p-5 space-y-3 text-xs">
                <p className="text-slate-600">
                  Current Room: <strong>Room {selectedBooking.room_number}</strong> ({selectedBooking.primary_guest_name})
                </p>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Select New Room
                  </label>
                  <select
                    value={targetShiftRoom}
                    onChange={(e) => setTargetShiftRoom(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm font-bold bg-white text-slate-900"
                  >
                    {ROOMS.filter(r => r.number !== selectedBooking.room_number).map((r) => (
                      <option key={r.number} value={r.number}>
                        Room {r.number} - {r.type}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="bg-slate-50 border-t border-slate-200 px-5 py-3 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsShiftModalOpen(false)}
                  className="px-3.5 py-1.5 bg-slate-200 text-slate-800 font-bold text-xs rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isProcessingShift}
                  onClick={handleShiftRoom}
                  className="px-4 py-1.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl cursor-pointer"
                >
                  {isProcessingShift ? "Shifting..." : "Shift Room"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal 4: New Reservation & Advance Booking Modal */}
        {isNewBookingModalOpen && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-xs overflow-y-auto"
            onClick={(e) => {
              if (e.target === e.currentTarget) setIsNewBookingModalOpen(false);
            }}
          >
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-150">
              
              {/* Header */}
              <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between border-b border-slate-800">
                <div>
                  <h3 className="text-base font-bold flex items-center gap-2 text-[#C5A059]">
                    <span>📞</span> New Phone Booking / Reservation
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Record Advance Payment & Lock Room on Calendar
                  </p>
                </div>
                <button
                  onClick={() => setIsNewBookingModalOpen(false)}
                  className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Form */}
              <form onSubmit={handleCreateReservation}>
                <div className="p-6 space-y-4">
                  
                  {/* Booking Stage Toggle */}
                  <div className="flex rounded-xl bg-slate-100 p-1 border border-slate-200">
                    <button
                      type="button"
                      onClick={() => setNewBookingType("reserved")}
                      className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                        newBookingType === "reserved"
                          ? "bg-amber-600 text-white shadow-2xs"
                          : "text-slate-600 hover:text-slate-900"
                      }`}
                    >
                      <span>⏳ Advance Booking (Awaiting Arrival)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setNewBookingType("checked_in")}
                      className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                        newBookingType === "checked_in"
                          ? "bg-emerald-600 text-white shadow-2xs"
                          : "text-slate-600 hover:text-slate-900"
                      }`}
                    >
                      <span>✓ Direct Check-In (Guest Present)</span>
                    </button>
                  </div>

                  {/* Room Selection */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                      Select Room *
                    </label>
                    <select
                      value={newRoomNumber}
                      onChange={(e) => setNewRoomNumber(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-bold bg-white text-slate-900 focus:ring-2 focus:ring-amber-500 focus:outline-none"
                    >
                      {ROOMS.map((r) => (
                        <option key={r.number} value={r.number}>
                          Room {r.number} - {r.type} ({r.bedType})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Stay Dates */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                        Check-In Date *
                      </label>
                      <input
                        type="date"
                        required
                        value={newCheckIn}
                        onChange={(e) => setNewCheckIn(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs text-slate-900 focus:ring-2 focus:ring-amber-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                        Check-Out Date *
                      </label>
                      <input
                        type="date"
                        required
                        value={newCheckOut}
                        onChange={(e) => setNewCheckOut(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs text-slate-900 focus:ring-2 focus:ring-amber-500 focus:outline-none"
                      />
                    </div>
                  </div>

                  {/* Guest Name & Phone */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                        Guest Name *
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="Guest Full Name"
                        value={newGuestName}
                        onChange={(e) => setNewGuestName(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs text-slate-900 focus:ring-2 focus:ring-amber-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                        Mobile Number *
                      </label>
                      <input
                        type="tel"
                        required
                        placeholder="e.g. 9876543210"
                        value={newGuestPhone}
                        onChange={(e) => setNewGuestPhone(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs text-slate-900 focus:ring-2 focus:ring-amber-500 focus:outline-none"
                      />
                    </div>
                  </div>

                  {/* Tariff & Advance Payment Breakdown */}
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-3">
                    <p className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                      Payment & Advance Calculation
                    </p>

                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 mb-1">
                          Total Price (₹) *
                        </label>
                        <input
                          type="number"
                          required
                          value={newAgreedPrice}
                          onChange={(e) => setNewAgreedPrice(e.target.value)}
                          className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs font-bold text-slate-900"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-emerald-600 mb-1">
                          Advance Paid (₹)
                        </label>
                        <input
                          type="number"
                          value={newAdvancePaid}
                          onChange={(e) => setNewAdvancePaid(e.target.value)}
                          className="w-full px-2.5 py-1.5 border border-emerald-300 rounded-lg text-xs font-bold text-emerald-800 bg-emerald-50/50"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-rose-500 mb-1">
                          Balance Due (₹)
                        </label>
                        <div className="px-2.5 py-1.5 bg-rose-50 border border-rose-200 rounded-lg text-xs font-extrabold text-rose-700">
                          ₹{Math.max(0, (parseFloat(newAgreedPrice) || 0) - (parseFloat(newAdvancePaid) || 0))}
                        </div>
                      </div>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 mb-1">
                        Advance Payment Mode
                      </label>
                      <select
                        value={newAdvanceMode}
                        onChange={(e) => setNewAdvanceMode(e.target.value)}
                        className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs bg-white text-slate-800"
                      >
                        <option value="UPI (GPay/PhonePe/Paytm)">UPI (GPay/PhonePe/Paytm)</option>
                        <option value="Cash">Cash</option>
                        <option value="Bank Transfer / NEFT">Bank Transfer / NEFT</option>
                        <option value="Credit / Debit Card">Credit / Debit Card</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="bg-slate-50 border-t border-slate-200 px-6 py-3.5 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsNewBookingModalOpen(false)}
                    className="px-4 py-2 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 font-bold text-xs rounded-xl transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSavingBooking}
                    className="px-5 py-2 bg-[#0F172A] hover:bg-slate-800 text-[#C5A059] font-bold text-xs rounded-xl shadow-xs transition-all disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
                  >
                    {isSavingBooking ? "Saving..." : "Confirm & Save Booking"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

      </main>
    </div>
  );
}
