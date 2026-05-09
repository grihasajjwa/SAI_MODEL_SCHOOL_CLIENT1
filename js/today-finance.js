function formatTodayMoney(value) {
    const amount = Number(value) || 0;
    return amount.toLocaleString('en-IN', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
}

function formatTodayPaymentMode(receipt = {}) {
    if (Array.isArray(receipt.paymentBreakdown) && receipt.paymentBreakdown.length) {
        return receipt.paymentBreakdown
            .map((entry) => `${entry.modeLabel || entry.baseMode} (${formatTodayMoney(entry.amount)})`)
            .join(', ');
    }

    return receipt.paymentMode || '-';
}

function formatTodayExpensePaymentMode(expense = {}) {
    if (Array.isArray(expense.paymentBreakdown) && expense.paymentBreakdown.length) {
        return expense.paymentBreakdown
            .map((entry) => `${entry.modeLabel || entry.baseMode} (${formatTodayMoney(entry.amount)})`)
            .join(', ');
    }

    return expense.paymentMode || '-';
}

function renderTodaySummary(summary = {}, dateValue) {
    document.getElementById('todayDateLabel').textContent = dateValue
        ? new Date(dateValue).toLocaleDateString('en-IN')
        : new Date().toLocaleDateString('en-IN');

    document.getElementById('todayFeeCash').textContent = formatTodayMoney(summary.feeCash || 0);
    document.getElementById('todayFeeOnline').textContent = formatTodayMoney(summary.feeOnline || 0);
    document.getElementById('todayExpenseCash').textContent = formatTodayMoney(summary.expenseCash || 0);
    document.getElementById('todayExpenseOnline').textContent = formatTodayMoney(summary.expenseOnline || 0);
    document.getElementById('todayNetCash').textContent = formatTodayMoney(summary.netCash || 0);
    document.getElementById('todayNetOnline').textContent = formatTodayMoney(summary.netOnline || 0);
    document.getElementById('todayIncome').textContent = formatTodayMoney(summary.totalIncome || 0);
    document.getElementById('todayExpense').textContent = formatTodayMoney(summary.totalExpense || 0);
    document.getElementById('todayNetBalance').textContent = formatTodayMoney(summary.netBalance || 0);
}

function renderTodayReceipts(receipts = []) {
    const tbody = document.getElementById('todayReceiptsBody');

    if (!receipts.length) {
        tbody.innerHTML = '<tr><td colspan="8" class="text-center text-muted py-4">No fee receipts recorded today.</td></tr>';
        return;
    }

    tbody.innerHTML = receipts.map((receipt) => `
        <tr>
            <td>${new Date(receipt.receiptDate || receipt.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</td>
            <td>${receipt.admissionNo || '-'}</td>
            <td>${receipt.studentName || '-'}</td>
            <td>${(receipt.lineItems || []).map((item) => item.particular).join(', ') || '-'}</td>
            <td>Rs. ${formatTodayMoney(receipt.paidAmount || 0)}</td>
            <td>Rs. ${formatTodayMoney(receipt.dueAmount || 0)}</td>
            <td>${formatTodayPaymentMode(receipt)}</td>
            <td><a href="fee-receipt.html?id=${receipt._id}" target="_blank" class="btn btn-sm btn-outline-primary">Receipt</a></td>
        </tr>
    `).join('');
}

function renderTodayExpenses(expenses = []) {
    const tbody = document.getElementById('todayExpensesBody');

    if (!expenses.length) {
        tbody.innerHTML = '<tr><td colspan="7" class="text-center text-muted py-4">No expenses recorded today.</td></tr>';
        return;
    }

    tbody.innerHTML = expenses.map((expense) => `
        <tr>
            <td>${new Date(expense.expenseDate || expense.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</td>
            <td>${expense.headOfAccount || '-'}</td>
            <td>${expense.paidTo || '-'}</td>
            <td>${expense.paidFor || '-'}</td>
            <td>Rs. ${formatTodayMoney(expense.amount || 0)}</td>
            <td>${formatTodayExpensePaymentMode(expense)}</td>
            <td>${expense.notes || '-'}</td>
        </tr>
    `).join('');
}

async function loadTodayFinance() {
    const result = await API.fees.getTodayTransactions();

    if (!result || !result.success) {
        throw new Error(result?.message || 'Unable to fetch today transactions');
    }

    renderTodaySummary(result.summary || {}, result.date);
    renderTodayReceipts(result.receipts || []);
    renderTodayExpenses(result.expenses || []);
}

document.addEventListener('DOMContentLoaded', async () => {
    if (!Auth.isAuthenticated()) {
        window.location.href = '../pages/login.html';
        return;
    }

    try {
        await loadTodayFinance();
    } catch (error) {
        console.error(error);
        alert(error.message || 'Unable to load today finance report');
    }
});
