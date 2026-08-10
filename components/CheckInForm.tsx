"use client";

import React, { useState } from 'react';
import Tesseract from 'tesseract.js';
import { supabase } from '../utils/supabase';
import imageCompression from 'browser-image-compression';

interface PrimaryGuest {
  name: string;
  age: string;
  phone: string;
  checkInDate: string;
  checkOutDate: string;
  agreedPrice: string;
}

interface AdditionalGuest {
  name: string;
  age: string;
}

const rotateImage = (file: File | Blob): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const canvas = document.createElement('canvas');
      canvas.width = img.height;
      canvas.height = img.width;
      const ctx = canvas.getContext('2d');
      if (!ctx) return reject(new Error('No canvas context'));
      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.rotate(Math.PI / 2); // Rotate 90 degrees
      ctx.drawImage(img, -img.width / 2, -img.height / 2);
      canvas.toBlob((blob) => {
        if (blob) resolve(blob);
        else reject(new Error('Canvas toBlob failed'));
      }, file.type || 'image/jpeg');
    };
    img.onerror = () => reject(new Error('Image load failed'));
    img.src = url;
  });
};

export default function CheckInForm() {
  const [primaryGuest, setPrimaryGuest] = useState<PrimaryGuest>({
    name: '',
    age: '',
    phone: '',
    checkInDate: '',
    checkOutDate: '',
    agreedPrice: '',
  });

  const [maleGuests, setMaleGuests] = useState<number>(0);
  const [femaleGuests, setFemaleGuests] = useState<number>(0);
  const [idFiles, setIdFiles] = useState<{ [key: number]: File | null }>({});
  
  // Agent states
  const [agents, setAgents] = useState<any[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState<string>('');
  const [agentCommission, setAgentCommission] = useState<string>('');

  React.useEffect(() => {
    async function fetchAgents() {
      const { data, error } = await supabase.from('Agents').select('*').eq('status', 'Active');
      if (!error && data) {
        setAgents(data);
      }
    }
    fetchAgents();
  }, []);
  const [idStatus, setIdStatus] = useState<{ [key: number]: 'idle' | 'scanning' | 'valid' | 'invalid' }>({});
  
  const [idBackFiles, setIdBackFiles] = useState<{ [key: number]: File | null }>({});
  const [idBackStatus, setIdBackStatus] = useState<{ [key: number]: 'idle' | 'uploaded' }>({});
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handlePrimaryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setPrimaryGuest((prev) => ({ ...prev, [name]: value }));
  };



  const handleFileChange = async (guestIndex: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    
    if (!file) {
      setIdFiles((prev) => ({ ...prev, [guestIndex]: null }));
      setIdStatus((prev) => ({ ...prev, [guestIndex]: 'idle' }));
      return;
    }

    setIdStatus((prev) => ({ ...prev, [guestIndex]: 'scanning' }));

    try {
      // 1. Run OCR on high-res original for accuracy, compress concurrently for storage
      const ocrPromise = Tesseract.recognize(file, 'eng').catch(err => {
        console.error("OCR Promise error:", err);
        return { data: { text: '' } };
      });
      const compressionPromise = imageCompression(file, { maxSizeMB: 0.3, maxWidthOrHeight: 1920, useWebWorker: true }).catch(err => {
        console.error("Compression error:", err);
        return file;
      });

      const [ocrResult, compressedFile] = await Promise.all([ocrPromise, compressionPromise]);
      const { data: { text } } = ocrResult as any;

      setIdFiles((prev) => ({ ...prev, [guestIndex]: compressedFile as File }));

      const checkValid = (t: string) => {
        const aadhaarRegex = /\d{4}\s?\d{4}\s?\d{4}/;
        const panRegex = /[A-Z]{5}[0-9]{4}[A-Z]{1}/i;
        const hasKeywords = ['GOVERNMENT OF INDIA', 'MALE', 'FEMALE', 'INCOME TAX', 'DOB', 'ELECTION', 'FATHER'].some(keyword => 
          t.includes(keyword)
        );
        return aadhaarRegex.test(t) || panRegex.test(t) || hasKeywords;
      };

      let isValid = checkValid(text.toUpperCase());

      // 2. If it fails, the ID might be rotated 90 degrees (landscape card shot in portrait)
      if (!isValid) {
        try {
          const rotatedBlob = await rotateImage(file);
          const { data: { text: textRotated } } = await Tesseract.recognize(rotatedBlob, 'eng');
          isValid = checkValid(textRotated.toUpperCase());
        } catch (rotErr) {
          console.error("Rotation OCR failed:", rotErr);
        }
      }

      if (isValid) {
        setIdStatus((prev) => ({ ...prev, [guestIndex]: 'valid' }));
      } else {
        setIdStatus((prev) => prev[guestIndex] === 'valid' ? prev : { ...prev, [guestIndex]: 'invalid' });
      }
    } catch (error) {
      console.error("OCR Error:", error);
      setIdStatus((prev) => prev[guestIndex] === 'valid' ? prev : { ...prev, [guestIndex]: 'invalid' });
    }
  };

  const handleBackFileChange = async (guestIndex: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    if (!file) {
      setIdBackFiles((prev) => ({ ...prev, [guestIndex]: null }));
      setIdBackStatus((prev) => ({ ...prev, [guestIndex]: 'idle' }));
      return;
    }
    
    setIdBackStatus((prev) => ({ ...prev, [guestIndex]: 'uploaded' }));
    
    let fileToStore: File | Blob = file;
    try {
      const compressionOptions = { maxSizeMB: 0.3, maxWidthOrHeight: 1920, useWebWorker: true };
      fileToStore = await imageCompression(file, compressionOptions);
    } catch (err) {
      console.error("Back file compression failed:", err);
    }
    
    setIdBackFiles((prev) => ({ ...prev, [guestIndex]: fileToStore as File }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!allIdsValid) return;
    
    setIsSubmitting(true);

    try {
      const uploadedUrls: { [key: number]: string } = {};
      const uploadedBackUrls: { [key: number]: string } = {};

      const totalGuests = 1;
      
      // 1. Upload All Files
      for (let i = 0; i < totalGuests; i++) {
        const file = idFiles[i];
        if (file) {
          const fileExt = file.name ? file.name.split('.').pop() || 'jpg' : 'jpg';
          const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
          const { error } = await supabase.storage.from('id_proofs').upload(fileName, file);
          if (error) throw error;
          const { data: { publicUrl } } = supabase.storage.from('id_proofs').getPublicUrl(fileName);
          uploadedUrls[i] = publicUrl;
        }

        const backFile = idBackFiles[i];
        if (backFile) {
          const fileExt = backFile.name ? backFile.name.split('.').pop() || 'jpg' : 'jpg';
          const fileName = `back_${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
          const { error } = await supabase.storage.from('id_proofs').upload(fileName, backFile);
          if (error) throw error;
          const { data: { publicUrl } } = supabase.storage.from('id_proofs').getPublicUrl(fileName);
          uploadedBackUrls[i] = publicUrl;
        }
      }

      // 2. Insert into Bookings via RPC (Bypasses SELECT RLS for anonymous users)
      const { data: bookingId, error: bookingError } = await supabase.rpc('create_booking_return_id', {
        p_check_in_date: primaryGuest.checkInDate,
        p_check_out_date: primaryGuest.checkOutDate,
        p_agreed_price: primaryGuest.agreedPrice ? parseFloat(primaryGuest.agreedPrice) : null,
        p_status: 'checked_in'
      });
        
      if (bookingError) throw bookingError;

      // 3. Prepare and Insert Guests
      const guestsToInsert: any[] = [];
      
      // Primary Guest
      guestsToInsert.push({
        booking_id: bookingId,
        name: primaryGuest.name,
        age: parseInt(primaryGuest.age),
        phone: primaryGuest.phone || null,
        id_image_url: uploadedUrls[0] || null,
        id_image_back_url: uploadedBackUrls[0] || null
      });

      // Additional Guests
      for (let i = 0; i < maleGuests; i++) {
        guestsToInsert.push({
          booking_id: bookingId,
          name: 'Additional Male Guest',
          age: 0,
          phone: null,
          id_image_url: null,
          id_image_back_url: null
        });
      }
      for (let i = 0; i < femaleGuests; i++) {
        guestsToInsert.push({
          booking_id: bookingId,
          name: 'Additional Female Guest',
          age: 0,
          phone: null,
          id_image_url: null,
          id_image_back_url: null
        });
      }

      const { error: guestsError } = await supabase
        .from('Guests')
        .insert(guestsToInsert);

      if (guestsError && guestsError.message?.includes('id_image_back_url')) {
        alert("WARNING: The 'id_image_back_url' column is missing in your Supabase Guests table! The back images were not saved. Please add it.");
        const fallbackGuests = guestsToInsert.map(g => {
          const { id_image_back_url, ...rest } = g;
          return rest;
        });
        const { error: fallbackError } = await supabase.from('Guests').insert(fallbackGuests);
        if (fallbackError) throw fallbackError;
      } else if (guestsError) {
        throw guestsError;
      }

      // 4. Update Agent if selected
      if (selectedAgentId && agentCommission) {
        const agentIdNum = parseInt(selectedAgentId);
        const commissionNum = parseFloat(agentCommission);
        const totalBookingGuests = 1 + maleGuests + femaleGuests;
        
        if (!isNaN(agentIdNum) && !isNaN(commissionNum) && commissionNum > 0) {
           const { data: currentAgent } = await supabase.from('Agents').select('total_guests, total_credit').eq('id', agentIdNum).single();
           if (currentAgent) {
             await supabase.from('Agents').update({
               total_guests: (currentAgent.total_guests || 0) + totalBookingGuests,
               total_credit: (currentAgent.total_credit || 0) + commissionNum
             }).eq('id', agentIdNum);
           }
        }
      }

      // 4. On successful save
      setIsSubmitted(true);
      
    } catch (err: any) {
      console.error("Submission Error:", err);
      alert("Failed to complete check-in: " + (err?.message || JSON.stringify(err) || "Unknown error"));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReset = () => {
    setIsSubmitted(false);
    setPrimaryGuest({ name: '', age: '', phone: '', checkInDate: '', checkOutDate: '', agreedPrice: '' });
    setMaleGuests(0);
    setFemaleGuests(0);
    setIdFiles({});
    setIdStatus({});
    setIdBackFiles({});
    setIdBackStatus({});
  };

  const allIdsValid = idStatus[0] === 'valid';

  if (isSubmitted) {
    return (
      <div className="min-h-screen bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-indigo-100 via-slate-50 to-purple-100 py-12 px-4 sm:px-6 lg:px-8 font-sans flex items-center justify-center">
        <div className="w-full max-w-md mx-auto bg-white/80 backdrop-blur-xl p-8 sm:p-10 rounded-[2rem] shadow-2xl border border-white/50 text-center animate-in zoom-in duration-300">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-10 h-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-3xl font-extrabold text-slate-900 mb-4 tracking-tight">Check-in Complete!</h2>
          <p className="text-slate-500 mb-8 text-lg leading-relaxed">
            Welcome to Hotel Aadvik INN. Your details have been verified. Please collect your room keys from the reception.
          </p>
          <button
            onClick={handleReset}
            className="w-full py-4 text-white text-lg font-semibold rounded-2xl bg-indigo-600 hover:bg-indigo-700 shadow-lg shadow-indigo-200 transition-all active:scale-[0.98]"
          >
            Check-in Another Guest
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-indigo-100 via-slate-50 to-purple-100 py-8 px-4 sm:px-6 lg:px-8 font-sans text-slate-800 flex items-center justify-center">
      <div className="w-full max-w-xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
        
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900">
            Guest Check-in
          </h1>
          <p className="text-sm sm:text-base text-slate-500">
            Please fill out your details to complete your registration.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          
          {/* Primary Guest Card */}
          <div className="bg-white/70 backdrop-blur-xl p-5 sm:p-6 rounded-3xl shadow-lg border border-white/60 transition-all duration-300 hover:shadow-2xl hover:-translate-y-1">
            <div className="flex items-center gap-3 mb-5">
              <div className="bg-indigo-100 text-indigo-600 w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm">
                1
              </div>
              <h2 className="text-lg sm:text-xl font-semibold text-slate-800">Primary Guest</h2>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">Full Name</label>
                <input
                  type="text"
                  name="name"
                  value={primaryGuest.name}
                  onChange={handlePrimaryChange}
                  required
                  placeholder="John Doe"
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition-colors outline-none text-slate-700 bg-slate-50 focus:bg-white"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1">Age</label>
                  <input
                    type="number"
                    name="age"
                    value={primaryGuest.age}
                    onChange={handlePrimaryChange}
                    required
                    min="18"
                    placeholder="30"
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition-colors outline-none text-slate-700 bg-slate-50 focus:bg-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1">Phone Number</label>
                  <input
                    type="tel"
                    name="phone"
                    value={primaryGuest.phone}
                    onChange={handlePrimaryChange}
                    required
                    placeholder="+91 9876543210"
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition-colors outline-none text-slate-700 bg-slate-50 focus:bg-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1">Check-in Date</label>
                  <input
                    type="date"
                    name="checkInDate"
                    value={primaryGuest.checkInDate}
                    onChange={handlePrimaryChange}
                    required
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition-colors outline-none text-slate-700 bg-slate-50 focus:bg-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1">Check-out Date</label>
                  <input
                    type="date"
                    name="checkOutDate"
                    value={primaryGuest.checkOutDate}
                    onChange={handlePrimaryChange}
                    required
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition-colors outline-none text-slate-700 bg-slate-50 focus:bg-white"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1">Agreed Price (Rs.) *</label>
                  <input
                    type="number"
                    name="agreedPrice"
                    value={primaryGuest.agreedPrice}
                    onChange={handlePrimaryChange}
                    required
                    min="0"
                    placeholder="e.g. 1500"
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition-colors outline-none text-slate-700 bg-slate-50 focus:bg-white font-semibold"
                  />
                </div>
                
                <div className="bg-indigo-50/50 p-4 rounded-xl border border-indigo-100 sm:col-span-1">
                  <label className="block text-sm font-medium text-indigo-900 mb-1">Referred By Agent (Optional)</label>
                  <select
                    value={selectedAgentId}
                    onChange={(e) => setSelectedAgentId(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-lg border border-indigo-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition-colors outline-none text-slate-700 bg-white mb-3"
                  >
                    <option value="">-- No Agent (Direct Booking) --</option>
                    {agents.map((agent) => (
                      <option key={agent.id} value={agent.id}>{agent.name}</option>
                    ))}
                  </select>
                  
                  {selectedAgentId && (
                    <>
                      <label className="block text-sm font-medium text-indigo-900 mb-1">Commission (Rs.)</label>
                      <input
                        type="number"
                        value={agentCommission}
                        onChange={(e) => setAgentCommission(e.target.value)}
                        min="0"
                        placeholder="e.g. 200"
                        className="w-full px-4 py-2.5 rounded-lg border border-indigo-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition-colors outline-none text-slate-700 bg-white font-semibold"
                      />
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Guest Counts */}
          <div className="bg-white/70 backdrop-blur-xl p-5 sm:p-6 rounded-3xl shadow-lg border border-white/60 transition-all duration-300 hover:shadow-2xl hover:-translate-y-1">
            <h2 className="text-lg sm:text-xl font-semibold text-slate-800 mb-4">Additional Guests (Optional)</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">Male Guests</label>
                <input
                  type="number"
                  min="0"
                  value={maleGuests === 0 ? '' : maleGuests}
                  onChange={(e) => setMaleGuests(parseInt(e.target.value) || 0)}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition-colors outline-none text-slate-700 bg-slate-50 focus:bg-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">Female Guests</label>
                <input
                  type="number"
                  min="0"
                  value={femaleGuests === 0 ? '' : femaleGuests}
                  onChange={(e) => setFemaleGuests(parseInt(e.target.value) || 0)}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition-colors outline-none text-slate-700 bg-slate-50 focus:bg-white"
                />
              </div>
            </div>
          </div>

          {/* ID Uploads Section */}
          <div className="bg-white/70 backdrop-blur-xl p-5 sm:p-6 rounded-3xl shadow-lg border border-white/60 transition-all duration-300 hover:shadow-2xl hover:-translate-y-1">
            <h2 className="text-lg sm:text-xl font-semibold text-slate-800 mb-2">Identity Verification</h2>
            <div className="mb-5 space-y-3">
              <p className="text-sm text-slate-500">
                Please upload a valid government-issued ID for the primary guest. OCR verification is required.
              </p>
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                <p className="text-sm font-semibold text-amber-800">
                  ⚠️ Note: If you have an e-Aadhaar PDF, please take a screenshot of it on your phone and upload the image.
                </p>
              </div>
            </div>

            <div className="space-y-4">
              {/* Primary Guest ID Upload */}
              <div className="flex flex-col p-4 bg-white/50 rounded-2xl border border-white/60 gap-3 transition-all shadow-sm">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="w-full sm:w-1/3">
                    <p className="font-medium text-slate-700 line-clamp-1">{primaryGuest.name || "Primary Guest"}'s ID</p>
                    <p className="text-xs text-slate-500 mt-0.5">Formats: JPG, PNG</p>
                  </div>
                  
                  <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-2/3 shrink-0">
                    {idStatus[0] === 'valid' || idStatus[0] === 'scanning' ? (
                      <div className="relative w-full">
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => handleFileChange(0, e)}
                          disabled={idStatus[0] === 'scanning'}
                          className={`absolute inset-0 w-full h-full opacity-0 z-10 ${idStatus[0] !== 'scanning' ? 'cursor-pointer' : ''}`}
                          title="Change Front Side"
                        />
                        <div className={`w-full text-center px-4 py-2.5 rounded-xl text-sm font-medium transition-colors border flex items-center justify-center gap-2 ${idStatus[0] === 'scanning' ? 'bg-amber-50 text-amber-700 border-amber-200 shadow-sm animate-pulse' : 'bg-emerald-50 text-emerald-700 border-emerald-200 shadow-sm'}`}>
                          {idStatus[0] === 'scanning' ? 'Verifying...' : '✓ Front Verified'}
                        </div>
                      </div>
                    ) : (
                      <div className="flex gap-2 w-full">
                        <div className="relative w-1/2">
                          <input
                            type="file"
                            accept="image/*"
                            capture="environment"
                            onChange={(e) => handleFileChange(0, e)}
                            className="absolute inset-0 w-full h-full opacity-0 z-10 cursor-pointer"
                            title="Take Photo"
                          />
                          <div className={`w-full text-center px-1 py-2.5 rounded-xl text-xs sm:text-sm font-medium transition-colors border flex items-center justify-center gap-1 ${idStatus[0] === 'invalid' ? 'bg-red-50 text-red-600 border-red-200 hover:bg-red-100 shadow-sm' : 'bg-white text-indigo-600 border-indigo-200 hover:bg-indigo-50 shadow-sm'}`}>
                            <span className="text-base">📷</span> Camera
                          </div>
                        </div>
                        <div className="relative w-1/2">
                          <input
                            type="file"
                            accept="image/*"
                            onChange={(e) => handleFileChange(0, e)}
                            className="absolute inset-0 w-full h-full opacity-0 z-10 cursor-pointer"
                            title="Upload from Gallery"
                          />
                          <div className={`w-full text-center px-1 py-2.5 rounded-xl text-xs sm:text-sm font-medium transition-colors border flex items-center justify-center gap-1 ${idStatus[0] === 'invalid' ? 'bg-red-50 text-red-600 border-red-200 hover:bg-red-100 shadow-sm' : 'bg-white text-indigo-600 border-indigo-200 hover:bg-indigo-50 shadow-sm'}`}>
                            <span className="text-base">📁</span> Gallery
                          </div>
                        </div>
                      </div>
                    )}

                    {idBackStatus[0] === 'uploaded' ? (
                      <div className="relative w-full">
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => handleBackFileChange(0, e)}
                          className="absolute inset-0 w-full h-full opacity-0 z-10 cursor-pointer"
                          title="Change Back Side"
                        />
                        <div className="w-full text-center px-4 py-2.5 rounded-xl text-sm font-medium transition-colors border flex items-center justify-center gap-2 bg-emerald-50 text-emerald-700 border-emerald-200 shadow-sm">
                          ✓ Back Uploaded
                        </div>
                      </div>
                    ) : (
                      <div className="flex gap-2 w-full">
                        <div className="relative w-1/2">
                          <input
                            type="file"
                            accept="image/*"
                            capture="environment"
                            onChange={(e) => handleBackFileChange(0, e)}
                            className="absolute inset-0 w-full h-full opacity-0 z-10 cursor-pointer"
                            title="Take Photo"
                          />
                          <div className="w-full text-center px-1 py-2.5 rounded-xl text-xs sm:text-sm font-medium transition-colors border flex items-center justify-center gap-1 bg-white text-indigo-600 border-indigo-200 hover:bg-indigo-50 shadow-sm">
                            <span className="text-base">📷</span> Camera
                          </div>
                        </div>
                        <div className="relative w-1/2">
                          <input
                            type="file"
                            accept="image/*"
                            onChange={(e) => handleBackFileChange(0, e)}
                            className="absolute inset-0 w-full h-full opacity-0 z-10 cursor-pointer"
                            title="Upload from Gallery"
                          />
                          <div className="w-full text-center px-1 py-2.5 rounded-xl text-xs sm:text-sm font-medium transition-colors border flex items-center justify-center gap-1 bg-white text-indigo-600 border-indigo-200 hover:bg-indigo-50 shadow-sm">
                            <span className="text-base">📁</span> Gallery
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                {idStatus[0] === 'invalid' && (
                  <div className="flex items-center justify-between mt-2 animate-in fade-in slide-in-from-top-1 bg-red-50 p-3 rounded-xl border border-red-100">
                    <p className="text-red-600 text-sm font-medium">
                      Invalid ID detected: Please upload a clear photo of the Front Side of a valid Government ID
                    </p>
                    <button 
                      type="button"
                      onClick={() => setIdStatus(prev => ({ ...prev, [0]: 'valid' }))}
                      className="ml-4 px-4 py-2 text-xs font-bold text-red-700 hover:text-red-900 bg-red-100 hover:bg-red-200 rounded-lg transition-colors shrink-0"
                    >
                      Skip Verification (Force Accept)
                    </button>
                  </div>
                )}
                {idStatus[0] === 'scanning' && (
                  <div className="flex items-center justify-end mt-2 animate-in fade-in slide-in-from-top-1">
                    <button 
                      type="button"
                      onClick={() => setIdStatus(prev => ({ ...prev, [0]: 'valid' }))}
                      className="px-4 py-2 text-xs font-bold text-amber-700 hover:text-amber-900 bg-amber-100 hover:bg-amber-200 rounded-lg transition-colors shrink-0 shadow-sm"
                    >
                      Taking too long? Skip Verification
                    </button>
                  </div>
                )}
              </div>


            </div>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={!allIdsValid || isSubmitting}
            className={`w-full py-4 text-white text-lg font-semibold rounded-3xl transition-all shadow-lg mt-8 ${
              (allIdsValid && !isSubmitting)
                ? 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-200 active:scale-[0.98]' 
                : 'bg-slate-300 shadow-none cursor-not-allowed text-slate-500'
            }`}
          >
            {isSubmitting 
              ? 'Saving Data...' 
              : allIdsValid 
                ? 'Complete Check-in' 
                : 'Please Verify All IDs'
            }
          </button>
          
        </form>
      </div>
    </div>
  );
}
