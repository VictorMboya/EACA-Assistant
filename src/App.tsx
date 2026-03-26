/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { GoogleGenAI } from "@google/genai";
import { 
  AlertCircle, 
  Camera, 
  Image as ImageIcon,
  X,
  Activity, 
  Stethoscope, 
  ClipboardList, 
  Send, 
  Loader2, 
  CheckCircle2, 
  AlertTriangle,
  ChevronRight,
  Database
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// Initialize Gemini
const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

interface EACAEvent {
  Patient_Age: string;
  GDS_Present: boolean;
  RDT_Status: 'Positive' | 'Negative' | 'NA_Stockout';
  Primary_Assessment: string;
  Action_Taken: string;
  Key_Symptoms_JSON: {
    Fever: boolean;
    Rapid_Breathing: boolean;
    Convulsions: boolean;
  };
}

interface AnalysisResult {
  chvInstructions: string;
  districtData: EACAEvent;
  isEmergency: boolean;
}

export default function App() {
  const [input, setInput] = useState('');
  const [image, setImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const analyzeSymptoms = async () => {
    if (!input.trim() && !image) return;

    setLoading(true);
    setError(null);
    try {
      const model = "gemini-3-flash-preview";
      const systemInstruction = `
        You are the East Africa CHV Clinical Assistant (EACA). 
        Your goal is to help Community Health Volunteers (CHVs) in rural Kenya and Uganda triage febrile children under 5.
        
        STRICT PROTOCOL (WHO iCCM):
        1. Assess for General Danger Signs (GDS): Inability to drink/breastfeed, vomiting everything, convulsions, lethargy/unconsciousness.
        2. Assess for Respiratory Distress (Pneumonia): Cough AND (Rapid Breathing OR Chest In-drawing).
        3. Assess for Fever (Malaria): Fever present. Assume RDT Stockout if not mentioned.
        4. Skin Symptoms (NEW): If an image is provided, analyze for common rural East African conditions:
           - Measles (rash + fever + cough/runny eyes)
           - Cellulitis (red, hot, swollen skin)
           - Scabies or infected sores.
        5. If Pneumonia AND Fever triggers, recommend treatments for both.
        
        OUTPUT REQUIREMENTS:
        You must return a JSON object with two fields:
        - "chvInstructions": A string containing simple, direct English instructions for the CHV. Use bullet points. Priority: Referral Status -> Action Plan -> Key Dangers.
        - "districtData": A JSON object matching the EACA_Event schema.
        
        SCHEMA:
        {
          "chvInstructions": "...",
          "districtData": {
            "Patient_Age": "string",
            "GDS_Present": boolean,
            "RDT_Status": "Positive" | "Negative" | "NA_Stockout",
            "Primary_Assessment": "string",
            "Action_Taken": "string",
            "Key_Symptoms_JSON": {
              "Fever": boolean,
              "Rapid_Breathing": boolean,
              "Convulsions": boolean
            }
          }
        }
      `;

      const parts: any[] = [{ text: `Analyze these CHV notes: "${input}"` }];
      
      if (image) {
        const base64Data = image.split(',')[1];
        parts.push({
          inlineData: {
            data: base64Data,
            mimeType: "image/jpeg"
          }
        });
      }

      const response = await genAI.models.generateContent({
        model,
        contents: { parts },
        config: {
          systemInstruction,
          responseMimeType: "application/json"
        }
      });

      const data = JSON.parse(response.text || "{}");
      setResult({
        chvInstructions: data.chvInstructions,
        districtData: data.districtData,
        isEmergency: data.districtData.GDS_Present
      });
    } catch (err) {
      console.error(err);
      setError("Failed to analyze symptoms. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F5F5F5] text-[#1A1A1A] font-sans selection:bg-blue-100">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-blue-600 p-1.5 rounded-lg">
              <Stethoscope className="w-5 h-5 text-white" />
            </div>
            <h1 className="font-bold text-lg tracking-tight">EACA Assistant</h1>
          </div>
          <div className="flex items-center gap-4 text-xs font-medium text-gray-500 uppercase tracking-wider">
            <span className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-green-500" />
              iCCM Protocol v2.1
            </span>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* Input Section */}
          <div className="lg:col-span-12">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="p-6">
                <div className="flex items-center gap-2 mb-4">
                  <ClipboardList className="w-5 h-5 text-blue-600" />
                  <h2 className="font-semibold text-gray-900">Household Visit Notes</h2>
                </div>
                <p className="text-sm text-gray-500 mb-4">
                  Enter symptoms as observed or transcribed. (e.g., "child hot, heavy breath, no drink")
                </p>
                <textarea
                  id="symptom-input"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Type or paste CHV notes here..."
                  className="w-full h-32 p-4 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all resize-none text-lg"
                />

                {/* Camera / Image Section */}
                <div className="mt-4 flex flex-wrap gap-4">
                  {!image ? (
                    <label className="flex items-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-3 rounded-xl cursor-pointer transition-all border border-dashed border-gray-300">
                      <Camera className="w-5 h-5" />
                      <span className="text-sm font-semibold">Take Photo of Skin Rash</span>
                      <input 
                        type="file" 
                        accept="image/*" 
                        capture="environment" 
                        className="hidden" 
                        onChange={handleImageUpload}
                      />
                    </label>
                  ) : (
                    <div className="relative group">
                      <img 
                        src={image} 
                        alt="Captured skin symptom" 
                        className="w-32 h-32 object-cover rounded-xl border-2 border-blue-500 shadow-md"
                      />
                      <button 
                        onClick={() => setImage(null)}
                        className="absolute -top-2 -right-2 bg-red-500 text-white p-1 rounded-full shadow-lg hover:bg-red-600 transition-all"
                      >
                        <X className="w-4 h-4" />
                      </button>
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity rounded-xl flex items-center justify-center">
                        <span className="text-white text-[10px] font-bold uppercase">Change Photo</span>
                      </div>
                    </div>
                  )}
                </div>

                <div className="mt-6 flex justify-end">
                  <button
                    id="analyze-btn"
                    onClick={analyzeSymptoms}
                    disabled={loading || !input.trim()}
                    className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white px-6 py-3 rounded-xl font-semibold transition-all shadow-lg shadow-blue-200 active:scale-95"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Analyzing...
                      </>
                    ) : (
                      <>
                        <Send className="w-5 h-5" />
                        Analyze Triage
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Results Section */}
          <AnimatePresence mode="wait">
            {result && (
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="lg:col-span-12 space-y-6"
              >
                {/* Emergency Banner */}
                {result.isEmergency && (
                  <motion.div 
                    initial={{ x: -10 }}
                    animate={{ x: 0 }}
                    className="bg-red-50 border-l-4 border-red-600 p-4 rounded-r-xl flex items-start gap-3"
                  >
                    <AlertCircle className="w-6 h-6 text-red-600 shrink-0 mt-0.5" />
                    <div>
                      <h3 className="font-bold text-red-900 uppercase tracking-wide text-sm">Immediate Emergency Referral</h3>
                      <p className="text-red-700 text-sm mt-1">
                        General Danger Signs detected. Stop local treatment and transport to health facility immediately.
                      </p>
                    </div>
                  </motion.div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* CHV Instructions Card */}
                  <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                    <div className="bg-blue-50 px-6 py-4 border-b border-blue-100 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Activity className="w-5 h-5 text-blue-600" />
                        <h3 className="font-bold text-blue-900">CHV Action Plan</h3>
                      </div>
                      {result.isEmergency ? (
                        <span className="bg-red-100 text-red-700 text-[10px] font-bold px-2 py-1 rounded-full uppercase tracking-wider">Urgent</span>
                      ) : (
                        <span className="bg-green-100 text-green-700 text-[10px] font-bold px-2 py-1 rounded-full uppercase tracking-wider">Routine</span>
                      )}
                    </div>
                    <div className="p-6">
                      <div className="prose prose-sm max-w-none">
                        <div className="whitespace-pre-wrap text-lg leading-relaxed text-gray-800 font-medium">
                          {result.chvInstructions}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* District Data Card */}
                  <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                    <div className="bg-gray-50 px-6 py-4 border-b border-gray-200 flex items-center gap-2">
                      <Database className="w-5 h-5 text-gray-600" />
                      <h3 className="font-bold text-gray-900">District Surveillance Data</h3>
                    </div>
                    <div className="p-6">
                      <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div className="p-3 bg-gray-50 rounded-xl border border-gray-100">
                            <p className="text-[10px] uppercase tracking-wider text-gray-500 font-bold mb-1">Age Group</p>
                            <p className="font-mono text-sm">{result.districtData.Patient_Age}</p>
                          </div>
                          <div className="p-3 bg-gray-50 rounded-xl border border-gray-100">
                            <p className="text-[10px] uppercase tracking-wider text-gray-500 font-bold mb-1">RDT Status</p>
                            <p className={`font-mono text-sm ${
                              result.districtData.RDT_Status === 'Positive' ? 'text-red-600' : 
                              result.districtData.RDT_Status === 'Negative' ? 'text-green-600' : 'text-orange-600'
                            }`}>
                              {result.districtData.RDT_Status}
                            </p>
                          </div>
                        </div>
                        
                        <div className="p-3 bg-gray-50 rounded-xl border border-gray-100">
                          <p className="text-[10px] uppercase tracking-wider text-gray-500 font-bold mb-1">Primary Assessment</p>
                          <p className="font-semibold text-gray-900">{result.districtData.Primary_Assessment}</p>
                        </div>

                        <div className="p-3 bg-gray-50 rounded-xl border border-gray-100">
                          <p className="text-[10px] uppercase tracking-wider text-gray-500 font-bold mb-1">Action Taken</p>
                          <p className="font-semibold text-gray-900">{result.districtData.Action_Taken}</p>
                        </div>

                        <div className="mt-4">
                          <p className="text-[10px] uppercase tracking-wider text-gray-500 font-bold mb-2">Symptom Matrix</p>
                          <div className="grid grid-cols-3 gap-2">
                            {Object.entries(result.districtData.Key_Symptoms_JSON).map(([key, val]) => (
                              <div key={key} className={`flex flex-col items-center p-2 rounded-lg border ${val ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-gray-50 border-gray-100 text-gray-400'}`}>
                                {val ? <CheckCircle2 className="w-4 h-4 mb-1" /> : <div className="w-4 h-4 mb-1" />}
                                <span className="text-[9px] font-bold uppercase text-center">{key.replace('_', ' ')}</span>
                              </div>
                            ))}
                          </div>
                        </div>


                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Error State */}
          {error && (
            <div className="lg:col-span-12 bg-orange-50 border border-orange-200 p-4 rounded-xl flex items-center gap-3 text-orange-800">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <p className="text-sm font-medium">{error}</p>
            </div>
          )}

          {/* Placeholder / Empty State */}
          {!result && !loading && !error && (
            <div className="lg:col-span-12 py-12 flex flex-col items-center justify-center text-center opacity-40">
              <div className="bg-gray-200 p-4 rounded-full mb-4">
                <Activity className="w-8 h-8 text-gray-400" />
              </div>
              <h3 className="font-bold text-gray-900">Ready for Assessment</h3>
              <p className="text-sm text-gray-500 max-w-xs mt-1">
                Enter symptoms above to generate a clinical triage plan based on East Africa iCCM protocols.
              </p>
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="max-w-4xl mx-auto px-4 py-12 border-t border-gray-200 mt-12">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6 opacity-50">
          <p className="text-xs font-medium">
            &copy; 2026 East Africa CHV Clinical Assistant (EACA)
          </p>
          <div className="flex items-center gap-6 text-xs font-bold uppercase tracking-widest">
            <a href="#" className="hover:text-blue-600 transition-colors">Privacy</a>
            <a href="#" className="hover:text-blue-600 transition-colors">Protocols</a>
            <a href="#" className="hover:text-blue-600 transition-colors">Support</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
