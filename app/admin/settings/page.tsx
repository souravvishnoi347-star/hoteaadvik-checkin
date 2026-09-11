"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/utils/supabase";

import dynamic from "next/dynamic";
import AdminSidebar from "@/components/AdminSidebar";

function AdminSettings() {
  const router = useRouter();
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");

  const [settings, setSettings] = useState({
    hotelName: "HOTEL AADVIK INN",
    hotelAddress: "OPP VERTERNITY HOSPITAL HARIDWAR 249401",
    gstin: "",
    contact: "+91 9719350125",
    gstPercentage: 0,
    extraBedCharge: 350,
    aiProvider: "gemini",
    geminiApiKey: "",
    openRouterApiKey: "",
    masterPin: "9999"
  });

  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push("/admin/login");
      } else {
        setIsCheckingSession(false);
      }
    };
    
    checkSession();

    // Load settings from local storage
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem("hotelAadvikSettings");
      if (saved) {
        try {
          setSettings(prev => ({ ...prev, ...JSON.parse(saved) }));
        } catch (e) {
          console.error("Failed to parse settings");
        }
      }
    }
  }, [router]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setSettings(prev => ({
      ...prev,
      [name]: (name === 'gstPercentage' || name === 'extraBedCharge') ? parseFloat(value) || 0 : value
    }));
  };

  const handleSave = () => {
    setIsSaving(true);
    localStorage.setItem("hotelAadvikSettings", JSON.stringify(settings));
    setTimeout(() => {
      setIsSaving(false);
      setSuccessMsg("Settings saved successfully!");
      setTimeout(() => setSuccessMsg(""), 3000);
    }, 500);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/admin/login");
  };

  if (isCheckingSession) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-600 mb-4"></div>
        <p className="text-gray-500 font-medium">Verifying access...</p>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-50 flex-col md:flex-row relative">
      <AdminSidebar activePath="/admin/settings" hotelName={settings.hotelName} />

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col overflow-hidden z-0">
        <header className="bg-white shadow-sm border-b px-8 py-5 flex justify-between items-center shrink-0">
          <h2 className="text-xl font-semibold text-gray-800">Hotel Settings</h2>
        </header>

        <div className="flex-1 overflow-auto p-8">
          <div className="max-w-2xl mx-auto bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden p-8">
            <h3 className="text-lg font-bold text-gray-800 mb-6 border-b pb-4">Bill Generator Configuration</h3>
            
            {successMsg && (
              <div className="mb-6 p-4 bg-green-50 text-green-700 rounded-lg border border-green-200 font-medium flex items-center gap-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                {successMsg}
              </div>
            )}

            <div className="space-y-5">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Hotel Name</label>
                <input
                  type="text"
                  name="hotelName"
                  value={settings.hotelName}
                  onChange={handleChange}
                  className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition-colors outline-none text-gray-800"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Hotel Address</label>
                <input
                  type="text"
                  name="hotelAddress"
                  value={settings.hotelAddress}
                  onChange={handleChange}
                  className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition-colors outline-none text-gray-800"
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">GSTIN Number (Optional)</label>
                  <input
                    type="text"
                    name="gstin"
                    value={settings.gstin}
                    onChange={handleChange}
                    placeholder="e.g. 22AAAAA0000A1Z5"
                    className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition-colors outline-none text-gray-800"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Default GST Percentage (%)</label>
                  <input
                    type="number"
                    name="gstPercentage"
                    value={settings.gstPercentage}
                    onChange={handleChange}
                    min="0"
                    max="100"
                    placeholder="e.g. 12"
                    className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition-colors outline-none text-gray-800"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Reception Contact</label>
                  <input
                    type="text"
                    name="contact"
                    value={settings.contact}
                    onChange={handleChange}
                    className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition-colors outline-none text-gray-800"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Default Extra Bed Charge (Rs.)</label>
                  <input
                    type="number"
                    name="extraBedCharge"
                    value={settings.extraBedCharge}
                    onChange={handleChange}
                    min="0"
                    placeholder="e.g. 350"
                    className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition-colors outline-none text-gray-800"
                  />
                </div>
              </div>
            </div>

            {/* AI Concierge Configuration */}
            <div className="mt-10 pt-8 border-t border-gray-100">
              <div className="flex items-center gap-2 mb-4">
                <span className="text-xl">🤖</span>
                <h3 className="text-lg font-bold text-gray-800">AI Concierge & WhatsApp Brain</h3>
              </div>
              <p className="text-xs text-slate-500 mb-6">
                Connect your AI API key to automatically answer customer WhatsApp questions (Wi-Fi, Check-out, Directions, Room service).
              </p>

              <div className="space-y-5">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">AI Provider</label>
                  <select
                    name="aiProvider"
                    value={settings.aiProvider || "gemini"}
                    onChange={(e) => setSettings(prev => ({ ...prev, aiProvider: e.target.value }))}
                    className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition-colors outline-none text-gray-800 bg-white"
                  >
                    <option value="gemini">Google Gemini 1.5 Flash (Recommended - 100% Free 1,500 req/day)</option>
                    <option value="openrouter">OpenRouter (Meta Llama 3 / Mistral Free)</option>
                  </select>
                </div>

                {settings.aiProvider === "gemini" ? (
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1">
                      Google Gemini API Key
                    </label>
                    <input
                      type="password"
                      name="geminiApiKey"
                      value={settings.geminiApiKey || ""}
                      onChange={handleChange}
                      placeholder="AIzaSy..."
                      className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition-colors outline-none text-gray-800 font-mono text-sm"
                    />
                    <p className="text-[11px] text-emerald-600 mt-1 font-semibold flex items-center gap-1">
                      ✨ Get 100% Free API Key at <a href="https://aistudio.google.com" target="_blank" rel="noreferrer" className="underline font-bold">aistudio.google.com</a> (1,500 free queries every day).
                    </p>
                  </div>
                ) : (
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1">
                      OpenRouter API Key
                    </label>
                    <input
                      type="password"
                      name="openRouterApiKey"
                      value={settings.openRouterApiKey || ""}
                      onChange={handleChange}
                      placeholder="sk-or-v1-..."
                      className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition-colors outline-none text-gray-800 font-mono text-sm"
                    />
                    <p className="text-[11px] text-slate-500 mt-1 font-medium">
                      Get key from <a href="https://openrouter.ai/keys" target="_blank" rel="noreferrer" className="underline text-indigo-600 font-bold">openrouter.ai</a>.
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Master Security PIN (Forgot Password Recovery) */}
            <div className="mt-10 pt-8 border-t border-gray-100">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xl">🔐</span>
                <h3 className="text-lg font-bold text-gray-800">Master Security PIN (Password Recovery)</h3>
              </div>
              <p className="text-xs text-slate-500 mb-4">
                This 4-digit Master PIN is used to reset the Admin password from the login page if forgotten.
              </p>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Master Recovery PIN</label>
                <input
                  type="text"
                  maxLength={6}
                  name="masterPin"
                  value={settings.masterPin || "9999"}
                  onChange={handleChange}
                  placeholder="e.g. 9999"
                  className="w-48 px-4 py-3 rounded-lg border border-gray-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition-colors outline-none text-gray-800 font-mono text-base font-bold tracking-widest"
                />
                <p className="text-[11px] text-slate-400 mt-1">Default PIN is 9999. Keep this PIN safe.</p>
              </div>
            </div>

            <div className="mt-8 pt-6 border-t border-gray-100 text-right">
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-8 rounded-lg transition-colors disabled:opacity-50 inline-flex items-center gap-2 shadow-sm"
              >
                {isSaving ? "Saving..." : "Save Settings"}
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default dynamic(() => Promise.resolve(AdminSettings), { ssr: false });
