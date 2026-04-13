import { useState, useEffect } from "react";
import { api } from "../api";

const STATUS_BADGE = {
  "Submitted":   "badge badge-submitted",
  "In Progress": "badge badge-progress",
  "Resolved":    "badge badge-resolved",
};

function SearchBox() {
  const [query, setQuery]   = useState("");
  const [result, setResult] = useState(null);
  const [error, setError]   = useState("");
  const [loading, setLoading] = useState(false);

  const search = async () => {
    if (!query.trim()) { setError("Please enter a tracking ID."); return; }
    setError(""); setLoading(true); setResult(null);
    try {
      const data = await api.getById(query.trim().toUpperCase());
      setResult(data);
    } catch (e) {
      setError("No problem found with this ID.");
    }
    setLoading(false);
  };

  return (
    <div className="glass" style={{ padding:"1.25rem", marginBottom:16 }}>
      <div style={{ fontSize:13, fontWeight:700, marginBottom:10, display:"flex", alignItems:"center", gap:8 }}>
        <span>🔍</span> Search by Tracking ID
      </div>
      <div style={{ display:"flex", gap:8 }}>
        <input
          type="text"
          value={query}
          onChange={e => { setQuery(e.target.value); setResult(null); setError(""); }}
          onKeyDown={e => e.key === "Enter" && search()}
          placeholder="e.g. CPS-A1B2C3D4"
          style={{ flex:1, padding:"9px 12px", fontSize:13, border:"1.5px solid var(--border)", borderRadius:10, background:"var(--bg3)", color:"var(--text)", fontFamily:"inherit" }}
        />
        <button className="btn btn-primary" onClick={search} disabled={loading} style={{ whiteSpace:"nowrap" }}>
          {loading ? "…" : "Search →"}
        </button>
      </div>
      {error && <div className="error-msg" style={{ marginTop:8 }}>{error}</div>}
      {result && (
        <div style={{ marginTop:12, padding:"12px 14px", background:"var(--bg3)", borderRadius:10, border:"1.5px solid var(--border)", animation:"fadeUp 0.3s ease" }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:8, marginBottom:8 }}>
            <div>
              <div style={{ fontFamily:"'Syne',sans-serif", fontWeight:700, fontSize:14, marginBottom:4 }}>{result.id}</div>
              <div style={{ fontSize:13, color:"var(--text2)" }}>{result.description}</div>
            </div>
            <span className={STATUS_BADGE[result.status] || "badge badge-submitted"}>{result.status}</span>
          </div>
          <div style={{ display:"flex", gap:8, flexWrap:"wrap", marginTop:8 }}>
            <span className="badge badge-cat">{result.category}</span>
            <span style={{ fontSize:11, color:"var(--text2)" }}>{result.department}</span>
            <span style={{ fontSize:11, color:"var(--text2)" }}>{new Date(result.created_at).toLocaleString()}</span>
          </div>
          {result.resolution && (
            <div style={{ marginTop:8, padding:"6px 10px", background:"var(--bg2)", borderRadius:8, fontSize:12, color:"var(--text2)", borderLeft:"3px solid var(--accent2)" }}>
              <strong>Resolution:</strong> {result.resolution}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function TrackPage({ studentId }) {
  const [problems, setProblems] = useState([]);
  const [loading, setLoading]   = useState(true);

  const load = async () => {
    setLoading(true);
    try { setProblems(await api.getByStudent(studentId)); }
    catch (e) { console.error(e); }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  return (
    <div className="page">
      <div className="section-header">
        <div className="section-title">My Problems</div>
        <button className="btn btn-sm" style={{ marginLeft:"auto" }} onClick={load}>↻ Refresh</button>
      </div>

      {/* Search Box */}
      <SearchBox />

      {loading ? (
        <div className="empty">
          <span className="spinner" style={{ borderTopColor:"var(--accent)", borderColor:"var(--border)" }} /> Loading…
        </div>
      ) : problems.length === 0 ? (
        <div className="empty">No problems yet.<br />Go to Submit tab to report one.</div>
      ) : (
        problems.map(p => (
          <div className="prob-card" key={p.id}>
            <div className="prob-header">
              <div>
                <div className="prob-id">{p.id}</div>
                <div className="prob-desc">{p.description}</div>
              </div>
              <span className={STATUS_BADGE[p.status] || "badge badge-submitted"}>{p.status}</span>
            </div>
            <div className="prob-meta">
              <span className="badge badge-cat">{p.category}</span>
              <span style={{ fontSize:11, color:"var(--text2)" }}>{p.department}</span>
              <span style={{ fontSize:11, color:"var(--text2)" }}>{new Date(p.created_at).toLocaleString()}</span>
            </div>
            {p.resolution && (
              <div className="resolution"><strong>Resolution:</strong> {p.resolution}</div>
            )}
          </div>
        ))
      )}
    </div>
  );
}