import { useState } from "react";
import "./index.css";
import SubmitPage from "./pages/SubmitPage";
import TrackPage from "./pages/TrackPage";
import AdminPage from "./pages/AdminPage";

const STUDENT_ID = (() => {
  let id = localStorage.getItem("cps_sid");
  if (!id) { id = "STU-" + Math.random().toString(36).slice(2,8).toUpperCase(); localStorage.setItem("cps_sid", id); }
  return id;
})();

export default function App() {
  const [tab, setTab] = useState("submit");
  const [dark, setDark] = useState(false);
  const [refresh, setRefresh] = useState(0);

  const toggleDark = () => {
    setDark(d => !d);
    document.body.classList.toggle("dark");
  };

  return (
    <div>
      <nav className="topbar">
        <div className="brand">
          <span className="brand-dot"></span> CampusSolve
        </div>
        <div className="nav-tabs">
          {[["submit","Submit"],["track","My Problems"],["admin","Admin"]].map(([key,label]) => (
            <button key={key} className={`tab${tab===key?" active":""}`} onClick={() => setTab(key)}>{label}</button>
          ))}
        </div>
        <button className="dark-toggle" onClick={toggleDark}>
          <div className="dark-toggle-knob" style={{ transform: dark ? "translateX(16px)" : "translateX(0)" }}>
            {dark ? "🌙" : "☀️"}
          </div>
        </button>
      </nav>

      {tab === "submit" && <SubmitPage studentId={STUDENT_ID} onSubmitted={() => setRefresh(r=>r+1)} />}
      {tab === "track" && <TrackPage studentId={STUDENT_ID} key={refresh} />}
      {tab === "admin" && <AdminPage />}
    </div>
  );
}