function formatCashbookMoney(value) {
    const amount = Number(value) || 0;
    return amount.toLocaleString('en-IN', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
}

function safeCashbookNumber(value) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
}

function setDefaultCashbookDates() {
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('cashbookStartDate').value = today;
    document.getElementById('cashbookEndDate').value = today;
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

function buildIncomeSummary(receipts = []) {
    const summary = {};

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
            if (!summary[particular]) {
                summary[particular] = { cash: 0, online: 0 };
            }

            paymentBreakdown.forEach((entry) => {
                const bucket = entry.baseMode === 'Cash' ? 'cash' : 'online';
                summary[particular][bucket] += safeCashbookNumber(entry.amount) * itemShare;
            });
        });
    });

    return Object.entries(summary)
        .map(([label, values]) => ({
            label,
            cash: values.cash,
            online: values.online,
            total: values.cash + values.online
        }))
        .sort((a, b) => a.label.localeCompare(b.label));
}

function buildExpenseSummary(expenses = []) {
    const summary = {};

    expenses.forEach((expense) => {
        const head = String(expense.headOfAccount || 'Others').trim() || 'Others';

        if (!summary[head]) {
            summary[head] = { cash: 0, online: 0 };
        }

        if (Array.isArray(expense.paymentBreakdown) && expense.paymentBreakdown.length) {
            expense.paymentBreakdown.forEach((entry) => {
                const bucket = entry.baseMode === 'Cash' ? 'cash' : 'online';
                summary[head][bucket] += safeCashbookNumber(entry.amount);
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
            total: values.cash + values.online
        }))
        .sort((a, b) => a.label.localeCompare(b.label));
}

function renderSummaryTable(tbodyId, rows = [], emptyMessage) {
    const tbody = document.getElementById(tbodyId);

    if (!rows.length) {
        tbody.innerHTML = `
            <tr>
                <td colspan="4" class="text-center text-muted py-4">${emptyMessage}</td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = rows.map((row) => `
        <tr>
            <td>${row.label}</td>
            <td>Rs. ${formatCashbookMoney(row.cash)}</td>
            <td>Rs. ${formatCashbookMoney(row.online)}</td>
            <td class="fw-semibold">Rs. ${formatCashbookMoney(row.total)}</td>
        </tr>
    `).join('');
}

function setText(id, value) {
    document.getElementById(id).textContent = value;
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

    loadButton.disabled = true;
    loadButton.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>Loading...';

    try {
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

        const incomeRows = buildIncomeSummary(receiptResult.transactions || []);
        const expenseRows = buildExpenseSummary(expenseResult.expenses || []);

        renderSummaryTable('cashbookIncomeBody', incomeRows, 'No collections found for the selected range.');
        renderSummaryTable('cashbookExpenseBody', expenseRows, 'No expenses found for the selected range.');
        updateCashbookDashboard(incomeRows, expenseRows);
    } catch (error) {
        console.error(error);
        alert(error.message || 'Unable to load cashbook');
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

document.addEventListener('DOMContentLoaded', async () => {
    if (!Auth.isAuthenticated()) {
        window.location.href = '../pages/login.html';
        return;
    }

    setDefaultCashbookDates();

    document.getElementById('cashbookFilterForm').addEventListener('submit', async (event) => {
        event.preventDefault();
        await loadCashbook();
    });

    document.getElementById('resetCashbookBtn').addEventListener('click', async () => {
        resetCashbookFilters();
        await loadCashbook();
    });

    document.getElementById('openingCashBalance').addEventListener('input', () => updateCashbookDashboard(
        buildIncomeSummary([]),
        buildExpenseSummary([])
    ));
    document.getElementById('openingOnlineBalance').addEventListener('input', () => updateCashbookDashboard(
        buildIncomeSummary([]),
        buildExpenseSummary([])
    ));

    await loadCashbook();
});
