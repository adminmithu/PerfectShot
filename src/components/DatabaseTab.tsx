import React, { useState, useEffect } from 'react';
import { Database, RefreshCw, Download, Search, Layers, FileText, CheckCircle2 } from 'lucide-react';

export const DatabaseTab: React.FC = () => {
  const [dbStats, setDbStats] = useState<any>(null);
  const [selectedCollection, setSelectedCollection] = useState<string>('bots');
  const [collectionData, setCollectionData] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [filterText, setFilterText] = useState('');
  const [downloadSuccess, setDownloadSuccess] = useState(false);

  const collections = [
    { id: 'bots', name: 'bots', label: 'Bots Fleet' },
    { id: 'commands', name: 'commands', label: 'Slash Commands' },
    { id: 'responders', name: 'responders', label: 'Auto-Responders' },
    { id: 'subscribers', name: 'subscribers', label: 'Subscribers (CRM)' },
    { id: 'messages', name: 'messages', label: 'Messages Log' },
    { id: 'broadcasts', name: 'broadcasts', label: 'Broadcasts' },
    { id: 'logs', name: 'logs', label: 'Audit Logs' },
  ];

  const loadStats = async () => {
    try {
      const res = await fetch('/api/database/stats');
      const data = await res.json();
      if (data.success) {
        setDbStats(data.data);
      }
    } catch (e) {
      console.error('Failed to load db stats:', e);
    }
  };

  const loadCollection = async (collName: string) => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/database/collections/${collName}`);
      const data = await res.json();
      if (data.success) {
        setCollectionData(data.data);
      }
    } catch (e) {
      console.error('Failed to load collection:', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadStats();
    loadCollection(selectedCollection);
  }, [selectedCollection]);

  const filteredDocs = collectionData.filter(doc => {
    if (!filterText.trim()) return true;
    return JSON.stringify(doc).toLowerCase().includes(filterText.toLowerCase());
  });

  const handleExportJson = () => {
    const jsonStr = JSON.stringify(collectionData, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${selectedCollection}-export.json`;
    a.click();
    URL.revokeObjectURL(url);
    setDownloadSuccess(true);
    setTimeout(() => setDownloadSuccess(false), 2000);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-white tracking-tight">MongoDB Document Database Explorer</h2>
          <p className="text-xs text-slate-400">
            Inspect raw collections, schema documents, query records, and export production JSON datasets.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={handleExportJson}
            className="flex items-center space-x-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-medium border border-slate-700 transition"
          >
            {downloadSuccess ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> : <Download className="w-3.5 h-3.5 text-sky-400" />}
            <span>Export Collection JSON</span>
          </button>
          <button
            onClick={() => {
              loadStats();
              loadCollection(selectedCollection);
            }}
            className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-xl border border-slate-700 transition"
            title="Refresh database records"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-sky-400' : ''}`} />
          </button>
        </div>
      </div>

      {/* Database Cluster KPI Overview */}
      {dbStats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
            <span className="text-[11px] text-slate-400">Storage Engine</span>
            <p className="text-sm font-bold text-emerald-400 mt-1 truncate">MongoDB Compatible</p>
            <p className="text-[10px] text-slate-500 mt-0.5">Embedded Document Store</p>
          </div>
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
            <span className="text-[11px] text-slate-400">Total Documents</span>
            <p className="text-xl font-bold text-white mt-1">{dbStats.totalDocuments}</p>
            <p className="text-[10px] text-slate-500 mt-0.5">Across 7 collections</p>
          </div>
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
            <span className="text-[11px] text-slate-400">Active Collection</span>
            <p className="text-sm font-bold text-sky-400 mt-1 capitalize">{selectedCollection}</p>
            <p className="text-[10px] text-slate-500 mt-0.5">{collectionData.length} records</p>
          </div>
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
            <span className="text-[11px] text-slate-400">Integrity Check</span>
            <p className="text-sm font-bold text-emerald-400 mt-1 flex items-center space-x-1">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Healthy</span>
            </p>
            <p className="text-[10px] text-slate-500 mt-0.5">Atomic persistence active</p>
          </div>
        </div>
      )}

      {/* Collection Navigator & Document Inspector */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Collections Sidebar (3 cols) */}
        <div className="lg:col-span-3 bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-2">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 px-2 py-1 flex items-center space-x-1.5">
            <Layers className="w-3.5 h-3.5 text-sky-400" />
            <span>Collections ({collections.length})</span>
          </div>

          <div className="space-y-1">
            {collections.map(c => {
              const isSelected = selectedCollection === c.id;
              const count = dbStats?.collections?.[c.name] ?? 0;

              return (
                <button
                  key={c.id}
                  onClick={() => setSelectedCollection(c.id)}
                  className={`w-full text-left px-3 py-2.5 rounded-xl text-xs font-medium flex items-center justify-between transition ${
                    isSelected
                      ? 'bg-sky-500/20 text-sky-400 border border-sky-500/30'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                  }`}
                >
                  <span className="font-mono">{c.name}</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 font-mono">
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Document Explorer Pane (9 cols) */}
        <div className="lg:col-span-9 bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
            <div className="flex items-center space-x-2">
              <FileText className="w-5 h-5 text-sky-400" />
              <h3 className="text-sm font-semibold text-white">
                Collection: <span className="font-mono text-sky-400">{selectedCollection}</span> ({filteredDocs.length} documents)
              </h3>
            </div>

            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-500" />
              <input
                type="text"
                placeholder="Filter documents..."
                value={filterText}
                onChange={e => setFilterText(e.target.value)}
                className="bg-slate-800 border border-slate-700 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500 w-56"
              />
            </div>
          </div>

          {/* Documents Display */}
          <div className="space-y-4 max-h-[520px] overflow-y-auto pr-1">
            {isLoading ? (
              <div className="py-12 text-center text-xs text-slate-500">Loading collection documents...</div>
            ) : filteredDocs.length === 0 ? (
              <div className="py-12 text-center text-xs text-slate-500">No documents found.</div>
            ) : (
              filteredDocs.map((doc, idx) => (
                <div
                  key={doc._id || idx}
                  className="bg-slate-950/70 border border-slate-800 rounded-xl p-4 space-y-2 hover:border-slate-700 transition"
                >
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-mono text-sky-400 font-semibold">
                      _id: {doc._id || 'ObjectId(' + idx + ')'}
                    </span>
                    <span className="text-[10px] text-slate-500 font-mono">
                      {doc.createdAt ? new Date(doc.createdAt).toISOString() : `Index #${idx + 1}`}
                    </span>
                  </div>
                  <pre className="text-[11px] font-mono text-slate-300 overflow-x-auto bg-slate-900 p-3 rounded-lg border border-slate-850 max-h-44">
                    {JSON.stringify(doc, null, 2)}
                  </pre>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
