from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
from typing import Optional
import sqlite3, uuid, httpx, os, json
from datetime import datetime, timedelta
from dotenv import load_dotenv
from jose import JWTError, jwt
from passlib.context import CryptContext

load_dotenv()

app = FastAPI(title="Campus Problem Solver API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

DB_PATH = "problems.db"
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")

# ── Security config ──────────────────────────────────────────────────────────
SECRET_KEY = os.getenv("SECRET_KEY", "campussolve-secret-change-in-production")
ALGORITHM = "HS256"
TOKEN_EXPIRE_HOURS = 1

# Admin credentials — change these in .env !
ADMIN_USERNAME = os.getenv("ADMIN_USERNAME", "admin")
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "campus@123")

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
bearer_scheme = HTTPBearer()

DEPARTMENTS = {
    "Bathroom & Hygiene": "Sanitation Dept.",
    "Anti-Ragging & Safety": "Student Safety Cell",
    "Mess & Food Quality": "Mess Committee",
    "Academic Issues": "Academic Office",
    "Infrastructure/Maintenance": "Maintenance Dept.",
    "Other": "Administration",
}

# ── DB setup ─────────────────────────────────────────────────────────────────
def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    with get_db() as db:
        db.execute("""
            CREATE TABLE IF NOT EXISTS problems (
                id          TEXT PRIMARY KEY,
                description TEXT NOT NULL,
                category    TEXT,
                department  TEXT,
                confidence  REAL,
                status      TEXT DEFAULT 'Submitted',
                resolution  TEXT DEFAULT '',
                student_id  TEXT,
                created_at  TEXT,
                updated_at  TEXT
            )
        """)
        db.commit()

init_db()

# ── JWT helpers ───────────────────────────────────────────────────────────────
def create_token(username: str) -> str:
    expire = datetime.utcnow() + timedelta(hours=TOKEN_EXPIRE_HOURS)
    return jwt.encode({"sub": username, "exp": expire}, SECRET_KEY, algorithm=ALGORITHM)

def verify_token(credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme)):
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        username = payload.get("sub")
        if username != ADMIN_USERNAME:
            raise HTTPException(status_code=401, detail="Invalid token")
        return username
    except JWTError:
        raise HTTPException(status_code=401, detail="Token expired or invalid. Please login again.")

# ── Schemas ───────────────────────────────────────────────────────────────────
class LoginRequest(BaseModel):
    username: str
    password: str

class ClassifyRequest(BaseModel):
    description: str

class SubmitRequest(BaseModel):
    description: str
    student_id: Optional[str] = "anonymous"

class StatusUpdate(BaseModel):
    status: str
    resolution: Optional[str] = ""

# ── AI Classification ─────────────────────────────────────────────────────────
async def classify_with_ai(description: str) -> dict:
    if not GEMINI_API_KEY:
        return {"category": "Other", "confidence": 50, "reason": "No API key configured"}

    prompt = f"""Classify this campus complaint into exactly one category.
Categories: "Bathroom & Hygiene", "Anti-Ragging & Safety", "Mess & Food Quality", "Academic Issues", "Infrastructure/Maintenance", "Other"

Complaint: {description}

Return ONLY valid JSON: {{"category": "...", "confidence": 85, "reason": "brief reason under 10 words"}}"""

    try:
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                f"https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite-preview:generateContent?key={GEMINI_API_KEY}",
                json={
                    "contents": [{"parts": [{"text": prompt}]}],
                    "generationConfig": {"temperature": 0.1}
                },
                timeout=15,
            )
            resp.raise_for_status()
            text = resp.json()["candidates"][0]["content"]["parts"][0]["text"]
            text = text.replace("```json", "").replace("```", "").strip()
            return json.loads(text)
    except Exception:
        desc = description.lower()
        if any(w in desc for w in ["bathroom","toilet","water","hygiene","washroom"]):
            return {"category": "Bathroom & Hygiene", "confidence": 80, "reason": "Keyword match"}
        elif any(w in desc for w in ["ragging","bully","threat","safety","harassment"]):
            return {"category": "Anti-Ragging & Safety", "confidence": 80, "reason": "Keyword match"}
        elif any(w in desc for w in ["mess","food","canteen","meal","eating"]):
            return {"category": "Mess & Food Quality", "confidence": 80, "reason": "Keyword match"}
        elif any(w in desc for w in ["exam","teacher","class","marks","academic","lecture"]):
            return {"category": "Academic Issues", "confidence": 80, "reason": "Keyword match"}
        elif any(w in desc for w in ["light","fan","electricity","wifi","repair","broken","maintenance"]):
            return {"category": "Infrastructure/Maintenance", "confidence": 80, "reason": "Keyword match"}
        else:
            return {"category": "Other", "confidence": 60, "reason": "Manual review needed"}

# ── Auth Routes ───────────────────────────────────────────────────────────────
@app.post("/admin/login")
def admin_login(req: LoginRequest):
    if req.username != ADMIN_USERNAME or req.password != ADMIN_PASSWORD:
        raise HTTPException(status_code=401, detail="Invalid username or password")
    token = create_token(req.username)
    return {"access_token": token, "token_type": "bearer", "expires_in": f"{TOKEN_EXPIRE_HOURS}h"}

@app.get("/admin/verify")
def verify_admin(username: str = Depends(verify_token)):
    return {"valid": True, "username": username}

# ── Public Routes ─────────────────────────────────────────────────────────────
@app.get("/")
def root():
    return {"status": "Campus Problem Solver API running"}

@app.post("/classify")
async def classify(req: ClassifyRequest):
    if not req.description.strip():
        raise HTTPException(400, "Description cannot be empty")
    result = await classify_with_ai(req.description)
    result["department"] = DEPARTMENTS.get(result["category"], "Administration")
    return result

@app.post("/problems")
async def submit_problem(req: SubmitRequest):
    if not req.description.strip():
        raise HTTPException(400, "Description cannot be empty")
    classification = await classify_with_ai(req.description)
    problem_id = "CPS-" + str(uuid.uuid4())[:8].upper()
    now = datetime.utcnow().isoformat()
    with get_db() as db:
        db.execute(
            """INSERT INTO problems (id,description,category,department,confidence,
               status,resolution,student_id,created_at,updated_at)
               VALUES (?,?,?,?,?,?,?,?,?,?)""",
            (problem_id, req.description,
             classification.get("category","Other"),
             DEPARTMENTS.get(classification.get("category","Other"),"Administration"),
             classification.get("confidence",50),
             "Submitted","",req.student_id,now,now),
        )
        db.commit()
    return {
        "id": problem_id,
        "category": classification.get("category"),
        "department": DEPARTMENTS.get(classification.get("category","Other")),
        "confidence": classification.get("confidence"),
        "status": "Submitted",
        "created_at": now,
    }

@app.get("/problems/student/{student_id}")
def get_student_problems(student_id: str):
    with get_db() as db:
        rows = db.execute(
            "SELECT * FROM problems WHERE student_id=? ORDER BY created_at DESC",
            (student_id,)
        ).fetchall()
    return [dict(r) for r in rows]

@app.get("/problems/{problem_id}")
def get_problem(problem_id: str):
    with get_db() as db:
        row = db.execute("SELECT * FROM problems WHERE id=?", (problem_id,)).fetchone()
    if not row:
        raise HTTPException(404, "Problem not found")
    return dict(row)

# ── Protected Admin Routes ────────────────────────────────────────────────────
@app.get("/problems")
def get_all_problems(username: str = Depends(verify_token)):
    with get_db() as db:
        rows = db.execute("SELECT * FROM problems ORDER BY created_at DESC").fetchall()
    return [dict(r) for r in rows]

@app.patch("/problems/{problem_id}")
def update_problem(problem_id: str, update: StatusUpdate, username: str = Depends(verify_token)):
    now = datetime.utcnow().isoformat()
    with get_db() as db:
        row = db.execute("SELECT id FROM problems WHERE id=?", (problem_id,)).fetchone()
        if not row:
            raise HTTPException(404, "Problem not found")
        db.execute(
            "UPDATE problems SET status=?,resolution=?,updated_at=? WHERE id=?",
            (update.status, update.resolution, now, problem_id),
        )
        db.commit()
    return {"message": "Updated", "id": problem_id, "status": update.status}

@app.get("/stats")
@app.get("/stats-public")
def get_public_stats():
    with get_db() as db:
        total = db.execute("SELECT COUNT(*) FROM problems").fetchone()[0]
        by_status = db.execute("SELECT status, COUNT(*) as count FROM problems GROUP BY status").fetchall()
    return {
        "total": total,
        "by_status": {r["status"]: r["count"] for r in by_status},
    }
def get_stats(username: str = Depends(verify_token)):
    with get_db() as db:
        total = db.execute("SELECT COUNT(*) FROM problems").fetchone()[0]
        by_status = db.execute("SELECT status, COUNT(*) as count FROM problems GROUP BY status").fetchall()
        by_category = db.execute("SELECT category, COUNT(*) as count FROM problems GROUP BY category").fetchall()
    return {
        "total": total,
        "by_status": {r["status"]: r["count"] for r in by_status},
        "by_category": {r["category"]: r["count"] for r in by_category},
    }