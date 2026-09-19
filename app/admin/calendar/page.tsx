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
  headerBg: string;
}

export const ROOMS: RoomConfig[] = [
  {
    number: "201",
    type: "Triple Occupancy",
    capacity: 3,
    bedType: "3 Beds",
    badgeColor: "bg-blue-50 text-blue-700 border-blue-200",
    headerBg: "from-blue-600 to-indigo-700"
  },
  {
    number: "202",
    type: "Triple Occupancy",
    capacity: 3,
    bedType: "3 Beds",
    badgeColor: "bg-blue-50 text-blue-700 border-blue-200",
    headerBg: "from-blue-600 to-indigo-700"
  },
  {
    number: "203",
    type: "Double Bed Room",
    capacity: 2,
    bedType: "Double Bed",
    badgeColor: "bg-emerald-50 text-emerald-700 border-emerald-200",
    headerBg: "from-emerald-600 to-teal-700"
  },
  {
    number: "204",
    type: "Four Bed Room",
    capacity: 4,
    bedType: "4 Beds",
    badgeColor: "bg-purple-50 text-purple-700 border-purple-200",
    headerBg: "from-purple-600 to-violet-700"
  },
  {
    number: "205",
    type: "Triple Occupancy",
    capacity: 3,
    bedType: "3 Beds",
    badgeColor: "bg-blue-50 text-blue-700 border-blue-200",
    headerBg: "from-blue-600 to-indigo-700"
  },
  {
    number: "206",
    type: "Double Bed Room",
    capacity: 2,
    bedType: "Double Bed",
    badgeColor: "bg-emerald-50 text-emerald-700 border-emerald-200",
    headerBg: "from-emerald-600 to-teal-700"
  },
  {
    number: "207",
    type: "Four Bed Room",
    capacity: 4,
    bedType: "4 Beds",
    badgeColor: "bg-purple-50 text-purple-700 border-purple-200",
    headerBg: "from-purple-600 to-violet-700"
  }
];

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
  id_image_url?: string;
  id_image_back_url?: string;
  phone?: string;
};

type MergedBooking = Booking & {
  primary_guest_name: string;
  primary_guest_phone: string;
  total_guests: number;
  guests: Guest[];
};

export default function CalendarPage() {
  const router = useRouter();
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const [hotelSettings, setHotelSettings] = useState({
    hotelName: "HOTEL AADVIK INN"
  });

  // Calendar Date State
  const [currentYear, setCurrentYear] = useState<number>(new Date().getFullYear());
  const [currentMonth, setCurrentMonth] = useState<number>(new Date().getMonth()); // 0-indexed
  const [searchQuery, setSearchQuery] = useState("");

  // Data State
  const [bookings, setBookings] = useState<MergedBooking[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Modals
  const [selectedBooking, setSelectedBooking] = useState<MergedBooking | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

  // Quick New Reservation Modal
  const [isNewBookingModalOpen, setIsNewBookingModalOpen] = useState(false);
  const [newRoomNumber, setNewRoomNumber] = useState("201");
  const [newCheckIn, setNewCheckIn] = useState("");
  const [newCheckOut, setNewCheckOut] = useState("");
  const [newGuestName, setNewGuestName] = useState("");
  const [newGuestPhone, setNewGuestPhone] = useState("");
  const [newGuestAge, setNewGuestAge] = useState("28");
  const [newAgreedPrice, setNewAgreedPrice] = useState("1500");
  const [isSavingBooking, setIsSavingBooking] = useState(false);

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
          if (parsed.hotelName) {
            setHotelSettings({ hotelName: parsed.hotelName });
          }
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

      const merged: MergedBooking[] = (bookingsData || []).map((b: Booking) => {
        const related = (guestsData || []).filter((g: Guest) => g.booking_id === b.id);
        return {
          ...b,
          primary_guest_name: related.length > 0 ? related[0].name : "Guest",
          primary_guest_phone: related.length > 0 ? (related[0].phone || "") : "",
          total_guests: related.length,
          guests: related
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

  // Determine which booking occupies room `roomNum` on `dateStr`
  const getBookingForRoomAndDate = (roomNum: string, dateStr: string) => {
    return bookings.find(b => {
      if (!b.room_number) return false;
      const cleanRoom = b.room_number.toString().trim();
      if (cleanRoom !== roomNum) return false;

      const checkIn = normalizeDateStr(b.check_in_date);
      const checkOut = normalizeDateStr(b.check_out_date);

      if (!checkIn) return false;

      // Filter search query if provided
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = b.primary_guest_name.toLowerCase().includes(q);
        const matchPhone = b.primary_guest_phone.includes(q);
        const matchRoom = cleanRoom.includes(q);
        if (!matchName && !matchPhone && !matchRoom) return false;
      }

      // Check if date falls in stay range
      if (checkIn === checkOut) {
        return dateStr === checkIn;
      }
      return dateStr >= checkIn && dateStr < checkOut;
    });
  };

  // Check if date is check-out day for a booking in this room
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

  // Calculate stats for today
  const roomsOccupiedToday = ROOMS.filter(r => {
    const b = getBookingForRoomAndDate(r.number, todayStr);
    return !!b;
  }).length;
  const roomsAvailableToday = ROOMS.length - roomsOccupiedToday;
  const occupancyPercent = Math.round((roomsOccupiedToday / ROOMS.length) * 100);

  // Quick reservation handler
  const handleOpenNewReservation = (roomNum: string, dateStr?: string) => {
    setNewRoomNumber(roomNum);
    const startDate = dateStr || todayStr;
    setNewCheckIn(startDate);
    
    // Default checkout: next day
    const nextDay = new Date(startDate);
    nextDay.setDate(nextDay.getDate() + 1);
    const nextDayStr = `${nextDay.getFullYear()}-${String(nextDay.getMonth() + 1).padStart(2, "0")}-${String(nextDay.getDate()).padStart(2, "0")}`;
    setNewCheckOut(nextDayStr);

    setNewGuestName("");
    setNewGuestPhone("");
    setNewGuestAge("28");
    setNewAgreedPrice("1500");
    setIsNewBookingModalOpen(true);
  };

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

    try {
      setIsSavingBooking(true);

      // 1. Insert into Bookings
      const { data: bData, error: bError } = await supabase
        .from("Bookings")
        .insert({
          check_in_date: newCheckIn,
          check_out_date: newCheckOut,
          agreed_price: parseFloat(newAgreedPrice) || 0,
          room_number: newRoomNumber,
          status: "checked_in"
        })
        .select()
        .single();

      if (bError) throw bError;

      // 2. Insert primary guest into Guests
      const { error: gError } = await supabase
        .from("Guests")
        .insert({
          booking_id: bData.id,
          name: newGuestName.trim(),
          age: parseInt(newGuestAge) || 28,
          phone: newGuestPhone.trim()
        });

      if (gError) throw gError;

      alert(`Room ${newRoomNumber} successfully booked for ${newGuestName}!`);
      setIsNewBookingModalOpen(false);
      fetchCalendarData();
    } catch (err: any) {
      console.error("Error creating booking:", err);
      alert("Failed to create booking: " + err.message);
    } finally {
      setIsSavingBooking(false);
    }
  };

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

      <main className="flex-1 flex flex-col overflow-hidden bg-slate-100">
        
        {/* Top Header & Metrics Bar */}
        <header className="bg-white border-b border-slate-200 px-6 py-4 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 shrink-0 shadow-sm z-20">
          <div>
            <div className="flex items-center gap-3">
              <span className="p-2 bg-amber-50 rounded-lg text-[#C5A059] border border-amber-200">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                  Live occupancy grid • Rooms 201 to 207
                </p>
              </div>
            </div>
          </div>

          {/* Quick Metrics Bar */}
          <div className="flex items-center gap-3">
            <div className="bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 flex items-center gap-3 shadow-xs">
              <div className="text-center">
                <p className="text-[10px] uppercase font-bold text-slate-400">Total Rooms</p>
                <p className="text-base font-bold text-slate-800">7</p>
              </div>
              <div className="h-6 w-px bg-slate-200" />
              <div className="text-center">
                <p className="text-[10px] uppercase font-bold text-emerald-600">Occupied Today</p>
                <p className="text-base font-bold text-emerald-700">{roomsOccupiedToday}</p>
              </div>
              <div className="h-6 w-px bg-slate-200" />
              <div className="text-center">
                <p className="text-[10px] uppercase font-bold text-blue-600">Vacant Today</p>
                <p className="text-base font-bold text-blue-700">{roomsAvailableToday}</p>
              </div>
              <div className="h-6 w-px bg-slate-200" />
              <div className="text-center">
                <p className="text-[10px] uppercase font-bold text-purple-600">Occupancy</p>
                <p className="text-base font-bold text-purple-700">{occupancyPercent}%</p>
              </div>
            </div>

            <button
              onClick={() => handleOpenNewReservation("201")}
              className="flex items-center gap-2 px-4 py-2.5 bg-[#0F172A] hover:bg-slate-800 text-[#C5A059] font-bold text-xs rounded-xl shadow-sm transition-all cursor-pointer"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              New Booking
            </button>
          </div>
        </header>

        {/* Date Navigation & Search Subheader */}
        <div className="bg-slate-50 border-b border-slate-200 px-6 py-3 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrevMonth}
              className="p-2 bg-white border border-slate-300 hover:bg-slate-100 rounded-lg text-slate-700 transition-colors shadow-xs cursor-pointer"
              title="Previous Month"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>

            <div className="bg-white border border-slate-300 rounded-lg px-4 py-1.5 shadow-xs flex items-center gap-2 min-w-[170px] justify-center">
              <span className="text-sm font-bold text-slate-800">
                {monthNames[currentMonth]} {currentYear}
              </span>
            </div>

            <button
              onClick={handleNextMonth}
              className="p-2 bg-white border border-slate-300 hover:bg-slate-100 rounded-lg text-slate-700 transition-colors shadow-xs cursor-pointer"
              title="Next Month"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>

            <button
              onClick={handleJumpToToday}
              className="px-3 py-1.5 bg-amber-500/10 text-amber-800 hover:bg-amber-500/20 border border-amber-300 rounded-lg text-xs font-bold transition-colors ml-2 cursor-pointer"
            >
              Today
            </button>
          </div>

          {/* Search bar & Legend */}
          <div className="flex items-center gap-3">
            <div className="relative">
              <input
                type="text"
                placeholder="Search guest, phone, room..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 pr-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500 w-64 shadow-xs"
              />
              <svg className="w-4 h-4 text-slate-400 absolute left-2.5 top-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>

            {/* Legend badges */}
            <div className="hidden xl:flex items-center gap-2 text-[11px] font-medium text-slate-600 bg-white border border-slate-200 px-3 py-1.5 rounded-lg shadow-xs">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> Booked / In-House
              </span>
              <span className="text-slate-300">|</span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500" /> Checkout Day
              </span>
              <span className="text-slate-300">|</span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-slate-300" /> Available
              </span>
            </div>
          </div>
        </div>

        {/* Scrollable Calendar Matrix */}
        <div className="flex-1 overflow-auto bg-slate-100 p-4">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden min-w-[1100px]">
            <table className="w-full border-collapse text-left">
              
              {/* Sticky Table Header: 7 Room Columns */}
              <thead>
                <tr className="bg-slate-900 text-white sticky top-0 z-10 shadow-md">
                  
                  {/* Left Column Header: Date */}
                  <th className="p-3.5 w-36 text-center text-xs font-bold uppercase tracking-wider text-slate-300 border-r border-slate-800 bg-slate-950 sticky left-0 z-20">
                    <div className="flex items-center justify-center gap-1.5">
                      <svg className="w-4 h-4 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      Date
                    </div>
                  </th>

                  {/* 7 Room Columns */}
                  {ROOMS.map((room) => (
                    <th key={room.number} className="p-3 text-center border-r border-slate-800 last:border-r-0 min-w-[140px] bg-slate-900">
                      <div className="flex flex-col items-center">
                        <div className="flex items-center gap-1.5">
                          <span className="text-base font-extrabold text-white tracking-tight">
                            Room {room.number}
                          </span>
                        </div>
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

              {/* Rows: Dates along the Left */}
              <tbody className="divide-y divide-slate-200">
                {monthDates.map((dayItem) => {
                  const isCurrentDay = dayItem.isToday;

                  return (
                    <tr
                      key={dayItem.dateStr}
                      ref={isCurrentDay ? todayRowRef : null}
                      className={`transition-colors ${
                        isCurrentDay
                          ? "bg-amber-50/70 hover:bg-amber-100/50"
                          : dayItem.isWeekend
                          ? "bg-slate-50/70 hover:bg-slate-100/70"
                          : "hover:bg-slate-50"
                      }`}
                    >
                      {/* Sticky Date Cell on Left */}
                      <td
                        className={`p-2.5 text-center border-r border-slate-200 sticky left-0 z-5 font-medium transition-colors ${
                          isCurrentDay
                            ? "bg-amber-100/90 text-amber-950 font-bold border-r-amber-300"
                            : dayItem.isWeekend
                            ? "bg-slate-100/90 text-slate-700"
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
                            <span className="mt-0.5 text-[9px] bg-amber-500 text-white font-extrabold px-1.5 py-0.2 rounded-full uppercase tracking-wider shadow-xs">
                              Today
                            </span>
                          )}
                        </div>
                      </td>

                      {/* 7 Room Columns for this Date */}
                      {ROOMS.map((room) => {
                        const booking = getBookingForRoomAndDate(room.number, dayItem.dateStr);
                        const checkoutBooking = !booking ? getCheckoutForRoomAndDate(room.number, dayItem.dateStr) : null;

                        return (
                          <td
                            key={room.number}
                            className="p-1.5 border-r border-slate-200 last:border-r-0 align-top h-16 relative"
                          >
                            {booking ? (
                              // Occupied / Booked Cell
                              <div
                                onClick={() => {
                                  setSelectedBooking(booking);
                                  setIsDetailModalOpen(true);
                                }}
                                className="w-full h-full min-h-[52px] bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 rounded-xl p-2 flex flex-col justify-between cursor-pointer transition-all shadow-xs group"
                              >
                                <div className="flex items-center justify-between gap-1">
                                  <span className="text-xs font-bold text-emerald-950 truncate max-w-[100px] group-hover:text-emerald-800">
                                    {booking.primary_guest_name}
                                  </span>
                                  <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" title="Occupied" />
                                </div>

                                <div className="flex items-center justify-between text-[10px] text-emerald-700 mt-1">
                                  <span className="truncate max-w-[75px]">
                                    {booking.primary_guest_phone || "In-House"}
                                  </span>
                                  {booking.agreed_price && (
                                    <span className="font-extrabold text-emerald-900">
                                      ₹{booking.agreed_price}
                                    </span>
                                  )}
                                </div>
                              </div>
                            ) : checkoutBooking ? (
                              // Checkout today (Room free for new check-in)
                              <div
                                onClick={() => handleOpenNewReservation(room.number, dayItem.dateStr)}
                                className="w-full h-full min-h-[52px] bg-amber-50/80 hover:bg-amber-100 border border-amber-200 border-dashed rounded-xl p-1.5 flex flex-col justify-between cursor-pointer transition-all shadow-2xs group"
                              >
                                <div className="flex items-center justify-between text-[10px] text-amber-800 font-bold">
                                  <span className="truncate">Out: {checkoutBooking.primary_guest_name}</span>
                                  <span className="text-[9px] bg-amber-200 px-1 rounded text-amber-900">Checkout</span>
                                </div>
                                <div className="text-[10px] text-amber-600 font-medium text-center group-hover:text-amber-900">
                                  + Available for check-in
                                </div>
                              </div>
                            ) : (
                              // Vacant / Available Cell
                              <div
                                onClick={() => handleOpenNewReservation(room.number, dayItem.dateStr)}
                                className="w-full h-full min-h-[52px] rounded-xl border border-transparent hover:border-slate-300 hover:bg-slate-50 flex items-center justify-center cursor-pointer transition-all group p-1 text-slate-300 hover:text-slate-600"
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

        {/* Modal 1: Booking Details */}
        {isDetailModalOpen && selectedBooking && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-xs overflow-y-auto"
            onClick={(e) => {
              if (e.target === e.currentTarget) setIsDetailModalOpen(false);
            }}
          >
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-150">
              
              {/* Modal Header */}
              <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between border-b border-slate-800">
                <div>
                  <h3 className="text-lg font-bold flex items-center gap-2">
                    Room {selectedBooking.room_number || "Unassigned"}
                    <span className="text-xs font-normal px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                      Booking #{selectedBooking.id}
                    </span>
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {ROOMS.find(r => r.number === selectedBooking.room_number)?.type || "Standard Room"}
                  </p>
                </div>
                <button
                  onClick={() => setIsDetailModalOpen(false)}
                  className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-6 space-y-5">
                {/* Stay Dates Box */}
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex items-center justify-between">
                  <div>
                    <p className="text-[10px] uppercase font-bold text-slate-400">Check-In</p>
                    <p className="text-sm font-bold text-slate-800">{selectedBooking.check_in_date}</p>
                  </div>
                  <div className="flex flex-col items-center">
                    <span className="text-xs text-slate-400 font-semibold">➔</span>
                    <span className="text-[10px] text-emerald-700 bg-emerald-100 font-bold px-2 py-0.5 rounded-full mt-1">
                      In-House
                    </span>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] uppercase font-bold text-slate-400">Check-Out</p>
                    <p className="text-sm font-bold text-slate-800">{selectedBooking.check_out_date}</p>
                  </div>
                </div>

                {/* Primary Guest Details */}
                <div>
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                    Primary Guest
                  </h4>
                  <div className="bg-white border border-slate-200 rounded-xl p-3.5 space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-slate-500">Name:</span>
                      <span className="text-sm font-bold text-slate-900">{selectedBooking.primary_guest_name}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-slate-500">Phone:</span>
                      <span className="text-sm font-bold text-slate-900">{selectedBooking.primary_guest_phone || "Not provided"}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-slate-500">Total Guests:</span>
                      <span className="text-sm font-bold text-slate-900">{selectedBooking.total_guests} Guest(s)</span>
                    </div>
                    {selectedBooking.agreed_price && (
                      <div className="flex justify-between items-center border-t border-slate-100 pt-2">
                        <span className="text-xs text-slate-500">Rate / Night:</span>
                        <span className="text-sm font-extrabold text-emerald-700">₹{selectedBooking.agreed_price}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Additional Guests List */}
                {selectedBooking.guests && selectedBooking.guests.length > 0 && (
                  <div>
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                      All Guests ({selectedBooking.guests.length})
                    </h4>
                    <div className="space-y-1.5 max-h-36 overflow-y-auto">
                      {selectedBooking.guests.map((g, idx) => (
                        <div key={g.id || idx} className="bg-slate-50 border border-slate-200 rounded-lg p-2.5 flex items-center justify-between text-xs">
                          <span className="font-semibold text-slate-800">{idx + 1}. {g.name}</span>
                          <span className="text-slate-500">Age: {g.age}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Modal Footer Actions */}
              <div className="bg-slate-50 border-t border-slate-200 px-6 py-4 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => handleDeleteBooking(selectedBooking.id)}
                  className="px-4 py-2 bg-rose-50 text-rose-700 hover:bg-rose-100 font-bold text-xs rounded-xl border border-rose-200 transition-colors cursor-pointer"
                >
                  Cancel / Delete
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => router.push(`/admin`)}
                    className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl transition-colors cursor-pointer"
                  >
                    View in Dashboard
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

        {/* Modal 2: Quick New Reservation */}
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
                  <h3 className="text-lg font-bold flex items-center gap-2 text-[#C5A059]">
                    Quick Reservation
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Assign a room directly on the calendar
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
                  {/* Room Selection */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                      Select Room *
                    </label>
                    <select
                      value={newRoomNumber}
                      onChange={(e) => setNewRoomNumber(e.target.value)}
                      className="w-full px-3 py-2.5 border border-slate-300 rounded-xl text-sm font-semibold bg-white text-slate-900 focus:ring-2 focus:ring-amber-500 focus:outline-none"
                    >
                      {ROOMS.map((r) => (
                        <option key={r.number} value={r.number}>
                          Room {r.number} - {r.type} ({r.bedType})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Dates */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                        Check-In Date *
                      </label>
                      <input
                        type="date"
                        required
                        value={newCheckIn}
                        onChange={(e) => setNewCheckIn(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm text-slate-900 focus:ring-2 focus:ring-amber-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                        Check-Out Date *
                      </label>
                      <input
                        type="date"
                        required
                        value={newCheckOut}
                        onChange={(e) => setNewCheckOut(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm text-slate-900 focus:ring-2 focus:ring-amber-500 focus:outline-none"
                      />
                    </div>
                  </div>

                  {/* Guest Name & Phone */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                        Guest Name *
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="Full Name"
                        value={newGuestName}
                        onChange={(e) => setNewGuestName(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm text-slate-900 focus:ring-2 focus:ring-amber-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                        Phone Number
                      </label>
                      <input
                        type="tel"
                        placeholder="Mobile No."
                        value={newGuestPhone}
                        onChange={(e) => setNewGuestPhone(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm text-slate-900 focus:ring-2 focus:ring-amber-500 focus:outline-none"
                      />
                    </div>
                  </div>

                  {/* Age & Agreed Price */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                        Age
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="120"
                        value={newGuestAge}
                        onChange={(e) => setNewGuestAge(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm text-slate-900 focus:ring-2 focus:ring-amber-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                        Agreed Price (₹)
                      </label>
                      <input
                        type="number"
                        placeholder="1500"
                        value={newAgreedPrice}
                        onChange={(e) => setNewAgreedPrice(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm text-slate-900 focus:ring-2 focus:ring-amber-500 focus:outline-none"
                      />
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="bg-slate-50 border-t border-slate-200 px-6 py-4 flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setIsNewBookingModalOpen(false)}
                    className="px-4 py-2.5 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 font-bold text-xs rounded-xl transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSavingBooking}
                    className="px-5 py-2.5 bg-[#0F172A] hover:bg-slate-800 text-[#C5A059] font-bold text-xs rounded-xl shadow-sm transition-all disabled:opacity-50 cursor-pointer flex items-center gap-2"
                  >
                    {isSavingBooking ? "Saving Booking..." : "Confirm & Save"}
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
