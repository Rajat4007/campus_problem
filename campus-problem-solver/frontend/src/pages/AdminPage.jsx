import { useState, useEffect } from "react";
import { api } from "../api";

const STATUS_BADGE = {
  Submitted:     "badge badge-submitted",
  "In Progress": "badge badge-progress",
  Resolved:      "badge badge-resolved",
};

function SearchBox({ token, onUpdate }) {
  const [query, setQuery]         = useState("");
  const [result, setResult]       = useState(null);
  const [error, setError]         = useState("");
  const [loading, setLoading]     = useState(false);
  const [status, setStatus]       = useState("");
  const [resolution, setResolution] = useState("");
  const [saving, setSaving]       = useState(false);
  const [saved, setSaved]         = useState(false);

  const search = async () => {
    if (!query.trim()) { setError("Please enter a tracking ID."); return; }
    setError(""); setLoading(true); setResult(null); setSaved(false);
    try {
      const data = await api.getById(query.trim().toUpperCase());
      setResult(data);
      setStatus(data.status);
      setResolution(data.resolution || "");
    } catch (e) { setError("No problem found with this ID."); }
    setLoading(false);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.updateStatus(result.id, status, resolution, token);
      setSaved(true);
      setResult(r => ({ ...r, status, resolution }));
      if (onUpdate) onUpdate();
      setTimeout(() => setSaved(false), 2000);
    } catch (e) { alert("Save failed: " + e.message); }
    setSaving(false);
  };

  return (
    <div className="glass" style={{ padding:"1.25rem", marginBottom:16 }}>
      <div style={{ fontSize:13, fontWeight:700, marginBottom:10, display:"flex", alignItems:"center", gap:8 }}>
        <span>🔍</span> Search & Update by Tracking ID
      </div>
      <div style={{ display:"flex", gap:8 }}>
        <input
          type="text"
          value={query}
          onChange={e => { setQuery(e.target.value); setResult(null); setError(""); setSaved(false); }}
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
        <div style={{ marginTop:12, padding:"14px", background:"var(--bg3)", borderRadius:12, border:"1.5px solid var(--border)", animation:"fadeUp 0.3s ease" }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:8, marginBottom:10 }}>
            <div style={{ flex:1 }}>
              <div style={{ fontFamily:"'Syne',sans-serif", fontWeight:700, fontSize:15, marginBottom:4 }}>{result.id}</div>
              <div style={{ fontSize:13, color:"var(--text2)", marginBottom:8, lineHeight:1.5 }}>{result.description}</div>
              <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
                <span className="badge badge-cat">{result.category}</span>
                <span style={{ fontSize:11, color:"var(--text2)" }}>{result.department}</span>
                <span style={{ fontSize:11, color:"var(--text2)" }}>{new Date(result.created_at).toLocaleString()}</span>
              </div>
            </div>
            <span className={STATUS_BADGE[result.status] || "badge badge-submitted"}>{result.status}</span>
          </div>

          <div style={{ height:"1px", background:"var(--border)", margin:"12px 0" }} />

          <div style={{ fontSize:12, fontWeight:700, color:"var(--text2)", marginBottom:10, textTransform:"uppercase", letterSpacing:"0.5px" }}>
            Update This Problem
          </div>
          <div style={{ display:"flex", gap:8, flexWrap:"wrap", alignItems:"center" }}>
            <select value={status} onChange={e => setStatus(e.target.value)} style={{ padding:"7px 10px", fontSize:13 }}>
              <option>Submitted</option>
              <option>In Progress</option>
              <option>Resolved</option>
            </select>
            <input
              type="text"
              value={resolution}
              onChange={e => setResolution(e.target.value)}
              placeholder="Add resolution note…"
              style={{ flex:1, minWidth:160, padding:"7px 10px", fontSize:13, border:"1.5px solid var(--border)", borderRadius:8, background:"var(--bg2)", color:"var(--text)", fontFamily:"inherit" }}
            />
            <button className="btn btn-primary btn-sm" onClick={handleSave} disabled={saving} style={{ whiteSpace:"nowrap" }}>
              {saving ? "Saving…" : saved ? "✓ Saved!" : "Save →"}
            </button>
          </div>
          {saved && (
            <div style={{ marginTop:8, fontSize:12, color:"var(--accent3)", fontWeight:600, animation:"fadeUp 0.3s ease" }}>
              ✓ Problem updated successfully!
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function LoginScreen({ onLogin }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [error, setError]       = useState("");
  const [loading, setLoading]   = useState(false);

  const handleLogin = async () => {
    if (!username || !password) { setError("Please enter username and password."); return; }
    setLoading(true); setError("");
    try {
      const data = await api.adminLogin(username, password);
      localStorage.setItem("cps_admin_token", data.access_token);
      onLogin(data.access_token);
    } catch (e) { setError("Invalid username or password."); }
    setLoading(false);
  };

  return (
    <div className="page" style={{ maxWidth:420, marginTop:"4rem" }}>
      <div className="glass" style={{ padding:"1.75rem" }}>
        <div className="card-title" style={{ marginBottom:"1.25rem" }}>
          <div className="card-icon">🔐</div> Admin Login
        </div>

        <div style={{ marginBottom:12 }}>
          <label>Username</label>
          <input
            type="text"
            value={username}
            onChange={e => setUsername(e.target.value)}
            placeholder="Enter admin username"
            style={{ width:"100%", padding:"10px 12px", fontSize:14, border:"1.5px solid var(--border)", borderRadius:10, background:"var(--bg3)", color:"var(--text)", fontFamily:"inherit" }}
          />
        </div>

        <div style={{ marginBottom:16 }}>
          <label>Password</label>
          <div style={{ position:"relative" }}>
            <input
              type={showPass ? "text" : "password"}
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Enter password"
              onKeyDown={e => e.key === "Enter" && handleLogin()}
              style={{ width:"100%", padding:"10px 40px 10px 12px", fontSize:14, border:"1.5px solid var(--border)", borderRadius:10, background:"var(--bg3)", color:"var(--text)", fontFamily:"inherit" }}
            />
            <button
              onClick={() => setShowPass(s => !s)}
              style={{ position:"absolute", right:10, top:"50%", transform:"translateY(-50%)", background:"none", border:"none", cursor:"pointer", fontSize:16, color:"var(--text2)", padding:4 }}
            >
              {showPass ? "🙈" : "👁️"}
            </button>
          </div>
        </div>

        {error && <div className="error-msg" style={{ marginBottom:10 }}>{error}</div>}
        <button className="btn btn-primary" style={{ width:"100%" }} onClick={handleLogin} disabled={loading}>
          {loading ? "Logging in…" : "Login →"}
        </button>
        <div style={{ fontSize:11, color:"var(--text2)", marginTop:12, textAlign:"center" }}>
          Default: admin / campus@123
        </div>
      </div>
    </div>
  );
}

function ProblemRow({ problem, token, onUpdate }) {
  const [status, setStatus]         = useState(problem.status);
  const [resolution, setResolution] = useState(problem.resolution || "");
  const [saving, setSaving]         = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      await api.updateStatus(problem.id, status, resolution, token);
      onUpdate();
    } catch (e) {
      if (e.message.includes("401")) { localStorage.removeItem("cps_admin_token"); window.location.reload(); }
      alert("Save failed: " + e.message);
    }
    setSaving(false);
  };

  return (
    <div className="prob-card">
      <div className="prob-header">
        <div style={{ flex:1 }}>
          <div style={{ display:"flex", gap:8, alignItems:"center", marginBottom:6, flexWrap:"wrap" }}>
            <span className="prob-id">{problem.id}</span>
            <span className={STATUS_BADGE[problem.status] || "badge badge-submitted"}>{problem.status}</span>
          </div>
          <div className="prob-desc" style={{ marginBottom:8 }}>{problem.description}</div>
          <div className="prob-meta">
            <span className="badge badge-cat">{problem.category}</span>
            <span style={{ fontSize:11, color:"var(--text2)" }}>{problem.department}</span>
            <span style={{ fontSize:11, color:"var(--text2)" }}>{Math.round(problem.confidence)}% confidence</span>
            <span style={{ fontSize:11, color:"var(--text2)" }}>{new Date(problem.created_at).toLocaleString()}</span>
          </div>
        </div>
      </div>
      <div style={{ marginTop:12, display:"flex", gap:8, flexWrap:"wrap", alignItems:"center" }}>
        <select value={status} onChange={e => setStatus(e.target.value)}>
          <option>Submitted</option>
          <option>In Progress</option>
          <option>Resolved</option>
        </select>
        <input
          type="text"
          style={{ flex:1, minWidth:160, padding:"5px 10px", fontSize:12 }}
          placeholder="Add resolution note…"
          value={resolution}
          onChange={e => setResolution(e.target.value)}
        />
        <button className="btn btn-sm btn-primary" onClick={save} disabled={saving}>
          {saving ? "Saving…" : "Save"}
        </button>
      </div>
    </div>
  );
}

export default function AdminPage() {
  const [token, setToken]       = useState(localStorage.getItem("cps_admin_token") || "");
  const [problems, setProblems] = useState([]);
  const [stats, setStats]       = useState(null);
  const [loading, setLoading]   = useState(false);
  const [filter, setFilter]     = useState("All");

  const load = async () => {
    setLoading(true);
    try {
      const [data, s] = await Promise.all([api.getAll(token), api.getStats(token)]);
      setProblems(data); setStats(s);
    } catch (e) {
      if (e.message.includes("401")) { localStorage.removeItem("cps_admin_token"); setToken(""); }
    }
    setLoading(false);
  };

  useEffect(() => { if (token) load(); }, [token]);

  if (!token) return <LoginScreen onLogin={setToken} />;

  const filtered = filter === "All" ? problems : problems.filter(p => p.status === filter);

  return (
    <div className="page">
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16, flexWrap:"wrap", gap:8 }}>
        <div className="section-title">Admin Panel</div>
        <div style={{ display:"flex", gap:8 }}>
          <button className="btn btn-sm" onClick={load}>↻ Refresh</button>
          <button className="btn btn-sm" onClick={() => { localStorage.removeItem("cps_admin_token"); setToken(""); }}>Logout</button>
        </div>
      </div>

      <SearchBox token={token} onUpdate={load} />

      {stats && (
        <div className="metric-row">
          <div className="metric-card" style={{ borderTop:"3px solid var(--accent)" }}>
            <div className="metric-label">Total</div>
            <div className="metric-val">{stats.total}</div>
          </div>
          <div className="metric-card" style={{ borderTop:"3px solid var(--accent2)" }}>
            <div className="metric-label">In Progress</div>
            <div className="metric-val">{stats.by_status?.["In Progress"] || 0}</div>
          </div>
          <div className="metric-card" style={{ borderTop:"3px solid var(--accent3)" }}>
            <div className="metric-label">Resolved</div>
            <div className="metric-val">{stats.by_status?.Resolved || 0}</div>
          </div>
        </div>
      )}

      <div style={{ display:"flex", gap:6, marginBottom:16, flexWrap:"wrap" }}>
        {["All","Submitted","In Progress","Resolved"].map(f => (
          <button key={f} className={`btn btn-sm${filter===f?" btn-primary":""}`} onClick={() => setFilter(f)}>{f}</button>
        ))}
      </div>

      {loading ? (
        <div className="empty">Loading…</div>
      ) : filtered.length === 0 ? (
        <div className="empty">No problems found.</div>
      ) : (
        filtered.map(p => <ProblemRow key={p.id} problem={p} token={token} onUpdate={load} />)
      )}
    </div>
  );
}