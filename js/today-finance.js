function formatTodayMoney(value) {
    const amount = Number(value) || 0;
    return amount.toLocaleString('en-IN', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
}

function toTodayDateInputValue(date) {
    return [
        date.getFullYear(),
        String(date.getMonth() + 1).padStart(2, '0'),
        String(date.getDate()).padStart(2, '0')
    ].join('-');
}

function parseTodayDateInput(dateString) {
    if (!dateString) return new Date();
    const [year, month, day] = dateString.split('-').map(Number);
    if (!year || !month || !day) return new Date();
    return new Date(year, month - 1, day);
}

function moveTodayDate(days) {
    const dateInput = document.getElementById('todayFinanceDate');
    const date = parseTodayDateInput(dateInput.value);
    date.setDate(date.getDate() + days);
    dateInput.value = toTodayDateInputValue(date);
    return dateInput.value;
}

function setTodayFinanceLoading(isLoading) {
    const loader = document.getElementById('todayFinanceLoading');
    const dateInput = document.getElementById('todayFinanceDate');
    const prevButton = document.getElementById('todayPrevDate');
    const nextButton = document.getElementById('todayNextDate');

    loader?.classList.toggle('show', isLoading);
    if (dateInput) dateInput.disabled = isLoading;
    if (prevButton) prevButton.disabled = isLoading;
    if (nextButton) nextButton.disabled = isLoading;
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

function getTodayBilledAmount(receipt = {}) {
    const lineItems = Array.isArray(receipt.lineItems) ? receipt.lineItems : [];
    return Number(receipt.currentChargesTotal)
        || lineItems.reduce((sum, item) => sum + (Number(item.amount) || 0), 0)
        || Number(receipt.paidAmount)
        || 0;
}

function renderTodaySummary(summary = {}, dateValue) {
    const date = dateValue ? new Date(dateValue) : new Date();
    const dateInput = document.getElementById('todayFinanceDate');

    document.getElementById('todayDateLabel').textContent = date.toLocaleDateString('en-IN');
    if (dateInput && !dateInput.value) {
        dateInput.value = toTodayDateInputValue(date);
    }

    document.getElementById('todayOpeningCash').textContent = formatTodayMoney(summary.openingCash || 0);
    document.getElementById('todayOpeningOnline').textContent = formatTodayMoney(summary.openingOnline || 0);
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
            <td>${receipt.admissionNo || '-'}</td>
            <td>${receipt.studentName || '-'}</td>
            <td>${(receipt.lineItems || []).map((item) => item.particular).join(', ') || '-'}</td>
            <td>${formatTodayMoney(getTodayBilledAmount(receipt))}</td>
            <td>${formatTodayMoney(receipt.paidAmount || 0)}</td>
            <td>${formatTodayMoney(receipt.dueAmount || 0)}</td>
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
            <td>${formatTodayMoney(expense.amount || 0)}</td>
            <td>${formatTodayExpensePaymentMode(expense)}</td>
            <td>${expense.notes || '-'}</td>
        </tr>
    `).join('');
}

async function loadTodayFinance(dateValue = '') {
    const selectedDate = dateValue || document.getElementById('todayFinanceDate')?.value || toTodayDateInputValue(new Date());
    const result = await API.fees.getTodayTransactions(selectedDate);

    if (!result || !result.success) {
        throw new Error(result?.message || 'Unable to fetch today transactions');
    }

    renderTodaySummary(result.summary || {}, result.date);
    renderTodayReceipts(result.receipts || []);
    renderTodayExpenses(result.expenses || []);
}

async function refreshTodayFinance(dateValue) {
    setTodayFinanceLoading(true);

    try {
        await loadTodayFinance(dateValue);
    } catch (error) {
        console.error(error);
        alert(error.message || 'Unable to load finance report');
    } finally {
        setTodayFinanceLoading(false);
    }
}

function initializeTodayDateControls() {
    const dateInput = document.getElementById('todayFinanceDate');
    const prevButton = document.getElementById('todayPrevDate');
    const nextButton = document.getElementById('todayNextDate');
    const printButton = document.getElementById('todayPrintBtn');

    if (!dateInput) return;

    dateInput.value = toTodayDateInputValue(new Date());

    dateInput.addEventListener('change', () => {
        refreshTodayFinance(dateInput.value);
    });

    dateInput.addEventListener('keydown', (event) => {
        if (event.key === 'ArrowLeft') {
            event.preventDefault();
            refreshTodayFinance(moveTodayDate(-1));
        }

        if (event.key === 'ArrowRight') {
            event.preventDefault();
            refreshTodayFinance(moveTodayDate(1));
        }
    });

    prevButton?.addEventListener('click', () => {
        refreshTodayFinance(moveTodayDate(-1));
    });

    nextButton?.addEventListener('click', () => {
        refreshTodayFinance(moveTodayDate(1));
    });

    printButton?.addEventListener('click', () => {
        window.print();
    });
}

document.addEventListener('DOMContentLoaded', async () => {
    if (!Auth.isAuthenticated()) {
        window.location.href = '../pages/login.html';
        return;
    }

    initializeTodayDateControls();
    await refreshTodayFinance();
});
