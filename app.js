/* ═══════════════════════════════════════════════════
   THE ATELIER — Application Logic
   Premium editorial expense tracker
   ══════════════════════════════════════════════ */

// ─── State ───
let state = {
  transactions: [],
  currentPage: 'home',
  currentFilter: 'all',
  searchQuery: '',
  expenseType: 'expense',
  darkMode: false,
  currency: 'USD',
  monthlyBudget: 1500,
  settings: {
    alerts: true,
    biometric: false
  }
};

// ─── Currency Config ───
const currencySymbols = { USD: '$', EUR: '€', GBP: '£', INR: '₹', JPY: '¥' };
const currencyLocales = { USD: 'en-US', EUR: 'de-DE', GBP: 'en-GB', INR: 'en-IN', JPY: 'ja-JP' };

// ─── Category Config ───
const categoryConfig = {
  Dining:        { icon: '🍽️', cssClass: 'dining'   },
  Shopping:      { icon: '🛍️', cssClass: 'shopping' },
  Transport:     { icon: '🚗', cssClass: 'transport' },
  Health:        { icon: '💊', cssClass: 'health'   },
  Travel:        { icon: '✈️', cssClass: 'travel'   },
  Bills:         { icon: '📄', cssClass: 'bills'    },
  Entertainment: { icon: '🎬', cssClass: 'shopping' },
  Income:        { icon: '💰', cssClass: 'health'   },
  Other:         { icon: '📦', cssClass: 'transport' }
};

// ─── Constants ───
// Default empty list for transactions

/* ═══════════════════════════════════════════════════
   LOCAL STORAGE — Persist & Restore All State
   ═══════════════════════════════════════════════════ */

function saveState() {
  try {
    localStorage.setItem('tracko_v3_transactions', JSON.stringify(state.transactions));
    localStorage.setItem('tracko_v3_darkMode',     JSON.stringify(state.darkMode));
    localStorage.setItem('tracko_v3_currency',     state.currency);
    localStorage.setItem('tracko_v3_budget',       String(state.monthlyBudget));
    localStorage.setItem('tracko_v3_settings',     JSON.stringify(state.settings));
  } catch (e) {
    console.warn('Could not save to localStorage:', e);
  }
}

function loadState() {
  try {
    const txns = localStorage.getItem('tracko_v3_transactions');
    if (txns) state.transactions = JSON.parse(txns);

    const dark = localStorage.getItem('tracko_v3_darkMode');
    if (dark !== null) state.darkMode = JSON.parse(dark);

    const cur = localStorage.getItem('tracko_v3_currency');
    if (cur && currencySymbols[cur]) state.currency = cur;

    const budget = localStorage.getItem('tracko_v3_budget');
    if (budget) {
      const parsed = parseFloat(budget);
      if (!isNaN(parsed) && parsed > 0) state.monthlyBudget = parsed;
    }

    const settings = localStorage.getItem('tracko_v3_settings');
    if (settings) state.settings = { ...state.settings, ...JSON.parse(settings) };
  } catch (e) {
    console.warn('Could not load from localStorage:', e);
  }
}

/* ═══════════════════════════════════════════════════
   INIT
   ═══════════════════════════════════════════════════ */

function init() {
  loadState();

  applyTheme();
  renderAll();
  setDateDefault();
  syncAllUIToState();
}

/* ═══════════════════════════════════════════════════
   NAVIGATION
   ═══════════════════════════════════════════════════ */

function navigateTo(page) {
  state.currentPage = page;

  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));

  const target = document.getElementById('page-' + page);
  if (target) {
    target.classList.add('active');
    target.style.animation = 'none';
    target.offsetHeight;
    target.style.animation = '';
  }

  // Update nav items across sidebar AND bottom-nav
  document.querySelectorAll('.nav-item').forEach(item => {
    item.classList.toggle('active', item.dataset.page === page);
  });

  if (page === 'home')     renderHome();
  if (page === 'ledger')   renderLedger();
  if (page === 'insights') renderInsights();
  if (page === 'studio')   renderStudio();
}

/* ═══════════════════════════════════════════════════
   RENDER ALL
   ═══════════════════════════════════════════════════ */

function renderAll() {
  renderHome();
  renderLedger();
  renderInsights();
  renderStudio();
  syncCurrencyPrefixes();
}

/* ═══════════════════════════════════════════════════
   FORMAT HELPERS
   ═══════════════════════════════════════════════════ */

function formatCurrency(amount) {
  const locale = currencyLocales[state.currency] || 'en-US';
  const decimals = state.currency === 'JPY' ? 0 : 2;
  return Math.abs(amount).toLocaleString(locale, {
    style: 'currency',
    currency: state.currency,
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  });
}

function formatDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return months[d.getMonth()] + ' ' + d.getDate() + ', ' + d.getFullYear();
}

function timeAgo(dateStr) {
  const now  = new Date();
  const d    = new Date(dateStr + 'T12:00:00');
  const diff = Math.floor((now - d) / (1000 * 60 * 60 * 24));
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  if (diff < 7)  return diff + 'd ago';
  return formatDate(dateStr);
}

function getNextId() {
  return state.transactions.length > 0
    ? Math.max(...state.transactions.map(t => t.id)) + 1
    : 1;
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function getFinancialTotals(transactions) {
  const totals = (transactions || []).reduce(function(acc, txn) {
    if (txn.type === 'income') acc.income += txn.amount;
    if (txn.type === 'expense') acc.expenses += txn.amount;
    return acc;
  }, { income: 0, expenses: 0 });

  totals.balance = totals.income - totals.expenses;
  return totals;
}

/* ═══════════════════════════════════════════════════
   RENDER: HOME
   ═══════════════════════════════════════════════════ */

function renderHome() {
  // Always render calendar at top
  renderModernCalendar(calOffset);

  // ── Derive financial totals reactively ──
  const totals   = getFinancialTotals(state.transactions);
  const income   = totals.income;
  const expenses = totals.expenses;
  const balance  = totals.balance; // income - expenses
  const budget   = state.monthlyBudget || 0;

  // ── Hero card: Budget Left (budget - expenses) ──
  // Hide the separate currency symbol span since formatCurrency includes it
  const heroSymbolEl = document.getElementById('heroSymbol');
  if (heroSymbolEl) heroSymbolEl.style.display = 'none';

  const budgetLeft = Math.max(0, budget - expenses);
  const balEl = document.getElementById('totalNetWorth');
  if (balEl) {
    balEl.textContent = formatCurrency(budgetLeft);
    balEl.style.color = '';
  }

  // ── Income / Expense pills ──
  document.getElementById('heroIncome').textContent   = formatCurrency(income);
  document.getElementById('heroExpenses').textContent = formatCurrency(expenses);

  // ── Budget bar ──
  const usedPct    = budget > 0 ? Math.min((expenses / budget) * 100, 100) : 0;
  const fillEl     = document.getElementById('heroBudgetFill');
  const usedLabel  = document.getElementById('heroBudgetUsedLabel');
  const totalLabel = document.getElementById('heroBudgetTotalLabel');

  if (fillEl) {
    fillEl.style.width = usedPct + '%';
    fillEl.className   = 'hero-budget-fill' + (usedPct >= 90 ? ' danger' : usedPct >= 70 ? ' warning' : '');
  }
  if (usedLabel)  usedLabel.textContent  = formatCurrency(budgetLeft) + ' left';
  if (totalLabel) totalLabel.textContent = 'of ' + formatCurrency(budget) + ' budget';

  // ── Stat card 1: Budget Left ──
  const budgetPct = budget > 0 ? Math.round((budgetLeft / budget) * 100) : 0;
  document.getElementById('statBudgetLeft').textContent = formatCurrency(budgetLeft);
  document.getElementById('statBudgetPct').textContent  = budgetPct + '% of ' + formatCurrency(budget);

  // ── Stat card 2: Spent This Week ──
  const now      = new Date();
  const weekAgo  = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const weekTxns = state.transactions.filter(function(t) {
    return t.type === 'expense' && new Date(t.date + 'T12:00:00') >= weekAgo;
  });
  const weekTotal = weekTxns.reduce((s, t) => s + t.amount, 0);
  document.getElementById('statWeekSpend').textContent = formatCurrency(weekTotal);
  document.getElementById('statWeekCount').textContent = weekTxns.length + ' transaction' + (weekTxns.length !== 1 ? 's' : '');

  // ── Stat card 3: Pending Bill ──
  const pendingBills = state.transactions.filter(t => t.status === 'pending' && t.type === 'expense');
  if (pendingBills.length > 0) {
    const bill = pendingBills[0];
    document.getElementById('statBillAmount').textContent = formatCurrency(bill.amount);
    document.getElementById('statBillName').textContent   = bill.name;
  } else {
    document.getElementById('statBillAmount').textContent = '\u2014';
    document.getElementById('statBillName').textContent   = 'No pending bills';
  }

  // ── Top Spending by category ──
  const catSpend = {};
  state.transactions.filter(t => t.type === 'expense').forEach(t => {
    catSpend[t.category] = (catSpend[t.category] || 0) + t.amount;
  });
  const topCats = Object.entries(catSpend).sort((a, b) => b[1] - a[1]).slice(0, 4);

  const chipsContainer = document.getElementById('categoryChips');
  chipsContainer.innerHTML = topCats.length
    ? topCats.map(function(entry) {
        var cat = entry[0], spent = entry[1];
        var cfg = categoryConfig[cat] || categoryConfig.Other;
        var pctOfExpenses = expenses > 0 ? Math.round((spent / expenses) * 100) : 0;
        return '<div class="category-chip">' +
          '<div class="chip-icon ' + cfg.cssClass + '">' + cfg.icon + '</div>' +
          '<div class="chip-name">' + cat + '</div>' +
          '<div class="chip-amount">' + formatCurrency(spent) + '</div>' +
          '<div class="chip-count">' + pctOfExpenses + '% of expenses</div>' +
          '</div>';
      }).join('')
    : '<div class="empty-state" style="grid-column:1/-1"><div class="empty-icon">\ud83d\udcca</div><div class="empty-title">No expenses yet</div></div>';

  // ── Recent Transactions (latest 5) ──
  const recent = [...state.transactions].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 5);
  document.getElementById('recentTransactions').innerHTML = recent.length
    ? recent.map(t => renderTransactionItem(t, true)).join('')
    : '<div class="empty-state"><div class="empty-icon">\ud83d\udced</div><div class="empty-title">No transactions yet</div><div class="empty-desc">Tap + to add your first entry.</div></div>';
}


/* ═══════════════════════════════════════════════════
   RENDER: TRANSACTION ITEM
   ═══════════════════════════════════════════════════ */

function renderTransactionItem(t, compact) {
  const isIncome  = t.type === 'income';
  const cfg       = categoryConfig[t.category] || categoryConfig.Other;
  const sign      = isIncome ? '+' : '-';
  const amountStr = sign + formatCurrency(t.amount);
  const meta      = compact
    ? timeAgo(t.date) + ' • ' + t.category
    : formatDate(t.date) + ' • ' + t.category;

  return '<div class="transaction-item" data-id="' + t.id + '">' +
    '<div class="transaction-icon ' + (isIncome ? 'income' : 'expense') + '">' + cfg.icon + '</div>' +
    '<div class="transaction-details">' +
      '<div class="transaction-name">' + escapeHtml(t.name) + '</div>' +
      '<div class="transaction-meta">' + meta + '</div>' +
    '</div>' +
    '<div class="transaction-amount-wrapper">' +
      '<div class="transaction-amount ' + (isIncome ? 'positive' : 'negative') + '">' + amountStr + '</div>' +
      '<div class="transaction-status ' + t.status + '">' + t.status + '</div>' +
    '</div>' +
    '<button class="transaction-delete" onclick="deleteTransaction(' + t.id + ', event)" title="Delete">' +
      '<span class="material-symbols-rounded" style="font-size:1rem;">close</span>' +
    '</button>' +
  '</div>';
}

/* ═══════════════════════════════════════════════════
   RENDER: LEDGER  (grouped by date, sortable)
   ═══════════════════════════════════════════════════ */

// Ledger sort state (not persisted — resets to default on reload, which is fine)
var ledgerSort = 'date-desc';

function renderLedger() {
  // 1. Start with all transactions
  var list = state.transactions.slice();

  // 2. Apply type / status filter
  if (state.currentFilter === 'expense') list = list.filter(function(t) { return t.type === 'expense'; });
  if (state.currentFilter === 'income')  list = list.filter(function(t) { return t.type === 'income'; });
  if (state.currentFilter === 'pending') list = list.filter(function(t) { return t.status === 'pending'; });

  // 3. Apply search
  if (state.searchQuery) {
    var q = state.searchQuery.toLowerCase();
    list = list.filter(function(t) {
      return t.name.toLowerCase().includes(q) ||
             t.category.toLowerCase().includes(q) ||
             (t.notes || '').toLowerCase().includes(q);
    });
  }

  // 4. Sort
  list.sort(function(a, b) {
    switch (ledgerSort) {
      case 'date-asc':    return new Date(a.date) - new Date(b.date);
      case 'amount-desc': return b.amount - a.amount;
      case 'amount-asc':  return a.amount - b.amount;
      case 'name-asc':    return a.name.localeCompare(b.name);
      default:            return new Date(b.date) - new Date(a.date); // date-desc
    }
  });

  // 5. Summary bar — always based on FILTERED list
  var filteredIncome   = list.filter(function(t) { return t.type === 'income'; }).reduce(function(s,t){return s+t.amount;},0);
  var filteredExpenses = list.filter(function(t) { return t.type === 'expense'; }).reduce(function(s,t){return s+t.amount;},0);
  var filteredNet      = filteredIncome - filteredExpenses;

  document.getElementById('ledgerTotalIncome').textContent  = formatCurrency(filteredIncome);
  document.getElementById('ledgerTotalExpense').textContent = formatCurrency(filteredExpenses);
  var netEl = document.getElementById('ledgerNetBalance');
  // Balance = Total Income - Total Expenses (show negative when expenses exceed income)
  var netSign = filteredNet < 0 ? '-' : '';
  var netAmount = Math.abs(filteredNet);
  netEl.textContent = netSign + formatCurrency(netAmount);
  netEl.className   = 'ledger-summary-value ' + (filteredNet >= 0 ? 'ledger-summary-income' : 'ledger-summary-expense');
  document.getElementById('ledgerTxnCount').textContent = list.length;

  // Show/hide search clear button
  var clearBtn = document.getElementById('searchClear');
  if (clearBtn) clearBtn.style.display = state.searchQuery ? 'flex' : 'none';

  // 6. Render — grouped by date only when sorting by date, flat otherwise
  var container = document.getElementById('allTransactions');
  if (list.length === 0) {
    container.innerHTML =
      '<div class="empty-state">' +
        '<div class="empty-icon">📭</div>' +
        '<div class="empty-title">No transactions found</div>' +
        '<div class="empty-desc">Try a different filter or add a new entry.</div>' +
      '</div>';
  } else if (ledgerSort === 'date-desc' || ledgerSort === 'date-asc') {
    container.innerHTML = renderGroupedByDate(list);
  } else {
    // Flat list with a subtle section label showing sort
    var sortLabels = {
      'amount-desc': 'Sorted by highest amount',
      'amount-asc':  'Sorted by lowest amount',
      'name-asc':    'Sorted A → Z'
    };
    container.innerHTML =
      '<div class="ledger-flat-label">' + (sortLabels[ledgerSort] || '') + '</div>' +
      '<div class="transaction-list">' +
        list.map(function(t) { return renderTransactionItem(t, false); }).join('') +
      '</div>';
  }

  // 7. Portfolio sidebar — based on ALL transactions (not filtered)
  var allIncome   = state.transactions.filter(function(t){return t.type==='income';}).reduce(function(s,t){return s+t.amount;},0);
  var allExpenses = state.transactions.filter(function(t){return t.type==='expense';}).reduce(function(s,t){return s+t.amount;},0);
  var savings     = allIncome - allExpenses;

  document.getElementById('estimatedSavings').textContent = formatCurrency(Math.abs(savings));
  document.getElementById('portfolioHealth').textContent  = savings >= 0
    ? 'Well managed. Net balance is positive.'
    : 'Expenses exceed income by ' + formatCurrency(Math.abs(savings)) + '.';

  // 8. Category breakdown in sidebar
  renderLedgerCatBreakdown(state.transactions.filter(function(t){return t.type==='expense';}));
}

/* Group transactions by date and render each group */
function renderGroupedByDate(list) {
  // Build groups: { 'Nov 24, 2024': [txn, …], … }
  var groups = {};
  var order  = [];
  list.forEach(function(t) {
    var label = formatDate(t.date);
    if (!groups[label]) { groups[label] = []; order.push(label); }
    groups[label].push(t);
  });

  return order.map(function(label) {
    var txns         = groups[label];
    var dayExpenses  = txns.filter(function(t){return t.type==='expense';}).reduce(function(s,t){return s+t.amount;},0);
    var dayIncome    = txns.filter(function(t){return t.type==='income';}).reduce(function(s,t){return s+t.amount;},0);

    var daySub = '';
    if (dayIncome > 0 && dayExpenses > 0)
      daySub = '+' + formatCurrency(dayIncome) + '  −' + formatCurrency(dayExpenses);
    else if (dayIncome > 0)
      daySub = '+' + formatCurrency(dayIncome);
    else if (dayExpenses > 0)
      daySub = '−' + formatCurrency(dayExpenses);

    return '<div class="ledger-group">' +
      '<div class="ledger-group-header">' +
        '<span class="ledger-group-date">' + label + '</span>' +
        '<span class="ledger-group-sub">' + daySub + '</span>' +
      '</div>' +
      '<div class="transaction-list">' +
        txns.map(function(t) { return renderTransactionItem(t, false); }).join('') +
      '</div>' +
    '</div>';
  }).join('');
}

/* Mini category breakdown in sidebar */
function renderLedgerCatBreakdown(expenseTxns) {
  var catSpend = {};
  expenseTxns.forEach(function(t) {
    catSpend[t.category] = (catSpend[t.category] || 0) + t.amount;
  });
  var total   = expenseTxns.reduce(function(s,t){return s+t.amount;}, 0);
  var sorted  = Object.entries(catSpend).sort(function(a,b){return b[1]-a[1];}).slice(0, 5);
  var fills   = ['primary-fill','secondary-fill','tertiary-fill','error-fill','primary-fill'];

  document.getElementById('ledgerCatBreakdown').innerHTML = sorted.length
    ? sorted.map(function(entry, i) {
        var cat = entry[0], amt = entry[1];
        var pct = total > 0 ? Math.round((amt / total) * 100) : 0;
        var cfg = categoryConfig[cat] || categoryConfig.Other;
        return '<div class="lcat-row">' +
          '<span class="lcat-icon">' + cfg.icon + '</span>' +
          '<div class="lcat-body">' +
            '<div class="lcat-top">' +
              '<span class="lcat-name">' + cat + '</span>' +
              '<span class="lcat-amt">' + formatCurrency(amt) + '</span>' +
            '</div>' +
            '<div class="lcat-bar-track">' +
              '<div class="lcat-bar-fill ' + fills[i] + '" style="width:' + pct + '%"></div>' +
            '</div>' +
          '</div>' +
        '</div>';
      }).join('')
    : '<div style="font-size:0.8125rem;color:var(--on-surface-variant);padding:var(--space-3) 0;">No expenses yet</div>';
}

function filterTransactions() {
  state.searchQuery = document.getElementById('searchInput').value;
  renderLedger();
}

function clearSearch() {
  state.searchQuery = '';
  var input = document.getElementById('searchInput');
  if (input) input.value = '';
  renderLedger();
}

function setFilter(filter) {
  state.currentFilter = filter;
  document.querySelectorAll('.filter-chip').forEach(function(chip) {
    chip.classList.toggle('active', chip.dataset.filter === filter);
  });
  renderLedger();
}

function setSort(value) {
  ledgerSort = value;
  renderLedger();
}

/* ═══════════════════════════════════════════════════
   RENDER: INSIGHTS
   ═══════════════════════════════════════════════════ */

function renderInsights() {
  const expenseTxns = state.transactions.filter(t => t.type === 'expense');
  const totalSpent  = expenseTxns.reduce((s, t) => s + t.amount, 0);
  const budget      = state.monthlyBudget;
  const remaining   = Math.max(0, budget - totalSpent);

  const budgetRemainingEl = document.getElementById('budgetRemaining');
  if (budgetRemainingEl) {
    budgetRemainingEl.innerHTML = 'You have <strong>' + formatCurrency(remaining) + '</strong> remaining this month.';
  }

  // Budget Ring Math
  const pct = budget > 0 ? Math.min(totalSpent / budget, 1) : 0;
  const circumference = 2 * Math.PI * 52;
  const offset = circumference * (1 - pct);

  const ring = document.getElementById('budgetRingFill');
  if (ring) {
    setTimeout(function() { ring.style.strokeDashoffset = offset; }, 100);
  }

  const budgetSpentEl = document.getElementById('budgetSpent');
  if (budgetSpentEl) budgetSpentEl.textContent = formatCurrency(totalSpent);

  const budgetTotalEl = document.getElementById('budgetTotal');
  if (budgetTotalEl) budgetTotalEl.textContent = 'of ' + formatCurrency(budget);

  // --- Process Category Data (Bar Chart) ---
  const catSpend = {};
  expenseTxns.forEach(t => { catSpend[t.category] = (catSpend[t.category] || 0) + t.amount; });
  const sortedCats = Object.entries(catSpend).sort((a, b) => b[1] - a[1]).slice(0, 6);

  const catCtx = document.getElementById('categoryChart');
  if (!catCtx) return;

  // Destroy previous chart instance to avoid "Canvas already in use" error
  if (window.categoryChartInst) {
    window.categoryChartInst.destroy();
    window.categoryChartInst = null;
  }

  // Show empty state if no expense data
  if (sortedCats.length === 0) {
    const container = catCtx.parentElement;
    catCtx.style.display = 'none';
    if (!container.querySelector('.chart-empty')) {
      const empty = document.createElement('div');
      empty.className = 'chart-empty empty-state';
      empty.innerHTML = '<div class="empty-icon">📊</div><div class="empty-title">No expense data yet</div><div class="empty-desc">Add some expenses to see the breakdown.</div>';
      container.appendChild(empty);
    }
    return;
  }

  // Show canvas (in case it was hidden before)
  catCtx.style.display = '';
  const existingEmpty = catCtx.parentElement.querySelector('.chart-empty');
  if (existingEmpty) existingEmpty.remove();

  // Read real colors from CSS variables at render time
  const style      = getComputedStyle(document.documentElement);
  const accentColor = style.getPropertyValue('--primary').trim() || '#4a4bd7';
  const labelColor  = style.getPropertyValue('--on-surface-variant').trim() || '#5a6062';
  const gridColor   = style.getPropertyValue('--surface-container-high').trim() || '#e5e9eb';

  window.categoryChartInst = new Chart(catCtx, {
    type: 'bar',
    data: {
      labels: sortedCats.map(c => c[0]),
      datasets: [{
        label: 'Spent',
        data: sortedCats.map(c => c[1]),
        backgroundColor: accentColor,
        borderRadius: 6,
        barThickness: 28
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: function(ctx) { return ' ' + formatCurrency(ctx.raw); }
          }
        }
      },
      scales: {
        x: { grid: { display: false }, ticks: { color: labelColor } },
        y: { grid: { color: gridColor }, ticks: { color: labelColor, callback: function(v) { return formatCurrency(v); } }, beginAtZero: true }
      }
    }
  });
}


/* ═══════════════════════════════════════════════════
   RENDER: STUDIO (Settings)
   ═══════════════════════════════════════════════════ */

function renderStudio() {
  const darkToggle      = document.getElementById('darkModeToggle');
  const currencySelect  = document.getElementById('currencySelect');
  const alertsToggle    = document.getElementById('alertsToggle');
  const biometricToggle = document.getElementById('biometricToggle');
  const budgetDesc      = document.getElementById('budgetSettingDesc');

  if (darkToggle)      darkToggle.checked     = state.darkMode;
  if (currencySelect)  currencySelect.value   = state.currency;
  if (alertsToggle)    alertsToggle.checked   = state.settings.alerts;
  if (biometricToggle) biometricToggle.checked = state.settings.biometric;
  if (budgetDesc)      budgetDesc.textContent = 'Current: ' + formatCurrency(state.monthlyBudget) + ' / month';
}

/* ═══════════════════════════════════════════════════
   SYNC UI → STATE on boot
   ═══════════════════════════════════════════════════ */

function syncAllUIToState() {
  renderStudio();
  syncCurrencyPrefixes();
}

function syncCurrencyPrefixes() {
  const sym = currencySymbols[state.currency] || '$';
  document.querySelectorAll('.currency-prefix').forEach(function(el) {
    el.textContent = sym;
  });
}

/* ═══════════════════════════════════════════════════
   THEME
   ═══════════════════════════════════════════════════ */

function applyTheme() {
  document.documentElement.setAttribute('data-theme', state.darkMode ? 'dark' : 'light');
}

function toggleDarkMode() {
  const toggle = document.getElementById('darkModeToggle');
  if (!toggle) return;
  state.darkMode = toggle.checked;
  applyTheme();
  saveState();
  showToast(state.darkMode ? 'Dark canvas activated' : 'Light canvas restored');
}

/* ═══════════════════════════════════════════════════
   CURRENCY
   The HTML calls setCurrency(this.value) — this is the correct handler.
   It saves state, re-renders everything, and updates all currency displays.
   ═══════════════════════════════════════════════════ */

function setCurrency(value) {
  if (!currencySymbols[value]) return;
  state.currency = value;
  saveState();
  renderAll();          // re-render all pages so amounts update everywhere
  showToast('Currency changed to ' + value);
}

/* ═══════════════════════════════════════════════════
   ALERTS TOGGLE (was missing — caused JS ReferenceError)
   ═══════════════════════════════════════════════════ */

function toggleAlerts() {
  const toggle = document.getElementById('alertsToggle');
  if (!toggle) return;
  state.settings.alerts = toggle.checked;
  saveState();
  showToast(state.settings.alerts ? 'Spending alerts enabled' : 'Spending alerts disabled');
}

/* ═══════════════════════════════════════════════════
   ADD EXPENSE MODAL
   ═══════════════════════════════════════════════════ */

function openAddExpense() {
  const modal = document.getElementById('addExpenseModal');
  modal.style.display = 'flex';
  requestAnimationFrame(function() { modal.classList.add('show'); });
  document.body.style.overflow = 'hidden';
  resetExpenseForm();
  syncCurrencyPrefixes();
}

function closeAddExpense() {
  const modal = document.getElementById('addExpenseModal');
  const sheet = modal.querySelector('.modal-sheet');
  sheet.style.transform = 'translateY(100%)';
  setTimeout(function() {
    modal.classList.remove('show');
    modal.style.display = '';
    sheet.style.transform = '';
    document.body.style.overflow = '';
  }, 350);
}

function setExpenseType(type) {
  state.expenseType = type;
  document.querySelectorAll('.type-toggle-btn').forEach(function(btn) {
    btn.classList.toggle('active', btn.dataset.type === type);
  });
  if (type === 'income') {
    document.getElementById('expenseCategory').value = 'Income';
  }
}

function setDateDefault() {
  const el = document.getElementById('expenseDate');
  if (el) el.value = new Date().toISOString().split('T')[0];
}

function resetExpenseForm() {
  const form = document.getElementById('expenseForm');
  if (!form) return;

  // Explicitly clear all form input fields
  document.getElementById('expenseAmount').value = '';
  document.getElementById('expenseName').value = '';
  document.getElementById('expenseCategory').value = '';
  document.getElementById('expenseNotes').value = '';
  
  // Reset type and date
  state.expenseType = 'expense';
  setExpenseType('expense');
  setDateDefault();
}

function handleAddExpense(e) {
  e.preventDefault();

  const amount   = parseFloat(document.getElementById('expenseAmount').value);
  const name     = document.getElementById('expenseName').value.trim();
  const category = document.getElementById('expenseCategory').value;
  const date     = document.getElementById('expenseDate').value;
  const notes    = document.getElementById('expenseNotes').value.trim();

  if (!amount || amount <= 0 || !name || !category || !date) return;

  const newTxn = {
    id:     getNextId(),
    name,
    category,
    amount,
    type:   state.expenseType,
    date,
    status: 'cleared',
    notes
  };

  // 1. Add transaction to state and persist
  state.transactions.unshift(newTxn);
  saveState();

  // 2. Reset form using form.reset() — clears all native inputs in one call
  const form = document.getElementById('expenseForm');
  if (form) form.reset();

  // Also reset internal type/date state back to defaults
  state.expenseType = 'expense';
  setExpenseType('expense');
  setDateDefault();

  // 3. Close modal
  closeAddExpense();

  // 4. Recalculate balance (income - expenses) and update entire UI
  const totals = getFinancialTotals(state.transactions);
  // totals.balance = totals.income - totals.expenses (already computed inside helper)
  renderAll(); // re-renders home balance, ledger net, insights, studio

  // 5. Show confirmation toast
  showToast((newTxn.type === 'income' ? 'Income' : 'Expense') + ' added: ' + formatCurrency(amount));
}

/* ═══════════════════════════════════════════════════
   DELETE TRANSACTION
   ═══════════════════════════════════════════════════ */

function deleteTransaction(id, event) {
  event.stopPropagation();
  state.transactions = state.transactions.filter(t => t.id !== id);
  saveState();
  renderAll();
  showToast('Transaction removed');
}

/* ═══════════════════════════════════════════════════
   BUDGET SETTINGS MODAL
   ═══════════════════════════════════════════════════ */

function openBudgetSetting() {
  document.getElementById('budgetInput').value = state.monthlyBudget;
  syncCurrencyPrefixes();
  const modal = document.getElementById('budgetModal');
  modal.style.display = 'flex';
  requestAnimationFrame(function() { modal.classList.add('show'); });
  document.body.style.overflow = 'hidden';
}

function closeBudgetModal() {
  const modal = document.getElementById('budgetModal');
  const sheet = modal.querySelector('.modal-sheet');
  sheet.style.transform = 'translateY(100%)';
  setTimeout(function() {
    modal.classList.remove('show');
    modal.style.display = '';
    sheet.style.transform = '';
    document.body.style.overflow = '';
  }, 350);
}

function saveBudget(e) {
  e.preventDefault();
  const val = parseFloat(document.getElementById('budgetInput').value);
  if (!val || val <= 0) return;

  // 1. Save new budget to state and persist
  state.monthlyBudget = val;
  saveState();

  // 2. Reset form using form.reset() — clears the budget input field
  const budgetForm = document.getElementById('budgetForm');
  if (budgetForm) budgetForm.reset();

  // 3. Close modal
  closeBudgetModal();

  // 4. Recalculate balance (income - expenses) and update entire UI
  const totals = getFinancialTotals(state.transactions);
  // totals.balance = totals.income - totals.expenses (derived reactively)
  renderAll(); // re-renders home balance bar, insights ring, studio budget desc

  // 5. Show confirmation toast
  showToast('Budget updated to ' + formatCurrency(val));
}

/* ═══════════════════════════════════════════════════
   RESET DATA
   ═══════════════════════════════════════════════════ */

function confirmResetData() {
  document.getElementById('confirmDialog').classList.add('show');
}

function closeConfirmDialog() {
  document.getElementById('confirmDialog').classList.remove('show');
}

function resetAllData() {
  state.transactions  = [];
  state.monthlyBudget = 1500;
  state.currency      = 'USD';
  state.darkMode      = false;
  state.settings      = { alerts: true, biometric: false };

  // Wipe all atelier keys from localStorage
  Object.keys(localStorage)
    .filter(function(k) { return k.startsWith('atelier_'); })
    .forEach(function(k) { localStorage.removeItem(k); });

  saveState();
  applyTheme();
  syncAllUIToState();
  renderAll();
  closeConfirmDialog();
  showToast('All data has been reset');
}

/* ═══════════════════════════════════════════════════
   TOAST
   ═══════════════════════════════════════════════════ */

function showToast(msg) {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = msg;
  toast.classList.add('show');
  clearTimeout(toast._timer);
  toast._timer = setTimeout(function() { toast.classList.remove('show'); }, 2800);
}

/* ═══════════════════════════════════════════════════
   GLOBAL EVENT LISTENERS
   ═══════════════════════════════════════════════════ */

document.addEventListener('click', function(e) {
  if (e.target.classList.contains('modal-overlay')) {
    if (e.target.id === 'addExpenseModal') closeAddExpense();
    if (e.target.id === 'budgetModal')     closeBudgetModal();
  }
  if (e.target.classList.contains('confirm-dialog')) {
    closeConfirmDialog();
  }
});

document.addEventListener('keydown', function(e) {
  if (e.key === 'Escape') {
    closeAddExpense();
    closeBudgetModal();
    closeConfirmDialog();
  }
});

/* ═══════════════════════════════════════════════════
   HASH ROUTING
   ═══════════════════════════════════════════════════ */

function handleHashChange() {
  const hash = window.location.hash.replace('#', '') || 'home';
  const validPages = ['home', 'ledger', 'insights', 'studio'];
  if (validPages.includes(hash)) navigateTo(hash);
}

window.addEventListener('hashchange', handleHashChange);

// Wrap navigateTo to also keep URL in sync
var _navigateTo = navigateTo;
navigateTo = function(page) {
  if (window.location.hash !== '#' + page) {
    history.replaceState(null, '', '#' + page);
  }
  _navigateTo(page);
};

/* ═══════════════════════════════════════════════════
   MODERN DATE WIDGET (Horizon Calendar)
   ═══════════════════════════════════════════════════ */

var calOffset = 0; // days offset from today

function renderModernCalendar(offsetOverride) {
  if (offsetOverride !== undefined) {
    calOffset = offsetOverride;
  }
  
  var now = new Date();
  
  // Set greeting
  var hours = now.getHours();
  var greeting = 'Good evening,';
  if (hours < 12) greeting = 'Good morning,';
  else if (hours < 17) greeting = 'Good afternoon,';
  document.getElementById('greetingTitle').textContent = greeting;
  
  // Current Date text (e.g. Monday, October 24)
  var options = { weekday: 'long', month: 'long', day: 'numeric' };
  document.getElementById('greetingDate').textContent = now.toLocaleDateString('en-US', options);

  // Render horizontal date strip (7 days)
  var baseDate = new Date();
  baseDate.setDate(now.getDate() + calOffset);
  
  var html = '';
  // Show 3 days before, base date, and 3 days after
  for (var i = -3; i <= 3; i++) {
    var d = new Date(baseDate);
    d.setDate(baseDate.getDate() + i);
    
    var isToday = (d.toDateString() === now.toDateString());
    var isSelected = (i === 0);
    
    var dayName = d.toLocaleDateString('en-US', { weekday: 'short' });
    var dayNum = d.getDate();
    
    var cls = 'horizon-day';
    if (isToday) cls += ' today';
    if (isSelected && !isToday) cls += ' selected';
    
    html += '<div class="' + cls + '">';
    html += '<div class="horizon-day-name">' + dayName + '</div>';
    html += '<div class="horizon-day-num">' + dayNum + '</div>';
    html += '</div>';
  }
  
  document.getElementById('horizonCalendar').innerHTML = html;
}

function shiftHorizon(direction) {
  calOffset += direction * 7;
  renderModernCalendar();
}

/* ═══════════════════════════════════════════════════
   BOOT
   ═══════════════════════════════════════════════════ */

document.addEventListener('DOMContentLoaded', function() {
  init();
  handleHashChange();
  renderModernCalendar(); // draw current date strip on load
  registerServiceWorker();
});

function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;

  window.addEventListener('load', function() {
    navigator.serviceWorker.register('./service-worker.js').catch(function(err) {
      console.warn('Service worker registration failed:', err);
    });
  });
}