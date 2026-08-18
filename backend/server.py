from fastapi import FastAPI, APIRouter, Request, HTTPException, Response
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
from pydantic import BaseModel, Field
from pathlib import Path
from datetime import datetime, timezone, timedelta
from typing import List
import os
import uuid
import hashlib
import secrets


# ============================================================
# ENVIRONMENT
# ============================================================

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ.get("DB_NAME", "family_ledger")
FRONTEND_URL = os.environ.get("FRONTEND_URL", "http://localhost:3001")

client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]


# ============================================================
# APP
# ============================================================

app = FastAPI(title="Family Ledger API")

api = APIRouter(prefix="/api")


# ============================================================
# HELPERS
# ============================================================

def now_iso():
    return datetime.now(timezone.utc).isoformat()


def month_key():
    return datetime.now().strftime("%Y-%m")


def clean(doc):
    if not doc:
        return None

    doc = dict(doc)
    doc.pop("_id", None)
    return doc


# ============================================================
# PASSWORD SECURITY
# ============================================================

def hash_password(password: str) -> str:
    """
    Hash a password using PBKDF2-HMAC-SHA256 with a random salt.
    No external password library is required.
    """
    salt = secrets.token_bytes(16)

    password_hash = hashlib.pbkdf2_hmac(
        "sha256",
        password.encode("utf-8"),
        salt,
        120000,
    )

    return f"{salt.hex()}:{password_hash.hex()}"


def verify_password(password: str, stored_hash: str) -> bool:
    try:
        salt_hex, hash_hex = stored_hash.split(":")

        salt = bytes.fromhex(salt_hex)

        calculated_hash = hashlib.pbkdf2_hmac(
            "sha256",
            password.encode("utf-8"),
            salt,
            120000,
        )

        return secrets.compare_digest(
            calculated_hash.hex(),
            hash_hex,
        )

    except (ValueError, TypeError):
        return False


# ============================================================
# SESSION SECURITY
# ============================================================

SESSION_DURATION_DAYS = 7


def create_session_token():
    return secrets.token_urlsafe(48)


async def current_user(request: Request):
    """
    Get the currently authenticated user from the session cookie.
    Also accepts Authorization: Bearer <token>.
    """

    token = request.cookies.get("session_token")

    authorization = request.headers.get("Authorization", "")

    if not token and authorization.startswith("Bearer "):
        token = authorization[7:]

    if not token:
        raise HTTPException(
            status_code=401,
            detail="Sign in required",
        )

    session = await db.user_sessions.find_one(
        {"session_token": token},
        {"_id": 0},
    )

    if not session:
        raise HTTPException(
            status_code=401,
            detail="Session not found",
        )

    expiry = session.get("expires_at")

    if isinstance(expiry, str):
        expiry = datetime.fromisoformat(expiry)

    if expiry.tzinfo is None:
        expiry = expiry.replace(tzinfo=timezone.utc)

    if expiry < datetime.now(timezone.utc):
        await db.user_sessions.delete_one(
            {"session_token": token}
        )

        raise HTTPException(
            status_code=401,
            detail="Session expired",
        )

    user = await db.users.find_one(
        {"user_id": session["user_id"]},
        {"_id": 0, "password_hash": 0},
    )

    if not user:
        raise HTTPException(
            status_code=401,
            detail="User not found",
        )

    return user


# ============================================================
# AUTH MODELS
# ============================================================

class RegisterInput(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    email: str = Field(min_length=3, max_length=200)
    password: str = Field(min_length=8, max_length=200)


class LoginInput(BaseModel):
    email: str = Field(min_length=3, max_length=200)
    password: str = Field(min_length=1, max_length=200)


# ============================================================
# BUDGET MODELS
# ============================================================

class CategoryIn(BaseModel):
    name: str
    planned: float = 0
    used: float = 0
    notes: str = ""


class MonthIn(BaseModel):
    income: float = 0
    categories: List[CategoryIn] = []
    goal_inclusions: dict = {}
    notes: str = ""


class GoalIn(BaseModel):
    name: str
    total_amount: float = 0
    due_date: str
    saved_amount: float = 0
    notes: str = ""
    active: bool = True


class ContributionIn(BaseModel):
    amount: float
    note: str = ""


class ExpenseIn(BaseModel):
    name: str
    amount: float = 0
    notes: str = ""


# ============================================================
# BASIC API
# ============================================================

@api.get("/")
async def root():
    return {
        "message": "Family Ledger API is running"
    }


@api.get("/health")
async def health():
    return {
        "status": "ok"
    }


# ============================================================
# AUTH — REGISTER
# ============================================================

@api.post("/auth/register")
async def register(
    payload: RegisterInput,
    response: Response,
):
    email = payload.email.strip().lower()
    name = payload.name.strip()

    if not name:
        raise HTTPException(
            status_code=400,
            detail="Name is required",
        )

    if len(payload.password) < 8:
        raise HTTPException(
            status_code=400,
            detail="Password must be at least 8 characters",
        )

    existing_user = await db.users.find_one(
        {"email": email},
        {"_id": 0},
    )

    if existing_user:
        raise HTTPException(
            status_code=409,
            detail="An account with this email already exists",
        )

    user_id = f"user_{uuid.uuid4().hex[:12]}"

    user_doc = {
        "user_id": user_id,
        "name": name,
        "email": email,
        "password_hash": hash_password(payload.password),
        "picture": "",
        "created_at": now_iso(),
    }

    await db.users.insert_one(user_doc.copy())

    token = create_session_token()

    expires = datetime.now(timezone.utc) + timedelta(
        days=SESSION_DURATION_DAYS
    )

    await db.user_sessions.insert_one(
        {
            "user_id": user_id,
            "session_token": token,
            "expires_at": expires.isoformat(),
            "created_at": now_iso(),
        }
    )

    response.set_cookie(
        key="session_token",
        value=token,
        max_age=SESSION_DURATION_DAYS * 24 * 60 * 60,
        httponly=True,
        secure=True,
        samesite="none",
    )

    return {
        "user_id": user_id,
        "name": name,
        "email": email,
        "picture": "",
    }


# ============================================================
# AUTH — LOGIN
# ============================================================

@api.post("/auth/login")
async def login(
    payload: LoginInput,
    response: Response,
):
    email = payload.email.strip().lower()

    user = await db.users.find_one(
        {"email": email},
    )

    if not user:
        raise HTTPException(
            status_code=401,
            detail="Invalid email or password",
        )

    if not verify_password(
        payload.password,
        user.get("password_hash", ""),
    ):
        raise HTTPException(
            status_code=401,
            detail="Invalid email or password",
        )

    token = create_session_token()

    expires = datetime.now(timezone.utc) + timedelta(
        days=SESSION_DURATION_DAYS
    )

    # Remove previous sessions for this user.
    await db.user_sessions.delete_many(
        {"user_id": user["user_id"]}
    )

    await db.user_sessions.insert_one(
        {
            "user_id": user["user_id"],
            "session_token": token,
            "expires_at": expires.isoformat(),
            "created_at": now_iso(),
        }
    )

    response.set_cookie(
        key="session_token",
        value=token,
        max_age=SESSION_DURATION_DAYS * 24 * 60 * 60,
        httponly=True,
        secure=True,
        samesite="none",
    )

    return {
        "user_id": user["user_id"],
        "name": user.get("name", ""),
        "email": user["email"],
        "picture": user.get("picture", ""),
    }


# ============================================================
# AUTH — CURRENT USER
# ============================================================

@api.get("/auth/me")
async def auth_me(request: Request):
    return await current_user(request)


# ============================================================
# AUTH — LOGOUT
# ============================================================

@api.post("/auth/logout")
async def logout(
    request: Request,
    response: Response,
):
    token = request.cookies.get("session_token")

    if token:
        await db.user_sessions.delete_many(
            {"session_token": token}
        )

    response.delete_cookie(
        key="session_token",
        path="/",
    )

    return {
        "ok": True
    }


# ============================================================
# MONTHS
# ============================================================

@api.get("/months/current")
async def get_current_month(
    request: Request,
):
    user = await current_user(request)

    key = month_key()

    doc = await db.months.find_one(
        {
            "user_id": user["user_id"],
            "month": key,
        },
        {"_id": 0},
    )

    if not doc:
        doc = {
            "month_id": f"month_{uuid.uuid4().hex[:12]}",
            "user_id": user["user_id"],
            "month": key,
            "income": 0,
            "categories": [],
            "goal_inclusions": {},
            "expenses": [],
            "notes": "",
            "updated_at": now_iso(),
        }

        await db.months.insert_one(doc.copy())

    return clean(doc)


@api.put("/months/current")
async def save_current_month(
    payload: MonthIn,
    request: Request,
):
    user = await current_user(request)

    key = month_key()

    update = payload.model_dump()
    update["updated_at"] = now_iso()

    goal_inclusions = update.get("goal_inclusions", {})
    normalized_goal_inclusions = {}

    for goal_id, value in goal_inclusions.items():

        if isinstance(value, dict):
            planned = float(
                value.get(
                    "planned",
                    value.get("amount", 0)
                ) or 0
            )

            normalized_goal_inclusions[goal_id] = {
                **value,
                "included": bool(
                    value.get("included", False)
                ),
                "planned": planned,
                "amount": planned,
            }

        else:
            planned = float(value or 0)

            normalized_goal_inclusions[goal_id] = {
                "included": planned > 0,
                "planned": planned,
                "amount": planned,
            }

    update["goal_inclusions"] = normalized_goal_inclusions

    await db.months.update_one(
        {
            "user_id": user["user_id"],
            "month": key,
        },
        {
            "$set": update,
            "$setOnInsert": {
                "month_id": f"month_{uuid.uuid4().hex[:12]}",
                "user_id": user["user_id"],
                "month": key,
                "expenses": [],
            },
        },
        upsert=True,
    )

    doc = await db.months.find_one(
        {
            "user_id": user["user_id"],
            "month": key,
        },
        {"_id": 0},
    )

    return clean(doc)


@api.get("/months")
async def get_months(
    request: Request,
):
    user = await current_user(request)

    months = await db.months.find(
        {
            "user_id": user["user_id"],
        },
        {"_id": 0},
    ).sort(
        "month",
        -1,
    ).to_list(24)

    return months


@api.post("/months/copy/{source_month}")
async def copy_month(
    source_month: str,
    request: Request,
):
    user = await current_user(request)

    source = await db.months.find_one(
        {
            "user_id": user["user_id"],
            "month": source_month,
        },
        {"_id": 0},
    )

    if not source:
        raise HTTPException(
            status_code=404,
            detail="Month not found",
        )

    target = month_key()

    categories = [
        {
            **category,
            "used": 0,
        }
        for category in source.get(
            "categories",
            [],
        )
    ]

    await db.months.update_one(
        {
            "user_id": user["user_id"],
            "month": target,
        },
        {
            "$set": {
                "income": 0,
                "categories": categories,
                "goal_inclusions": {},
                "expenses": [],
                "notes": "",
                "updated_at": now_iso(),
            },
            "$setOnInsert": {
                "month_id": f"month_{uuid.uuid4().hex[:12]}",
                "user_id": user["user_id"],
                "month": target,
            },
        },
        upsert=True,
    )

    return {
        "ok": True
    }


# ============================================================
# GOALS
# ============================================================

@api.get("/goals")
async def get_goals(
    request: Request,
):
    user = await current_user(request)

    goals = await db.goals.find(
        {
            "user_id": user["user_id"],
        },
        {"_id": 0},
    ).sort(
        "due_date",
        1,
    ).to_list(100)

    return goals


@api.post("/goals")
async def add_goal(
    payload: GoalIn,
    request: Request,
):
    user = await current_user(request)

    doc = payload.model_dump()

    doc.update(
        {
            "goal_id": f"goal_{uuid.uuid4().hex[:12]}",
            "user_id": user["user_id"],
            "created_at": now_iso(),
        }
    )

    await db.goals.insert_one(doc.copy())

    return doc


@api.put("/goals/{goal_id}")
async def edit_goal(
    goal_id: str,
    payload: GoalIn,
    request: Request,
):
    user = await current_user(request)

    result = await db.goals.update_one(
        {
            "goal_id": goal_id,
            "user_id": user["user_id"],
        },
        {
            "$set": payload.model_dump()
        },
    )

    if result.matched_count == 0:
        raise HTTPException(
            status_code=404,
            detail="Goal not found",
        )

    return {
        "ok": True
    }


@api.delete("/goals/{goal_id}")
async def delete_goal(
    goal_id: str,
    request: Request,
):
    user = await current_user(request)

    await db.goals.delete_one(
        {
            "goal_id": goal_id,
            "user_id": user["user_id"],
        }
    )

    return {
        "ok": True
    }


@api.post("/goals/{goal_id}/contributions")
async def add_contribution(
    goal_id: str,
    payload: ContributionIn,
    request: Request,
):
    user = await current_user(request)

    amount = float(payload.amount or 0)

    if amount <= 0:
        raise HTTPException(
            status_code=400,
            detail="Contribution must be greater than zero",
        )

    goal = await db.goals.find_one(
        {
            "goal_id": goal_id,
            "user_id": user["user_id"],
        },
        {"_id": 0},
    )

    if not goal:
        raise HTTPException(
            status_code=404,
            detail="Goal not found",
        )

    current_saved = float(
        goal.get("saved_amount", 0) or 0
    )

    total_amount = float(
        goal.get("total_amount", 0) or 0
    )

    remaining = max(
        0,
        total_amount - current_saved
    )

    if amount > remaining:
        raise HTTPException(
            status_code=400,
            detail="Contribution is greater than the amount still needed",
        )

    contribution = {
        "contribution_id": (
            f"contribution_{uuid.uuid4().hex[:12]}"
        ),
        "amount": amount,
        "note": payload.note.strip(),
        "created_at": now_iso(),
    }

    new_saved_amount = current_saved + amount

    await db.goals.update_one(
        {
            "goal_id": goal_id,
            "user_id": user["user_id"],
        },
        {
            "$set": {
                "saved_amount": new_saved_amount,
                "updated_at": now_iso(),
            },
            "$push": {
                "contributions": contribution,
            },
        },
    )

    return {
        "ok": True,
        "contribution": contribution,
        "saved_amount": new_saved_amount,
        "remaining": max(
            0,
            total_amount - new_saved_amount
        ),
    }


# ============================================================
# EXPENSES
# ============================================================

@api.post("/months/current/expenses")
async def add_expense(
    payload: ExpenseIn,
    request: Request,
):
    user = await current_user(request)

    expense = payload.model_dump()

    expense["expense_id"] = (
        f"expense_{uuid.uuid4().hex[:12]}"
    )
    expense["date"] = now_iso()

    result = await db.months.update_one(
        {
            "user_id": user["user_id"],
            "month": month_key(),
        },
        {
            "$push": {
                "expenses": expense
            }
        },
    )

    if result.matched_count == 0:
        raise HTTPException(
            status_code=404,
            detail="Current month not found",
        )

    return expense


@api.delete("/months/current/expenses/{expense_id}")
async def delete_expense(
    expense_id: str,
    request: Request,
):
    user = await current_user(request)

    await db.months.update_one(
        {
            "user_id": user["user_id"],
            "month": month_key(),
        },
        {
            "$pull": {
                "expenses": {
                    "expense_id": expense_id
                }
            }
        },
    )

    return {
        "ok": True
    }

# ============================================================
# OVERVIEW
# ============================================================

@api.get("/overview")
async def get_overview(
    request: Request,
):
    user = await current_user(request)

    key = month_key()

    month = await db.months.find_one(
        {
            "user_id": user["user_id"],
            "month": key,
        },
        {"_id": 0},
    )

    if not month:
        return {
            "summary": {
                "income": 0,
                "total_allocated": 0,
                "total_used": 0,
                "unplanned_expenses": 0,
                "remaining": 0,
                "remaining_planned": 0,
                "category_count": 0,
                "goal_planned": 0,
            }
        }

    income = float(month.get("income", 0) or 0)
    categories = month.get("categories", []) or []
    expenses = month.get("expenses", []) or []
    goal_inclusions = month.get("goal_inclusions", {}) or {}

    category_planned = sum(
        float(category.get("planned", 0) or 0)
        for category in categories
    )

    category_used = sum(
        float(category.get("used", 0) or 0)
        for category in categories
    )

    goal_planned = 0

    for inclusion in goal_inclusions.values():
        if not isinstance(inclusion, dict):
            continue

        if inclusion.get("included"):
            goal_planned += float(
                inclusion.get("planned", inclusion.get("amount", 0)) or 0
            )

    unplanned_expenses = sum(
        float(expense.get("amount", 0) or 0)
        for expense in expenses
    )

    total_allocated = category_planned + goal_planned
    total_used = category_used + unplanned_expenses

    return {
        "summary": {
            "income": income,
            "total_allocated": total_allocated,
            "total_used": total_used,
            "unplanned_expenses": unplanned_expenses,
            "remaining": income - total_used,
            "remaining_planned": income - total_allocated,
            "category_count": len(categories),
            "goal_planned": goal_planned,
        }
    }


# ============================================================
# REPORTS
# ============================================================

@api.get("/reports")
async def get_reports(
    request: Request,
):
    user = await current_user(request)

    months = await db.months.find(
        {
            "user_id": user["user_id"],
        },
        {"_id": 0},
    ).sort(
        "month",
        1,
    ).to_list(24)

    report_months = []

    total_income = 0
    total_allocated = 0
    total_used = 0
    total_unplanned = 0
    total_category_planned = 0
    total_goal_planned = 0

    for month in months:
        income = float(month.get("income", 0) or 0)

        categories = month.get("categories", []) or []
        expenses = month.get("expenses", []) or []
        goal_inclusions = month.get("goal_inclusions", {}) or {}

        allocated = sum(
            float(category.get("planned", 0) or 0)
            for category in categories
        )

        used = sum(
            float(category.get("used", 0) or 0)
            for category in categories
        )

        unplanned = sum(
            float(expense.get("amount", 0) or 0)
            for expense in expenses
        )

        goal_planned = 0

        for value in goal_inclusions.values():
            if isinstance(value, dict):
                if value.get("included"):
                    goal_planned += float(
                        value.get(
                            "planned",
                            value.get("amount", 0),
                        )
                        or 0
                    )
            else:
                try:
                    goal_planned += float(value or 0)
                except (TypeError, ValueError):
                    pass

        month_label = month.get("month", "")

        total_month_allocated = allocated + goal_planned

        report_months.append(
            {
                "month_label": month_label,
                "income": income,
                "total_allocated": total_month_allocated,
                "total_used": used + unplanned,
                "unplanned_expenses": unplanned,
            }
        )

        total_income += income
        total_allocated += total_month_allocated
        total_used += used + unplanned
        total_unplanned += unplanned
        total_category_planned += allocated
        total_goal_planned += goal_planned

    return {
        "months": report_months,
        "totals": {
            "income": total_income,
            "allocated": total_allocated,
            "used": total_used,
            "remaining": total_income - total_allocated - total_unplanned,
            "unplanned_expenses": total_unplanned,
            "categoryPlanned": total_category_planned,
            "goalPlanned": total_goal_planned,
        },
    }


# ============================================================
# ROUTER + CORS
# ============================================================

app.include_router(api)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:3001",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:3001",
        "https://money-map-gamma-six.vercel.app",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ============================================================
# SHUTDOWN
# ============================================================

@app.on_event("shutdown")
async def shutdown():
    client.close()
