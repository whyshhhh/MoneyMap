import React, { useEffect, useMemo, useState } from "react";
import {
  BarChart3,
  CalendarDays,
  Check,
  ChevronRight,
  CircleDollarSign,
  ClipboardList,
  CreditCard,
  DollarSign,
  Edit3,
  Flag,
  Home,
  LogIn,
  LogOut,
  Menu,
  Plus,
  Receipt,
  RefreshCw,
  Save,
  Settings,
  Target,
  Trash2,
  TrendingDown,
  TrendingUp,
  Wallet,
  X,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import "./App.css";


/* ============================================================
   CONFIGURATION
   ============================================================ */

const API_BASE =
  process.env.REACT_APP_BACKEND_URL || "http://localhost:8000";

const API = `${API_BASE}/api`;

const CURRENCY = "₹";


/* ============================================================
   GENERAL HELPERS
   ============================================================ */

function money(value) {
  const number = Number(value || 0);

  return new Intl.NumberFormat("en-IN", {
    maximumFractionDigits: 0,
  }).format(number);
}


function moneyDecimal(value) {
  const number = Number(value || 0);

  return new Intl.NumberFormat("en-IN", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 0,
  }).format(number);
}


function formatMoney(value) {
  return `${CURRENCY}${money(value)}`;
}


function percentage(value, total) {
  if (!total || total <= 0) return 0;

  return Math.min(
    100,
    Math.max(
      0,
      (Number(value || 0) / Number(total)) * 100
    )
  );
}


function monthLabel(month) {
  if (!month) return "";

  const date = new Date(`${month}-01T00:00:00`);

  return date.toLocaleDateString("en-IN", {
    month: "long",
    year: "numeric",
  });
}


function formatDate(dateString) {
  if (!dateString) return "";

  const date = new Date(dateString);

  if (Number.isNaN(date.getTime())) {
    return dateString;
  }

  return date.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function monthsUntilDue(dueDate) {
  if (!dueDate) return 0;

  const today = new Date();
  const due = new Date(`${dueDate}T00:00:00`);

  if (Number.isNaN(due.getTime())) {
    return 0;
  }

  if (due <= today) {
    return 1;
  }

  const monthDifference =
    (due.getFullYear() - today.getFullYear()) * 12 +
    (due.getMonth() - today.getMonth());

  return Math.max(
    1,
    monthDifference +
      (due.getDate() >= today.getDate() ? 1 : 0)
  );
}

function expectedMonthlySaving(goal) {
  const remaining = Math.max(
    0,
    Number(goal.total_amount || 0) -
      Number(goal.saved_amount || 0)
  );

  const months = monthsUntilDue(
    goal.due_date
  );

  if (!months) return remaining;

  return Math.ceil(
    remaining / months
  );
}

function initials(name) {
  if (!name) return "FL";

  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}


function todayISO() {
  const now = new Date();

  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}


function currentMonth() {
  const now = new Date();

  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");

  return `${year}-${month}`;
}


/* ============================================================
   API HELPER
   ============================================================ */

async function apiRequest(path, options = {}) {
  const response = await fetch(`${API}${path}`, {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    ...options,
  });

  let data = null;

  try {
    data = await response.json();
  } catch {
    data = null;
  }

  if (!response.ok) {
    const message =
      data?.detail ||
      data?.message ||
      `Request failed with status ${response.status}`;

    throw new Error(message);
  }

  return data;
}


/* ============================================================
   SMALL REUSABLE COMPONENTS
   ============================================================ */

function IconButton({
  icon,
  label,
  onClick,
  danger = false,
}) {
  return (
    <button
      type="button"
      className={`icon-button ${danger ? "danger" : ""}`}
      onClick={onClick}
      title={label}
      aria-label={label}
    >
      {icon}
    </button>
  );
}


function Button({
  children,
  variant = "primary",
  onClick,
  type = "button",
  disabled = false,
  small = false,
  form,
}) {
  return (
    <button
      type={type}
      form={form}
      className={`button button-${variant} ${
        small ? "button-small" : ""
      }`}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  );
}


function MoneyInput({
  value,
  onChange,
  placeholder = "0",
  disabled = false,
}) {
  return (
    <div className="money-input">
      <span className="money-symbol">{CURRENCY}</span>

      <input
        className="form-input"
        type="number"
        min="0"
        step="1"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        disabled={disabled}
      />
    </div>
  );
}


function ProgressBar({
  value,
  total,
  variant = "",
}) {
  const width = percentage(value, total);

  return (
    <div className="progress-track">
      <div
        className={`progress-fill ${variant}`}
        style={{ width: `${width}%` }}
      />
    </div>
  );
}


function EmptyState({
  icon,
  title,
  text,
  action,
}) {
  return (
    <div className="empty-state">
      <div className="empty-state-icon">
        {icon}
      </div>

      <h3 className="empty-state-title">
        {title}
      </h3>

      {text && (
        <p className="empty-state-text">
          {text}
        </p>
      )}

      {action}
    </div>
  );
}


function Modal({
  title,
  description,
  onClose,
  children,
  footer,
}) {
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="modal">
        <div className="modal-header">
          <div>
            <h2 className="modal-title">
              {title}
            </h2>

            {description && (
              <p className="modal-description">
                {description}
              </p>
            )}
          </div>

          <button
            type="button"
            className="modal-close"
            onClick={onClose}
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        <div className="modal-body">
          {children}
        </div>

        {footer && (
          <div className="modal-footer">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}


/* ============================================================
   AUTH PAGE
   ============================================================ */

function AuthPage({ onAuthenticated }) {
  const [mode, setMode] = useState("login");

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submit(event) {
    event.preventDefault();

    setError("");
    setLoading(true);

    try {
      const endpoint =
        mode === "login"
          ? "/auth/login"
          : "/auth/register";

      const payload =
        mode === "login"
          ? {
              email,
              password,
            }
          : {
              name,
              email,
              password,
            };

      const user = await apiRequest(endpoint, {
        method: "POST",
        body: JSON.stringify(payload),
      });

      onAuthenticated(user);
    } catch (requestError) {
      setError(
        requestError.message ||
          "Unable to complete authentication."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-page">
      <section className="auth-visual">
        <div className="auth-visual-content">
          <p className="auth-kicker">
            Household money, made intentional
          </p>

          <h1 className="auth-heading">
            Give every rupee a place to go.
          </h1>

          <p className="auth-description">
            Family Ledger turns your monthly income into
            a clear plan for essentials, goals, savings
            and the things that matter later.
          </p>

          <div className="auth-features">
            <div className="auth-feature">
              <p className="auth-feature-title">
                Plan before spending
              </p>

              <p className="auth-feature-text">
                Decide how much each part of the month
                should receive before the money disappears.
              </p>
            </div>

            <div className="auth-feature">
              <p className="auth-feature-title">
                Build future goals
              </p>

              <p className="auth-feature-text">
                Break large yearly expenses into manageable
                monthly contributions.
              </p>
            </div>

            <div className="auth-feature">
              <p className="auth-feature-title">
                See the whole picture
              </p>

              <p className="auth-feature-text">
                Understand income, allocations, usage and
                remaining money at a glance.
              </p>
            </div>

            <div className="auth-feature">
              <p className="auth-feature-title">
                Keep a history
              </p>

              <p className="auth-feature-text">
                Compare months and learn where the household
                budget is actually going.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="auth-form-side">
        <div className="auth-form-container">
          <div className="auth-form-header">
            <p className="eyebrow">
              Family Ledger
            </p>

            <h2 className="auth-form-title">
              {mode === "login"
                ? "Welcome back."
                : "Create your ledger."}
            </h2>

            <p className="auth-form-subtitle">
              {mode === "login"
                ? "Sign in to continue planning your household budget."
                : "Set up your private household budgeting space."}
            </p>
          </div>

          <form
            className="auth-form"
            onSubmit={submit}
          >
            {mode === "register" && (
              <div className="form-field">
                <label className="form-label">
                  Your name
                </label>

                <input
                  className="form-input"
                  value={name}
                  onChange={(event) =>
                    setName(event.target.value)
                  }
                  placeholder="Enter your name"
                  required
                />
              </div>
            )}

            <div className="form-field">
              <label className="form-label">
                Email address
              </label>

              <input
                className="form-input"
                type="email"
                value={email}
                onChange={(event) =>
                  setEmail(event.target.value)
                }
                placeholder="you@example.com"
                required
              />
            </div>

            <div className="form-field">
              <label className="form-label">
                Password
              </label>

              <input
                className="form-input"
                type="password"
                value={password}
                onChange={(event) =>
                  setPassword(event.target.value)
                }
                placeholder={
                  mode === "register"
                    ? "At least 8 characters"
                    : "Enter your password"
                }
                minLength={mode === "register" ? 8 : 1}
                required
              />
            </div>

            {error && (
              <div className="alert alert-error">
                {error}
              </div>
            )}

            <Button
              type="submit"
              disabled={loading}
            >
              {loading ? (
                <>
                  <RefreshCw
                    size={15}
                    className="spin"
                  />
                  Please wait...
                </>
              ) : (
                <>
                  {mode === "login" ? (
                    <LogIn size={15} />
                  ) : (
                    <Plus size={15} />
                  )}

                  {mode === "login"
                    ? "Sign in"
                    : "Create account"}
                </>
              )}
            </Button>
          </form>

          <p className="auth-switch">
            {mode === "login"
              ? "Don't have an account?"
              : "Already have an account?"}{" "}
            <button
              type="button"
              onClick={() => {
                setMode(
                  mode === "login"
                    ? "register"
                    : "login"
                );
                setError("");
              }}
            >
              {mode === "login"
                ? "Create one"
                : "Sign in"}
            </button>
          </p>
        </div>
      </section>
    </div>
  );
}


/* ============================================================
   DASHBOARD
   ============================================================ */

function Dashboard({
  month,
  goals,
  summary,
  onNavigate,
  onRefresh,
}) {
  const categories = month?.categories || [];

  const goalInclusions =
    month?.goal_inclusions || {};

  const includedGoals = goals.filter(
    (goal) =>
      goalInclusions[goal.goal_id]?.included
  );

  const remaining =
    Number(summary?.income || 0) -
    Number(summary?.total_used || 0);

  return (
    <>
      <div className="page-header">
        <div className="page-header-copy">
          <p className="eyebrow">
            {monthLabel(month?.month)}
          </p>

          <h1 className="page-title">
            Good planning starts here.
          </h1>

          <p className="page-description">
            Your household budget at a glance — what
            came in, what has a place, and what remains.
          </p>
        </div>

        <div className="header-actions">
          <Button
            variant="secondary"
            onClick={onRefresh}
          >
            <RefreshCw size={15} />
            Refresh
          </Button>

          <Button
            onClick={() => onNavigate("plan")}
          >
            <ClipboardList size={15} />
            Monthly plan
          </Button>
        </div>
      </div>

      <div className="stats-grid">
        <div className="card stat-card">
          <p className="stat-label">
            Monthly income
          </p>

          <p className="stat-value">
            {formatMoney(summary?.income)}
          </p>

          <p className="stat-note">
            Planned household income
          </p>
        </div>

        <div className="card stat-card">
          <p className="stat-label">
            Allocated
          </p>

          <p className="stat-value">
            {formatMoney(summary?.total_allocated)}
          </p>

          <p className="stat-note">
            Categories + future goals
          </p>
        </div>

        <div className="card stat-card">
          <p className="stat-label">
            Used
          </p>

          <p className="stat-value">
            {formatMoney(summary?.total_used)}
          </p>

          <p className="stat-note">
            Recorded usage this month
          </p>
        </div>

        <div className="card stat-card">
          <p className="stat-label">
            Remaining
          </p>

          <p className="stat-value">
            {formatMoney(remaining)}
          </p>

          <p className="stat-note">
            Based on recorded usage
          </p>
        </div>
      </div>

      <div className="dashboard-grid">
        <div className="dashboard-stack">
          <div className="card card-padding">
            <div className="card-header">
              <div>
                <h2 className="card-title">
                  Monthly allocation
                </h2>

                <p className="card-subtitle">
                  Your planned categories for this month.
                </p>
              </div>

              <Button
                variant="ghost"
                small
                onClick={() => onNavigate("plan")}
              >
                Manage
                <ChevronRight size={14} />
              </Button>
            </div>

            {categories.length === 0 ? (
              <EmptyState
                icon={<Wallet size={19} />}
                title="Your plan is still empty"
                text="Add the categories you want to budget for each month."
                action={
                  <Button
                    small
                    onClick={() => onNavigate("plan")}
                  >
                    <Plus size={14} />
                    Add categories
                  </Button>
                }
              />
            ) : (
              <div className="allocation-list">
                {categories.map((category) => (
                  <div
                    className="allocation-row"
                    key={category.id}
                  >
                    <p className="allocation-name">
                      {category.name}
                    </p>

                    <ProgressBar
                      value={category.used}
                      total={category.planned}
                    />

                    <span className="allocation-amount">
                      {formatMoney(category.used)} /{" "}
                      {formatMoney(category.planned)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="card card-padding">
            <div className="card-header">
              <div>
                <h2 className="card-title">
                  Where the plan stands
                </h2>

                <p className="card-subtitle">
                  Allocation versus the month's income.
                </p>
              </div>
            </div>

            <div className="allocation-list">
              <div className="allocation-row">
                <p className="allocation-name">
                  Allocated
                </p>

                <ProgressBar
                  value={summary?.total_allocated}
                  total={summary?.income}
                />

                <span className="allocation-amount">
                  {percentage(
                    summary?.total_allocated,
                    summary?.income
                  ).toFixed(0)}
                  %
                </span>
              </div>

              <div className="allocation-row">
                <p className="allocation-name">
                  Actually used
                </p>

                <ProgressBar
                  value={summary?.total_used}
                  total={summary?.income}
                  variant="terracotta"
                />

                <span className="allocation-amount">
                  {percentage(
                    summary?.total_used,
                    summary?.income
                  ).toFixed(0)}
                  %
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="dashboard-stack">
          <div className="card card-padding">
            <div className="card-header">
              <div>
                <h2 className="card-title">
                  Future goals
                </h2>

                <p className="card-subtitle">
                  Money you're intentionally setting aside.
                </p>
              </div>

              <Button
                variant="ghost"
                small
                onClick={() => onNavigate("goals")}
              >
                View all
                <ChevronRight size={14} />
              </Button>
            </div>

            {goals.length === 0 ? (
              <EmptyState
                icon={<Target size={19} />}
                title="No goals yet"
                text="Create a goal for something important coming up."
                action={
                  <Button
                    small
                    onClick={() => onNavigate("goals")}
                  >
                    <Plus size={14} />
                    Add a goal
                  </Button>
                }
              />
            ) : (
              <div className="goal-list">
                {goals.slice(0, 3).map((goal) => (
                  <div
                    className="goal-card"
                    key={goal.goal_id}
                  >
                    <div className="goal-top">
                      <div>
                        <p className="goal-name">
                          {goal.name}
                        </p>

                        <p className="goal-date">
                          Due {formatDate(goal.due_date)}
                        </p>
                      </div>

                      <span className="goal-percent">
                        {percentage(
                          goal.saved_amount,
                          goal.total_amount
                        ).toFixed(0)}
                        %
                      </span>
                    </div>

                    <div className="goal-progress">
                      <ProgressBar
                        value={goal.saved_amount}
                        total={goal.total_amount}
                        variant="sage"
                      />
                    </div>

                    <div className="goal-values">
                      <span>
                        {formatMoney(
                          goal.saved_amount
                        )}{" "}
                        saved
                      </span>

                      <span>
                        {formatMoney(
                          goal.total_amount
                        )}
                      </span>
                    </div>

                    {includedGoals.some(
                      (included) =>
                        included.goal_id ===
                        goal.goal_id
                    ) && (
                      <div className="goal-actions">
                        <span className="form-hint">
                          Included in this month's plan
                        </span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="card card-padding">
            <div className="card-header">
              <div>
                <h2 className="card-title">
                  Quick summary
                </h2>

                <p className="card-subtitle">
                  A few useful numbers for this month.
                </p>
              </div>
            </div>

            <div className="allocation-list">
              <div className="row-between">
                <span className="text-muted">
                  Budget categories
                </span>

                <strong className="mono">
                  {summary?.category_count || 0}
                </strong>
              </div>

              <div className="row-between">
                <span className="text-muted">
                  Goal contributions planned
                </span>

                <strong className="mono">
                  {formatMoney(
                    summary?.goal_planned
                  )}
                </strong>
              </div>

              <div className="row-between">
                <span className="text-muted">
                  Unplanned expenses
                </span>

                <strong className="mono text-terracotta">
                  {formatMoney(
                    summary?.unplanned_expenses
                  )}
                </strong>
              </div>

              <div className="row-between">
                <span className="text-muted">
                  Still unallocated
                </span>

                <strong className="mono text-forest">
                  {formatMoney(
                    summary?.remaining_planned
                  )}
                </strong>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}


/* ============================================================
   MONTHLY PLAN
   ============================================================ */

function MonthlyPlan({
  month,
  goals,
  onSave,
  onRefresh,
}) {
  const [income, setIncome] = useState(
    month?.income || 0
  );

  const [categories, setCategories] = useState(
    month?.categories || []
  );

  const [notes, setNotes] = useState(
    month?.notes || ""
  );

  const [goalInclusions, setGoalInclusions] =
    useState(month?.goal_inclusions || {});

  const [showCategoryModal, setShowCategoryModal] =
    useState(false);

  const [editingCategory, setEditingCategory] =
    useState(null);

  const [saving, setSaving] = useState(false);

  const [message, setMessage] = useState("");

  useEffect(() => {
    setIncome(month?.income || 0);
    setCategories(month?.categories || []);
    setNotes(month?.notes || "");
    setGoalInclusions(
      month?.goal_inclusions || {}
    );
  }, [month]);

  const totals = useMemo(() => {
    const categoryPlanned = categories.reduce(
      (sum, category) =>
        sum + Number(category.planned || 0),
      0
    );

    const categoryUsed = categories.reduce(
      (sum, category) =>
        sum + Number(category.used || 0),
      0
    );

    const goalPlanned = Object.values(
      goalInclusions
    ).reduce((sum, inclusion) => {
      if (!inclusion?.included) return sum;

      return (
        sum + Number(inclusion.planned || 0)
      );
    }, 0);

    const allocated =
      categoryPlanned + goalPlanned;

    const unplannedExpenses =
    (month?.expenses || []).reduce(
    (sum, expense) =>
      sum + Number(expense.amount || 0),
    0
    );

    return {
  categoryPlanned,
  categoryUsed,
  goalPlanned,
  allocated,
  unplannedExpenses,
  remaining:
    Number(income || 0) - allocated,
};
  }, [
  income,
  categories,
  goalInclusions,
  month?.expenses,
]);

  async function savePlan() {
    setSaving(true);
    setMessage("");

    try {
      await onSave({
        income: Number(income || 0),
        categories,
        goal_inclusions: goalInclusions,
        notes,
      });

      setMessage("Monthly plan saved.");

      setTimeout(() => {
        setMessage("");
      }, 2500);
    } catch (error) {
      setMessage(error.message);
    } finally {
      setSaving(false);
    }
  }

  function addCategory(category) {
    setCategories((current) => [
      ...current,
      {
        ...category,
        id:
          category.id ||
          `category_local_${Date.now()}`,
      },
    ]);

    setShowCategoryModal(false);
  }

  function updateCategory(category) {
    setCategories((current) =>
      current.map((item) =>
        item.id === category.id
          ? category
          : item
      )
    );

    setEditingCategory(null);
  }

  function removeCategory(id) {
    setCategories((current) =>
      current.filter(
        (category) => category.id !== id
      )
    );
  }

  function toggleGoal(goalId) {
    setGoalInclusions((current) => {
      const existing =
        current[goalId] || {};

      return {
        ...current,
        [goalId]: {
          included: !existing.included,
          planned: existing.planned || 0,
        },
      };
    });
  }

  function changeGoalAmount(
    goalId,
    value
  ) {
    setGoalInclusions((current) => ({
      ...current,
      [goalId]: {
        ...(current[goalId] || {}),
        included:
          current[goalId]?.included ?? true,
        planned: Number(value || 0),
      },
    }));
  }

  return (
    <>
      <div className="page-header">
        <div className="page-header-copy">
          <p className="eyebrow">
            {monthLabel(month?.month)}
          </p>

          <h1 className="page-title">
            Monthly plan
          </h1>

          <p className="page-description">
            Decide where the month's income should go
            before the month gets away from you.
          </p>
        </div>

        <div className="header-actions">
          <Button
            variant="secondary"
            onClick={onRefresh}
          >
            <RefreshCw size={15} />
            Refresh
          </Button>

          <Button
            onClick={savePlan}
            disabled={saving}
          >
            <Save size={15} />
            {saving ? "Saving..." : "Save plan"}
          </Button>
        </div>
      </div>

      {message && (
        <div
          className={`alert ${
            message.includes("saved")
              ? "alert-success"
              : "alert-error"
          }`}
          style={{ marginBottom: 18 }}
        >
          {message.includes("saved") ? (
            <Check size={15} />
          ) : (
            <X size={15} />
          )}

          {message}
        </div>
      )}

      <div className="income-card">
        <div className="income-copy">
          <h2>
            Monthly income
          </h2>

          <p>
            Enter the amount available for the household
            this month.
          </p>
        </div>

        <div className="income-value">
          <MoneyInput
            value={income}
            onChange={setIncome}
          />
        </div>
      </div>

      <div className="dashboard-grid">
        <div className="dashboard-stack">
          <div className="card card-padding">
            <div className="card-header">
              <div>
                <h2 className="card-title">
                  Budget categories
                </h2>

                <p className="card-subtitle">
                  Add only the categories that make sense
                  for your family's month.
                </p>
              </div>

              <Button
                small
                onClick={() =>
                  setShowCategoryModal(true)
                }
              >
                <Plus size={14} />
                Add category
              </Button>
            </div>

            {categories.length === 0 ? (
              <EmptyState
                icon={<Wallet size={19} />}
                title="Start with your categories"
                text="Think about every place your monthly income needs to go."
                action={
                  <Button
                    small
                    onClick={() =>
                      setShowCategoryModal(true)
                    }
                  >
                    <Plus size={14} />
                    Add first category
                  </Button>
                }
              />
            ) : (
              <div className="table-scroll">
                <table className="budget-table">
                  <thead>
                    <tr>
                      <th>Category</th>
                      <th>Planned</th>
                      <th>Used</th>
                      <th>Remaining</th>
                      <th />
                    </tr>
                  </thead>

                  <tbody>
                    {categories.map(
                      (category) => {
                        const remaining =
                          Number(
                            category.planned || 0
                          ) -
                          Number(
                            category.used || 0
                          );

                        return (
                          <tr key={category.id}>
                            <td>
                              <div className="table-name">
                                {category.name}
                              </div>

                              {category.notes && (
                                <div className="form-hint">
                                  {category.notes}
                                </div>
                              )}
                            </td>

                            <td>
                              <span className="table-money">
                                {formatMoney(
                                  category.planned
                                )}
                              </span>
                            </td>

                            <td>
                              <span className="table-money">
                                {formatMoney(
                                  category.used
                                )}
                              </span>
                            </td>

                            <td>
                              <span
                                className={`table-money ${
                                  remaining < 0
                                    ? "table-negative"
                                    : "table-positive"
                                }`}
                              >
                                {formatMoney(
                                  remaining
                                )}
                              </span>
                            </td>

                            <td>
                              <div className="table-actions">
                                <IconButton
                                  label="Edit category"
                                  icon={
                                    <Edit3
                                      size={14}
                                    />
                                  }
                                  onClick={() =>
                                    setEditingCategory(
                                      category
                                    )
                                  }
                                />

                                <IconButton
                                  label="Delete category"
                                  danger
                                  icon={
                                    <Trash2
                                      size={14}
                                    />
                                  }
                                  onClick={() =>
                                    removeCategory(
                                      category.id
                                    )
                                  }
                                />
                              </div>
                            </td>
                          </tr>
                        );
                      }
                    )}
                  </tbody>
                </table>
              </div>
            )}

            <div className="add-category-row">
              <span className="form-hint">
                You can change these allocations at
                any time during planning.
              </span>

              <strong className="mono">
                {formatMoney(
                  totals.categoryPlanned
                )}
              </strong>
            </div>
          </div>

          <div className="card card-padding">
            <div className="card-header">
              <div>
                <h2 className="card-title">
                  Future goals
                </h2>

                <p className="card-subtitle">
                  Include a planned contribution to
                  future expenses in this month's budget.
                </p>
              </div>
            </div>

            {goals.length === 0 ? (
              <EmptyState
                icon={<Target size={19} />}
                title="No future goals"
                text="Create a goal first if you want to reserve money for a future expense."
              />
            ) : (
              <div className="contribution-panel">
                {goals.map((goal) => {
                  const inclusion =
                    goalInclusions[
                      goal.goal_id
                    ] || {};

                  const isIncluded =
                    inclusion.included === true;

                  return (
                    <div
                      className="contribution-row"
                      key={goal.goal_id}
                    >
                      <div>
                        <div className="contribution-name">
                          {goal.name}
                        </div>

                        <div className="contribution-meta">
                          {formatMoney(
                            goal.saved_amount
                          )}{" "}
                          of{" "}
                          {formatMoney(
                            goal.total_amount
                          )}{" "}
                          saved · due{" "}
                          {formatDate(
                            goal.due_date
                          )}
                        </div>
                      </div>

                      <div className="contribution-amount">
                        {isIncluded
                          ? formatMoney(
                              inclusion.planned
                            )
                          : "Not included"}
                      </div>

                      {isIncluded && (
                        <MoneyInput
                          value={
                            inclusion.planned || 0
                          }
                          onChange={(value) =>
                            changeGoalAmount(
                              goal.goal_id,
                              value
                            )
                          }
                        />
                      )}

                      <button
                        type="button"
                        className={`toggle ${
                          isIncluded
                            ? "active"
                            : ""
                        }`}
                        onClick={() =>
                          toggleGoal(
                            goal.goal_id
                          )
                        }
                        aria-label={
                          isIncluded
                            ? "Remove goal from monthly plan"
                            : "Include goal in monthly plan"
                        }
                      />
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="card card-padding">
            <div className="card-header">
              <div>
                <h2 className="card-title">
                  Planning notes
                </h2>

                <p className="card-subtitle">
                  Optional notes for this month.
                </p>
              </div>
            </div>

            <textarea
              className="form-textarea"
              value={notes}
              onChange={(event) =>
                setNotes(event.target.value)
              }
              placeholder="Anything unusual about this month?"
            />
          </div>
        </div>

        <div className="dashboard-stack">
          <div className="card card-padding">
            <div className="card-header">
              <div>
                <h2 className="card-title">
                  Plan summary
                </h2>

                <p className="card-subtitle">
                  How your income is currently assigned.
                </p>
              </div>
            </div>

            <div className="allocation-list">
              <div className="row-between">
                <span className="text-muted">
                  Income
                </span>

                <strong className="mono">
                  {formatMoney(income)}
                </strong>
              </div>

              <div className="row-between">
                <span className="text-muted">
                  Categories
                </span>

                <strong className="mono">
                  {formatMoney(
                    totals.categoryPlanned
                  )}
                </strong>
              </div>


             <div className="row-between">
               <span className="text-muted">
                 Future goals
               </span>

               <strong className="mono">
                {formatMoney(
                 totals.goalPlanned
                )}
               </strong>
             </div>

             <div className="row-between">
              <span className="text-muted">
                Unplanned expenses
              </span>

              <strong className="mono text-terracotta">
                {formatMoney(
                  totals.unplannedExpenses
                )}
              </strong>
             </div>

             <div className="divider" />

             <div className="row-between">
               <span>
                 <strong>
                  Still unallocated
                 </strong>
               </span>


                <strong
                  className={`mono ${
                    totals.remaining < 0
                      ? "text-terracotta"
                      : "text-forest"
                  }`}
                >
                  {formatMoney(
                    totals.remaining
                  )}
                </strong>
              </div>
             </div>
             </div>

         <div className="card card-padding">
              <div className="card-header">
              <div>
                <h2 className="card-title">
                  Allocation progress
                </h2>

                <p className="card-subtitle">
                  Aim to give your income a purpose
                  without over-allocating it.
                </p>
              </div>
             </div>

            <ProgressBar
              value={totals.allocated}
              total={income}
            />

            <div className="goal-values" style={{ marginTop: 10 }}>
              <span>
                {formatMoney(totals.allocated)}
              </span>

              <span>
                {percentage(
                  totals.allocated,
                  income
                ).toFixed(0)}
                %
              </span>
            </div>
          </div>
        </div>
     </div>

      {(showCategoryModal ||
        editingCategory) && (
        <CategoryModal
          category={editingCategory}
          onClose={() => {
            setShowCategoryModal(false);
            setEditingCategory(null);
          }}
          onSave={
            editingCategory
              ? updateCategory
              : addCategory
          }
        />
      )}
    </>
  );
}


/* ============================================================
   CATEGORY MODAL
   ============================================================ */

function CategoryModal({
  category,
  onClose,
  onSave,
}) {
  const [name, setName] = useState(
    category?.name || ""
  );

  const [planned, setPlanned] = useState(
    category?.planned || 0
  );

  const [used, setUsed] = useState(
    category?.used || 0
  );

  const [notes, setNotes] = useState(
    category?.notes || ""
  );

  function submit(event) {
    event.preventDefault();

    if (!name.trim()) return;

    onSave({
      id:
        category?.id ||
        `category_local_${Date.now()}`,
      name: name.trim(),
      planned: Number(planned || 0),
      used: Number(used || 0),
      notes: notes.trim(),
    });
  }

  return (
    <Modal
      title={
        category
          ? "Edit category"
          : "Add a category"
      }
      description="Give this part of your monthly income a clear job."
      onClose={onClose}
      footer={
        <>
          <Button
            variant="secondary"
            onClick={onClose}
          >
            Cancel
          </Button>

          <Button
            type="submit"
            form="category-form"
          >
            <Save size={14} />
            Save category
          </Button>
        </>
      }
    >
      <form
        id="category-form"
        className="form-grid"
        onSubmit={submit}
      >
        <div className="form-field full">
          <label className="form-label">
            Category name
          </label>

          <input
            className="form-input"
            value={name}
            onChange={(event) =>
              setName(event.target.value)
            }
            placeholder="e.g. Groceries"
            required
            autoFocus
          />
        </div>

        <div className="form-field">
          <label className="form-label">
            Planned amount
          </label>

          <MoneyInput
            value={planned}
            onChange={setPlanned}
          />
        </div>

        <div className="form-field">
          <label className="form-label">
            Used so far
          </label>

          <MoneyInput
            value={used}
            onChange={setUsed}
          />
        </div>

        <div className="form-field full">
          <label className="form-label">
            Notes
          </label>

          <textarea
            className="form-textarea"
            value={notes}
            onChange={(event) =>
              setNotes(event.target.value)
            }
            placeholder="Optional notes"
          />
        </div>
      </form>
    </Modal>
  );
}


/* ============================================================
   GOALS PAGE
   ============================================================ */

function GoalsPage({
  goals,
  month,
  onCreateGoal,
  onUpdateGoal,
  onDeleteGoal,
  onContribute,
}) {
  const [showGoalModal, setShowGoalModal] =
    useState(false);

  const [editingGoal, setEditingGoal] =
    useState(null);

  const [contributingGoal, setContributingGoal] =
    useState(null);

  return (
    <>
      <div className="page-header">
        <div className="page-header-copy">
          <p className="eyebrow">
            Future planning
          </p>

          <h1 className="page-title">
            Future goals
          </h1>

          <p className="page-description">
            Turn large upcoming expenses into smaller,
            intentional contributions.
          </p>
        </div>

        <div className="header-actions">
          <Button
            onClick={() =>
              setShowGoalModal(true)
            }
          >
            <Plus size={15} />
            Add goal
          </Button>
        </div>
      </div>

      {goals.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={<Flag size={20} />}
            title="Nothing on the horizon yet"
            text="Create your first future goal — college fees, insurance, travel, an emergency fund, or anything else you want to prepare for."
            action={
              <Button
                onClick={() =>
                  setShowGoalModal(true)
                }
              >
                <Plus size={15} />
                Create a goal
              </Button>
            }
          />
        </div>
      ) : (
        <div className="dashboard-grid">
          <div className="dashboard-stack">
            {goals.map((goal) => (
              <GoalLargeCard
                key={goal.goal_id}
                goal={goal}
                month={month}
                onEdit={() =>
                  setEditingGoal(goal)
                }
                onDelete={() =>
                  onDeleteGoal(goal.goal_id)
                }
                onContribute={() =>
                  setContributingGoal(goal)
                }
              />
            ))}
          </div>

          <div className="dashboard-stack">
            <div className="card card-padding">
              <div className="card-header">
                <div>
                  <h2 className="card-title">
                    Goal overview
                  </h2>

                  <p className="card-subtitle">
                    The bigger picture across your active
                    goals.
                  </p>
                </div>
              </div>

              <div className="allocation-list">
                <div className="row-between">
                  <span className="text-muted">
                    Active goals
                  </span>

                  <strong className="mono">
                    {goals.length}
                  </strong>
                </div>

                <div className="row-between">
                  <span className="text-muted">
                    Total target
                  </span>

                  <strong className="mono">
                    {formatMoney(
                      goals.reduce(
                        (sum, goal) =>
                          sum +
                          Number(
                            goal.total_amount || 0
                          ),
                        0
                      )
                    )}
                  </strong>
                </div>

                <div className="row-between">
                  <span className="text-muted">
                    Already saved
                  </span>

                  <strong className="mono text-forest">
                    {formatMoney(
                      goals.reduce(
                        (sum, goal) =>
                          sum +
                          Number(
                            goal.saved_amount || 0
                          ),
                        0
                      )
                    )}
                  </strong>
                </div>

                <div className="divider" />

                <div className="row-between">
                  <strong>
                    Still needed
                  </strong>

                  <strong className="mono">
                    {formatMoney(
                      goals.reduce(
                        (sum, goal) =>
                          sum +
                          Math.max(
                            0,
                            Number(
                              goal.total_amount || 0
                            ) -
                              Number(
                                goal.saved_amount || 0
                              )
                          ),
                        0
                      )
                    )}
                  </strong>
                </div>
              </div>
            </div>

            <div className="card card-padding">
              <div className="card-header">
                <div>
                  <h2 className="card-title">
                    Planning principle
                  </h2>
                </div>
              </div>

              <p className="page-description">
                If an expense is predictable, it doesn't
                need to become an emergency. A yearly
                payment can be turned into a small monthly
                target.
              </p>
            </div>
          </div>
        </div>
      )}

      {(showGoalModal || editingGoal) && (
        <GoalModal
          goal={editingGoal}
          onClose={() => {
            setShowGoalModal(false);
            setEditingGoal(null);
          }}
          onSave={async (goal) => {
            if (editingGoal) {
              await onUpdateGoal(
                editingGoal.goal_id,
                goal
              );
            } else {
              await onCreateGoal(goal);
            }

            setShowGoalModal(false);
            setEditingGoal(null);
          }}
        />
      )}

      {contributingGoal && (
        <ContributionModal
          goal={contributingGoal}
          onClose={() =>
            setContributingGoal(null)
          }
          onSave={async (amount, note) => {
            await onContribute(
              contributingGoal.goal_id,
              amount,
              note
            );

            setContributingGoal(null);
          }}
        />
      )}
    </>
  );
}


/* ============================================================
   LARGE GOAL CARD
   ============================================================ */

function GoalLargeCard({
  goal,
  month,
  onEdit,
  onDelete,
  onContribute,
}) {
  const saved = Number(
    goal.saved_amount || 0
  );

  const target = Number(
    goal.total_amount || 0
  );

  const remaining = Math.max(
    0,
    target - saved
  );
  
  const plannedThisMonth = Number(
   month?.goal_inclusions?.[goal.goal_id]
    ?.planned || 0
  );

  const monthlyTarget =
   expectedMonthlySaving(goal);

  const progress = percentage(
    saved,
    target
  );

  return (
    <div className="card card-padding">
      <div className="goal-top">
        <div>
          <p className="eyebrow">
            Goal
          </p>

          <h2 className="section-title">
            {goal.name}
          </h2>

          <p className="card-subtitle">
            Due {formatDate(goal.due_date)}
          </p>
        </div>

        <strong className="goal-percent">
          {progress.toFixed(0)}%
        </strong>
      </div>

      <div className="goal-progress">
        <ProgressBar
          value={saved}
          total={target}
          variant="sage"
        />
      </div>

      <div className="goal-values">
        <span>
          {formatMoney(saved)} saved
        </span>

        <span>
          Target {formatMoney(target)}
        </span>
      </div>

      <div
        className="stats-grid"
        style={{
          marginTop: 20,
          marginBottom: 0,
        }}
      >
        <div className="card stat-card">
         <p className="stat-label">
            Expected monthly saving
        </p>
        
        {plannedThisMonth > 0 && (
  <div className="card stat-card">
    <p className="stat-label">
      Planned this month
    </p>

    <p className="stat-value">
      {formatMoney(plannedThisMonth)}
    </p>

    <p className="stat-note">
      Included in this month's budget
    </p>
  </div>
)}

        <p className="stat-value">
          {formatMoney(monthlyTarget)}
        </p>

        <p className="stat-note">
          To reach the goal by the due date
        </p>
        </div>

        <div className="card stat-card">
          <p className="stat-label">
            Remaining
          </p>

          <p className="stat-value">
            {formatMoney(remaining)}
          </p>
        </div>
      </div>

      {goal.notes && (
        <div
          className="alert"
          style={{ marginTop: 18 }}
        >
          {goal.notes}
        </div>
      )}

      <div
        className="header-actions"
        style={{
          marginTop: 18,
        }}
      >
        <Button
          small
          onClick={onContribute}
          disabled={remaining <= 0}
        >
          <Plus size={14} />
          Record contribution
        </Button>

        <Button
          variant="secondary"
          small
          onClick={onEdit}
        >
          <Edit3 size={14} />
          Edit
        </Button>

        <Button
          variant="danger"
          small
          onClick={onDelete}
        >
          <Trash2 size={14} />
          Delete
        </Button>
      </div>
    </div>
  );
}


/* ============================================================
   GOAL MODAL
   ============================================================ */

function GoalModal({
  goal,
  onClose,
  onSave,
}) {
  const [name, setName] = useState(
    goal?.name || ""
  );

  const [totalAmount, setTotalAmount] =
    useState(goal?.total_amount || 0);

  const [dueDate, setDueDate] = useState(
    goal?.due_date || ""
  );

  const [savedAmount, setSavedAmount] =
    useState(goal?.saved_amount || 0);

  const [notes, setNotes] = useState(
    goal?.notes || ""
  );

  const [saving, setSaving] =
    useState(false);

  const [error, setError] =
    useState("");

  async function submit(event) {
    event.preventDefault();

    setError("");

    if (
      Number(savedAmount) >
      Number(totalAmount)
    ) {
      setError(
        "Saved amount cannot be greater than the target amount."
      );

      return;
    }

    if (!dueDate) {
      setError(
        "Please choose a due date."
      );

      return;
    }

    setSaving(true);

    try {
      await onSave({
        name: name.trim(),
        total_amount: Number(
          totalAmount || 0
        ),
        due_date: dueDate,
        saved_amount: Number(
          savedAmount || 0
        ),
        notes: notes.trim(),
        active: true,
      });
    } catch (requestError) {
      setError(
        requestError.message ||
          "Unable to save the goal."
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      title={
        goal
          ? "Edit future goal"
          : "Create future goal"
      }
      description="Set a target and a date so the app can help you prepare."
      onClose={onClose}
      footer={
        <>
          <Button
            variant="secondary"
            onClick={onClose}
          >
            Cancel
          </Button>

          <Button
            type="submit"
            form="goal-form"
            disabled={saving}
          >
            <Save size={14} />
            {saving
              ? "Saving..."
              : "Save goal"}
          </Button>
        </>
      }
    >
      <form
        id="goal-form"
        className="form-grid"
        onSubmit={submit}
      >
        <div className="form-field full">
          <label className="form-label">
            Goal name
          </label>

          <input
            className="form-input"
            value={name}
            onChange={(event) =>
              setName(event.target.value)
            }
            placeholder="e.g. College fee"
            required
            autoFocus
          />
        </div>

        <div className="form-field">
          <label className="form-label">
            Target amount
          </label>

          <MoneyInput
            value={totalAmount}
            onChange={setTotalAmount}
          />
        </div>

        <div className="form-field">
          <label className="form-label">
            Already saved
          </label>

          <MoneyInput
            value={savedAmount}
            onChange={setSavedAmount}
          />
        </div>

        <div className="form-field full">
          <label className="form-label">
            Due date
          </label>

          <input
            className="form-input"
            type="date"
            value={dueDate}
            onChange={(event) =>
              setDueDate(event.target.value)
            }
            min={todayISO()}
            required
          />
        </div>

        <div className="form-field full">
          <label className="form-label">
            Notes
          </label>

          <textarea
            className="form-textarea"
            value={notes}
            onChange={(event) =>
              setNotes(event.target.value)
            }
            placeholder="What is this goal for?"
          />
        </div>

        {error && (
          <div className="form-field full">
            <div className="alert alert-error">
              {error}
            </div>
          </div>
        )}
      </form>
    </Modal>
  );
}


/* ============================================================
   CONTRIBUTION MODAL
   ============================================================ */

function ContributionModal({
  goal,
  onClose,
  onSave,
}) {
  const remaining =
    Number(goal.total_amount || 0) -
    Number(goal.saved_amount || 0);

  const [amount, setAmount] =
    useState("");

  const [note, setNote] =
    useState("");

  const [error, setError] =
    useState("");

  const [saving, setSaving] =
    useState(false);

  async function submit(event) {
    event.preventDefault();

    const numericAmount =
      Number(amount || 0);

    if (numericAmount <= 0) {
      setError(
        "Enter a contribution greater than zero."
      );

      return;
    }

    if (numericAmount > remaining) {
      setError(
        "That contribution is greater than the amount still needed."
      );

      return;
    }

    setSaving(true);
    setError("");

    try {
      await onSave(
        numericAmount,
        note.trim()
      );
    } catch (requestError) {
      setError(
        requestError.message ||
          "Unable to record the contribution."
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      title="Record contribution"
      description={`${goal.name} · ${formatMoney(
        remaining
      )} still needed`}
      onClose={onClose}
      footer={
        <>
          <Button
            variant="secondary"
            onClick={onClose}
          >
            Cancel
          </Button>

          <Button
            type="submit"
            form="contribution-form"
            disabled={saving}
          >
            <Check size={14} />
            {saving
              ? "Saving..."
              : "Record contribution"}
          </Button>
        </>
      }
    >
      <form
        id="contribution-form"
        className="form-grid"
        onSubmit={submit}
      >
        <div className="form-field full">
          <label className="form-label">
            Contribution amount
          </label>

          <MoneyInput
            value={amount}
            onChange={setAmount}
            placeholder="0"
          />

          <span className="form-hint">
            Maximum remaining:
            {" "}
            {formatMoney(remaining)}
          </span>
        </div>

        <div className="form-field full">
          <label className="form-label">
            Note
          </label>

          <textarea
            className="form-textarea"
            value={note}
            onChange={(event) =>
              setNote(event.target.value)
            }
            placeholder="Optional — e.g. August contribution"
          />
        </div>

        {error && (
          <div className="form-field full">
            <div className="alert alert-error">
              {error}
            </div>
          </div>
        )}
      </form>
    </Modal>
  );
}


/* ============================================================
   EXPENSES PAGE
   ============================================================ */

function ExpensesPage({
  month,
  onAddExpense,
  onDeleteExpense,
}) {
  const expenses = month?.expenses || [];

  const [showModal, setShowModal] =
    useState(false);

  const total = expenses.reduce(
    (sum, expense) =>
      sum + Number(expense.amount || 0),
    0
  );

  return (
    <>
      <div className="page-header">
        <div className="page-header-copy">
          <p className="eyebrow">
            Actual spending
          </p>

          <h1 className="page-title">
            Unplanned expenses
          </h1>

          <p className="page-description">
            Keep surprises visible without turning this
            into a tedious transaction-by-transaction
            tracker.
          </p>
        </div>

        <div className="header-actions">
          <Button
            onClick={() =>
              setShowModal(true)
            }
          >
            <Plus size={15} />
            Add expense
          </Button>
        </div>
      </div>

      <div className="stats-grid">
        <div className="card stat-card">
          <p className="stat-label">
            Unplanned total
          </p>

          <p className="stat-value">
            {formatMoney(total)}
          </p>

          <p className="stat-note">
            Recorded this month
          </p>
        </div>

        <div className="card stat-card">
          <p className="stat-label">
            Entries
          </p>

          <p className="stat-value">
            {expenses.length}
          </p>

          <p className="stat-note">
            Unexpected or miscellaneous expenses
          </p>
        </div>
      </div>

      <div className="card card-padding">
        <div className="card-header">
          <div>
            <h2 className="card-title">
              Expense list
            </h2>

            <p className="card-subtitle">
              These are kept separate from your planned
              monthly categories.
            </p>
          </div>
        </div>

        {expenses.length === 0 ? (
          <EmptyState
            icon={<Receipt size={19} />}
            title="No unplanned expenses"
            text="That's a good thing. If something unexpected comes up, record it here."
            action={
              <Button
                small
                onClick={() =>
                  setShowModal(true)
                }
              >
                <Plus size={14} />
                Add expense
              </Button>
            }
          />
        ) : (
          <div className="table-scroll">
            <table className="budget-table">
              <thead>
                <tr>
                  <th>Expense</th>
                  <th>Amount</th>
                  <th>Date</th>
                  <th />
                </tr>
              </thead>

              <tbody>
                {expenses.map((expense) => (
                  <tr
                    key={expense.expense_id}
                  >
                    <td>
                      <div className="table-name">
                        {expense.name}
                      </div>

                      {expense.notes && (
                        <div className="form-hint">
                          {expense.notes}
                        </div>
                      )}
                    </td>

                    <td>
                      <span className="table-money table-negative">
                        {formatMoney(
                          expense.amount
                        )}
                      </span>
                    </td>

                    <td>
                      <span className="table-muted">
                        {formatDate(
                          expense.date
                        )}
                      </span>
                    </td>

                    <td>
                      <div className="table-actions">
                        <IconButton
                          label="Delete expense"
                          danger
                          icon={
                            <Trash2 size={14} />
                          }
                          onClick={() =>
                            onDeleteExpense(
                              expense.expense_id
                            )
                          }
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showModal && (
        <ExpenseModal
          onClose={() =>
            setShowModal(false)
          }
          onSave={async (expense) => {
            await onAddExpense(expense);
            setShowModal(false);
          }}
        />
      )}
    </>
  );
}


/* ============================================================
   EXPENSE MODAL
   ============================================================ */

function ExpenseModal({
  onClose,
  onSave,
}) {
  const [name, setName] =
    useState("");

  const [amount, setAmount] =
    useState("");

  const [notes, setNotes] =
    useState("");

  const [saving, setSaving] =
    useState(false);

  async function submit(event) {
    event.preventDefault();

    setSaving(true);

    try {
      await onSave({
        name: name.trim(),
        amount: Number(amount || 0),
        notes: notes.trim(),
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      title="Add unplanned expense"
      description="Record an unexpected expense so it doesn't disappear from the picture."
      onClose={onClose}
      footer={
        <>
          <Button
            variant="secondary"
            onClick={onClose}
          >
            Cancel
          </Button>

          <Button
            type="submit"
            form="expense-form"
            disabled={saving}
          >
            <Save size={14} />
            {saving
              ? "Saving..."
              : "Save expense"}
          </Button>
        </>
      }
    >
      <form
        id="expense-form"
        className="form-grid"
        onSubmit={submit}
      >
        <div className="form-field full">
          <label className="form-label">
            Expense name
          </label>

          <input
            className="form-input"
            value={name}
            onChange={(event) =>
              setName(event.target.value)
            }
            placeholder="e.g. Emergency repair"
            required
            autoFocus
          />
        </div>

        <div className="form-field full">
          <label className="form-label">
            Amount
          </label>

          <MoneyInput
            value={amount}
            onChange={setAmount}
            placeholder="0"
          />
        </div>

        <div className="form-field full">
          <label className="form-label">
            Notes
          </label>

          <textarea
            className="form-textarea"
            value={notes}
            onChange={(event) =>
              setNotes(event.target.value)
            }
            placeholder="Optional"
          />
        </div>
      </form>
    </Modal>
  );
}


/* ============================================================
   HISTORY PAGE
   ============================================================ */

function HistoryPage({
  history,
  onRefresh,
}) {
  return (
    <>
      <div className="page-header">
        <div className="page-header-copy">
          <p className="eyebrow">
            Looking back
          </p>

          <h1 className="page-title">
            Month history
          </h1>

          <p className="page-description">
            Compare your plans over time and see whether
            your household budget is becoming more
            intentional.
          </p>
        </div>

        <div className="header-actions">
          <Button
            variant="secondary"
            onClick={onRefresh}
          >
            <RefreshCw size={15} />
            Refresh
          </Button>
        </div>
      </div>

      <div className="card card-padding">
        {history.length === 0 ? (
          <EmptyState
            icon={<CalendarDays size={19} />}
            title="No month history yet"
            text="Once you save monthly plans, they'll appear here."
          />
        ) : (
          <div className="history-list">
            {history.map((item) => (
              <div
                className="history-row"
                key={item.month}
              >
                <div className="history-month">
                  {monthLabel(item.month)}
                </div>

                <div className="history-stat">
                  <span className="history-stat-label">
                    Income
                  </span>

                  <span className="history-stat-value">
                    {formatMoney(item.income)}
                  </span>
                </div>

                <div className="history-stat">
                  <span className="history-stat-label">
                    Allocated
                  </span>

                  <span className="history-stat-value">
                    {formatMoney(
                      item.total_allocated
                    )}
                  </span>
                </div>

                <div className="history-stat">
                  <span className="history-stat-label">
                    Used
                  </span>

                  <span className="history-stat-value">
                    {formatMoney(
                      item.total_used
                    )}
                  </span>
                </div>

                <div className="history-stat">
                  <span className="history-stat-label">
                    Unplanned
                  </span>

                  <span className="history-stat-value">
                    {formatMoney(
                      item.unplanned_expenses
                    )}
                  </span>
                </div>

                <div>
                  <span className="form-hint">
                    {item.category_count}{" "}
                    categories
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}


/* ============================================================
   REPORTS PAGE
   ============================================================ */

function ReportsPage({
  reports,
  goals,
}) {
  const months = reports?.months || [];

  const totals = reports?.totals || {};

  const chartData = months.map(
    (month) => ({
      month: month.month_label
        ?.split(" ")
        ?.map((part) => part.slice(0, 3))
        ?.join(" "),
      income: month.income,
      allocated: month.total_allocated,
      used: month.total_used,
    })
  );

  const goalData = goals.map(
    (goal) => ({
      name: goal.name,
      saved: Number(
        goal.saved_amount || 0
      ),
      remaining: Math.max(
        0,
        Number(goal.total_amount || 0) -
          Number(goal.saved_amount || 0)
      ),
    })
  );

  const pieData = goals.map(
    (goal) => ({
      name: goal.name,
      value: Number(
        goal.saved_amount || 0
      ),
    })
  ).filter(
    (item) => item.value > 0
  );

  const pieColors = [
    "#285447",
    "#b85c3e",
    "#c7953d",
    "#afc4ae",
    "#64706a",
  ];

  return (
    <>
      <div className="page-header">
        <div className="page-header-copy">
          <p className="eyebrow">
            The bigger picture
          </p>

          <h1 className="page-title">
            Reports
          </h1>

          <p className="page-description">
            A simple view of how your household budget
            has behaved across the months.
          </p>
        </div>
      </div>

      <div className="stats-grid">
        <div className="card stat-card">
          <p className="stat-label">
            Total income
          </p>

          <p className="stat-value">
            {formatMoney(totals.income)}
          </p>

          <p className="stat-note">
            Across saved months
          </p>
        </div>

        <div className="card stat-card">
          <p className="stat-label">
            Total allocated
          </p>

          <p className="stat-value">
            {formatMoney(totals.allocated)}
          </p>

          <p className="stat-note">
            Planned money
          </p>
        </div>

        <div className="card stat-card">
          <p className="stat-label">
            Total used
          </p>

          <p className="stat-value">
            {formatMoney(totals.used)}
          </p>

          <p className="stat-note">
            Recorded usage
          </p>
        </div>

        <div className="card stat-card">
          <p className="stat-label">
            Unplanned
          </p>

          <p className="stat-value">
            {formatMoney(
              totals.unplanned_expenses
            )}
          </p>

          <p className="stat-note">
            Unexpected expenses
          </p>
        </div>
      </div>

      <div className="report-grid">
        <div className="card chart-card">
          <div className="card-header">
            <div>
              <h2 className="card-title">
                Monthly trend
              </h2>

              <p className="card-subtitle">
                Income, allocation and actual usage.
              </p>
            </div>
          </div>

          {chartData.length === 0 ? (
            <EmptyState
              icon={<BarChart3 size={19} />}
              title="Not enough history yet"
              text="Save a few monthly plans and this chart will become useful."
            />
          ) : (
            <div className="chart-container">
              <ResponsiveContainer
                width="100%"
                height="100%"
              >
                <LineChart
                  data={chartData}
                  margin={{
                    top: 10,
                    right: 10,
                    left: 0,
                    bottom: 0,
                  }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="#d8ccba"
                  />

                  <XAxis
                    dataKey="month"
                    tick={{
                      fill: "#64706a",
                      fontSize: 9,
                    }}
                    axisLine={false}
                    tickLine={false}
                  />

                  <YAxis
                    tick={{
                      fill: "#64706a",
                      fontSize: 9,
                    }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(value) =>
                      `${CURRENCY}${Math.round(
                        value / 1000
                      )}k`
                    }
                  />

                  <Tooltip
                    formatter={(value) =>
                      formatMoney(value)
                    }
                  />

                  <Legend />

                  <Line
                    type="monotone"
                    dataKey="income"
                    name="Income"
                    stroke="#285447"
                    strokeWidth={2}
                    dot={{ r: 3 }}
                  />

                  <Line
                    type="monotone"
                    dataKey="allocated"
                    name="Allocated"
                    stroke="#c7953d"
                    strokeWidth={2}
                    dot={{ r: 3 }}
                  />

                  <Line
                    type="monotone"
                    dataKey="used"
                    name="Used"
                    stroke="#b85c3e"
                    strokeWidth={2}
                    dot={{ r: 3 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <div className="card chart-card">
          <div className="card-header">
            <div>
              <h2 className="card-title">
                Goal progress
              </h2>

              <p className="card-subtitle">
                Saved money across your active goals.
              </p>
            </div>
          </div>

          {goalData.length === 0 ? (
            <EmptyState
              icon={<Target size={19} />}
              title="No goal data yet"
              text="Create a future goal and start contributing to it."
            />
          ) : (
            <div className="chart-container">
              <ResponsiveContainer
                width="100%"
                height="100%"
              >
                <BarChart
                  data={goalData}
                  layout="vertical"
                  margin={{
                    top: 5,
                    right: 15,
                    left: 5,
                    bottom: 5,
                  }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="#d8ccba"
                  />

                  <XAxis
                    type="number"
                    tick={{
                      fill: "#64706a",
                      fontSize: 9,
                    }}
                    axisLine={false}
                    tickLine={false}
                  />

                  <YAxis
                    type="category"
                    dataKey="name"
                    width={85}
                    tick={{
                      fill: "#26302b",
                      fontSize: 9,
                    }}
                    axisLine={false}
                    tickLine={false}
                  />

                  <Tooltip
                    formatter={(value) =>
                      formatMoney(value)
                    }
                  />

                  <Legend />

                  <Bar
                    dataKey="saved"
                    name="Saved"
                    fill="#285447"
                    radius={[0, 4, 4, 0]}
                  />

                  <Bar
                    dataKey="remaining"
                    name="Remaining"
                    fill="#d8ccba"
                    radius={[0, 4, 4, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {pieData.length > 0 && (
          <div className="card chart-card">
            <div className="card-header">
              <div>
                <h2 className="card-title">
                  Savings distribution
                </h2>

                <p className="card-subtitle">
                  Where your saved goal money currently sits.
                </p>
              </div>
            </div>

            <div className="chart-container">
              <ResponsiveContainer
                width="100%"
                height="100%"
              >
                <PieChart>
                  <Pie
                    data={pieData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={88}
                    innerRadius={48}
                    paddingAngle={3}
                  >
                    {pieData.map(
                      (entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={
                            pieColors[
                              index %
                                pieColors.length
                            ]
                          }
                        />
                      )
                    )}
                  </Pie>

                  <Tooltip
                    formatter={(value) =>
                      formatMoney(value)
                    }
                  />

                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>
    </>
  );
}


/* ============================================================
   APP
   ============================================================ */

export default function App() {
  const [user, setUser] =
    useState(null);

  const [loading, setLoading] =
    useState(true);

  const [page, setPage] =
    useState("overview");

  const [month, setMonth] =
    useState(null);

  const [goals, setGoals] =
    useState([]);

  const [history, setHistory] =
    useState([]);

  const [reports, setReports] =
    useState(null);

  const [summary, setSummary] =
    useState(null);

  const [mobileMenuOpen, setMobileMenuOpen] =
    useState(false);

  const [error, setError] =
    useState("");

  const [toast, setToast] =
    useState("");

  const navigation = [
    {
      id: "overview",
      label: "Overview",
      icon: <Home size={17} />,
    },
    {
      id: "plan",
      label: "Monthly Plan",
      icon: <ClipboardList size={17} />,
    },
    {
      id: "goals",
      label: "Future Goals",
      icon: <Target size={17} />,
    },
    {
      id: "expenses",
      label: "Unplanned Expenses",
      icon: <Receipt size={17} />,
    },
    {
      id: "history",
      label: "Month History",
      icon: <CalendarDays size={17} />,
    },
    {
      id: "reports",
      label: "Reports",
      icon: <BarChart3 size={17} />,
    },
  ];

  function showToast(message) {
    setToast(message);

    setTimeout(() => {
      setToast("");
    }, 3000);
  }

  async function loadUser() {
    try {
      const currentUser =
        await apiRequest("/auth/me");

      setUser(currentUser);

      return currentUser;
    } catch {
      setUser(null);

      return null;
    }
  }

  async function loadData() {
    setError("");

    try {
      const [
        currentMonthData,
        goalsData,
        historyData,
        reportsData,
      ] = await Promise.all([
        apiRequest("/months/current"),
        apiRequest("/goals"),
        apiRequest("/months"),
        apiRequest("/reports"),
      ]);

      setMonth(currentMonthData);
      setGoals(goalsData);
      setHistory(
        historyData.map((item) => {
          const income =
            Number(item.income || 0);

          const categoryPlanned =
            (item.categories || []).reduce(
              (sum, category) =>
                sum +
                Number(
                  category.planned || 0
                ),
              0
            );

          const categoryUsed =
            (item.categories || []).reduce(
              (sum, category) =>
                sum +
                Number(
                  category.used || 0
                ),
              0
            );

          const goalPlanned =
            Object.values(
              item.goal_inclusions || {}
            ).reduce(
              (sum, inclusion) =>
                inclusion?.included
                  ? sum +
                    Number(
                      inclusion.planned ||
                        0
                    )
                  : sum,
              0
            );

          const unplanned =
            (item.expenses || []).reduce(
              (sum, expense) =>
                sum +
                Number(
                  expense.amount || 0
                ),
              0
            );

          return {
            ...item,
            income,
            total_allocated:
              categoryPlanned +
              goalPlanned,
            total_used:
              categoryUsed +
              unplanned,
            unplanned_expenses:
              unplanned,
            category_count:
              (item.categories || [])
                .length,
          };
        })
      );

      setReports(reportsData);

      const overview =
        await apiRequest("/overview");

      setSummary(
        overview.summary
      );
    } catch (requestError) {
      setError(
        requestError.message ||
          "Unable to load your ledger."
      );
    }
  }

  useEffect(() => {
    async function initialize() {
      setLoading(true);

      const currentUser =
        await loadUser();

      if (currentUser) {
        await loadData();
      }

      setLoading(false);
    }

    initialize();
  }, []);

  async function refresh() {
    await loadData();

    showToast(
      "Your ledger has been refreshed."
    );
  }

  async function saveMonthPlan(payload) {
    await apiRequest(
      "/months/current",
      {
        method: "PUT",
        body: JSON.stringify(payload),
      }
    );

    await loadData();
  }

  async function createGoal(payload) {
    await apiRequest(
      "/goals",
      {
        method: "POST",
        body: JSON.stringify(payload),
      }
    );

    await loadData();

    showToast("Goal created.");
  }

  async function updateGoal(
    goalId,
    payload
  ) {
    await apiRequest(
      `/goals/${goalId}`,
      {
        method: "PUT",
        body: JSON.stringify(payload),
      }
    );

    await loadData();

    showToast("Goal updated.");
  }

  async function deleteGoal(goalId) {
    const confirmed =
      window.confirm(
        "Delete this goal? This cannot be undone."
      );

    if (!confirmed) return;

    try {
      await apiRequest(
        `/goals/${goalId}`,
        {
          method: "DELETE",
        }
      );

      await loadData();

      showToast("Goal deleted.");
    } catch (requestError) {
      setError(
        requestError.message
      );
    }
  }

  async function contributeToGoal(
    goalId,
    amount,
    note
  ) {
    await apiRequest(
      `/goals/${goalId}/contributions`,
      {
        method: "POST",
        body: JSON.stringify({
          amount,
          note,
        }),
      }
    );

    await loadData();

    showToast(
      "Contribution recorded."
    );
  }

  async function addExpense(expense) {
    await apiRequest(
      "/months/current/expenses",
      {
        method: "POST",
        body: JSON.stringify(expense),
      }
    );

    await loadData();

    showToast(
      "Expense recorded."
    );
  }

  async function deleteExpense(
    expenseId
  ) {
    const confirmed =
      window.confirm(
        "Remove this expense?"
      );

    if (!confirmed) return;

    try {
      await apiRequest(
        `/months/current/expenses/${expenseId}`,
        {
          method: "DELETE",
        }
      );

      await loadData();

      showToast(
        "Expense removed."
      );
    } catch (requestError) {
      setError(
        requestError.message
      );
    }
  }

  async function logout() {
    try {
      await apiRequest(
        "/auth/logout",
        {
          method: "POST",
        }
      );
    } finally {
      setUser(null);
      setMonth(null);
      setGoals([]);
      setHistory([]);
      setReports(null);
      setSummary(null);
    }
  }

  function navigate(target) {
    setPage(target);
    setMobileMenuOpen(false);
    setError("");
  }

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="loading-content">
          <div className="loading-mark">
            <Wallet size={21} />
          </div>

          <div className="spinner" />

          <p className="loading-text">
            Preparing your ledger...
          </p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <AuthPage
        onAuthenticated={async (
          authenticatedUser
        ) => {
          setUser(authenticatedUser);
          await loadData();
        }}
      />
    );
  }

  return (
    <div className="app-shell">
      <div className="mobile-header">
        <div className="mobile-brand">
          <Wallet
            size={20}
            className="mobile-brand-mark"
          />

          <h1 className="mobile-brand-name">
            Family Ledger
          </h1>
        </div>

        <button
          type="button"
          className="mobile-menu-button"
          onClick={() =>
            setMobileMenuOpen(
              (current) => !current
            )
          }
          aria-label="Open navigation"
        >
          {mobileMenuOpen ? (
            <X size={18} />
          ) : (
            <Menu size={18} />
          )}
        </button>
      </div>

      <div className="app-layout">
        <aside
          className={`sidebar ${
            mobileMenuOpen
              ? "mobile-open"
              : ""
          }`}
        >
          <div className="brand">
            <div className="brand-mark">
              <Wallet size={20} />
            </div>

            <div>
              <p className="brand-name">
                Family Ledger
              </p>

              <p className="brand-subtitle">
                Household planning
              </p>
            </div>
          </div>

          <p className="nav-section-label">
            Navigation
          </p>

          <nav className="sidebar-nav">
            {navigation.map((item) => (
              <button
                type="button"
                key={item.id}
                className={`nav-item ${
                  page === item.id
                    ? "active"
                    : ""
                }`}
                onClick={() =>
                  navigate(item.id)
                }
              >
                {item.icon}
                {item.label}
              </button>
            ))}
          </nav>

          <div className="sidebar-spacer" />

          <div className="user-card">
            <div className="user-avatar">
              {initials(user.name)}
            </div>

            <div className="user-info">
              <p className="user-name">
                {user.name}
              </p>

              <p className="user-email">
                {user.email}
              </p>
            </div>

            <button
              type="button"
              className="logout-button"
              onClick={logout}
              title="Sign out"
              aria-label="Sign out"
            >
              <LogOut size={15} />
            </button>
          </div>
        </aside>

        <main className="main-area">
          <div className="content-container">
            {error && (
              <div
                className="alert alert-error"
                style={{
                  marginBottom: 18,
                }}
              >
                <X size={15} />
                <span>
                  {error}
                </span>

                <button
                  type="button"
                  className="icon-button"
                  style={{
                    marginLeft: "auto",
                  }}
                  onClick={() =>
                    setError("")
                  }
                >
                  <X size={14} />
                </button>
              </div>
            )}

            {page === "overview" && (
              <Dashboard
                month={month}
                goals={goals}
                summary={summary}
                onNavigate={navigate}
                onRefresh={refresh}
              />
            )}

            {page === "plan" && (
              <MonthlyPlan
                month={month}
                goals={goals}
                onSave={saveMonthPlan}
                onRefresh={refresh}
              />
            )}

            {page === "goals" && (
              <GoalsPage
                goals={goals}
                onCreateGoal={
                  createGoal
                }
                onUpdateGoal={
                  updateGoal
                }
                onDeleteGoal={
                  deleteGoal
                }
                onContribute={
                  contributeToGoal
                }
              />
            )}

            {page === "expenses" && (
              <ExpensesPage
                month={month}
                onAddExpense={
                  addExpense
                }
                onDeleteExpense={
                  deleteExpense
                }
              />
            )}

            {page === "history" && (
              <HistoryPage
                history={history}
                onRefresh={refresh}
              />
            )}

            {page === "reports" && (
              <ReportsPage
                reports={reports}
                goals={goals}
              />
            )}
          </div>
        </main>
      </div>

      {toast && (
        <div className="toast-container">
          <div className="toast">
            {toast}
          </div>
        </div>
      )}
    </div>
  );
}