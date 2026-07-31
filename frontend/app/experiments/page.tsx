"use client";

import React, { useEffect, useState } from 'react';
import Sidebar from '@/components/Sidebar';
import { EvaluateResponse } from '@/lib/api';

export default function ExperimentsPage() {
  const [evaluations, setEvaluations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Batch states
  const [batchFiles, setBatchFiles] = useState<File[]>([]);
  const [groundTruths, setGroundTruths] = useState<any[]>([]);
  const [gtIndex, setGtIndex] = useState(-1); // -1 means not in setup mode
  
  // Processing states
  const [processing, setProcessing] = useState(false);
  const [processIndex, setProcessIndex] = useState(0);
  const [delayCountdown, setDelayCountdown] = useState(0);

  const fetchEvals = async () => {
    try {
      const res = await fetch('http://localhost:8000/api/evaluations');
      if (res.ok) {
        const data = await res.json();
        setEvaluations(data);
      }
    } catch (e) {
      console.error("Failed to fetch evaluations", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEvals();
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const files = Array.from(e.target.files);
      setBatchFiles(files);
      setGroundTruths(new Array(files.length).fill({
        vendor_name: "",
        bill_number: "",
        date: "",
        amount: 0,
        currency: "USD"
      }));
      setGtIndex(0); // Start ground truth setup loop
    }
  };

  const handleGtChange = (field: string, value: any) => {
    const newGts = [...groundTruths];
    newGts[gtIndex] = { ...newGts[gtIndex], [field]: value };
    setGroundTruths(newGts);
  };

  const nextGt = () => {
    if (gtIndex < batchFiles.length - 1) {
      setGtIndex(gtIndex + 1);
    } else {
      // Done setting up! Start processing
      setGtIndex(-1);
      startBatchProcess();
    }
  };

  const startBatchProcess = async () => {
    setProcessing(true);
    setProcessIndex(0);

    for (let i = 0; i < batchFiles.length; i++) {
      setProcessIndex(i);
      
      const formData = new FormData();
      formData.append('file', batchFiles[i]);
      formData.append('ground_truth', JSON.stringify(groundTruths[i]));
      
      try {
        await fetch('http://localhost:8000/api/evaluate', {
          method: 'POST',
          body: formData
        });
      } catch (err) {
        console.error("Batch error on file", batchFiles[i].name, err);
      }

      // Delay for Gemini Rate Limit (except for the last item)
      if (i < batchFiles.length - 1) {
        let wait = 14;
        setDelayCountdown(wait);
        while (wait > 0) {
          await new Promise(r => setTimeout(r, 1000));
          wait--;
          setDelayCountdown(wait);
        }
      }
    }

    setProcessing(false);
    setBatchFiles([]);
    fetchEvals(); // Refresh table
  };

  return (
    <div className="flex h-full bg-[#0B0E14]">
      <Sidebar />
      <main className="flex-1 flex flex-col overflow-hidden bg-[#0B0E14] p-8">
        <header className="mb-8 flex justify-between items-center">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <span className="material-symbols-outlined text-4xl text-[#00a572]">science</span>
              <h1 className="text-3xl font-bold text-white">Evaluation Database</h1>
            </div>
            <p className="text-[#c2c6d6]">View past extractions saved in your SQLite database for batch comparison.</p>
          </div>
          
          {!processing && gtIndex === -1 && (
            <div>
              <label className="bg-[#4d8eff] hover:bg-[#3b7ced] text-white px-4 py-2 rounded font-medium cursor-pointer transition-colors shadow-lg">
                <span className="material-symbols-outlined align-middle mr-2 text-[20px]">upload_file</span>
                New Batch Evaluation
                <input type="file" multiple accept="image/*" className="hidden" onChange={handleFileSelect} />
              </label>
            </div>
          )}
        </header>
        
        {/* BATCH GROUND TRUTH SETUP UI */}
        {gtIndex >= 0 && (
          <div className="flex-1 bg-[#111827] border border-[#1F2937] rounded-xl p-8 flex flex-col items-center justify-center">
            <h2 className="text-2xl font-bold text-white mb-6">Set Ground Truth ({gtIndex + 1} of {batchFiles.length})</h2>
            <p className="text-[#c2c6d6] mb-8">File: {batchFiles[gtIndex].name}</p>
            
            <div className="w-full max-w-md space-y-4">
              <div>
                <label className="block text-xs font-medium text-[#c2c6d6] mb-1 uppercase tracking-wider">Vendor Name</label>
                <input 
                  type="text" 
                  className="w-full bg-[#0B0E14] border border-[#2D3342] text-white px-4 py-2 rounded focus:outline-none focus:border-[#4d8eff]" 
                  value={groundTruths[gtIndex].vendor_name}
                  onChange={e => handleGtChange('vendor_name', e.target.value)}
                  placeholder="e.g. City Cab Corp"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-[#c2c6d6] mb-1 uppercase tracking-wider">Date (YYYY-MM-DD)</label>
                  <input 
                    type="text" 
                    className="w-full bg-[#0B0E14] border border-[#2D3342] text-white px-4 py-2 rounded focus:outline-none focus:border-[#4d8eff]" 
                    value={groundTruths[gtIndex].date}
                    onChange={e => handleGtChange('date', e.target.value)}
                    placeholder="2023-10-14"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#c2c6d6] mb-1 uppercase tracking-wider">Total Amount</label>
                  <input 
                    type="number" 
                    className="w-full bg-[#0B0E14] border border-[#2D3342] text-white px-4 py-2 rounded focus:outline-none focus:border-[#4d8eff]" 
                    value={groundTruths[gtIndex].amount}
                    onChange={e => handleGtChange('amount', parseFloat(e.target.value) || 0)}
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-[#c2c6d6] mb-1 uppercase tracking-wider">Bill Number</label>
                <input 
                  type="text" 
                  className="w-full bg-[#0B0E14] border border-[#2D3342] text-white px-4 py-2 rounded focus:outline-none focus:border-[#4d8eff]" 
                  value={groundTruths[gtIndex].bill_number}
                  onChange={e => handleGtChange('bill_number', e.target.value)}
                  placeholder="e.g. INV-001"
                />
              </div>
              
              <button 
                onClick={nextGt}
                className="w-full mt-6 bg-[#00a572] hover:bg-[#008c61] text-white py-3 rounded font-bold shadow-lg transition-colors"
              >
                {gtIndex < batchFiles.length - 1 ? 'Next Image' : 'Start Batch Process'}
              </button>
            </div>
          </div>
        )}

        {/* PROCESSING UI */}
        {processing && (
          <div className="flex-1 bg-[#111827] border border-[#1F2937] rounded-xl flex flex-col items-center justify-center p-8">
            <span className="material-symbols-outlined text-6xl text-[#4d8eff] animate-spin mb-6">autorenew</span>
            <h2 className="text-2xl font-bold text-white mb-2">Processing Batch...</h2>
            <p className="text-[#c2c6d6] mb-8">Evaluating file {processIndex + 1} of {batchFiles.length}</p>
            
            <div className="w-full max-w-lg bg-[#0B0E14] h-4 rounded-full overflow-hidden border border-[#2D3342]">
              <div 
                className="bg-[#00a572] h-full transition-all duration-500" 
                style={{ width: `${(processIndex / batchFiles.length) * 100}%` }}
              />
            </div>
            
            {delayCountdown > 0 && (
              <p className="mt-8 text-sm text-[#e2a946] animate-pulse">
                Rate limit safety: Waiting {delayCountdown}s before next API call...
              </p>
            )}
          </div>
        )}

        {/* MAIN TABLE */}
        {!processing && gtIndex === -1 && (
          <div className="flex flex-col flex-1 space-y-6 overflow-hidden">
            {/* Summary Dashboard */}
            {!loading && evaluations.length > 0 && (
              <div className="bg-[#111827] border border-[#1F2937] rounded-xl p-6">
                <h2 className="text-xl font-bold text-white mb-4">Overall Performance Dashboard</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {Object.entries(
                    evaluations.reduce((acc, ev) => {
                      const models = ev.results_json?.results || {};
                      Object.keys(models).forEach(m => {
                        if (!acc[m]) acc[m] = { total: 0, count: 0, cost: 0 };
                        acc[m].total += (models[m].overall_accuracy || 0);
                        acc[m].count += 1;
                        acc[m].cost += (models[m].cost_per_bill || 0);
                      });
                      return acc;
                    }, {} as Record<string, {total: number, count: number, cost: number}>)
                  ).map(([model, stats]) => (
                    <div key={model} className="bg-[#1a2130] p-4 rounded-lg border border-[#2D3342]">
                      <h3 className="text-[#c2c6d6] font-bold mb-2">{model}</h3>
                      <div className="flex justify-between items-end">
                        <div>
                          <p className="text-xs text-[#8b949e] uppercase">Avg Accuracy</p>
                          <p className="text-2xl font-bold text-[#00a572]">{(stats.total / stats.count).toFixed(1)}%</p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-[#8b949e] uppercase">Total Cost</p>
                          <p className="text-sm font-bold text-white">${stats.cost.toFixed(4)}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex-1 overflow-auto rounded-xl border border-[#1F2937] bg-[#111827]">
              {loading ? (
                <div className="flex items-center justify-center h-full text-[#c2c6d6]">Loading...</div>
            ) : evaluations.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-[#424754]">
                <span className="material-symbols-outlined text-4xl mb-2 opacity-50">database</span>
                <p>No evaluations found in database.</p>
              </div>
            ) : (
              <table className="w-full text-left text-sm text-[#c2c6d6]">
                <thead className="bg-[#1a2130] text-xs uppercase border-b border-[#1F2937]">
                  <tr>
                    <th className="px-6 py-4">Image</th>
                    <th className="px-6 py-4">ID</th>
                    <th className="px-6 py-4">Filename</th>
                    <th className="px-6 py-4">Created At</th>
                    <th className="px-6 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1F2937]">
                  {evaluations.map((ev, i) => (
                    <tr key={ev.id || i} className="hover:bg-[#1a2130]/50 transition-colors">
                      <td className="px-6 py-4">
                        {ev.image_base64 ? (
                          <img src={ev.image_base64} alt="Receipt Thumbnail" className="w-12 h-12 object-cover rounded shadow-sm border border-[#424754]" />
                        ) : (
                          <div className="w-12 h-12 bg-[#1d2027] flex items-center justify-center rounded border border-[#424754]">
                            <span className="material-symbols-outlined text-[#424754] text-[18px]">broken_image</span>
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 font-mono text-xs">{ev.id}</td>
                      <td className="px-6 py-4">{ev.filename}</td>
                      <td className="px-6 py-4">{new Date(ev.created_at).toLocaleString()}</td>
                      <td className="px-6 py-4 text-right">
                        <button 
                          className="text-[#4d8eff] hover:underline"
                          onClick={() => alert('Detailed view for ID: ' + ev.id + '\n\n' + JSON.stringify(ev.results_json, null, 2))}
                        >
                          View JSON
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
        )}
      </main>
    </div>
  );
}