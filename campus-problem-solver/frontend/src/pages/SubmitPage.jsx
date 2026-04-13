import { useState, useRef, useEffect } from "react";
import { api } from "../api";

const BLOCKS = ["Block 1", "Block 2", "Block 3", "Block 4"];

function Toast({ message, type, onClose }) {
  useEffect(() => {
    const t = setTimeout(onClose, 3500);
    return () => clearTimeout(t);
  }, []);
  const colors = {
    success: "linear-gradient(135deg,#16a34a,#15803d)",
    error:   "linear-gradient(135deg,#dc2626,#b91c1c)",
    info:    "linear-gradient(135deg,#2563eb,#1d4ed8)",
  };
  return (
    <div style={{
      background: colors[type] || colors.info,
      color:"#fff", padding:"12px 18px", borderRadius:12,
      fontSize:13, fontWeight:600, boxShadow:"0 8px 32px rgba(0,0,0,0.25)",
      animation:"toastIn 0.4s cubic-bezier(.4,0,.2,1)",
      maxWidth:300, display:"flex", alignItems:"center", gap:10,
    }}>
      <span>{type==="success"?"✓":type==="error"?"✕":"ℹ"}</span>
      <span>{message}</span>
      <button onClick={onClose} style={{marginLeft:"auto",background:"none",border:"none",color:"#fff",cursor:"pointer",fontSize:16}}>×</button>
    </div>
  );
}

export default function SubmitPage({ studentId, onSubmitted }) {
  const [description, setDescription]   = useState("");
  const [block, setBlock]               = useState("");
  const [room, setRoom]                 = useState("");
  const [image, setImage]               = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [classified, setClassified]     = useState(null);
  const [tracking, setTracking]         = useState(null);
  const [stats, setStats]               = useState({ total:0, by_status:{} });
  const [loading, setLoading]           = useState(false);
  const [submitting, setSubmitting]     = useState(false);
  const [recording, setRecording]       = useState(false);
  const [copied, setCopied]             = useState(false);
  const [toasts, setToasts]             = useState([]);
  const [dragOver, setDragOver]         = useState(false);
  const mediaRef = useRef(null);
  const fileRef  = useRef(null);

  const inProgress = stats.by_status?.["In Progress"] || 0;
  const resolved   = stats.by_status?.["Resolved"] || 0;
  const total      = stats.total || 0;

  const loadStats = async () => {
    try {
      const res = await fetch("http://127.0.0.1:8000/stats-public");
      if (res.ok) setStats(await res.json());
    } catch (e) {}
  };

  useEffect(() => { loadStats(); }, []);

  const addToast = (message, type = "info") => {
    const id = Date.now();
    setToasts(t => [...t, { id, message, type }]);
  };
  const removeToast = (id) => setToasts(t => t.filter(x => x.id !== id));

  const toggleVoice = () => {
    if (recording) {
      mediaRef.current?.stop();
      mediaRef.current = null;
      setRecording(false);
      return;
    }
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { addToast("Voice sirf Chrome browser mein kaam karta hai.", "error"); return; }
    const rec = new SR();
    rec.lang = "en-IN";
    rec.continuous = true;
    rec.interimResults = true;
    let finalText = "";
    rec.onstart = () => { addToast("Listening… bol do!", "info"); setRecording(true); };
    rec.onresult = (e) => {
      finalText = "";
      let interim = "";
      for (let i = 0; i < e.results.length; i++) {
        if (e.results[i].isFinal) finalText += e.results[i][0].transcript + " ";
        else interim += e.results[i][0].transcript;
      }
      setDescription(prev => {
        const base = prev.replace(/\[INTERIM\].*$/, "").trimEnd();
        return (base + " " + finalText + (interim ? " [INTERIM] " + interim : "")).trim();
      });
    };
    rec.onerror = (e) => {
      if (e.error === "not-allowed") addToast("Microphone access denied.", "error");
      else if (e.error === "no-speech") addToast("Koi awaaz nahi aayi. Dobara try karo.", "error");
      else addToast("Mic error: " + e.error, "error");
      setRecording(false);
    };
    rec.onend = () => {
      setRecording(false);
      setDescription(prev => prev.replace(/\[INTERIM\].*$/, "").trim());
      if (finalText.trim()) addToast("Voice successfully add ho gaya!", "success");
    };
    mediaRef.current = rec;
    rec.start();
  };

  const handleImage = (file) => {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { addToast("Image too large! Max 5MB.", "error"); return; }
    setImage(file);
    setImagePreview(URL.createObjectURL(file));
    addToast("Image attached!", "success");
  };

  const handleDrop = (e) => {
    e.preventDefault(); setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith("image/")) handleImage(file);
  };

  const handleClassify = async () => {
    if (!description.trim()) { addToast("Please describe the problem first.", "error"); return; }
    setLoading(true); setClassified(null);
    try {
      const result = await api.classify(description);
      setClassified(result);
      addToast(`Classified as: ${result.category}`, "success");
    } catch (e) { addToast("Classification failed. You can still submit.", "error"); }
    setLoading(false);
  };

  const handleSubmit = async () => {
    if (!description.trim()) { addToast("Please describe the problem.", "error"); return; }
    if (!block)               { addToast("Please select a block.", "error"); return; }
    if (!room.trim())         { addToast("Please enter room number.", "error"); return; }
    setSubmitting(true);
    try {
      const fullDesc = `[${block}, Room ${room}] ${description}`;
      const result = await api.submit(fullDesc, studentId);
      setTracking(result);
      setDescription(""); setBlock(""); setRoom("");
      setImage(null); setImagePreview(null); setClassified(null);
      await loadStats();
      if (onSubmitted) onSubmitted();
      addToast("Problem submitted successfully!", "success");
      if ("Notification" in window && Notification.permission === "granted") {
        new Notification("CampusSolve", { body: `Submitted! ID: ${result.id}` });
      }
    } catch (e) { addToast("Submission failed: " + e.message, "error"); }
    setSubmitting(false);
  };

  const requestNotifPermission = async () => {
    if (!("Notification" in window)) { addToast("Notifications not supported.", "error"); return; }
    const perm = await Notification.requestPermission();
    if (perm === "granted") addToast("Notifications enabled!", "success");
    else addToast("Notification permission denied.", "error");
  };

  const copyId = () => {
    if (!tracking) return;
    navigator.clipboard.writeText(tracking.id).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
      addToast("Tracking ID copied!", "success");
    });
  };

  return (
    <>
      <style>{`
        @keyframes toastIn { from{opacity:0;transform:translateX(60px)} to{opacity:1;transform:translateX(0)} }
        @keyframes fadeUp  { from{opacity:0;transform:translateY(24px)} to{opacity:1;transform:translateY(0)} }
        @keyframes pulse   { 0%,100%{box-shadow:0 0 0 0 rgba(232,93,38,0.5)} 70%{box-shadow:0 0 0 10px rgba(232,93,38,0)} }
        @keyframes float   { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-6px)} }
        .glass {
          background: rgba(255,255,255,0.08);
          backdrop-filter: blur(18px);
          -webkit-backdrop-filter: blur(18px);
          border: 1.5px solid rgba(255,255,255,0.15);
          border-radius: 20px;
          box-shadow: 0 8px 32px rgba(0,0,0,0.12);
        }
        .dark .glass {
          background: rgba(20,18,14,0.55);
          border-color: rgba(255,255,255,0.08);
          box-shadow: 0 8px 40px rgba(0,0,0,0.4);
        }
        .submit-bg {
          min-height: 100vh;
          background: linear-gradient(135deg,#fff8f4 0%,#f0f4ff 50%,#f4fff8 100%);
          padding-bottom: 3rem;
        }
        .dark .submit-bg {
          background: linear-gradient(135deg,#12100e 0%,#0f121a 50%,#0e1210 100%);
        }
        .fade-up   { animation: fadeUp 0.5s ease both; }
        .fade-up-1 { animation: fadeUp 0.5s 0.1s ease both; }
        .fade-up-2 { animation: fadeUp 0.5s 0.2s ease both; }
        .fade-up-3 { animation: fadeUp 0.5s 0.3s ease both; }
        .block-btn {
          flex:1; padding:14px 8px; border-radius:12px;
          border:1.5px solid var(--border); background:var(--bg3);
          color:var(--text2); font-family:'Syne',sans-serif;
          font-size:13px; font-weight:700; cursor:pointer;
          transition:all 0.2s; text-align:center;
        }
        .block-btn:hover { border-color:var(--accent); color:var(--accent); transform:translateY(-2px); }
        .block-btn.selected {
          background:var(--accent); color:#fff; border-color:var(--accent);
          transform:translateY(-2px); box-shadow:0 4px 16px rgba(232,93,38,0.35);
        }
        .mic-btn {
          width:48px; height:48px; border-radius:50%;
          border:2px solid var(--border); background:var(--bg3);
          color:var(--text); font-size:20px; cursor:pointer;
          transition:all 0.2s; display:flex; align-items:center; justify-content:center; flex-shrink:0;
        }
        .mic-btn.recording { background:#dc2626; border-color:#dc2626; animation:pulse 1.2s infinite; }
        .mic-btn:hover { transform:scale(1.08); }
        .drop-zone {
          border:2px dashed var(--border); border-radius:14px;
          padding:24px; text-align:center; cursor:pointer;
          transition:all 0.2s; background:var(--bg3); position:relative;
        }
        .drop-zone.over { border-color:var(--accent); background:rgba(232,93,38,0.06); }
        .drop-zone:hover { border-color:var(--accent2); }
        .img-preview {
          width:100%; max-height:180px; object-fit:cover;
          border-radius:12px; margin-top:10px;
          border:1.5px solid var(--border); animation:fadeUp 0.3s ease;
        }
        .notif-btn {
          display:flex; align-items:center; gap:8px;
          padding:10px 16px; border-radius:10px;
          border:1.5px solid var(--border); background:var(--bg3);
          color:var(--text); font-size:13px; font-weight:600;
          cursor:pointer; transition:all 0.2s; font-family:'DM Sans',sans-serif;
        }
        .notif-btn:hover { border-color:var(--accent2); color:var(--accent2); }
        .room-input {
          width:100%; padding:12px 14px; font-size:14px;
          font-family:'DM Sans',sans-serif; border:1.5px solid var(--border);
          border-radius:10px; background:var(--bg3); color:var(--text); transition:border-color 0.2s;
        }
        .room-input:focus { outline:none; border-color:var(--accent); box-shadow:0 0 0 3px rgba(232,93,38,0.1); }
        .section-label {
          font-size:11px; font-weight:700; letter-spacing:1px;
          text-transform:uppercase; color:var(--text2); margin-bottom:10px; display:block;
        }
      `}</style>

      {/* Toasts */}
      <div style={{ position:"fixed", top:80, right:20, zIndex:9999, display:"flex", flexDirection:"column", gap:8 }}>
        {toasts.map(t => <Toast key={t.id} message={t.message} type={t.type} onClose={() => removeToast(t.id)} />)}
      </div>

      <div className="submit-bg">
        <div className="page">

          {/* Hero */}
          <div className="hero fade-up">
            <div className="hero-tag">AI-Powered</div>
            <h1>Report a <span>Campus Problem</span></h1>
            <p>Describe your issue and our AI will classify and route it to the right department instantly.</p>
          </div>

          {/* Stats */}
          <div className="stats-row fade-up-1">
            <div className="stat-card s1"><div className="stat-num">{total}</div><div className="stat-label">Total Filed</div></div>
            <div className="stat-card s2"><div className="stat-num">{inProgress}</div><div className="stat-label">In Progress</div></div>
            <div className="stat-card s3"><div className="stat-num">{resolved}</div><div className="stat-label">Resolved</div></div>
          </div>

          {/* Location Card */}
          <div className="glass fade-up-2" style={{ padding:"1.5rem", marginBottom:14 }}>
            <div className="card-title" style={{ marginBottom:"1.2rem" }}>
              <div className="card-icon">📍</div> Location
            </div>
            <span className="section-label">Select Block</span>
            <div style={{ display:"flex", gap:10, marginBottom:16 }}>
              {BLOCKS.map(b => (
                <button key={b} className={`block-btn${block===b?" selected":""}`} onClick={() => setBlock(b)}>
                  {b}
                </button>
              ))}
            </div>
            <span className="section-label">Room Number</span>
            <input
              className="room-input"
              type="text"
              placeholder="e.g. 503, 201A, Ground Floor"
              value={room}
              onChange={e => setRoom(e.target.value)}
            />
            {block && room && (
              <div style={{ marginTop:12, padding:"8px 14px", background:"rgba(232,93,38,0.1)", borderRadius:8, fontSize:13, color:"var(--accent)", fontWeight:600, display:"flex", alignItems:"center", gap:6, animation:"fadeUp 0.3s ease" }}>
                📌 {block}, Room {room}
              </div>
            )}
          </div>

          {/* Problem Card */}
          <div className="glass fade-up-3" style={{ padding:"1.5rem", marginBottom:14 }}>
            <div className="card-title" style={{ marginBottom:"1.2rem" }}>
              <div className="card-icon">📝</div> Describe Your Problem
            </div>

            <span className="section-label">What's the issue?</span>
            <div style={{ display:"flex", gap:10, alignItems:"flex-start" }}>
              <textarea
                rows={4}
                value={description}
                onChange={e => { setDescription(e.target.value); setTracking(null); setClassified(null); }}
                placeholder="e.g. Bathroom on 3rd floor has no water since morning…"
                style={{ flex:1 }}
              />
              <button className={`mic-btn${recording?" recording":""}`} onClick={toggleVoice} title={recording?"Stop":"Voice input"}>
                {recording ? "⏹" : "🎤"}
              </button>
            </div>
            {recording && (
              <div style={{ fontSize:12, color:"#dc2626", fontWeight:600, marginTop:6, display:"flex", alignItems:"center", gap:6 }}>
                <span style={{ width:8, height:8, borderRadius:"50%", background:"#dc2626", display:"inline-block", animation:"pulse 1s infinite" }} />
                Recording… speak clearly
              </div>
            )}

            <span className="section-label" style={{ marginTop:16 }}>Attach Photo (optional)</span>
            <div
              className={`drop-zone${dragOver?" over":""}`}
              onDragOver={e => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileRef.current?.click()}
            >
              <input ref={fileRef} type="file" accept="image/*" style={{ display:"none" }} onChange={e => handleImage(e.target.files[0])} />
              {imagePreview ? (
                <>
                  <img src={imagePreview} alt="preview" className="img-preview" />
                  <div style={{ fontSize:12, color:"var(--text2)", marginTop:8 }}>{image?.name} • Click to change</div>
                </>
              ) : (
                <>
                  <div style={{ fontSize:28, marginBottom:8, animation:"float 3s ease-in-out infinite" }}>📸</div>
                  <div style={{ fontSize:13, color:"var(--text2)", fontWeight:500 }}>Click to upload or drag & drop</div>
                  <div style={{ fontSize:11, color:"var(--text2)", marginTop:4 }}>PNG, JPG, WEBP up to 5MB</div>
                </>
              )}
            </div>

            {classified && (
              <div className="ai-box" style={{ marginTop:14 }}>
                <div className="ai-label">AI Classification Result</div>
                <div className="ai-cat">{classified.category}</div>
                <div className="ai-dept">→ {classified.department}</div>
                <div className="conf-row">
                  <div className="conf-bg"><div className="conf-fill" style={{ width:`${classified.confidence}%` }} /></div>
                  <div className="conf-pct">{Math.round(classified.confidence)}%</div>
                </div>
              </div>
            )}

            {tracking && (
              <div className="tracking-box" style={{ marginTop:14 }}>
                <div className="tracking-label">✓ Submitted Successfully!</div>
                <div className="tracking-id-row">
                  <div className="tracking-id">{tracking.id}</div>
                  <button className={`copy-btn${copied?" copied":""}`} onClick={copyId} title="Copy ID">
                    {copied ? "✓" : "📋"}
                  </button>
                </div>
                <div className="tracking-dept">
                  Routed to: {tracking.department} • {Math.round(tracking.confidence)}% confidence
                </div>
              </div>
            )}

            <div className="btn-row">
              <button className="btn" onClick={handleClassify} disabled={loading}>
                {loading ? <><span className="spinner" style={{ borderTopColor:"var(--accent)", borderColor:"var(--border)" }} /> Classifying…</> : <><span>✦</span> Classify with AI</>}
              </button>
              <button className="btn btn-primary" onClick={handleSubmit} disabled={submitting || !description.trim() || !block || !room.trim()}>
                {submitting ? <><span className="spinner" /> Submitting…</> : "Submit Problem →"}
              </button>
              <button className="notif-btn" onClick={requestNotifPermission} title="Enable notifications">🔔</button>
            </div>
          </div>

        </div>
      </div>
    </>
  );
}