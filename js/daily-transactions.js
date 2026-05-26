let dailyTransactionRows = [];
let dailyOpeningBalance = 0;
let dailyOpeningCashBalance = 0;
let dailyOpeningOnlineBalance = 0;

function safeDailyNumber(value) {
    const amount = Number(value);
    return Number.isFinite(amount) ? amount : 0;
}

function formatDailyMoney(value) {
    return safeDailyNumber(value).toLocaleString('en-IN', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
}

function formatDailyDate(value) {
    return value ? new Date(value).toLocaleDateString('en-IN') : '-';
}

function formatDailyTime(value) {
    return value ? new Date(value).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '';
}

function escapeDailyHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function setDailyText(id, value) {
    const element = document.getElementById(id);
    if (element) element.textContent = value;
}

function getDailyPreviousDateString(dateString) {
    if (!dateString) return '';
    const [year, month, day] = dateString.split('-').map(Number);
    if (!year || !month || !day) return '';
    const date = new Date(year, month - 1, day);
    date.setDate(date.getDate() - 1);
    return [
        date.getFullYear(),
        String(date.getMonth() + 1).padStart(2, '0'),
        String(date.getDate()).padStart(2, '0')
    ].join('-');
}

function toDailyDateInputValue(date) {
    return [
        date.getFullYear(),
        String(date.getMonth() + 1).padStart(2, '0'),
        String(date.getDate()).padStart(2, '0')
    ].join('-');
}

function setDailyTodayDates() {
    const today = toDailyDateInputValue(new Date());
    document.getElementById('dailyStartDate').value = today;
    document.getElementById('dailyEndDate').value = today;
}

function setDailyMonthDates() {
    const now = new Date();
    document.getElementById('dailyStartDate').value = toDailyDateInputValue(new Date(now.getFullYear(), now.getMonth(), 1));
    document.getElementById('dailyEndDate').value = toDailyDateInputValue(new Date(now.getFullYear(), now.getMonth() + 1, 0));
}

function normalizeDailyReceiptBreakdown(receipt = {}) {
    if (Array.isArray(receipt.paymentBreakdown) && receipt.paymentBreakdown.length) {
        return receipt.paymentBreakdown.map((entry) => ({
            baseMode: entry.baseMode === 'Cash' ? 'Cash' : 'Online',
            amount: safeDailyNumber(entry.amount),
            label: entry.modeLabel || entry.baseMode || ''
        }));
    }

    const amount = safeDailyNumber(receipt.paidAmount);
    return amount > 0 ? [{
        baseMode: receipt.paymentMode === 'Cash' ? 'Cash' : 'Online',
        amount,
        label: receipt.paymentMode || ''
    }] : [];
}

function normalizeDailyExpenseBreakdown(expense = {}) {
    if (Array.isArray(expense.paymentBreakdown) && expense.paymentBreakdown.length) {
        return expense.paymentBreakdown.map((entry) => ({
            baseMode: entry.baseMode === 'Online' ? 'Online' : 'Cash',
            amount: safeDailyNumber(entry.amount),
            label: entry.modeLabel || entry.baseMode || ''
        }));
    }

    const amount = safeDailyNumber(expense.amount);
    return amount > 0 ? [{
        baseMode: expense.paymentMode === 'Online' ? 'Online' : 'Cash',
        amount,
        label: expense.paymentMode || ''
    }] : [];
}

function isDailyDuePaymentExpense(expense = {}) {
    return (expense.paymentBreakdown || []).some((entry) => String(entry.modeLabel || '').trim().toLowerCase() === 'due payment')
        || String(expense.paidFor || '').trim().toLowerCase() === 'due payment';
}

function splitDailyAmounts(breakdown = []) {
    return breakdown.reduce((totals, entry) => {
        const bucket = entry.baseMode === 'Cash' ? 'cash' : 'online';
        totals[bucket] += safeDailyNumber(entry.amount);
        return totals;
    }, { cash: 0, online: 0 });
}

function buildDailyReceiptRow(receipt = {}) {
    const breakdown = normalizeDailyReceiptBreakdown(receipt);
    const totals = splitDailyAmounts(breakdown);
    const lineItems = Array.isArray(receipt.lineItems) ? receipt.lineItems : [];
    const billedAmount = safeDailyNumber(receipt.currentChargesTotal)
        || lineItems.reduce((sum, item) => sum + safeDailyNumber(item.amount), 0)
        || safeDailyNumber(receipt.paidAmount);
    const particulars = [
        receipt.studentName || 'Fee Receipt',
        receipt.admissionNo ? `Adm: ${receipt.admissionNo}` : '',
        receipt.className ? `Class: ${receipt.className}${receipt.section ? `-${receipt.section}` : ''}` : '',
        receipt.month ? `Month: ${receipt.month}` : '',
        lineItems.length ? lineItems.map((item) => item.particular).filter(Boolean).join(', ') : ''
    ].filter(Boolean).join(' | ');

    return {
        source: 'receipt',
        type: 'Credit',
        date: receipt.receiptDate || receipt.createdAt,
        createdAt: receipt.createdAt,
        particulars,
        reference: receipt.receiptNo || receipt.voucherNo || '',
        billedAmount,
        cashReceived: totals.cash,
        onlineReceived: totals.online,
        expenseCash: 0,
        expenseOnline: 0,
        // notes: [receipt.notes, receipt.receiptNo ? `Receipt: ${receipt.receiptNo}` : '', receipt.voucherNo ? `Voucher: ${receipt.voucherNo}` : ''].filter(Boolean).join(' | ')
        notes: [receipt.notes,  receipt.voucherNo ? `Voucher: ${receipt.voucherNo}` : ''].filter(Boolean).join(' | ')
    
    };
}

function buildDailyExpenseRow(expense = {}) {
    const breakdown = normalizeDailyExpenseBreakdown(expense);
    const totals = splitDailyAmounts(breakdown);
    const isDuePayment = isDailyDuePaymentExpense(expense);
    const salaryNote = expense.salaryDetails?.employeeName
        ? `Salary: ${expense.salaryDetails.employeeName}${expense.salaryDetails.salaryMonth ? ` (${expense.salaryDetails.salaryMonth})` : ''}`
        : '';
    const particulars = [
        isDuePayment ? 'Due Payment Received' : (expense.headOfAccount || 'Expense'),
        expense.paidTo || '',
        expense.paidFor || ''
    ].filter(Boolean).join(' | ');

    return {
        source: 'expense',
        type: isDuePayment ? 'Credit' : 'Debit',
        date: expense.expenseDate || expense.createdAt,
        createdAt: expense.createdAt,
        particulars,
        reference: expense.voucherNo || '',
        billedAmount: 0,
        cashReceived: isDuePayment ? totals.cash : 0,
        onlineReceived: isDuePayment ? totals.online : 0,
        expenseCash: isDuePayment ? 0 : totals.cash,
        expenseOnline: isDuePayment ? 0 : totals.online,
        notes: [expense.notes, salaryNote, expense.voucherNo ? `Voucher: ${expense.voucherNo}` : ''].filter(Boolean).join(' | ')
    };
}

function getDailyRowDelta(row = {}) {
    return safeDailyNumber(row.cashReceived)
        + safeDailyNumber(row.onlineReceived)
        - safeDailyNumber(row.expenseCash)
        - safeDailyNumber(row.expenseOnline);
}

async function loadDailyOpeningBalance(startDate) {
    const beforeDate = getDailyPreviousDateString(startDate);
    if (!beforeDate) return { cash: 0, online: 0 };

    const result = await API.fees.getCashbookOpening({ beforeDate });
    if (result?.success) {
        return {
            cash: safeDailyNumber(result.opening?.cash),
            online: safeDailyNumber(result.opening?.online)
        };
    }

    if (result?.routeMissing || String(result?.message || '').toLowerCase().includes('not found')) {
        return calculateDailyOpeningBalanceFallback(beforeDate);
    }

    throw new Error(result?.message || 'Unable to calculate opening balance');
}

async function calculateDailyOpeningBalanceFallback(beforeDate) {
    const [receiptResult, expenseResult] = await Promise.all([
        API.fees.getTransactions({ endDate: beforeDate, limit: 500 }),
        API.fees.getExpenses({ endDate: beforeDate, limit: 1000 })
    ]);

    if (!receiptResult?.success || !expenseResult?.success) {
        throw new Error('Unable to calculate opening balance');
    }

    const receiptTotal = (receiptResult.transactions || []).reduce((sum, receipt) => {
        const totals = splitDailyAmounts(normalizeDailyReceiptBreakdown(receipt));
        return {
            cash: sum.cash + totals.cash,
            online: sum.online + totals.online
        };
    }, { cash: 0, online: 0 });

    const expenseTotal = (expenseResult.expenses || []).reduce((sum, expense) => {
        const totals = splitDailyAmounts(normalizeDailyExpenseBreakdown(expense));
        const sign = isDailyDuePaymentExpense(expense) ? 1 : -1;
        return {
            cash: sum.cash + (sign * totals.cash),
            online: sum.online + (sign * totals.online)
        };
    }, { cash: 0, online: 0 });

    return {
        cash: receiptTotal.cash + expenseTotal.cash,
        online: receiptTotal.online + expenseTotal.online
    };
}

function getFilteredDailyRows() {
    const selectedType = document.getElementById('dailyTypeFilter').value;
    const search = document.getElementById('dailySearchInput').value.trim().toLowerCase();

    return dailyTransactionRows.filter((row) => {
        if (selectedType && row.type !== selectedType) return false;
        if (!search) return true;
        return [
            row.particulars,
            row.reference,
            row.notes,
            row.type
        ].some((value) => String(value || '').toLowerCase().includes(search));
    });
}

function updateDailyPrintRange() {
    const startDate = document.getElementById('dailyStartDate').value;
    const endDate = document.getElementById('dailyEndDate').value;
    const label = startDate && endDate && startDate !== endDate
        ? `${formatDailyDate(startDate)} to ${formatDailyDate(endDate)}`
        : formatDailyDate(startDate || endDate);
    setDailyText('dailyPrintRange', `Date: ${label}`);
}

function updateDailySummary(rows = []) {
    const totals = rows.reduce((sum, row) => ({
        billed: sum.billed + safeDailyNumber(row.billedAmount),
        cashReceived: sum.cashReceived + safeDailyNumber(row.cashReceived),
        onlineReceived: sum.onlineReceived + safeDailyNumber(row.onlineReceived),
        expenseCash: sum.expenseCash + safeDailyNumber(row.expenseCash),
        expenseOnline: sum.expenseOnline + safeDailyNumber(row.expenseOnline)
    }), { billed: 0, cashReceived: 0, onlineReceived: 0, expenseCash: 0, expenseOnline: 0 });

    const currentCashBalance = dailyOpeningCashBalance + totals.cashReceived - totals.expenseCash;
    const currentOnlineBalance = dailyOpeningOnlineBalance + totals.onlineReceived - totals.expenseOnline;
    const currentBalance = currentCashBalance + currentOnlineBalance;

    setDailyText('dailyOpeningCashBalance', formatDailyMoney(dailyOpeningCashBalance));
    setDailyText('dailyOpeningOnlineBalance', formatDailyMoney(dailyOpeningOnlineBalance));
    setDailyText('dailyBilledTotal', formatDailyMoney(totals.billed));
    setDailyText('dailyCashReceivedTotal', formatDailyMoney(totals.cashReceived));
    setDailyText('dailyOnlineReceivedTotal', formatDailyMoney(totals.onlineReceived));
    setDailyText('dailyExpenseCashTotal', formatDailyMoney(totals.expenseCash));
    setDailyText('dailyExpenseOnlineTotal', formatDailyMoney(totals.expenseOnline));
    setDailyText('dailyCurrentCashBalance', formatDailyMoney(currentCashBalance));
    setDailyText('dailyCurrentOnlineBalance', formatDailyMoney(currentOnlineBalance));
    setDailyText('dailyFooterBilled', formatDailyMoney(totals.billed));
    setDailyText('dailyFooterCashReceived', formatDailyMoney(totals.cashReceived));
    setDailyText('dailyFooterOnlineReceived', formatDailyMoney(totals.onlineReceived));
    setDailyText('dailyFooterExpenseCash', formatDailyMoney(totals.expenseCash));
    setDailyText('dailyFooterExpenseOnline', formatDailyMoney(totals.expenseOnline));
    setDailyText('dailyFooterBalance', formatDailyMoney(currentBalance));
    setDailyText('dailyRowCount', `${rows.length} row${rows.length === 1 ? '' : 's'}`);
}

function renderDailyTransactions() {
    const tbody = document.getElementById('dailyTransactionsBody');
    const rows = getFilteredDailyRows();
    updateDailySummary(rows);

    if (!rows.length) {
        tbody.innerHTML = '<tr><td colspan="10" class="text-center text-muted py-4">No transactions found for the selected filters.</td></tr>';
        return;
    }

    let runningBalance = dailyOpeningBalance;
    tbody.innerHTML = rows.map((row) => {
        runningBalance += getDailyRowDelta(row);
        const rowClass = row.type === 'Credit' ? 'transaction-credit' : 'transaction-debit';
        const typeClass = row.type === 'Credit' ? 'text-success' : 'text-danger';

        return `
            <tr class="${rowClass}">
                <td>${formatDailyDate(row.date)}<div class="small text-muted">${formatDailyTime(row.date || row.createdAt)}</div></td>
                <td><span class="fw-bold ${typeClass}">${escapeDailyHtml(row.type)}</span></td>
                <td>${escapeDailyHtml(row.particulars || '-')}<div class="small text-muted">${escapeDailyHtml(row.reference || '')}</div></td>
                <td class="text-end">Rs. ${formatDailyMoney(row.billedAmount)}</td>
                <td class="text-end">Rs. ${formatDailyMoney(row.cashReceived)}</td>
                <td class="text-end">Rs. ${formatDailyMoney(row.onlineReceived)}</td>
                <td class="text-end">Rs. ${formatDailyMoney(row.expenseCash)}</td>
                <td class="text-end">Rs. ${formatDailyMoney(row.expenseOnline)}</td>
                <td class="text-end fw-bold">Rs. ${formatDailyMoney(runningBalance)}</td>
                <td>${escapeDailyHtml(row.notes || '-')}</td>
            </tr>
        `;
    }).join('');
}

async function loadDailyTransactions() {
    const startDate = document.getElementById('dailyStartDate').value;
    const endDate = document.getElementById('dailyEndDate').value;
    const button = document.getElementById('loadDailyTransactionsBtn');
    const originalHtml = button.innerHTML;

    updateDailyPrintRange();
    button.disabled = true;
    button.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>Loading...';

    try {
        const openingBalance = await loadDailyOpeningBalance(startDate);
        dailyOpeningCashBalance = safeDailyNumber(openingBalance.cash);
        dailyOpeningOnlineBalance = safeDailyNumber(openingBalance.online);
        dailyOpeningBalance = dailyOpeningCashBalance + dailyOpeningOnlineBalance;
        const [receiptResult, expenseResult] = await Promise.all([
            API.fees.getTransactions({ startDate, endDate, limit: 500 }),
            API.fees.getExpenses({ startDate, endDate, limit: 1000 })
        ]);

        if (!receiptResult?.success) {
            throw new Error(receiptResult?.message || 'Unable to fetch fee transactions');
        }

        if (!expenseResult?.success) {
            throw new Error(expenseResult?.message || 'Unable to fetch expense transactions');
        }

        dailyTransactionRows = [
            ...(receiptResult.transactions || []).map(buildDailyReceiptRow),
            ...(expenseResult.expenses || []).map(buildDailyExpenseRow)
        ].sort((a, b) => {
            const dateA = new Date(a.date || a.createdAt).getTime();
            const dateB = new Date(b.date || b.createdAt).getTime();
            if (dateA !== dateB) return dateA - dateB;
            return String(a.reference || '').localeCompare(String(b.reference || ''));
        });

        renderDailyTransactions();
    } catch (error) {
        console.error(error);
        alert(error.message || 'Unable to load daily transactions');
        dailyTransactionRows = [];
        dailyOpeningBalance = 0;
        dailyOpeningCashBalance = 0;
        dailyOpeningOnlineBalance = 0;
        renderDailyTransactions();
    } finally {
        button.disabled = false;
        button.innerHTML = originalHtml;
    }
}

function escapeDailyCsv(value) {
    return `"${String(value ?? '').replace(/"/g, '""')}"`;
}

function exportDailyCsv() {
    const rows = getFilteredDailyRows();
    let runningBalance = dailyOpeningBalance;
    const lines = [[
        'Date',
        'Type',
        'Particulars',
        'Billed Amount',
        'Cash Received',
        'Online Received',
        'Expense Cash',
        'Expense Online',
        'Current Balance',
        'Notes'
    ]];

    rows.forEach((row) => {
        runningBalance += getDailyRowDelta(row);
        lines.push([
            formatDailyDate(row.date),
            row.type,
            row.particulars,
            formatDailyMoney(row.billedAmount),
            formatDailyMoney(row.cashReceived),
            formatDailyMoney(row.onlineReceived),
            formatDailyMoney(row.expenseCash),
            formatDailyMoney(row.expenseOnline),
            formatDailyMoney(runningBalance),
            row.notes
        ]);
    });

    const csv = lines.map((line) => line.map(escapeDailyCsv).join(',')).join('\n');
    const startDate = document.getElementById('dailyStartDate').value || 'start';
    const endDate = document.getElementById('dailyEndDate').value || 'end';
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `daily-transactions-${startDate}-to-${endDate}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
}

document.addEventListener('DOMContentLoaded', async () => {
    if (!Auth.isAuthenticated()) {
        window.location.href = '../pages/login.html';
        return;
    }

    setDailyTodayDates();
    updateDailyPrintRange();

    document.getElementById('dailyTransactionForm').addEventListener('submit', async (event) => {
        event.preventDefault();
        await loadDailyTransactions();
    });
    document.getElementById('resetDailyTransactionsBtn').addEventListener('click', async () => {
        setDailyTodayDates();
        document.getElementById('dailyTypeFilter').value = '';
        document.getElementById('dailySearchInput').value = '';
        await loadDailyTransactions();
    });
    document.getElementById('dailyTodayBtn').addEventListener('click', async () => {
        setDailyTodayDates();
        await loadDailyTransactions();
    });
    document.getElementById('dailyMonthBtn').addEventListener('click', async () => {
        setDailyMonthDates();
        await loadDailyTransactions();
    });
    document.getElementById('dailyRefreshBtn').addEventListener('click', loadDailyTransactions);
    document.getElementById('dailyPrintBtn').addEventListener('click', () => window.print());
    document.getElementById('dailyCsvBtn').addEventListener('click', exportDailyCsv);
    document.getElementById('dailyTypeFilter').addEventListener('change', renderDailyTransactions);
    document.getElementById('dailySearchInput').addEventListener('input', renderDailyTransactions);
    document.getElementById('dailyStartDate').addEventListener('change', updateDailyPrintRange);
    document.getElementById('dailyEndDate').addEventListener('change', updateDailyPrintRange);

    await loadDailyTransactions();
});
