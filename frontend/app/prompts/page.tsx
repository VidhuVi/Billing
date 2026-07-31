"use client";

import React, { useEffect, useState } from 'react';
import Sidebar from '@/components/Sidebar';

export default function PromptsPage() {
  const [prompts, setPrompts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [promptText, setPromptText] = useState("");

  const fetchPrompts = async () => {
    try {
      const res = await fetch('http://localhost:8000/api/prompts');
      if (res.ok) {
        const data = await res.json();
        setPrompts(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPrompts();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !promptText) return;

    const formData = new FormData();
    formData.append('name', name);
    formData.append('prompt_text', promptText);
    // New prompts are inactive by default unless it's the first one, but DB handles defaults.
    
    try {
      await fetch('http://localhost:8000/api/prompts', {
        method: 'POST',
        body: formData
      });
      setName("");
      setPromptText("");
      fetchPrompts();
    } catch (err) {
      console.error(err);
    }
  };

  const handleActivate = async (id: number) => {
    try {
      await fetch(`http://localhost:8000/api/prompts/${id}/activate`, { method: 'POST' });
      fetchPrompts();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="flex h-full bg-[#0B0E14]">
      <Sidebar />
      <main className="flex-1 flex flex-col overflow-hidden bg-[#0B0E14] p-8">
        <header className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <span className="material-symbols-outlined text-4xl text-[#00a572]">tune</span>
            <h1 className="text-3xl font-bold text-white">Prompt Tuning</h1>
          </div>
          <p className="text-[#c2c6d6]">Manage system prompts to test if extraction failures are due to bad models or bad instructions.</p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 flex-1 overflow-hidden">
          
          {/* Create Prompt Form */}
          <div className="bg-[#111827] border border-[#1F2937] rounded-xl p-6 flex flex-col h-full overflow-hidden">
            <h2 className="text-xl font-bold text-white mb-4">Create New Prompt</h2>
            <form onSubmit={handleCreate} className="flex flex-col flex-1">
              <div className="mb-4">
                <label className="block text-xs font-medium text-[#c2c6d6] mb-1 uppercase tracking-wider">Prompt Name</label>
                <input 
                  type="text" 
                  className="w-full bg-[#0B0E14] border border-[#2D3342] text-white px-4 py-2 rounded focus:outline-none focus:border-[#4d8eff]" 
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="e.g. JSON Schema Enforcer v2"
                />
              </div>
              <div className="mb-4 flex-1 flex flex-col">
                <label className="block text-xs font-medium text-[#c2c6d6] mb-1 uppercase tracking-wider">System Prompt Text</label>
                <textarea 
                  className="w-full flex-1 bg-[#0B0E14] border border-[#2D3342] text-white px-4 py-2 rounded focus:outline-none focus:border-[#4d8eff] font-mono text-sm resize-none" 
                  value={promptText}
                  onChange={e => setPromptText(e.target.value)}
                  placeholder="You are an AI..."
                />
              </div>
              <button 
                type="submit"
                className="w-full bg-[#4d8eff] hover:bg-[#3b7ced] text-white py-3 rounded font-bold shadow-lg transition-colors"
                disabled={!name || !promptText}
              >
                Save Prompt
              </button>
            </form>
          </div>

          {/* Prompt List */}
          <div className="bg-[#111827] border border-[#1F2937] rounded-xl p-6 flex flex-col h-full overflow-hidden">
            <h2 className="text-xl font-bold text-white mb-4">Saved Prompts</h2>
            <div className="flex-1 overflow-auto space-y-4">
              {loading ? (
                <p className="text-[#c2c6d6]">Loading...</p>
              ) : prompts.length === 0 ? (
                <p className="text-[#c2c6d6]">No prompts saved.</p>
              ) : (
                prompts.map(p => (
                  <div key={p.id} className={`p-4 rounded-lg border ${p.is_active ? 'border-[#00a572] bg-[#00a572]/10' : 'border-[#2D3342] bg-[#0B0E14]'}`}>
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <h3 className="font-bold text-white flex items-center gap-2">
                          {p.name}
                          {p.is_active && <span className="bg-[#00a572] text-[10px] uppercase px-2 py-0.5 rounded text-white font-bold">Active</span>}
                        </h3>
                        <p className="text-xs text-[#c2c6d6]">{new Date(p.created_at).toLocaleDateString()}</p>
                      </div>
                      {!p.is_active && (
                        <button 
                          onClick={() => handleActivate(p.id)}
                          className="text-xs bg-[#1F2937] hover:bg-[#2D3342] text-white px-3 py-1 rounded transition-colors"
                        >
                          Activate
                        </button>
                      )}
                    </div>
                    <pre className="text-xs text-[#c2c6d6] whitespace-pre-wrap font-mono bg-black/20 p-2 rounded mt-2 max-h-32 overflow-auto">
                      {p.prompt_text}
                    </pre>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}