"use client";

import React, { useEffect, useState } from 'react';
import Sidebar from '@/components/Sidebar';

export default function ComparisonPage() {
  const [evaluations, setEvaluations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [selectedEval, setSelectedEval] = useState<any | null>(null);
  const [modelA, setModelA] = useState<string>("");
  const [modelB, setModelB] = useState<string>("");

  useEffect(() => {
    async function fetchEvals() {
      try {
        const res = await fetch('http://localhost:8000/api/evaluations');
        if (res.ok) {
          const data = await res.json();
          setEvaluations(data);
          if (data.length > 0) {
            setSelectedEval(data[0]);
            const models = Object.keys(data[0].results_json?.results || {});
            if (models.length >= 2) {
              setModelA(models[0]);
              setModelB(models[1]);
            }
          }
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    fetchEvals();
  }, []);

  const handleEvalChange = (id: string) => {
    const ev = evaluations.find(e => e.id.toString() === id);
    setSelectedEval(ev);
    const models = Object.keys(ev?.results_json?.results || {});
    if (models.length > 0 && !models.includes(modelA)) setModelA(models[0]);
    if (models.length > 1 && !models.includes(modelB)) setModelB(models[1]);
  };

  return (
    <div className="flex h-full bg-[#0B0E14]">
      <Sidebar />
      <main className="flex-1 flex flex-col overflow-hidden bg-[#0B0E14] p-8">
        <header className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <span className="material-symbols-outlined text-4xl text-[#00a572]">difference</span>
            <h1 className="text-3xl font-bold text-white">Model Comparison</h1>
          </div>
          <p className="text-[#c2c6d6]">Select a receipt evaluation and compare the JSON extractions side-by-side.</p>
        </header>

        {loading ? (
          <p className="text-[#c2c6d6]">Loading...</p>
        ) : evaluations.length === 0 ? (
          <p className="text-[#c2c6d6]">No evaluations available. Run a batch first.</p>
        ) : (
          <div className="flex flex-col flex-1 overflow-hidden space-y-4">
            
            {/* Selectors */}
            <div className="bg-[#111827] border border-[#1F2937] p-4 rounded-xl flex gap-6 items-center">
              <div>
                <label className="block text-xs font-medium text-[#c2c6d6] mb-1 uppercase">Evaluation Record</label>
                <select 
                  className="bg-[#0B0E14] border border-[#2D3342] text-white px-3 py-1.5 rounded focus:outline-none"
                  value={selectedEval?.id || ""}
                  onChange={e => handleEvalChange(e.target.value)}
                >
                  {evaluations.map(e => (
                    <option key={e.id} value={e.id}>ID: {e.id} - {e.filename}</option>
                  ))}
                </select>
              </div>

              {selectedEval && (
                <>
                  <div>
                    <label className="block text-xs font-medium text-[#c2c6d6] mb-1 uppercase">Model A</label>
                    <select 
                      className="bg-[#0B0E14] border border-[#2D3342] text-white px-3 py-1.5 rounded focus:outline-none"
                      value={modelA}
                      onChange={e => setModelA(e.target.value)}
                    >
                      {Object.keys(selectedEval.results_json?.results || {}).map(m => (
                        <option key={m} value={m}>{m}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[#c2c6d6] mb-1 uppercase">Model B</label>
                    <select 
                      className="bg-[#0B0E14] border border-[#2D3342] text-white px-3 py-1.5 rounded focus:outline-none"
                      value={modelB}
                      onChange={e => setModelB(e.target.value)}
                    >
                      {Object.keys(selectedEval.results_json?.results || {}).map(m => (
                        <option key={m} value={m}>{m}</option>
                      ))}
                    </select>
                  </div>
                </>
              )}
            </div>

            {/* Viewer */}
            {selectedEval && (
              <div className="flex-1 flex gap-4 overflow-hidden">
                <div className="flex-1 bg-[#111827] border border-[#1F2937] rounded-xl flex flex-col overflow-hidden">
                  <div className="bg-[#1a2130] px-4 py-2 border-b border-[#1F2937] flex justify-between items-center">
                    <span className="font-bold text-white text-sm">{modelA}</span>
                    <span className="text-xs text-[#00a572]">{selectedEval.results_json?.results?.[modelA]?.overall_accuracy}% Match</span>
                  </div>
                  <pre className="flex-1 p-4 overflow-auto text-sm font-mono text-[#c2c6d6]">
                    {JSON.stringify(selectedEval.results_json?.results?.[modelA]?.extraction, null, 2)}
                  </pre>
                </div>
                
                <div className="flex-1 bg-[#111827] border border-[#1F2937] rounded-xl flex flex-col overflow-hidden">
                  <div className="bg-[#1a2130] px-4 py-2 border-b border-[#1F2937] flex justify-between items-center">
                    <span className="font-bold text-white text-sm">{modelB}</span>
                    <span className="text-xs text-[#00a572]">{selectedEval.results_json?.results?.[modelB]?.overall_accuracy}% Match</span>
                  </div>
                  <pre className="flex-1 p-4 overflow-auto text-sm font-mono text-[#c2c6d6]">
                    {JSON.stringify(selectedEval.results_json?.results?.[modelB]?.extraction, null, 2)}
                  </pre>
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}