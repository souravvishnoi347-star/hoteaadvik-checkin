"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/utils/supabase";
import dynamic from "next/dynamic";
import AdminSidebar from "@/components/AdminSidebar";

function QuickBillPage() {
  const router = useRouter();
  const invoiceRef = useRef<HTMLDivElement>(null);

  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const [hotelSettings, setHotelSettings] = useState({
    hotelName: "HOTEL AADVIK INN",
    hotelAddress: "ARYA NAGAR HARIDWAR UTTARAKHAND",
    gstin: "",
    contact: "+91 9528255318",
    gstPercentage: 0,
    extraBedCharge: 350
  });

  // Form State
  const [guestName, setGuestName] = useState("");
  const [guestPhone, setGuestPhone] = useState("");
  const [checkIn, setCheckIn] = useState(new Date().toISOString().slice(0, 10));
  const [checkOut, setCheckOut] = useState(new Date(Date.now() + 86400000).toISOString().slice(0, 10));
  const [roomNumber, setRoomNumber] = useState("");
  const [roomType, setRoomType] = useState("");
  const [ratePerNight, setRatePerNight] = useState("");
  const [isExtraBed, setIsExtraBed] = useState(false);
  const [paymentMode, setPaymentMode] = useState("Cash");
  const [guestGst, setGuestGst] = useState("");
  const [isDownloading, setIsDownloading] = useState(false);

  // Instead of waiting to assign an ID, we'll just use a mock ID for the live preview,
  // then when they click generate, we get the real ID and update it right before downloading.
  const [bookingId, setBookingId] = useState<number>(0);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const savedSettings = localStorage.getItem("hotelSettings");
      if (savedSettings) {
        try {
          setHotelSettings(prev => ({ ...prev, ...JSON.parse(savedSettings) }));
        } catch (e) {}
      }
    }

    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push("/admin/login");
      } else {
        setIsCheckingSession(false);
      }
    };
    checkSession();
  }, [router]);

  const getCalculations = () => {
    const start = new Date(checkIn);
    const end = new Date(checkOut);
    
    // Calculate nights, strictly minimum 1 night
    const diffTime = end.getTime() - start.getTime();
    let nights = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    if (nights <= 0 || isNaN(nights)) nights = 1;
    
    const rate = parseFloat(ratePerNight) || 0;
    
    const extraBedTotal = isExtraBed ? (hotelSettings.extraBedCharge * nights) : 0;
    const subtotal = (rate * nights) + extraBedTotal;
    
    const gstPercent = hotelSettings.gstPercentage || 0;
    const gstAmount = subtotal * (gstPercent / 100);
    const grandTotal = subtotal + gstAmount;

    return {
      duration: nights,
      rate,
      extraBedTotal,
      subtotal,
      gstAmount,
      grandTotal,
      checkIn: start.toLocaleDateString(),
      checkOut: end.toLocaleDateString()
    };
  };

  const handleGenerateBill = async () => {
    if (!guestName || !roomNumber || !roomType || !ratePerNight) {
      alert("Please fill in all required fields (Name, Room No, Room Type, Rate).");
      return;
    }

    setIsDownloading(true);

    try {
      const calc = getCalculations();

      // 1. Insert into Bookings
      const { data: bookingData, error: bookingError } = await supabase
        .from("Bookings")
        .insert([{
          status: 'Checked-Out',
          check_in_date: checkIn,
          check_out_date: checkOut,
          room_number: roomNumber,
          agreed_price: parseFloat(ratePerNight)
        }])
        .select()
        .single();

      if (bookingError) {
        if (bookingError.message?.includes("total_amount") || bookingError.code === "PGRST204" || bookingError.code === "42703") {
          const { data: fallbackData, error: fallbackError } = await supabase
            .from("Bookings")
            .insert([{
              status: 'Checked-Out',
              check_in_date: checkIn,
              check_out_date: checkOut
            }])
            .select()
            .single();
            
          if (fallbackError) throw fallbackError;
          alert("WARNING: Bill generated but Revenue & Room not tracked correctly! Please add 'total_amount', 'room_number', and 'agreed_price' columns to Bookings table in Supabase.");
          await processGuestAndPDF(fallbackData.id, calc);
        } else {
          throw bookingError;
        }
      } else {
        await processGuestAndPDF(bookingData.id, calc);
      }
    } catch (err: any) {
      console.error(err);
      alert("Error generating bill: " + err.message);
      setIsDownloading(false);
    }
  };

  const processGuestAndPDF = async (finalBookingId: number, calc: any) => {
    setBookingId(finalBookingId);

    // 2. Insert into Guests
    const { error: guestError } = await supabase
      .from("Guests")
      .insert([{
        booking_id: finalBookingId,
        name: guestName,
        phone: guestPhone || "",
        age: 30, // Default age
        id_image_url: ""
      }]);

    if (guestError) {
      console.error("Guest insert error:", guestError);
    }

    // Wait for react to update the ID in the invoice DOM
    setTimeout(async () => {
      const element = invoiceRef.current;
      if (!element) {
        alert("Invoice template missing.");
        setIsDownloading(false);
        return;
      }

      // @ts-ignore
      const html2pdf = (await import("html2pdf.js")).default;
      const opt = {
        margin: 0,
        filename: `QuickBill_${finalBookingId}_${guestName.replace(/\s+/g, '_')}.pdf`,
        image: { type: 'jpeg' as const, quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, letterRendering: true, scrollY: 0 },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' as const }
      };

      const parentElement = element.parentElement;
      const originalOverflow = parentElement ? parentElement.style.overflow : '';
      if (parentElement) parentElement.style.overflow = 'visible';

      html2pdf().set(opt).from(element).save().then(() => {
        if (parentElement) parentElement.style.overflow = originalOverflow;
        setIsDownloading(false);
        // Reset state
        setGuestName("");
        setGuestPhone("");
        setRoomNumber("");
        setRoomType("");
        setRatePerNight("");
        setGuestGst("");
        setIsExtraBed(false);
        setBookingId(0);
      }).catch((e: any) => {
        if (parentElement) parentElement.style.overflow = originalOverflow;
        console.error("PDF generation failed:", e);
        setIsDownloading(false);
        alert("Failed to generate PDF document.");
      });
    }, 1000);
  };

  if (isCheckingSession) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-600 mb-4"></div>
        <p className="text-gray-500 font-medium">Verifying access...</p>
      </div>
    );
  }

  const calc = getCalculations();

  return (
    <div className="flex h-screen bg-gray-50 flex-col md:flex-row relative">
      <AdminSidebar activePath="/admin/quick-bill" hotelName={hotelSettings.hotelName} />

      <main className="flex-1 flex flex-col md:flex-row overflow-hidden z-0">
        
        {/* Left Column: Form */}
        <div className="w-full md:w-1/3 border-r border-gray-100 bg-white overflow-y-auto flex flex-col shrink-0">
          <header className="bg-white border-b px-6 py-5 flex justify-between items-center shrink-0">
            <h2 className="text-xl font-semibold text-gray-800">Quick Bill Generator</h2>
          </header>

          <div className="p-6 flex-1 flex flex-col gap-6">
            <div>
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 border-b pb-2">Guest Info</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-2">Guest Name *</label>
                  <input type="text" value={guestName} onChange={(e) => setGuestName(e.target.value)} placeholder="Full Name" className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-600 outline-none transition-all text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-2">Phone Number</label>
                  <input type="text" value={guestPhone} onChange={(e) => setGuestPhone(e.target.value)} placeholder="Mobile No." className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-600 outline-none transition-all text-sm" />
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 border-b pb-2">Stay Info</h3>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-2">Check-In *</label>
                    <input type="date" value={checkIn} onChange={(e) => setCheckIn(e.target.value)} className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-600 outline-none transition-all text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-2">Check-Out *</label>
                    <input type="date" value={checkOut} onChange={(e) => setCheckOut(e.target.value)} className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-600 outline-none transition-all text-sm" />
                  </div>
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 border-b pb-2">Room & Billing Info</h3>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-2">Room No *</label>
                    <input type="text" value={roomNumber} onChange={(e) => setRoomNumber(e.target.value)} placeholder="101" className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-600 outline-none transition-all text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-2">Type *</label>
                    <select value={roomType} onChange={(e) => setRoomType(e.target.value)} className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-600 outline-none transition-all text-sm">
                      <option value="">Select Type</option>
                      <option value="Standard Non-AC">Standard Non-AC</option>
                      <option value="Standard AC">Standard AC</option>
                      <option value="Deluxe AC">Deluxe AC</option>
                      <option value="Super Deluxe AC">Super Deluxe AC</option>
                      <option value="Family Suite">Family Suite</option>
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-2">Rate/Night (Rs) *</label>
                    <input type="number" value={ratePerNight} onChange={(e) => setRatePerNight(e.target.value)} placeholder="1500" className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-600 outline-none transition-all text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-2">Payment</label>
                    <select value={paymentMode} onChange={(e) => setPaymentMode(e.target.value)} className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-600 outline-none transition-all text-sm">
                      <option value="Cash">Cash</option>
                      <option value="UPI">UPI</option>
                      <option value="Credit Card">Credit Card</option>
                      <option value="Debit Card">Debit Card</option>
                      <option value="Bank Transfer">Bank Transfer</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-2">Guest GSTIN (Optional)</label>
                  <input type="text" value={guestGst} onChange={(e) => setGuestGst(e.target.value)} placeholder="e.g. 22AAAAA0000A1Z5" className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-600 outline-none transition-all text-sm uppercase" />
                </div>
                <div className="flex items-center">
                  <input type="checkbox" id="extraBed" checked={isExtraBed} onChange={(e) => setIsExtraBed(e.target.checked)} className="w-4 h-4 text-amber-600 border-gray-300 rounded focus:ring-amber-500 cursor-pointer" />
                  <label htmlFor="extraBed" className="ml-2 text-sm font-bold text-gray-700 cursor-pointer">
                    Extra Bed (Rs. {hotelSettings.extraBedCharge || 350}/night)
                  </label>
                </div>
              </div>
            </div>

            <div className="mt-auto pt-6 border-t border-gray-100">
              <button
                onClick={handleGenerateBill}
                disabled={!guestName || !roomNumber || !roomType || !ratePerNight || isDownloading}
                className="w-full flex items-center justify-center gap-2 bg-amber-700 hover:bg-amber-800 text-white font-bold py-4 px-4 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-md hover:shadow-lg"
              >
                {isDownloading ? "Generating PDF..." : "Generate Bill & Save"}
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: Live PDF Preview */}
        <div className="w-full md:w-2/3 bg-gray-300 overflow-auto p-4 md:p-8 flex items-start justify-center relative inner-shadow">
          <div 
            ref={invoiceRef} 
            id="invoice-template" 
            className="relative shrink-0 flex flex-col shadow-2xl bg-white" 
            style={{ width: '210mm', minHeight: '297mm', padding: '15mm 20mm', color: '#0f172a', fontFamily: 'system-ui, -apple-system, sans-serif' }}
          >
            {/* Header: Two Column Layout */}
            <div className="flex justify-between items-start border-b-2 pb-6 mb-8" style={{ borderColor: '#e2e8f0' }}>
              <div className="flex items-center gap-4">
                <img src="/logo.png" alt="Hotel Logo" className="h-20 object-contain" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                <div>
                  <h1 className="text-3xl font-extrabold tracking-tight" style={{ color: '#0f172a' }}>{hotelSettings.hotelName}</h1>
                  <p className="text-sm font-medium mt-1 text-slate-500">{hotelSettings.hotelAddress}</p>
                  {hotelSettings.gstin && (
                    <p className="text-sm font-semibold mt-1" style={{ color: '#334155' }}>GSTIN: {hotelSettings.gstin}</p>
                  )}
                </div>
              </div>
              <div className="text-right">
                <h2 className="text-4xl font-black uppercase tracking-widest mb-2" style={{ color: '#1e3a8a' }}>INVOICE</h2>
                <p className="text-sm font-bold" style={{ color: '#475569' }}>INV-{new Date().toISOString().slice(0,10).replace(/-/g,'')}-{bookingId ? bookingId.toString().padStart(4, '0') : 'XXXX'}</p>
                <p className="text-sm font-medium mt-1" style={{ color: '#64748b' }}>Date: {new Date().toLocaleDateString()}</p>
              </div>
            </div>

            {/* Info Section: Two Columns */}
            <div className="flex justify-between gap-8 mb-8">
              <div className="w-1/2">
                <h3 className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: '#94a3b8' }}>Bill To</h3>
                <p className="font-bold text-lg" style={{ color: '#0f172a' }}>{guestName || 'Guest Name'}</p>
                <p className="font-medium text-sm mt-1" style={{ color: '#475569' }}>Phone: {guestPhone || '—'}</p>
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
                <div className="w-1/3 text-right">
                  <div className="h-16"></div>
                  <div className="border-t pt-2 inline-block" style={{ borderColor: '#cbd5e1' }}>
                    <p className="text-xs font-bold text-slate-700 uppercase tracking-widest">Authorized Signatory</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default dynamic(() => Promise.resolve(QuickBillPage), { ssr: false });
