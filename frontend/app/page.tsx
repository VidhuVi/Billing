'use client';

import React, { useState, useEffect } from 'react';
import Sidebar from '@/components/Sidebar';
import {
  evaluateBill,
  pushToZoho,
  EvaluateResponse,
  ModelEvalResult,
  GroundTruthTarget
} from '@/lib/api';

// Initial default state is empty
const INITIAL_DEFAULT_RESULTS: Record<string, ModelEvalResult> = {};

export default function Dashboard() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [filename, setFilename] = useState<string>('');
  const [isEvaluating, setIsEvaluating] = useState<boolean>(false);
  const [evalId, setEvalId] = useState<string>('');
  const [evalResults, setEvalResults] = useState<Record<string, ModelEvalResult>>(INITIAL_DEFAULT_RESULTS);
  const [selectedModelKey, setSelectedModelKey] = useState<string>('gemini-1.5-flash');
  const [isMockMode, setIsMockMode] = useState<boolean>(false);

  // Zoom & Rotation controls
  const [zoomLevel, setZoomLevel] = useState<number>(85);
  const [rotationAngle, setRotationAngle] = useState<number>(0);


  // Modals & Drawers
  const [showJsonModal, setShowJsonModal] = useState<boolean>(false);
  const [showUploadModal, setShowUploadModal] = useState<boolean>(false);

  // Ground Truth State
  const [groundTruth, setGroundTruth] = useState<GroundTruthTarget>({
    vendor_name: 'City Cab Corp',
    date: '2023-10-14',
    amount: 42.50,
    currency: 'USD'
  });

  // Zoho Push Notification State
  const [zohoState, setZohoState] = useState<{
    loading: boolean;
    success?: boolean;
    message?: string;
    expenseId?: string;
  }>({ loading: false });

  const activeModelResult = evalResults[selectedModelKey] || Object.values(evalResults)[0];

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedFile(file);
      setFilename(file.name);
      const url = URL.createObjectURL(file);
      setImagePreviewUrl(url);
    }
  };

  const runEvaluation = async () => {
    if (!selectedFile) {
      // If no custom file is uploaded, simulate or prompt upload
      setShowUploadModal(true);
      return;
    }

    setIsEvaluating(true);
    try {
      const response: EvaluateResponse = await evaluateBill(selectedFile, groundTruth);
      setEvalId(response.eval_id);
      setEvalResults(response.results);
      setIsMockMode(response.is_mock);
      setShowUploadModal(false);
    } catch (err: any) {
      alert(`Evaluation Error: ${err.message || 'Failed to connect to backend server.'}`);
    } finally {
      setIsEvaluating(false);
    }
  };

  const handleExportToZoho = async () => {
    if (!activeModelResult) return;
    setZohoState({ loading: true });
    try {
      const res = await pushToZoho(activeModelResult.extraction);
      setZohoState({
        loading: false,
        success: res.success,
        message: res.message,
        expenseId: res.expense_id
      });
      setTimeout(() => {
        setZohoState({ loading: false });
      }, 5000);
    } catch (err: any) {
      setZohoState({
        loading: false,
        success: false,
        message: err.message || 'Failed to connect to Zoho Books API'
      });
    }
  };

  return (
    <div className="flex flex-col h-screen overflow-hidden font-sans text-[#e1e2ec] bg-[#0B0E14]">
      {/* Top Navigation Bar */}
      <nav className="flex justify-between items-center px-4 w-full bg-[#191b23] h-16 border-b border-[#424754]/40 shrink-0 z-20">
        <div className="flex items-center gap-8 h-full">
          <div className="text-xl font-bold text-[#adc6ff] tracking-tight flex items-center gap-2">
            <span className="material-symbols-outlined text-[24px] text-[#4d8eff]">scanner</span>
            Taxor AI Eval
          </div>
          <div className="hidden md:flex h-full">
            <a className="flex flex-col justify-center px-4 h-full text-[#c2c6d6] hover:text-white hover:bg-[#272a31] transition-colors cursor-pointer" href="#">Models</a>
            <a className="flex flex-col justify-center px-4 h-full text-[#c2c6d6] hover:text-white hover:bg-[#272a31] transition-colors cursor-pointer" href="#">Datasets</a>
            <a className="flex flex-col justify-center px-4 h-full text-[#adc6ff] font-bold border-b-2 border-[#adc6ff] bg-[#191b23] cursor-pointer" href="#">Evaluations</a>
            <a className="flex flex-col justify-center px-4 h-full text-[#c2c6d6] hover:text-white hover:bg-[#272a31] transition-colors cursor-pointer" href="#">Logs</a>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isMockMode && (
            <span className="text-xs bg-[#ca8100]/20 text-[#ffb95f] border border-[#ca8100]/40 px-2.5 py-1 rounded-full font-mono flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#ffb95f] animate-pulse"></span>
              Zero-Cost Mock Mode
            </span>
          )}
          <button title="Settings" className="p-2 text-[#c2c6d6] hover:text-white rounded hover:bg-[#272a31] transition-colors">
            <span className="material-symbols-outlined text-[20px]">settings</span>
          </button>
          <button title="API Keys" className="p-2 text-[#c2c6d6] hover:text-white rounded hover:bg-[#272a31] transition-colors">
            <span className="material-symbols-outlined text-[20px]">api</span>
          </button>
          <button title="User Profile" className="p-2 text-[#c2c6d6] hover:text-white rounded hover:bg-[#272a31] transition-colors">
            <span className="material-symbols-outlined text-[20px]">account_circle</span>
          </button>
        </div>
      </nav>

      <div className="flex flex-1 overflow-hidden">
        {/* Left Navigation Sidebar */}
        <Sidebar onNewEvaluation={() => setShowUploadModal(true)} />

        {/* Main Content Canvas (50/50 Split) */}
        <main className="flex-1 flex flex-col md:flex-row overflow-hidden bg-[#0B0E14]">
          {/* Left Pane: Source Image Viewer */}
          <section className="flex-1 border-r border-[#1F2937] flex flex-col min-w-0 bg-[#0B0E14] relative">
            <header className="h-12 border-b border-[#1F2937] flex items-center justify-between px-4 bg-[#0b0e15] shrink-0 z-10">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[#c2c6d6] text-[18px]">receipt_long</span>
                <h2 className="text-sm text-white font-medium">Source Image</h2>
                <span className="font-mono text-xs text-[#c2c6d6] bg-[#1d2027] px-2 py-0.5 rounded ml-2 border border-[#424754]">
                  {filename}
                </span>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setZoomLevel((prev) => Math.max(prev - 10, 40))}
                  title="Zoom Out"
                  className="w-8 h-8 flex items-center justify-center rounded hover:bg-[#272a31] text-[#c2c6d6] transition-colors"
                >
                  <span className="material-symbols-outlined text-[18px]">zoom_out</span>
                </button>
                <span className="font-mono text-xs text-[#c2c6d6] w-12 text-center">{zoomLevel}%</span>
                <button
                  onClick={() => setZoomLevel((prev) => Math.min(prev + 10, 150))}
                  title="Zoom In"
                  className="w-8 h-8 flex items-center justify-center rounded hover:bg-[#272a31] text-[#c2c6d6] transition-colors"
                >
                  <span className="material-symbols-outlined text-[18px]">zoom_in</span>
                </button>
                <div className="w-px h-4 bg-[#424754] mx-1"></div>
                <button
                  onClick={() => setRotationAngle((prev) => (prev + 90) % 360)}
                  title="Rotate Image"
                  className="w-8 h-8 flex items-center justify-center rounded hover:bg-[#272a31] text-[#c2c6d6] transition-colors"
                >
                  <span className="material-symbols-outlined text-[18px]">rotate_right</span>
                </button>
              </div>
            </header>

            {/* Image Canvas with Grid Background */}
            <div className="flex-1 overflow-auto p-6 flex items-center justify-center eval-grid relative">
              <div
                className="relative shadow-2xl border border-[#1F2937] bg-white max-w-[85%] mx-auto transition-all duration-300"
                style={{
                  transform: `scale(${zoomLevel / 100}) rotate(${rotationAngle}deg)`
                }}
              >
                {imagePreviewUrl ? (
                  <img
                    src={imagePreviewUrl}
                    alt="Receipt Document"
                    className="w-full h-auto block opacity-95 object-contain max-h-[750px]"
                  />
                ) : (
                  <div className="w-[400px] h-[600px] flex flex-col items-center justify-center text-[#c2c6d6] border-2 border-dashed border-[#1F2937] bg-[#111827]">
                    <span className="material-symbols-outlined text-4xl mb-4 text-[#424754]">image</span>
                    <p className="font-mono text-sm">No image uploaded</p>
                    <p className="font-mono text-xs text-[#424754] mt-2">Click "New Evaluation" to start</p>
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* Right Pane: Model Evaluation & Extracted Payload */}
          <section className="flex-1 flex flex-col min-w-0 bg-[#0B0E14]">
            {/* Model Selector Header Tabs */}
            <header className="h-12 border-b border-[#1F2937] flex items-center px-4 bg-[#0b0e15] shrink-0 overflow-x-auto gap-2">
              {Object.keys(evalResults).map((key) => {
                const res = evalResults[key];
                const isActive = selectedModelKey === key;
                return (
                  <button
                    key={key}
                    onClick={() => setSelectedModelKey(key)}
                    className={`h-8 px-4 rounded-full font-mono text-xs flex items-center gap-2 whitespace-nowrap transition-all ${
                      isActive
                        ? 'bg-[#4d8eff]/20 border border-[#adc6ff] text-[#adc6ff]'
                        : 'bg-[#1d2027] hover:bg-[#272a31] border border-[#424754] text-[#c2c6d6]'
                    }`}
                  >
                    {isActive && <div className="w-1.5 h-1.5 rounded-full bg-[#adc6ff] animate-pulse"></div>}
                    {res.model_name}
                  </button>
                );
              })}

              <div className="ml-auto pl-4 flex items-center border-l border-[#1F2937] h-8 font-mono text-xs">
                <span className="text-[#c2c6d6] mr-2">Eval ID:</span>
                <span className="text-white font-bold">{evalId}</span>
              </div>
            </header>

            <div className="flex-1 overflow-auto flex flex-col">
              {/* Top Metrics Grid (3 Cards) */}
              <div className="p-4 grid grid-cols-3 gap-4 shrink-0 border-b border-[#1F2937] bg-[#111827]">
                {/* Overall Accuracy */}
                <div className="bg-[#0B0E14] border border-[#1F2937] rounded-lg p-4 flex flex-col justify-between shadow-sm">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-mono text-[11px] text-[#c2c6d6] uppercase tracking-wider">Overall Accuracy</span>
                    <span className="material-symbols-outlined text-[#4edea3] text-[18px]">check_circle</span>
                  </div>
                  <div className="text-[28px] leading-tight font-semibold text-[#4edea3] font-mono tracking-tight">
                    {activeModelResult?.overall_accuracy ?? 0}%
                  </div>
                </div>

                {/* Latency */}
                <div className="bg-[#0B0E14] border border-[#1F2937] rounded-lg p-4 flex flex-col justify-between shadow-sm">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-mono text-[11px] text-[#c2c6d6] uppercase tracking-wider">Latency</span>
                    <span className="material-symbols-outlined text-[#c2c6d6] text-[18px]">timer</span>
                  </div>
                  <div className="text-[28px] leading-tight font-semibold text-white font-mono tracking-tight">
                    {activeModelResult?.latency_ms ?? 0}
                    <span className="text-[#c2c6d6] text-sm ml-1">ms</span>
                  </div>
                </div>

                {/* Cost / 100 docs */}
                <div className="bg-[#0B0E14] border border-[#1F2937] rounded-lg p-4 flex flex-col justify-between shadow-sm">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-mono text-[11px] text-[#c2c6d6] uppercase tracking-wider">Cost / 100 docs</span>
                    <span className="material-symbols-outlined text-[#c2c6d6] text-[18px]">payments</span>
                  </div>
                  <div className="text-[28px] leading-tight font-semibold text-white font-mono tracking-tight">
                    ${activeModelResult?.cost_per_100_bills?.toFixed(2) ?? '0.00'}
                  </div>
                </div>
              </div>

              {/* Extracted Data Table */}
              <div className="flex-1 bg-[#111827] flex flex-col min-h-0">
                <div className="px-4 py-3 border-b border-[#1F2937] flex items-center justify-between bg-[#0b0e15] sticky top-0 z-10">
                  <h3 className="text-sm text-white font-medium flex items-center gap-2">
                    <span className="material-symbols-outlined text-[18px] text-[#adc6ff]">data_object</span>
                    Extracted Payload ({activeModelResult?.model_name})
                  </h3>
                  <button
                    onClick={() => setShowJsonModal(true)}
                    className="text-[#adc6ff] hover:text-[#4d8eff] font-mono text-xs flex items-center gap-1 transition-colors"
                  >
                    <span className="material-symbols-outlined text-[16px]">code</span> View JSON
                  </button>
                </div>

                {activeModelResult?.error && (
                  <div className="mx-4 mt-3 p-3 bg-[#690005]/40 border border-[#ffb4ab] rounded-lg text-xs font-mono text-[#ffb4ab] flex items-center gap-2">
                    <span className="material-symbols-outlined text-[18px]">error</span>
                    <span>Model Notice: {activeModelResult.error}</span>
                  </div>
                )}

                <div className="flex-1 overflow-auto p-4">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-[#1F2937]">
                        <th className="pb-2 font-mono text-xs text-[#c2c6d6] uppercase font-medium w-1/4">Field</th>
                        <th className="pb-2 font-mono text-xs text-[#c2c6d6] uppercase font-medium w-1/2">Extracted Value</th>
                        <th className="pb-2 font-mono text-xs text-[#c2c6d6] uppercase font-medium w-1/6">Confidence</th>
                        <th className="pb-2 font-mono text-xs text-[#c2c6d6] uppercase font-medium w-1/12 text-center">Match</th>
                      </tr>
                    </thead>
                    <tbody>
                      {activeModelResult?.field_scores.map((score, idx) => {
                        let dotColor = 'bg-[#adc6ff]';
                        if (score.field_name.toLowerCase().includes('date')) dotColor = 'bg-[#4edea3]';
                        if (score.field_name.toLowerCase().includes('total')) dotColor = 'bg-[#ffb95f]';
                        if (score.field_name.toLowerCase().includes('tax')) dotColor = 'bg-[#ffb4ab]';

                        return (
                          <tr key={idx} className="border-b border-[#1F2937] hover:bg-[#1d2027] transition-colors">
                            <td className="py-3 text-sm text-white flex items-center gap-2">
                              <div className={`w-2 h-2 rounded-full ${dotColor}`}></div>
                              {score.field_name}
                            </td>
                            <td className="py-3 font-mono text-xs text-[#adc6ff]">
                              {typeof score.extracted_value === 'object'
                                ? JSON.stringify(score.extracted_value)
                                : String(score.extracted_value)}
                            </td>
                            <td className="py-3">
                              <span
                                className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono font-semibold ${
                                  score.confidence_level === 'HIGH'
                                    ? 'bg-[#00a572]/15 text-[#4edea3] border border-[#00a572]/30'
                                    : score.confidence_level === 'MED'
                                    ? 'bg-[#ca8100]/15 text-[#ffb95f] border border-[#ca8100]/30'
                                    : 'bg-[#93000a]/15 text-[#ffb4ab] border border-[#93000a]/30'
                                }`}
                              >
                                {score.confidence_level} {score.confidence.toFixed(2)}
                              </span>
                            </td>
                            <td className="py-3 text-center">
                              {score.is_match ? (
                                <span className="material-symbols-outlined text-[#4edea3] text-[18px]">check_circle</span>
                              ) : score.match_score > 0 ? (
                                <span className="material-symbols-outlined text-[#ffb95f] text-[18px]">warning</span>
                              ) : (
                                <span className="material-symbols-outlined text-[#ffb4ab] text-[18px]">cancel</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Right Pane Footer Actions */}
            <footer className="p-4 border-t border-[#1F2937] bg-[#0b0e15] flex items-center justify-between shrink-0 gap-3">
              <div className="text-xs text-[#c2c6d6] font-mono">
                Tokens: {activeModelResult?.token_usage?.input_tokens ?? 0} in / {activeModelResult?.token_usage?.output_tokens ?? 0} out
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => alert("Issue flagged for benchmark dataset review.")}
                  className="px-4 py-2 border border-[#424754] text-[#e1e2ec] rounded-lg text-sm font-medium hover:bg-[#272a31] transition-colors"
                >
                  Flag Issue
                </button>
                <button
                  onClick={handleExportToZoho}
                  disabled={zohoState.loading}
                  className="px-4 py-2 bg-[#005ac2] text-white rounded-lg text-sm font-medium hover:bg-[#4d8eff] transition-colors flex items-center gap-2 shadow-sm border border-[#004395] disabled:opacity-50"
                >
                  {zohoState.loading ? (
                    <span className="material-symbols-outlined text-[18px] animate-spin">refresh</span>
                  ) : (
                    <span className="material-symbols-outlined text-[18px]">cloud_upload</span>
                  )}
                  Export to Zoho Books
                </button>
              </div>
            </footer>
          </section>
        </main>
      </div>

      {/* Zoho Export Alert Toast */}
      {zohoState.message && (
        <div className={`fixed bottom-6 right-6 p-4 rounded-lg shadow-xl border flex items-center gap-3 z-50 animate-bounce ${
          zohoState.success ? 'bg-[#003824] border-[#00a572] text-[#4edea3]' : 'bg-[#690005] border-[#ffb4ab] text-[#ffb4ab]'
        }`}>
          <span className="material-symbols-outlined text-[20px]">
            {zohoState.success ? 'check_circle' : 'error'}
          </span>
          <div className="text-xs font-mono">
            <div>{zohoState.message}</div>
            {zohoState.expenseId && <div className="text-[10px] opacity-80">ID: {zohoState.expenseId}</div>}
          </div>
        </div>
      )}

      {/* JSON Viewer Modal */}
      {showJsonModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
          <div className="bg-[#111827] border border-[#1F2937] rounded-xl max-w-2xl w-full p-6 shadow-2xl flex flex-col max-h-[80vh]">
            <div className="flex justify-between items-center mb-4 border-b border-[#1F2937] pb-3">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <span className="material-symbols-outlined text-[#adc6ff]">code</span>
                Raw Extracted JSON ({activeModelResult?.model_name})
              </h3>
              <button onClick={() => setShowJsonModal(false)} className="text-[#c2c6d6] hover:text-white">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <pre className="flex-1 overflow-auto bg-[#0B0E14] p-4 rounded-lg font-mono text-xs text-[#adc6ff] border border-[#1F2937]">
              {JSON.stringify(activeModelResult?.extraction, null, 2)}
            </pre>
            <div className="mt-4 flex justify-end">
              <button
                onClick={() => setShowJsonModal(false)}
                className="px-4 py-2 bg-[#1d2027] hover:bg-[#272a31] border border-[#424754] text-white rounded-lg text-sm font-medium"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Upload New Evaluation Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-black/75 flex items-center justify-center p-4 z-50">
          <div className="bg-[#111827] border border-[#1F2937] rounded-xl max-w-xl w-full p-6 shadow-2xl">
            <div className="flex justify-between items-center mb-4 border-b border-[#1F2937] pb-3">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <span className="material-symbols-outlined text-[#4d8eff]">add_circle</span>
                New Evaluation Task
              </h3>
              <button onClick={() => setShowUploadModal(false)} className="text-[#c2c6d6] hover:text-white">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-mono text-[#c2c6d6] mb-1">Select Receipt / Bill Image</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="w-full bg-[#0B0E14] border border-[#424754] rounded-lg p-2.5 text-xs text-[#c2c6d6] file:mr-4 file:py-1 file:px-3 file:rounded-md file:border-0 file:text-xs file:bg-[#4d8eff] file:text-[#00285d] hover:file:bg-[#adc6ff]"
                />
              </div>

              <div className="border-t border-[#1F2937] pt-3">
                <label className="block text-xs font-mono text-[#adc6ff] mb-2 font-semibold">
                  Ground Truth Target (Optional for Precision Scoring)
                </label>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-[#c2c6d6] font-mono">Vendor Name</span>
                    <input
                      type="text"
                      value={groundTruth.vendor_name || ''}
                      onChange={(e) => setGroundTruth({ ...groundTruth, vendor_name: e.target.value })}
                      placeholder="e.g. City Cab Corp"
                      className="w-full bg-[#0B0E14] border border-[#1F2937] rounded p-2 text-white mt-1 font-mono"
                    />
                  </div>
                  <div>
                    <span className="text-[#c2c6d6] font-mono">Total Amount ($)</span>
                    <input
                      type="number"
                      step="0.01"
                      value={groundTruth.amount || ''}
                      onChange={(e) => setGroundTruth({ ...groundTruth, amount: parseFloat(e.target.value) || 0 })}
                      placeholder="42.50"
                      className="w-full bg-[#0B0E14] border border-[#1F2937] rounded p-2 text-white mt-1 font-mono"
                    />
                  </div>
                  <div>
                    <span className="text-[#c2c6d6] font-mono">Date</span>
                    <input
                      type="text"
                      value={groundTruth.date || ''}
                      onChange={(e) => setGroundTruth({ ...groundTruth, date: e.target.value })}
                      placeholder="YYYY-MM-DD"
                      className="w-full bg-[#0B0E14] border border-[#1F2937] rounded p-2 text-white mt-1 font-mono"
                    />
                  </div>
                  <div>
                    <span className="text-[#c2c6d6] font-mono">Currency</span>
                    <input
                      type="text"
                      value={groundTruth.currency || 'USD'}
                      onChange={(e) => setGroundTruth({ ...groundTruth, currency: e.target.value })}
                      placeholder="USD"
                      className="w-full bg-[#0B0E14] border border-[#1F2937] rounded p-2 text-white mt-1 font-mono"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3 border-t border-[#1F2937] pt-4">
              <button
                onClick={() => setShowUploadModal(false)}
                className="px-4 py-2 border border-[#424754] text-[#c2c6d6] rounded-lg text-sm"
              >
                Cancel
              </button>
              <button
                onClick={runEvaluation}
                disabled={isEvaluating}
                className="px-4 py-2 bg-[#4d8eff] text-[#00285d] font-bold rounded-lg text-sm hover:bg-[#adc6ff] transition-colors flex items-center gap-2"
              >
                {isEvaluating ? (
                  <>
                    <span className="material-symbols-outlined animate-spin text-[18px]">refresh</span>
                    Evaluating Models...
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-[18px]">rocket_launch</span>
                    Run Evaluation
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
