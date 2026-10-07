import { useCallback, useEffect, useMemo, useState } from 'react';
import './App.css';

const API_URL = process.env.REACT_APP_API_URL || '/api';
const CATEGORIES = ['Food', 'Transport', 'Shopping', 'Bills', 'Health', 'Entertainment', 'Other'];
const CATEGORY_ICONS = {
  Food: '◒',
  Transport: '↗',
  Shopping: '◇',
  Bills: '▤',
  Health: '+',
  Entertainment: '♫',
  Other: '•••',
};
const CATEGORY_COLORS = {
  Food: '#7c6cf2',
  Transport: '#51b8a5',
  Shopping: '#f2a65a',
  Bills: '#628be8',
  Health: '#ed7d91',
  Entertainment: '#b174d3',
  Other: '#94a3b8',
};

const today = new Date();
const currentMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
const todayString = `${currentMonth}-${String(today.getDate()).padStart(2, '0')}`;

async function request(path, options) {
  const response = await fetch(`${API_URL}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `Request failed (${response.status})`);
  }
  return response.status === 204 ? null : response.json();
}

function formatCurrency(amount) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(Number(amount || 0));
}

function formatDate(date) {
  return new Date(`${date}T00:00:00`).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function App() {
  const [expenses, setExpenses] = useState([]);
  const [summary, setSummary] = useState({ total: 0, count: 0, byCategory: {} });
  const [month, setMonth] = useState(currentMonth);
  const [categoryFilter, setCategoryFilter] = useState('All categories');
  const [search, setSearch] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({
    title: '',
    amount: '',
    category: 'Food',
    expenseDate: todayString,
    note: '',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const loadExpenses = useCallback(async () => {
    setError('');
    try {
      const [items, totals] = await Promise.all([
        request('/expenses'),
        request(`/expenses/summary?month=${month}`),
      ]);
      setExpenses(items);
      setSummary(totals);
    } catch (loadError) {
      setError(`Could not connect to the expense API. ${loadError.message}`);
    } finally {
      setLoading(false);
    }
  }, [month]);

  useEffect(() => {
    loadExpenses();
  }, [loadExpenses]);

  const visibleExpenses = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    return expenses.filter((expense) => {
      const matchesCategory = categoryFilter === 'All categories' || expense.category === categoryFilter;
      const matchesSearch = !normalizedSearch
        || expense.title.toLowerCase().includes(normalizedSearch)
        || (expense.note || '').toLowerCase().includes(normalizedSearch);
      return matchesCategory && matchesSearch;
    });
  }, [expenses, categoryFilter, search]);

  const monthLabel = useMemo(() => new Date(`${month}-01T00:00:00`).toLocaleDateString('en-IN', {
    month: 'long',
    year: 'numeric',
  }), [month]);

  function updateField(event) {
    const { name, value } = event.target;
    setForm((previous) => ({ ...previous, [name]: value }));
  }

  function resetForm() {
    setEditingId(null);
    setForm({ title: '', amount: '', category: 'Food', expenseDate: todayString, note: '' });
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      await request(editingId ? `/expenses/${editingId}` : '/expenses', {
        method: editingId ? 'PUT' : 'POST',
        body: JSON.stringify({ ...form, amount: Number(form.amount) }),
      });
      resetForm();
      await loadExpenses();
    } catch (saveError) {
      setError(`Expense could not be saved. ${saveError.message}`);
    } finally {
      setSaving(false);
    }
  }

  function startEditing(expense) {
    setEditingId(expense.id);
    setForm({
      title: expense.title,
      amount: String(expense.amount),
      category: expense.category,
      expenseDate: expense.expenseDate,
      note: expense.note || '',
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function deleteExpense(expense) {
    if (!window.confirm(`Delete "${expense.title}"? This cannot be undone.`)) return;
    setError('');
    try {
      await request(`/expenses/${expense.id}`, { method: 'DELETE' });
      if (editingId === expense.id) resetForm();
      await loadExpenses();
    } catch (deleteError) {
      setError(`Expense could not be deleted. ${deleteError.message}`);
    }
  }

  function exportCsv() {
    const rows = [
      ['Title', 'Amount (INR)', 'Category', 'Date', 'Note'],
      ...visibleExpenses.map(({ title, amount, category, expenseDate, note }) => [
        title, amount, category, expenseDate, note || '',
      ]),
    ];
    const csv = rows.map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(',')).join('\n');
    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    link.download = 'expenses.csv';
    link.click();
    URL.revokeObjectURL(link.href);
  }

  const categoryItems = Object.entries(summary.byCategory || {})
    .sort((first, second) => Number(second[1]) - Number(first[1]));
  const highestCategory = categoryItems[0];
  const greeting = new Date().getHours() < 12 ? 'Good morning' : new Date().getHours() < 18 ? 'Good afternoon' : 'Good evening';

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="/" aria-label="Pennywise home">
          <span className="brand-mark">p</span>
          <span>pennywise<span className="brand-period">.</span></span>
        </a>
        <div className="workspace-label">WORKSPACE</div>
        <nav aria-label="Main navigation">
          <a className="nav-link active" href="#overview"><span className="nav-icon">▦</span> Overview</a>
          <a className="nav-link" href="#transactions"><span className="nav-icon">↕</span> Transactions</a>
          <a className="nav-link" href="#spending"><span className="nav-icon">◔</span> Spending</a>
        </nav>
        <div className="sidebar-bottom">
          <div className="tip-card">
            <div className="tip-icon">✦</div>
            <p className="tip-title">Small steps add up</p>
            <p className="tip-copy">Keep tracking your spending to build better money habits.</p>
          </div>
          <div className="profile">
            <div className="avatar">A</div>
            <div><strong>My wallet</strong><span>Personal account</span></div>
            <span className="profile-menu">•••</span>
          </div>
        </div>
      </aside>

      <main className="main-content" id="overview">
        <header className="topbar">
          <div className="breadcrumb">Workspace <span>/</span> Overview</div>
          <div className="topbar-right">
            <span className="today-label">{today.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}</span>
            <div className="avatar top-avatar">A</div>
          </div>
        </header>

        <section className="page-intro">
          <div>
            <p className="eyebrow">{greeting} 👋</p>
            <h1>Your money, <span>in focus.</span></h1>
            <p className="intro-copy">A clearer picture of where it goes, one day at a time.</p>
          </div>
          <label className="month-picker">
            <span aria-hidden="true">▦</span>
            <input aria-label="Summary month" type="month" value={month} onChange={(event) => setMonth(event.target.value)} />
          </label>
        </section>

        {error && <div className="error-banner" role="alert">{error}</div>}

        <section className="summary-grid" aria-label="Spending summary">
          <article className="summary-card total-card">
            <div className="card-topline"><span className="card-label">TOTAL SPENT</span><span className="card-icon purple">₹</span></div>
            <div className="metric">{formatCurrency(summary.total)}</div>
            <div className="metric-foot"><span className="metric-dot purple-dot" />{monthLabel}</div>
            <div className="sparkline" aria-hidden="true"><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /></div>
          </article>
          <article className="summary-card">
            <div className="card-topline"><span className="card-label">TRANSACTIONS</span><span className="card-icon mint">↕</span></div>
            <div className="metric">{summary.count || 0}<span className="metric-unit"> entries</span></div>
            <div className="metric-foot"><span className="metric-dot mint-dot" />Logged this month</div>
            <div className="mini-bars" aria-hidden="true"><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /></div>
          </article>
          <article className="summary-card">
            <div className="card-topline"><span className="card-label">TOP CATEGORY</span><span className="card-icon orange">{highestCategory ? CATEGORY_ICONS[highestCategory[0]] : '✦'}</span></div>
            <div className="metric category-metric">{highestCategory ? highestCategory[0] : '—'}</div>
            <div className="metric-foot"><span className="metric-dot orange-dot" />{highestCategory ? formatCurrency(highestCategory[1]) : 'No spending yet'}</div>
            <div className="category-track" aria-hidden="true"><span style={{ width: highestCategory && summary.total ? `${Math.min((highestCategory[1] / summary.total) * 100, 100)}%` : '0%' }} /></div>
          </article>
        </section>

        <section className="content-grid">
          <article className="panel spending-panel" id="spending">
            <div className="panel-heading">
              <div><h2>Spending breakdown</h2><p>Where your money went in {monthLabel}</p></div>
              <span className="subtle-icon">•••</span>
            </div>
            {categoryItems.length ? (
              <div className="breakdown-list">
                {categoryItems.map(([category, amount]) => (
                  <div className="breakdown-item" key={category}>
                    <div className="breakdown-meta">
                      <span className="category-name"><span className="category-dot" style={{ background: CATEGORY_COLORS[category] || CATEGORY_COLORS.Other }} />{category}</span>
                      <span>{formatCurrency(amount)}</span>
                    </div>
                    <div className="progress-track"><span style={{ width: `${summary.total ? (amount / summary.total) * 100 : 0}%`, background: CATEGORY_COLORS[category] || CATEGORY_COLORS.Other }} /></div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-breakdown"><span>◔</span><strong>Your breakdown starts here</strong><p>Add your first expense to see your spending patterns.</p></div>
            )}
          </article>

          <article className="panel add-panel">
            <div className="panel-heading">
              <div><h2>{editingId ? 'Edit expense' : 'Add an expense'}</h2><p>{editingId ? 'Update the transaction details.' : 'Capture it while it’s fresh.'}</p></div>
              <span className="add-badge">{editingId ? '✎' : '+'}</span>
            </div>
            <form className="expense-form" onSubmit={handleSubmit}>
              <label>What was it for?
                <input name="title" value={form.title} onChange={updateField} placeholder="e.g. Weekend groceries" maxLength="100" required />
              </label>
              <div className="form-row">
                <label>Amount
                  <div className="amount-input"><span>₹</span><input name="amount" type="number" min="0.01" step="0.01" value={form.amount} onChange={updateField} placeholder="0.00" required /></div>
                </label>
                <label>Date
                  <input name="expenseDate" type="date" value={form.expenseDate} onChange={updateField} required />
                </label>
              </div>
              <label>Category
                <select name="category" value={form.category} onChange={updateField}>
                  {CATEGORIES.map((category) => <option key={category}>{category}</option>)}
                </select>
              </label>
              <label>Note <span className="optional-label">Optional</span>
                <input name="note" value={form.note} onChange={updateField} placeholder="Add a little detail..." maxLength="500" />
              </label>
              <div className="form-actions">
                {editingId && <button className="cancel-button" type="button" onClick={resetForm}>Cancel</button>}
                <button className="submit-button" type="submit" disabled={saving}>
                  {saving ? 'Saving…' : editingId ? 'Save changes' : 'Add expense'} <span aria-hidden="true">→</span>
                </button>
              </div>
            </form>
          </article>
        </section>

        <section className="panel transactions-panel" id="transactions">
          <div className="panel-heading transactions-heading">
            <div><h2>Recent transactions</h2><p>Your latest money movements</p></div>
            <div className="transaction-tools">
              <label className="search-field"><span aria-hidden="true">⌕</span><input aria-label="Search expenses" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search..." /></label>
              <select aria-label="Filter by category" className="filter-select" value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}>
                <option>All categories</option>
                {CATEGORIES.map((category) => <option key={category}>{category}</option>)}
              </select>
              <button className="export-button" type="button" onClick={exportCsv} disabled={!visibleExpenses.length}>↧ <span>Export</span></button>
            </div>
          </div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>TRANSACTION</th><th>CATEGORY</th><th>DATE</th><th className="amount-column">AMOUNT</th><th aria-label="Actions" /></tr></thead>
              <tbody>
                {visibleExpenses.map((expense) => (
                  <tr key={expense.id}>
                    <td><div className="transaction-title"><span className="transaction-icon" style={{ color: CATEGORY_COLORS[expense.category], background: `${CATEGORY_COLORS[expense.category]}18` }}>{CATEGORY_ICONS[expense.category] || CATEGORY_ICONS.Other}</span><span><strong>{expense.title}</strong>{expense.note && <small>{expense.note}</small>}</span></div></td>
                    <td><span className="category-pill">{expense.category}</span></td>
                    <td className="date-cell">{formatDate(expense.expenseDate)}</td>
                    <td className="amount-column amount-cell">− {formatCurrency(expense.amount)}</td>
                    <td className="row-actions"><button type="button" aria-label={`Edit ${expense.title}`} onClick={() => startEditing(expense)}>✎</button><button type="button" aria-label={`Delete ${expense.title}`} onClick={() => deleteExpense(expense)}>×</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
            {loading && <div className="table-state">Loading your expenses…</div>}
            {!loading && visibleExpenses.length === 0 && (
              <div className="table-state">
                <span className="empty-icon">↗</span>
                <strong>{expenses.length ? 'No matching expenses' : 'A fresh start'}</strong>
                <span>{expenses.length ? 'Try another search or category.' : 'Your transactions will show up here once you add one.'}</span>
              </div>
            )}
          </div>
          <div className="table-footer"><span>Showing {visibleExpenses.length} of {expenses.length} transactions</span><span>All amounts in INR <span className="footer-dot">●</span></span></div>
        </section>
        <footer className="page-footer"><span>Made for a little more peace of mind.</span><span>Track thoughtfully <span className="heart">♥</span></span></footer>
      </main>
    </div>
  );
}

export default App;
