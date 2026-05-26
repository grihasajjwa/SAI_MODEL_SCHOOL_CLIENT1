function formatCashbookMoney(value) {
    const amount = Number(value) || 0;
    return amount.toLocaleString('en-IN', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
}

function formatCashbookDate(value) {
    return value ? new Date(value).toLocaleDateString('en-IN') : '-';
}

function safeCashbookNumber(value) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
}

let currentCashbookIncomeRows = [];
let currentCashbookExpenseRows = [];

function setDefaultCashbookDates() {
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('cashbookStartDate').value = today;
    document.getElementById('cashbookEndDate').value = today;
}

function setCashbookMonthDates() {
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
    document.getElementById('cashbookStartDate').value = firstDay;
    document.getElementById('cashbookEndDate').value = lastDay;
}

function getPreviousDateString(dateString) {
    if (!dateString) return '';
    const [year, month, day] = dateString.split('-').map(Number);
    if (!year || !month || !day) return '';
    const date = new Date(year, month - 1, day);
    date.setDate(date.getDate() - 1);
    const previousYear = date.getFullYear();
    const previousMonth = String(date.getMonth() + 1).padStart(2, '0');
    const previousDay = String(date.getDate()).padStart(2, '0');
    return `${previousYear}-${previousMonth}-${previousDay}`;
}

async function loadOpeningBalanceForStartDate(startDate) {
    const beforeDate = getPreviousDateString(startDate);
    const openingCashInput = document.getElementById('openingCashBalance');
    const openingOnlineInput = document.getElementById('openingOnlineBalance');

    if (!beforeDate) {
        openingCashInput.value = '0';
        openingOnlineInput.value = '0';
        return;
    }

    const result = await API.fees.getCashbookOpening({ beforeDate });

    if (!result?.success) {
        throw new Error('Unable to calculate opening balance');
    }

    const openingCash = safeCashbookNumber(result.opening?.cash);
    const openingOnline = safeCashbookNumber(result.opening?.online);

    openingCashInput.value = String(openingCash.toFixed(2));
    openingOnlineInput.value = String(openingOnline.toFixed(2));
}

function normalizeReceiptBreakdown(receipt = {}) {
    if (Array.isArray(receipt.paymentBreakdown) && receipt.paymentBreakdown.length) {
        return receipt.paymentBreakdown.map((entry) => ({
            baseMode: entry.baseMode === 'Cash' ? 'Cash' : 'Online',
            amount: safeCashbookNumber(entry.amount)
        }));
    }

    const fallbackAmount = safeCashbookNumber(receipt.paidAmount);
    if (!fallbackAmount) {
        return [];
    }

    return [{
        baseMode: receipt.paymentMode === 'Cash' ? 'Cash' : 'Online',
        amount: fallbackAmount
    }];
}

function isDuePaymentExpense(expense = {}) {
    return (expense.paymentBreakdown || []).some((entry) => String(entry.modeLabel || '').trim().toLowerCase() === 'due payment')
        || String(expense.paidFor || '').trim().toLowerCase() === 'due payment';
}

function normalizeExpenseBreakdown(expense = {}) {
    if (Array.isArray(expense.paymentBreakdown) && expense.paymentBreakdown.length) {
        return expense.paymentBreakdown.map((entry) => ({
            modeLabel: entry.modeLabel || entry.baseMode,
            baseMode: entry.baseMode === 'Online' ? 'Online' : 'Cash',
            amount: safeCashbookNumber(entry.amount)
        }));
    }

    const fallbackAmount = safeCashbookNumber(expense.amount);
    if (!fallbackAmount) {
        return [];
    }

    return [{
        modeLabel: expense.paymentMode || 'Cash',
        baseMode: expense.paymentMode === 'Online' ? 'Online' : 'Cash',
        amount: fallbackAmount
    }];
}

function buildIncomeSummary(receipts = [], duePaymentExpenses = []) {
    const summary = {};

    function addIncome(particular, paymentBreakdown, detail = {}) {
        const label = String(particular || 'Others').trim() || 'Others';
        if (!summary[label]) {
            summary[label] = { cash: 0, online: 0, details: [] };
        }

        paymentBreakdown.forEach((entry) => {
            const bucket = entry.baseMode === 'Cash' ? 'cash' : 'online';
            const amount = safeCashbookNumber(entry.amount);
            summary[label][bucket] += amount;
            if (amount > 0) {
                summary[label].details.push({
                    ...detail,
                    mode: entry.baseMode,
                    amount
                });
            }
        });
    }

    receipts.forEach((receipt) => {
        const paymentBreakdown = normalizeReceiptBreakdown(receipt);
        const paymentTotal = paymentBreakdown.reduce((sum, entry) => sum + safeCashbookNumber(entry.amount), 0);
        if (paymentTotal <= 0) {
            return;
        }

        let lineItems = Array.isArray(receipt.lineItems) ? receipt.lineItems.filter((item) => safeCashbookNumber(item.amount) > 0) : [];
        if (!lineItems.length) {
            lineItems = [{ particular: 'Due Payment', amount: paymentTotal }];
        }

        const lineTotal = lineItems.reduce((sum, item) => sum + safeCashbookNumber(item.amount), 0) || paymentTotal;

        lineItems.forEach((item) => {
            const particular = String(item.particular || 'Others').trim() || 'Others';
            const itemShare = safeCashbookNumber(item.amount) / lineTotal;
            addIncome(particular, paymentBreakdown.map((entry) => ({
                ...entry,
                amount: safeCashbookNumber(entry.amount) * itemShare
            })), {
                date: receipt.receiptDate || receipt.createdAt,
                reference: receipt.voucherNo || receipt.receiptNo || '-',
                party: receipt.studentName || receipt.admissionNo || '-',
                description: receipt.month || ''
            });
        });
    });

    duePaymentExpenses.forEach((expense) => {
        addIncome('Due Payment', normalizeExpenseBreakdown(expense), {
            date: expense.expenseDate || expense.createdAt,
            reference: expense.voucherNo || '-',
            party: expense.paidTo || '-',
            description: expense.notes || expense.paidFor || ''
        });
    });

    return Object.entries(summary)
        .map(([label, values]) => ({
            label,
            cash: values.cash,
            online: values.online,
            total: values.cash + values.online,
            details: values.details || []
        }))
        .sort((a, b) => a.label.localeCompare(b.label));
}

function buildExpenseSummary(expenses = []) {
    const summary = {};

    expenses.forEach((expense) => {
        if (isDuePaymentExpense(expense)) {
            return;
        }

        const head = String(expense.headOfAccount || 'Others').trim() || 'Others';

        if (!summary[head]) {
            summary[head] = { cash: 0, online: 0, details: [] };
        }

        const paymentBreakdown = normalizeExpenseBreakdown(expense);
        if (paymentBreakdown.length) {
            paymentBreakdown.forEach((entry) => {
                const bucket = entry.baseMode === 'Cash' ? 'cash' : 'online';
                const amount = safeCashbookNumber(entry.amount);
                summary[head][bucket] += amount;
                if (amount > 0) {
                    summary[head].details.push({
                        date: expense.expenseDate || expense.createdAt,
                        reference: expense.voucherNo || '-',
                        party: expense.paidTo || '-',
                        description: expense.paidFor || expense.notes || '',
                        mode: entry.baseMode,
                        amount
                    });
                }
            });
            return;
        }

        const bucket = expense.paymentMode === 'Cash' ? 'cash' : 'online';
        summary[head][bucket] += safeCashbookNumber(expense.amount);
    });

    return Object.entries(summary)
        .map(([label, values]) => ({
            label,
            cash: values.cash,
            online: values.online,
            total: values.cash + values.online,
            details: values.details || []
        }))
        .sort((a, b) => a.label.localeCompare(b.label));
}

function renderDetailRows(row = {}, detailType = 'income') {
    if (!row.details?.length) {
        return '<div class="text-muted py-2">No details available.</div>';
    }

    const headerClass = detailType === 'expense' ? 'cashbook-detail-expense' : 'cashbook-detail-income';
    return `
        <div class="table-responsive">
            <table class="table table-sm table-bordered mb-0">
                <thead class="${headerClass}">
                    <tr>
                        <th>Date</th>
                        <th>Ref</th>
                        <th>Name</th>
                        <th>Description</th>
                        <th>Mode</th>
                        <th class="text-end">Amount</th>
                    </tr>
                </thead>
                <tbody>
                    ${row.details.map((detail) => `
                        <tr>
                            <td>${formatCashbookDate(detail.date)}</td>
                            <td>${detail.reference || '-'}</td>
                            <td>${detail.party || '-'}</td>
                            <td>${detail.description || '-'}</td>
                            <td>${detail.mode || '-'}</td>
                            <td class="text-end">Rs. ${formatCashbookMoney(detail.amount)}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    `;
}

function renderSummaryTable(tbodyId, rows = [], emptyMessage) {
    const tbody = document.getElementById(tbodyId);
    const detailType = tbodyId === 'cashbookExpenseBody' ? 'expense' : 'income';

    if (!rows.length) {
        tbody.innerHTML = `
            <tr>
                <td colspan="4" class="text-center text-muted py-4">${emptyMessage}</td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = rows.map((row, index) => {
        const detailId = `${tbodyId}-detail-${index}`;
        return `
        <tr>
            <td>
                <button class="btn btn-link p-0 text-decoration-none cashbook-detail-toggle" type="button" data-bs-toggle="collapse" data-bs-target="#${detailId}" aria-expanded="false">
                    <i class="fas fa-chevron-right me-2"></i>${row.label}
                </button>
            </td>
            <td>Rs. ${formatCashbookMoney(row.cash)}</td>
            <td>Rs. ${formatCashbookMoney(row.online)}</td>
            <td class="fw-semibold">Rs. ${formatCashbookMoney(row.total)}</td>
        </tr>
        <tr class="collapse" id="${detailId}">
            <td colspan="4" class="bg-white">
                ${renderDetailRows(row, detailType)}
            </td>
        </tr>
    `;
    }).join('');

    tbody.querySelectorAll('.cashbook-detail-toggle').forEach((button) => {
        const icon = button.querySelector('i');
        const target = document.querySelector(button.dataset.bsTarget);
        if (!target || !icon) return;
        target.addEventListener('shown.bs.collapse', () => {
            icon.classList.remove('fa-chevron-right');
            icon.classList.add('fa-chevron-down');
        });
        target.addEventListener('hidden.bs.collapse', () => {
            icon.classList.remove('fa-chevron-down');
            icon.classList.add('fa-chevron-right');
        });
    });
}

function setText(id, value) {
    document.getElementById(id).textContent = value;
}

function updateCashbookPrintHeader() {
    const startDate = document.getElementById('cashbookStartDate')?.value;
    const endDate = document.getElementById('cashbookEndDate')?.value;
    const header = document.getElementById('cashbookPrintDateRange');
    if (!header) return;

    if (startDate && endDate && startDate !== endDate) {
        header.textContent = `Date: ${formatCashbookDate(startDate)} to ${formatCashbookDate(endDate)}`;
        return;
    }

    header.textContent = `Date: ${formatCashbookDate(startDate || endDate)}`;
}

function updateCashbookDashboard(incomeRows = [], expenseRows = []) {
    const openingCash = safeCashbookNumber(document.getElementById('openingCashBalance').value);
    const openingOnline = safeCashbookNumber(document.getElementById('openingOnlineBalance').value);

    const incomeCash = incomeRows.reduce((sum, row) => sum + safeCashbookNumber(row.cash), 0);
    const incomeOnline = incomeRows.reduce((sum, row) => sum + safeCashbookNumber(row.online), 0);
    const expenseCash = expenseRows.reduce((sum, row) => sum + safeCashbookNumber(row.cash), 0);
    const expenseOnline = expenseRows.reduce((sum, row) => sum + safeCashbookNumber(row.online), 0);

    const closingCash = openingCash + incomeCash - expenseCash;
    const closingOnline = openingOnline + incomeOnline - expenseOnline;

    setText('cashbookOpeningCashView', formatCashbookMoney(openingCash));
    setText('cashbookOpeningOnlineView', formatCashbookMoney(openingOnline));
    setText('cashbookCollectionCashView', formatCashbookMoney(incomeCash));
    setText('cashbookCollectionOnlineView', formatCashbookMoney(incomeOnline));
    setText('cashbookExpenseCashView', formatCashbookMoney(expenseCash));
    setText('cashbookExpenseOnlineView', formatCashbookMoney(expenseOnline));
    setText('cashbookClosingCashView', formatCashbookMoney(closingCash));
    setText('cashbookClosingOnlineView', formatCashbookMoney(closingOnline));
    setText('cashbookClosingCashFooter', formatCashbookMoney(closingCash));
    setText('cashbookClosingOnlineFooter', formatCashbookMoney(closingOnline));

    setText('cashbookIncomeCashTotal', `Rs. ${formatCashbookMoney(incomeCash)}`);
    setText('cashbookIncomeOnlineTotal', `Rs. ${formatCashbookMoney(incomeOnline)}`);
    setText('cashbookIncomeGrandTotal', `Rs. ${formatCashbookMoney(incomeCash + incomeOnline)}`);

    setText('cashbookExpenseCashTotal', `Rs. ${formatCashbookMoney(expenseCash)}`);
    setText('cashbookExpenseOnlineTotal', `Rs. ${formatCashbookMoney(expenseOnline)}`);
    setText('cashbookExpenseGrandTotal', `Rs. ${formatCashbookMoney(expenseCash + expenseOnline)}`);
}

async function loadCashbook() {
    const startDate = document.getElementById('cashbookStartDate').value;
    const endDate = document.getElementById('cashbookEndDate').value;
    const loadButton = document.getElementById('loadCashbookBtn');
    const originalHtml = loadButton.innerHTML;

    updateCashbookPrintHeader();
    loadButton.disabled = true;
    loadButton.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>Loading...';

    try {
        await loadOpeningBalanceForStartDate(startDate);
        const [receiptResult, expenseResult] = await Promise.all([
            API.fees.getTransactions({ startDate, endDate, limit: 1000 }),
            API.fees.getExpenses({ startDate, endDate, limit: 1000 })
        ]);

        if (!receiptResult?.success) {
            throw new Error(receiptResult?.message || 'Unable to fetch fee transactions');
        }

        if (!expenseResult?.success) {
            throw new Error(expenseResult?.message || 'Unable to fetch expense transactions');
        }

        const expenses = expenseResult.expenses || [];
        const duePaymentExpenses = expenses.filter(isDuePaymentExpense);
        const incomeRows = buildIncomeSummary(receiptResult.transactions || [], duePaymentExpenses);
        const expenseRows = buildExpenseSummary(expenses);
        currentCashbookIncomeRows = incomeRows;
        currentCashbookExpenseRows = expenseRows;

        renderSummaryTable('cashbookIncomeBody', incomeRows, 'No collections found for the selected range.');
        renderSummaryTable('cashbookExpenseBody', expenseRows, 'No expenses found for the selected range.');
        updateCashbookDashboard(incomeRows, expenseRows);
    } catch (error) {
        console.error(error);
        alert(error.message || 'Unable to load cashbook');
        currentCashbookIncomeRows = [];
        currentCashbookExpenseRows = [];
        renderSummaryTable('cashbookIncomeBody', [], 'Unable to load collection summary.');
        renderSummaryTable('cashbookExpenseBody', [], 'Unable to load expense summary.');
        updateCashbookDashboard([], []);
    } finally {
        loadButton.disabled = false;
        loadButton.innerHTML = originalHtml;
    }
}

function resetCashbookFilters() {
    setDefaultCashbookDates();
    document.getElementById('openingCashBalance').value = '0';
    document.getElementById('openingOnlineBalance').value = '0';
}

function escapeCashbookCsv(value) {
    const text = String(value ?? '');
    return `"${text.replace(/"/g, '""')}"`;
}

function cashbookRowsToCsvSection(title, rows = []) {
    const lines = [
        [title],
        ['Particular', 'Cash', 'Online', 'Total']
    ];

    rows.forEach((row) => {
        lines.push([
            row.label,
            formatCashbookMoney(row.cash),
            formatCashbookMoney(row.online),
            formatCashbookMoney(row.total)
        ]);
    });

    const totals = rows.reduce((total, row) => ({
        cash: total.cash + safeCashbookNumber(row.cash),
        online: total.online + safeCashbookNumber(row.online),
        grand: total.grand + safeCashbookNumber(row.total)
    }), { cash: 0, online: 0, grand: 0 });

    lines.push([
        'Total',
        formatCashbookMoney(totals.cash),
        formatCashbookMoney(totals.online),
        formatCashbookMoney(totals.grand)
    ]);

    return lines.map((line) => line.map(escapeCashbookCsv).join(',')).join('\n');
}

function exportCashbookCsv() {
    const startDate = document.getElementById('cashbookStartDate').value || 'start';
    const endDate = document.getElementById('cashbookEndDate').value || 'end';
    const csv = [
        `Cashbook,${escapeCashbookCsv(startDate)} to ${escapeCashbookCsv(endDate)}`,
        '',
        cashbookRowsToCsvSection('Cash Summary by Particular', currentCashbookIncomeRows),
        '',
        cashbookRowsToCsvSection('Expense Head Wise Summary', currentCashbookExpenseRows)
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `cashbook-${startDate}-to-${endDate}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
}

document.addEventListener('DOMContentLoaded', async () => {
    if (!Auth.isAuthenticated()) {
        window.location.href = '../pages/login.html';
        return;
    }

    setDefaultCashbookDates();
    updateCashbookPrintHeader();

    document.getElementById('cashbookFilterForm').addEventListener('submit', async (event) => {
        event.preventDefault();
        await loadCashbook();
    });

    document.getElementById('resetCashbookBtn').addEventListener('click', async () => {
        resetCashbookFilters();
        await loadCashbook();
    });

    document.getElementById('cashbookTodayBtn').addEventListener('click', async () => {
        setDefaultCashbookDates();
        await loadCashbook();
    });

    document.getElementById('cashbookMonthBtn').addEventListener('click', async () => {
        setCashbookMonthDates();
        await loadCashbook();
    });

    document.getElementById('cashbookRefreshBtn').addEventListener('click', loadCashbook);
    document.getElementById('cashbookPrintBtn').addEventListener('click', () => window.print());
    document.getElementById('cashbookCsvBtn').addEventListener('click', exportCashbookCsv);
    document.getElementById('cashbookStartDate').addEventListener('change', updateCashbookPrintHeader);
    document.getElementById('cashbookEndDate').addEventListener('change', updateCashbookPrintHeader);

    document.getElementById('openingCashBalance').addEventListener('input', () => updateCashbookDashboard(
        currentCashbookIncomeRows,
        currentCashbookExpenseRows
    ));
    document.getElementById('openingOnlineBalance').addEventListener('input', () => updateCashbookDashboard(
        currentCashbookIncomeRows,
        currentCashbookExpenseRows
    ));

    await loadCashbook();
});
