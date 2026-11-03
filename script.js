document.addEventListener('DOMContentLoaded', () => {
  const STORAGE_KEY = 'finora.personal.entries.v1';
  const BUDGET_STORAGE_KEY = 'finora.personal.budgets.v1';
  const BALANCE_STORAGE_KEY = 'finora.personal.starting-balance.v1';
  const CURRENCY_KEY = 'finora.personal.currency.v1';
  const COLORS = ['#b5f36d', '#70bed6', '#e8ba72', '#ff8478', '#9c8ce8', '#67d8a2', '#dc91c7', '#8ca7a0', '#c4cc76', '#6f8fe4'];
  const CATEGORIES = {
    Food: '◉', Home: '⌂', Transport: '↗', Shopping: '◇', Health: '+',
    Bills: '▤', Education: '▱', Fun: '✳', Work: '↗', Other: '·',
  };
  const $ = (selector) => document.querySelector(selector);
  const dialog = $('#entry-dialog');
  const form = $('#entry-form');
  const currencySelect = $('#currency');
  const periodSelect = $('#period');
  const budgetDialog = $('#budget-dialog');
  const budgetForm = $('#budget-form');
  const balanceDialog = $('#balance-dialog');
  const balanceForm = $('#balance-form');
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.setAttribute('role', 'status');
  toast.setAttribute('aria-live', 'polite');
  document.body.append(toast);
  let entries = loadEntries();
  let budgets = loadBudgets();
  let startingBalance = loadStartingBalance();
  let currency = loadCurrency();
  let toastTimer;

  currencySelect.value = currency;
  form.elements.date.value = localDateValue(new Date());
  setGreeting();
  render();
  initNavigationSlider();
  initCursor();
  initThreeBackground();
  initWelcome();

  document.querySelectorAll('.add-trigger').forEach((button) => {
    button.addEventListener('click', () => {
      form.reset();
      form.elements.type.value = 'expense';
      form.elements.date.value = localDateValue(new Date());
      setEntryType('expense');
      dialog.showModal();
      window.setTimeout(() => form.elements.title.focus(), 50);
    });
  });

  $('.close-button').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) dialog.close();
  });

  document.querySelectorAll('.type-button').forEach((button) => {
    button.addEventListener('click', () => setEntryType(button.dataset.type));
  });

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const data = new FormData(form);
    const amount = Number(data.get('amount'));
    const amountMinor = Math.round(amount * 100);
    const title = String(data.get('title') || '').trim();
    const date = String(data.get('date') || '');

    if (!title || !Number.isSafeInteger(amountMinor) || amountMinor <= 0 || !isValidDate(date)) {
      showToast('Check the title, amount, and date, then try again.');
      return;
    }

    const entry = {
      id: createId(),
      title,
      amount: amountMinor,
      type: data.get('type') === 'income' ? 'income' : 'expense',
      category: String(data.get('category') || 'Other'),
      date,
    };
    const nextEntries = [entry, ...entries];
    if (!saveEntries(nextEntries)) return;
    entries = nextEntries;
    dialog.close();
    render();
    showToast(`${entry.type === 'income' ? 'Income' : 'Expense'} saved.`);
  });

  currencySelect.addEventListener('change', () => {
    try {
      localStorage.setItem(CURRENCY_KEY, currencySelect.value);
      currency = currencySelect.value;
      render();
    } catch (error) {
      showToast('Could not save your currency preference in this browser.');
    }
  });

  periodSelect.addEventListener('change', render);
  $('#entry-search').addEventListener('input', renderTransactions);
  $('#type-filter').addEventListener('change', renderTransactions);

  document.querySelectorAll('.side-link[data-entry-filter]').forEach((link) => {
    link.addEventListener('click', () => {
      $('#type-filter').value = link.dataset.entryFilter;
      renderTransactions();
    });
  });
  document.querySelectorAll('.side-link:not([data-entry-filter])').forEach((link) => {
    link.addEventListener('click', () => {
      const target = link.getAttribute('href');
      if (target === '#activity') {
        $('#type-filter').value = 'all';
        $('#entry-search').value = '';
        renderTransactions();
      }
    });
  });

  document.querySelectorAll('.side-link').forEach((link) => {
    link.addEventListener('click', () => {
      document.querySelectorAll('.side-link').forEach((item) => item.classList.remove('active'));
      link.classList.add('active');
    });
  });

  $('#add-budget').addEventListener('click', () => {
    budgetForm.reset();
    budgetDialog.showModal();
  });
  $('.budget-close').addEventListener('click', () => budgetDialog.close());
  budgetDialog.addEventListener('click', (event) => {
    if (event.target === budgetDialog) budgetDialog.close();
  });
  budgetForm.addEventListener('submit', (event) => {
    event.preventDefault();
    const data = new FormData(budgetForm);
    const amount = Number(data.get('amount'));
    const amountMinor = Math.round(amount * 100);
    const category = String(data.get('category') || 'Other');
    if (!Number.isSafeInteger(amountMinor) || amountMinor <= 0) {
      showToast('Enter a budget amount greater than zero.');
      return;
    }
    const nextBudgets = [...budgets.filter((budget) => budget.category !== category), { category, amount: amountMinor }];
    if (!saveBudgets(nextBudgets)) return;
    budgets = nextBudgets;
    budgetDialog.close();
    render();
    showToast(`${category} budget saved.`);
  });
  $('#budget-list').addEventListener('click', (event) => {
    const button = event.target.closest('[data-remove-budget]');
    if (!button) return;
    const nextBudgets = budgets.filter((budget) => budget.category !== button.dataset.removeBudget);
    if (!saveBudgets(nextBudgets)) return;
    budgets = nextBudgets;
    render();
    showToast('Budget removed.');
  });

  $('#edit-balance').addEventListener('click', () => {
    balanceForm.reset();
    balanceForm.elements.amount.value = (startingBalance / 100).toFixed(2);
    balanceDialog.showModal();
  });
  $('.balance-close').addEventListener('click', () => balanceDialog.close());
  balanceDialog.addEventListener('click', (event) => {
    if (event.target === balanceDialog) balanceDialog.close();
  });
  balanceForm.addEventListener('submit', (event) => {
    event.preventDefault();
    const amount = Number(new FormData(balanceForm).get('amount'));
    const amountMinor = Math.round(amount * 100);
    if (!Number.isSafeInteger(amountMinor) || amountMinor < 0) {
      showToast('Enter a valid starting balance.');
      return;
    }
    if (!saveStartingBalance(amountMinor)) return;
    startingBalance = amountMinor;
    balanceDialog.close();
    render();
    showToast('Starting balance saved.');
  });

  $('#transaction-list').addEventListener('click', (event) => {
    const button = event.target.closest('[data-delete-id]');
    if (!button) return;
    const entry = entries.find((item) => item.id === button.dataset.deleteId);
    if (!entry) return;
    const nextEntries = entries.filter((item) => item.id !== entry.id);
    if (!saveEntries(nextEntries)) return;
    entries = nextEntries;
    render();
    showToast('Entry removed.');
  });

  function loadEntries() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (!saved) return [];
      const parsed = JSON.parse(saved);
      if (!Array.isArray(parsed)) throw new Error('Stored entries are not a list.');
      return parsed.filter((item) =>
        item && typeof item.id === 'string' &&
        typeof item.title === 'string' && item.title.length > 0 &&
        Number.isSafeInteger(item.amount) && item.amount > 0 &&
        (item.type === 'income' || item.type === 'expense') &&
        typeof item.category === 'string' && isValidDate(item.date),
      );
    } catch (error) {
      showToast('Saved entries could not be read. Your browser data may be damaged.');
      return [];
    }
  }

  function loadCurrency() {
    try {
      const saved = localStorage.getItem(CURRENCY_KEY);
      return ['NPR', 'USD', 'INR'].includes(saved) ? saved : 'NPR';
    } catch (error) {
      showToast('Could not read the saved currency preference.');
      return 'NPR';
    }
  }

  function loadBudgets() {
    try {
      const saved = localStorage.getItem(BUDGET_STORAGE_KEY);
      if (!saved) return [];
      const parsed = JSON.parse(saved);
      if (!Array.isArray(parsed)) throw new Error('Stored budgets are not a list.');
      return parsed.filter((item) =>
        item && typeof item.category === 'string' &&
        Number.isSafeInteger(item.amount) && item.amount > 0,
      );
    } catch (error) {
      showToast('Saved budgets could not be read. Your browser data may be damaged.');
      return [];
    }
  }

  function loadStartingBalance() {
    try {
      const saved = localStorage.getItem(BALANCE_STORAGE_KEY);
      if (saved === null) return 0;
      const amount = Number(saved);
      if (!Number.isSafeInteger(amount) || amount < 0) throw new Error('Stored starting balance is invalid.');
      return amount;
    } catch (error) {
      showToast('Your saved starting balance could not be read.');
      return 0;
    }
  }

  function saveEntries(nextEntries) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(nextEntries));
      return true;
    } catch (error) {
      showToast('Could not save this entry. Check browser storage and try again.');
      return false;
    }
  }

  function saveBudgets(nextBudgets) {
    try {
      localStorage.setItem(BUDGET_STORAGE_KEY, JSON.stringify(nextBudgets));
      return true;
    } catch (error) {
      showToast('Could not save this budget. Check browser storage and try again.');
      return false;
    }
  }

  function saveStartingBalance(amount) {
    try {
      localStorage.setItem(BALANCE_STORAGE_KEY, String(amount));
      return true;
    } catch (error) {
      showToast('Could not save your balance. Check browser storage and try again.');
      return false;
    }
  }

  function setEntryType(type) {
    form.elements.type.value = type;
    document.querySelectorAll('.type-button').forEach((button) => {
      button.classList.toggle('selected', button.dataset.type === type);
    });
    $('#dialog-title').textContent = type === 'income' ? 'Add income' : 'Add an expense';
  }

  function render() {
    const visible = entriesInPeriod();
    const allIncome = entries.filter((entry) => entry.type === 'income').reduce((sum, entry) => sum + entry.amount, 0);
    const allExpenses = entries.filter((entry) => entry.type === 'expense').reduce((sum, entry) => sum + entry.amount, 0);
    const income = visible.filter((entry) => entry.type === 'income').reduce((sum, entry) => sum + entry.amount, 0);
    const expenses = visible.filter((entry) => entry.type === 'expense').reduce((sum, entry) => sum + entry.amount, 0);
    const saved = income - expenses;
    const rate = income > 0 ? Math.round((saved / income) * 100) : null;

    $('#balance-value').textContent = formatMoney(startingBalance + allIncome - allExpenses);
    $('#balance-note').textContent = startingBalance > 0 ? 'Starting amount + all-time entries' : 'Set your starting amount to begin';
    $('#income-value').textContent = formatMoney(income);
    $('#expense-value').textContent = formatMoney(expenses);
    $('#saved-value').textContent = formatMoney(saved);
    $('#saved-rate').textContent = rate === null ? 'Add income to see your savings rate' : `${rate}% of your income kept`;
    $('#save-progress').style.width = `${Math.max(0, Math.min(rate || 0, 100))}%`;
    renderFlowChart();
    renderSpendingChart();
    renderCategories(visible.filter((entry) => entry.type === 'expense'));
    renderBudgets();
    renderInsight(visible);
    renderTransactions();
  }

  function entriesInPeriod() {
    if (periodSelect.value === 'all') return entries;
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    return entries.filter((entry) => {
      const date = parseLocalDate(entry.date);
      return date.getFullYear() === year && date.getMonth() === month;
    });
  }

  function formatMoney(minorUnits) {
    const amount = (minorUnits / 100).toLocaleString(undefined, {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    });
    const symbol = currency === 'NPR' ? 'Rs' : currency === 'INR' ? '₹' : '$';
    return `${symbol} ${amount}`;
  }

  function renderFlowChart() {
    const now = new Date();
    const months = [];
    for (let offset = 5; offset >= 0; offset -= 1) {
      const date = new Date(now.getFullYear(), now.getMonth() - offset, 1);
      months.push({
        date,
        label: date.toLocaleDateString(undefined, { month: 'short' }),
        income: 0,
        expense: 0,
      });
    }
    entries.forEach((entry) => {
      const date = parseLocalDate(entry.date);
      const bucket = months.find((month) =>
        month.date.getFullYear() === date.getFullYear() && month.date.getMonth() === date.getMonth(),
      );
      if (bucket) bucket[entry.type] += entry.amount;
    });

    $('#chart-months').replaceChildren(...months.map((month) => {
      const label = document.createElement('span');
      label.textContent = month.label.toUpperCase();
      return label;
    }));

    const hasData = months.some((month) => month.income || month.expense);
    $('#flow-empty').hidden = hasData;
    const svg = $('#flow-svg');
    svg.classList.toggle('visible', hasData);
    svg.replaceChildren();
    if (!hasData) return;

    const max = Math.max(1, ...months.flatMap((month) => [month.income, month.expense]));
    const points = (key) => months.map((month, index) => {
      const x = 14 + (index * 672) / (months.length - 1);
      const y = 190 - (month[key] / max) * 164;
      return [x, y];
    });
    const namespace = 'http://www.w3.org/2000/svg';
    const defs = svgElement('defs', namespace);
    const gradientIn = svgElement('linearGradient', namespace, { id: 'fill-in', x1: '0', x2: '0', y1: '0', y2: '1' });
    gradientIn.append(svgElement('stop', namespace, { offset: '0%', 'stop-color': '#b5f36d', 'stop-opacity': '.15' }));
    gradientIn.append(svgElement('stop', namespace, { offset: '100%', 'stop-color': '#b5f36d', 'stop-opacity': '0' }));
    const gradientOut = svgElement('linearGradient', namespace, { id: 'fill-out', x1: '0', x2: '0', y1: '0', y2: '1' });
    gradientOut.append(svgElement('stop', namespace, { offset: '0%', 'stop-color': '#ff8478', 'stop-opacity': '.12' }));
    gradientOut.append(svgElement('stop', namespace, { offset: '100%', 'stop-color': '#ff8478', 'stop-opacity': '0' }));
    defs.append(gradientIn, gradientOut);
    svg.append(defs);

    [35, 85, 135, 185].forEach((y) => svg.append(svgElement('line', namespace, {
      x1: '0', y1: String(y), x2: '700', y2: String(y), class: 'chart-grid-line',
    })));

    ['income', 'expense'].forEach((key) => {
      const coords = points(key);
      const linePath = coords.map(([x, y], index) => `${index ? 'L' : 'M'} ${x} ${y}`).join(' ');
      const areaPath = `${linePath} L 686 199 L 14 199 Z`;
      svg.append(svgElement('path', namespace, { d: areaPath, class: key === 'income' ? 'chart-fill-in' : 'chart-fill-out' }));
      svg.append(svgElement('path', namespace, { d: linePath, class: key === 'income' ? 'chart-line-in' : 'chart-line-out' }));
      coords.forEach(([cx, cy]) => svg.append(svgElement('circle', namespace, {
        cx: String(cx), cy: String(cy), r: '3', fill: key === 'income' ? '#b5f36d' : '#ff8478',
      })));
    });
  }

  function renderSpendingChart() {
    const now = new Date();
    const months = [];
    for (let offset = 5; offset >= 0; offset -= 1) {
      const date = new Date(now.getFullYear(), now.getMonth() - offset, 1);
      months.push({
        date,
        label: date.toLocaleDateString(undefined, { month: 'short' }),
        expense: 0,
      });
    }

    entries.forEach((entry) => {
      if (entry.type !== 'expense') return;
      const date = parseLocalDate(entry.date);
      const bucket = months.find((month) =>
        month.date.getFullYear() === date.getFullYear() && month.date.getMonth() === date.getMonth(),
      );
      if (bucket) bucket.expense += entry.amount;
    });

    const total = months.reduce((sum, month) => sum + month.expense, 0);
    $('#spend-chart-total').textContent = formatMoney(total);
    $('#spend-months').replaceChildren(...months.map((month) => {
      const label = document.createElement('span');
      label.textContent = month.label.toUpperCase();
      return label;
    }));

    const hasExpenses = months.some((month) => month.expense > 0);
    $('#spend-empty').hidden = hasExpenses;
    const svg = $('#spend-svg');
    svg.classList.toggle('visible', hasExpenses);
    svg.replaceChildren();
    if (!hasExpenses) return;

    const namespace = 'http://www.w3.org/2000/svg';
    const defs = svgElement('defs', namespace);
    const fill = svgElement('linearGradient', namespace, {
      id: 'spend-bar-fill',
      x1: '0',
      x2: '0',
      y1: '0',
      y2: '1',
    });
    fill.append(svgElement('stop', namespace, {
      offset: '0%',
      'stop-color': '#ff9a86',
      'stop-opacity': '.88',
    }));
    fill.append(svgElement('stop', namespace, {
      offset: '100%',
      'stop-color': '#ff665f',
      'stop-opacity': '.28',
    }));
    defs.append(fill);
    svg.append(defs);
    const max = Math.max(...months.map((month) => month.expense));
    [35, 75, 115, 155].forEach((y) => svg.append(svgElement('line', namespace, {
      x1: '0', y1: String(y), x2: '700', y2: String(y), class: 'chart-grid-line',
    })));

    months.forEach((month, index) => {
      const x = 35 + index * 112;
      const height = month.expense > 0 ? Math.max(3, (month.expense / max) * 142) : 0;
      if (!height) return;
      const group = svgElement('g', namespace, {
        class: 'spend-bar-group',
        tabindex: '0',
        'aria-label': `${month.label}: ${formatMoney(month.expense)} spent`,
      });
      const bar = svgElement('rect', namespace, {
        x: String(x),
        y: String(166 - height),
        width: '48',
        height: String(height),
        rx: '4',
        class: 'spend-bar',
      });
      const title = svgElement('title', namespace);
      title.textContent = `${month.label}: ${formatMoney(month.expense)} spent`;
      bar.append(title);
      group.append(bar);
      group.append(svgElement('circle', namespace, {
        cx: String(x + 24),
        cy: String(166 - height),
        r: '2.5',
        class: 'spend-bar-cap',
      }));
      svg.append(group);
    });
  }

  function renderCategories(expenses) {
    const totals = new Map();
    expenses.forEach((entry) => totals.set(entry.category, (totals.get(entry.category) || 0) + entry.amount));
    const categories = [...totals.entries()].sort((a, b) => b[1] - a[1]);
    const total = categories.reduce((sum, item) => sum + item[1], 0);
    $('#donut-total').textContent = formatMoney(total);
    const svg = $('#category-donut');
    svg.replaceChildren();
    const namespace = 'http://www.w3.org/2000/svg';
    const radius = 58;
    const circumference = 2 * Math.PI * radius;
    svg.append(svgElement('circle', namespace, { cx: '80', cy: '80', r: String(radius), class: 'donut-track' }));
    if (total > 0) {
      let offset = 0;
      categories.forEach(([, amount], index) => {
        const segment = circumference * amount / total;
        svg.append(svgElement('circle', namespace, {
          cx: '80', cy: '80', r: String(radius), class: 'donut-segment',
          stroke: COLORS[index % COLORS.length],
          'stroke-dasharray': `${Math.max(0, segment - 2)} ${circumference - Math.max(0, segment - 2)}`,
          'stroke-dashoffset': String(-offset),
        }));
        offset += segment;
      });
    }
    const legend = $('#category-legend');
    legend.replaceChildren();
    if (!categories.length) {
      const empty = document.createElement('div');
      empty.className = 'empty-categories';
      empty.textContent = 'Your categories will appear here after you add expenses.';
      legend.append(empty);
      return;
    }
    categories.slice(0, 5).forEach(([name, amount], index) => {
      const row = document.createElement('div');
      row.className = 'category-row';
      const dot = document.createElement('span');
      dot.className = 'category-dot';
      dot.style.backgroundColor = COLORS[index % COLORS.length];
      const label = document.createElement('span');
      label.className = 'category-name';
      label.textContent = name;
      const value = document.createElement('span');
      value.className = 'category-amount';
      value.textContent = formatMoney(amount);
      row.append(dot, label, value);
      legend.append(row);
    });
  }

  function renderBudgets() {
    const currentMonth = new Date();
    const expenses = entries.filter((entry) => {
      const date = parseLocalDate(entry.date);
      return entry.type === 'expense' &&
        date.getFullYear() === currentMonth.getFullYear() &&
        date.getMonth() === currentMonth.getMonth();
    });
    const container = $('#budget-list');
    container.replaceChildren();
    if (!budgets.length) {
      const empty = document.createElement('div');
      empty.className = 'empty-budget';
      empty.textContent = 'Set a monthly limit for a category to track how you’re doing.';
      container.append(empty);
      return;
    }
    budgets.forEach((budget) => {
      const spent = expenses.filter((entry) => entry.category === budget.category)
        .reduce((sum, entry) => sum + entry.amount, 0);
      const ratio = spent / budget.amount;
      const item = document.createElement('div');
      item.className = 'budget-item';
      const top = document.createElement('div');
      top.className = 'budget-item-top';
      const category = document.createElement('span');
      category.className = 'budget-category';
      category.textContent = budget.category;
      const numbers = document.createElement('span');
      numbers.className = 'budget-numbers';
      numbers.textContent = `${formatMoney(spent)} / ${formatMoney(budget.amount)}`;
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'budget-remove';
      remove.dataset.removeBudget = budget.category;
      remove.setAttribute('aria-label', `Remove ${budget.category} budget`);
      remove.textContent = '×';
      top.append(category, numbers, remove);
      const track = document.createElement('div');
      track.className = 'budget-track';
      const progress = document.createElement('span');
      progress.style.width = `${Math.max(0, Math.min(100, ratio * 100))}%`;
      if (ratio >= 1) progress.classList.add('over-limit');
      else if (ratio >= 0.8) progress.classList.add('near-limit');
      track.append(progress);
      item.append(top, track);
      container.append(item);
    });
  }

  function renderInsight(visible) {
    const expenses = visible.filter((entry) => entry.type === 'expense');
    const income = visible.filter((entry) => entry.type === 'income').reduce((sum, entry) => sum + entry.amount, 0);
    const total = expenses.reduce((sum, entry) => sum + entry.amount, 0);
    const categoryTotals = new Map();
    expenses.forEach((entry) => categoryTotals.set(entry.category, (categoryTotals.get(entry.category) || 0) + entry.amount));
    const topCategory = [...categoryTotals.entries()].sort((a, b) => b[1] - a[1])[0];
    if (!entries.length) {
      $('#insight-title').textContent = 'Your first insight is waiting.';
      $('#insight-copy').textContent = 'Add your income and spending to see a summary based on your own entries.';
      return;
    }
    if (!visible.length) {
      $('#insight-title').textContent = 'No entries for this period yet.';
      $('#insight-copy').textContent = 'Choose “All time” or add an entry for this month to see your personal summary.';
      return;
    }
    if (topCategory) {
      const share = total > 0 ? Math.round((topCategory[1] / total) * 100) : 0;
      $('#insight-title').textContent = `${topCategory[0]} is your top spending category.`;
      $('#insight-copy').textContent = `You recorded ${formatMoney(topCategory[1])} in ${topCategory[0]} (${share}% of this period’s expenses). This is based on your entries, not a financial recommendation.`;
      return;
    }
    $('#insight-title').textContent = 'Income recorded. No expenses yet.';
    $('#insight-copy').textContent = income > 0
      ? `You recorded ${formatMoney(income)} in income for this period. Add expenses to see how your spending compares.`
      : 'Add income or expenses to see a summary based on your own entries.';
  }

  function renderTransactions() {
    const container = $('#transaction-list');
    container.replaceChildren();
    const query = $('#entry-search').value.trim().toLocaleLowerCase();
    const type = $('#type-filter').value;
    const recent = entriesInPeriod()
      .filter((entry) => type === 'all' || entry.type === type)
      .filter((entry) => !query || `${entry.title} ${entry.category}`.toLocaleLowerCase().includes(query))
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 8);
    if (!recent.length) {
      const empty = document.createElement('div');
      empty.className = 'empty-transactions';
      const icon = document.createElement('span');
      icon.className = 'empty-icon';
      icon.textContent = '+';
      const title = document.createElement('strong');
      title.textContent = 'No entries yet';
      const message = document.createElement('span');
      message.textContent = query || type !== 'all'
        ? 'No entries match those filters.'
        : 'Add your first income or expense to see your money activity here.';
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'button button-secondary add-trigger';
      button.textContent = 'Add your first entry';
      button.hidden = Boolean(query) || type !== 'all';
      button.addEventListener('click', () => {
        form.reset();
        form.elements.type.value = 'expense';
        form.elements.date.value = localDateValue(new Date());
        setEntryType('expense');
        dialog.showModal();
        window.setTimeout(() => form.elements.title.focus(), 50);
      });
      empty.append(icon, title, message, button);
      container.append(empty);
      return;
    }

    recent.forEach((entry, index) => {
      const row = document.createElement('div');
      row.className = 'transaction-row';
      row.style.animationDelay = `${Math.min(index, 6) * 30}ms`;
      const detail = document.createElement('div');
      detail.className = 'entry-detail';
      const icon = document.createElement('span');
      icon.className = 'entry-icon';
      icon.textContent = CATEGORIES[entry.category] || '·';
      const title = document.createElement('span');
      title.className = 'entry-title';
      title.textContent = entry.title;
      detail.append(icon, title);
      const category = document.createElement('span');
      category.className = 'entry-category';
      category.textContent = entry.category;
      const date = document.createElement('span');
      date.className = 'entry-date';
      date.textContent = parseLocalDate(entry.date).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: '2-digit' });
      const amount = document.createElement('span');
      amount.className = `entry-amount${entry.type === 'income' ? ' income' : ''}`;
      amount.textContent = `${entry.type === 'income' ? '+' : '−'} ${formatMoney(entry.amount)}`;
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'delete-entry';
      remove.dataset.deleteId = entry.id;
      remove.setAttribute('aria-label', `Delete ${entry.title}`);
      remove.title = 'Delete entry';
      remove.textContent = '×';
      row.append(detail, category, date, amount, remove);
      container.append(row);
    });
  }

  function svgElement(tag, namespace, attributes = {}) {
    const element = document.createElementNS(namespace, tag);
    Object.entries(attributes).forEach(([key, value]) => element.setAttribute(key, value));
    return element;
  }

  function localDateValue(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  function parseLocalDate(value) {
    const [year, month, day] = value.split('-').map(Number);
    return new Date(year, month - 1, day);
  }

  function isValidDate(value) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const date = parseLocalDate(value);
    return localDateValue(date) === value;
  }

  function createId() {
    return globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  function showToast(message) {
    toast.textContent = message;
    toast.classList.add('visible');
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => toast.classList.remove('visible'), 3200);
  }

  function setGreeting() {
    const hour = new Date().getHours();
    const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
    $('#greeting').firstChild.textContent = `${greeting}, Rijan `;
  }

  function initWelcome() {
    const screen = $('#welcome-screen');
    const enter = $('#welcome-enter');
    const welcomeKey = 'finora.welcome.seen.v1';
    try {
      if (sessionStorage.getItem(welcomeKey) === 'true') return;
      sessionStorage.setItem(welcomeKey, 'true');
    } catch (error) {
      console.warn('FINORA could not remember the welcome screen for this tab:', error);
    }
    const stopScene = initWelcomeScene();
    let dismissed = false;
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') dismiss();
    };
    const dismiss = () => {
      if (dismissed) return;
      dismissed = true;
      document.removeEventListener('keydown', handleKeyDown);
      screen.classList.add('is-leaving');
      screen.setAttribute('aria-hidden', 'true');
      document.body.classList.remove('welcome-open');
      stopScene();
      window.setTimeout(() => screen.remove(), 750);
    };

    screen.setAttribute('aria-hidden', 'false');
    screen.classList.add('is-visible');
    document.body.classList.add('welcome-open');
    enter.addEventListener('click', dismiss);
    document.addEventListener('keydown', handleKeyDown);
    window.setTimeout(() => enter.focus(), 450);
  }

  function initWelcomeScene() {
    const canvas = $('#welcome-scene');
    if (!window.THREE || !canvas) return () => {};
    let renderer;
    try {
      renderer = new window.THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
    } catch (error) {
      console.error('FINORA welcome 3D effect could not start:', error);
      return () => {};
    }

    const THREE = window.THREE;
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 40);
    camera.position.z = 5.2;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    renderer.setSize(230, 230, false);
    renderer.setClearColor(0x000000, 0);

    const coreMaterial = new THREE.MeshStandardMaterial({
      color: 0x9ece64,
      emissive: 0x365820,
      emissiveIntensity: 1.2,
      metalness: 0.72,
      roughness: 0.27,
      flatShading: true,
    });
    const core = new THREE.Mesh(new THREE.IcosahedronGeometry(0.83, 2), coreMaterial);
    scene.add(core);
    const shell = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.98, 1),
      new THREE.MeshBasicMaterial({ color: 0xc6ff83, wireframe: true, transparent: true, opacity: 0.18 }),
    );
    scene.add(shell);

    const orbitMaterial = new THREE.MeshBasicMaterial({ color: 0x91ce67, transparent: true, opacity: 0.46 });
    const orbitA = new THREE.Mesh(new THREE.TorusGeometry(1.38, 0.008, 5, 120), orbitMaterial);
    orbitA.rotation.set(0.8, 0.25, -0.5);
    const orbitB = new THREE.Mesh(
      new THREE.TorusGeometry(1.22, 0.006, 5, 120),
      new THREE.MeshBasicMaterial({ color: 0x70bed6, transparent: true, opacity: 0.36 }),
    );
    orbitB.rotation.set(-0.45, 0.5, 0.8);
    scene.add(orbitA, orbitB);
    scene.add(new THREE.AmbientLight(0xb7e99d, 1.35));
    const keyLight = new THREE.PointLight(0xd5ffab, 24, 9);
    keyLight.position.set(1.7, 2.2, 3);
    scene.add(keyLight);

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let frame = 0;
    let running = true;
    const draw = () => {
      if (!running) return;
      if (!reducedMotion) {
        core.rotation.y += 0.004;
        core.rotation.x += 0.0015;
        shell.rotation.y -= 0.0018;
        orbitA.rotation.z += 0.0015;
        orbitB.rotation.x += 0.001;
      }
      renderer.render(scene, camera);
      if (!reducedMotion) frame = window.requestAnimationFrame(draw);
    };
    draw();
    return () => {
      running = false;
      window.cancelAnimationFrame(frame);
      core.geometry.dispose();
      coreMaterial.dispose();
      shell.geometry.dispose();
      shell.material.dispose();
      orbitA.geometry.dispose();
      orbitMaterial.dispose();
      orbitB.geometry.dispose();
      orbitB.material.dispose();
      renderer.dispose();
    };
  }

  function initNavigationSlider() {
    const nav = document.querySelector('.sidebar nav.side-nav');
    if (!nav) return;
    const slider = document.createElement('span');
    slider.className = 'nav-slider';
    slider.setAttribute('aria-hidden', 'true');
    nav.prepend(slider);
    const links = [...nav.querySelectorAll('.side-link')];
    const hues = [86, 147, 195, 21, 42, 181, 270];
    const setActive = (link) => {
      const index = links.indexOf(link);
      if (index < 0) return;
      links.forEach((item) => item.classList.toggle('active', item === link));
      const hue = hues[index % hues.length];
      slider.style.setProperty('--slider-hue', String(hue));
      slider.style.transform = `translateY(${link.offsetTop}px)`;
      link.style.setProperty('--slider-color', `hsl(${hue} 76% 68%)`);
    };
    const current = links.find((link) => link.classList.contains('active')) || links[0];
    if (current) setActive(current);
    links.forEach((link) => {
      link.addEventListener('click', () => setActive(link));
    });
    window.addEventListener('resize', () => {
      const active = links.find((link) => link.classList.contains('active'));
      if (active) setActive(active);
    }, { passive: true });
  }

  function initCursor() {
    if (!window.matchMedia('(pointer: fine)').matches || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const dot = $('.cursor-dot');
    document.body.classList.add('cursor-ready');
    window.addEventListener('pointermove', (event) => {
      dot.style.transform = `translate3d(${event.clientX - 4}px, ${event.clientY - 4}px, 0)`;
    }, { passive: true });
  }

  function initThreeBackground() {
    const canvas = $('#ambient');
    if (!window.THREE || !canvas || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let renderer;
    try {
      renderer = new window.THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
    } catch (error) {
      console.error('FINORA ambient 3D effect could not start:', error);
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    renderer.setSize(window.innerWidth, window.innerHeight);
    const scene = new window.THREE.Scene();
    const camera = new window.THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 100);
    camera.position.z = 17;
    const geometry = new window.THREE.BufferGeometry();
    const count = 110;
    const positions = new Float32Array(count * 3);
    for (let index = 0; index < count; index += 1) {
      positions[index * 3] = (Math.random() - 0.5) * 30;
      positions[index * 3 + 1] = (Math.random() - 0.5) * 20;
      positions[index * 3 + 2] = (Math.random() - 0.5) * 10;
    }
    geometry.setAttribute('position', new window.THREE.BufferAttribute(positions, 3));
    const material = new window.THREE.PointsMaterial({ color: 0xa2d37b, size: 0.045, transparent: true, opacity: 0.52, sizeAttenuation: true });
    const points = new window.THREE.Points(geometry, material);
    scene.add(points);
    const particlePositions = geometry.attributes.position;
    let pointerX = 0;
    let pointerY = 0;
    let frame;
    let active = true;
    window.addEventListener('pointermove', (event) => {
      pointerX = (event.clientX / window.innerWidth - 0.5) * 0.22;
      pointerY = (event.clientY / window.innerHeight - 0.5) * 0.16;
    }, { passive: true });
    const resize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };
    const animate = () => {
      if (!active) return;
      for (let index = 0; index < count; index += 1) {
        const y = particlePositions.getY(index) + 0.0015 + (index % 4) * 0.0004;
        particlePositions.setY(index, y > 10 ? -10 : y);
      }
      particlePositions.needsUpdate = true;
      points.rotation.y += 0.00035;
      points.rotation.x += (pointerY - points.rotation.x) * 0.008;
      points.rotation.y += (pointerX - points.rotation.y) * 0.008;
      renderer.render(scene, camera);
      frame = window.requestAnimationFrame(animate);
    };
    window.addEventListener('resize', resize, { passive: true });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        active = false;
        window.cancelAnimationFrame(frame);
      } else if (!active) {
        active = true;
        animate();
      }
    });
    animate();
  }
});
