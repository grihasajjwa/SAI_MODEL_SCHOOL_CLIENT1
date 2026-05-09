function formatExpenseHistoryMoney(value) {
    const amount = Number(value) || 0;
    return amount.toLocaleString('en-IN', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
}

function formatExpenseHistoryPayment(expense = {}) {
    if (Array.isArray(expense.paymentBreakdown) && expense.paymentBreakdown.length) {
        return expense.paymentBreakdown
            .map((entry) => `${entry.modeLabel || entry.baseMode} (${formatExpenseHistoryMoney(entry.amount)})`)
            .join(', ');
    }

    return expense.paymentMode || '-';
}

let expenseFilterTimer = null;

function populateExpenseHistoryHeads(heads = []) {
    const select = document.getElementById('expenseHeadFilter');
    const currentValue = select.value;
    select.innerHTML = `
        <option value="">All Heads</option>
        ${heads.map((head) => `<option value="${head.name}">${head.name}</option>`).join('')}
    `;
    select.value = currentValue || '';
}

function renderExpenseHistory(expenses = [], totals = {}) {
    const tbody = document.getElementById('expenseTransactionsTableBody');
    document.getElementById('expenseHistoryTotalAmount').textContent = formatExpenseHistoryMoney(totals.totalAmount || 0);
    document.getElementById('expenseHistoryCount').textContent = totals.transactionCount || 0;

    if (!expenses.length) {
        tbody.innerHTML = `
            <tr>
                <td colspan="9" class="text-center text-muted py-4">No expense transactions found.</td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = expenses.map((expense) => `
        <tr>
            <td>${expense.voucherNo || '-'}</td>
            <td>${expense.expenseDate ? new Date(expense.expenseDate).toLocaleDateString('en-IN') : '-'}</td>
            <td>${expense.headOfAccount || '-'}</td>
            <td>${expense.paidTo || '-'}</td>
            <td>${expense.paidFor || '-'}</td>
            <td class="fw-semibold">Rs. ${formatExpenseHistoryMoney(expense.amount || 0)}</td>
            <td>${formatExpenseHistoryPayment(expense)}</td>
            <td>${expense.notes || '-'}</td>
            <td>
                <div class="d-flex gap-2">
                    <a href="expense-record.html?expenseId=${expense._id}" class="btn btn-sm btn-outline-secondary">Edit</a>
                    <a href="expense-receipt.html?id=${expense._id}" target="_blank" class="btn btn-sm btn-outline-primary">Print</a>
                    <button type="button" class="btn btn-sm btn-outline-danger delete-expense-history-btn" data-expense-id="${expense._id}" data-voucher-no="${expense.voucherNo || '-'}">Delete</button>
                </div>
            </td>
        </tr>
    `).join('');

    tbody.querySelectorAll('.delete-expense-history-btn').forEach((button) => {
        button.addEventListener('click', async () => {
            const expenseId = button.dataset.expenseId;
            const voucherNo = button.dataset.voucherNo;
            const confirmed = window.confirm(`Delete expense voucher ${voucherNo}?`);
            if (!confirmed) return;

            try {
                const result = await API.fees.deleteExpense(expenseId);
                if (!result?.success) {
                    throw new Error(result?.message || 'Unable to delete expense');
                }

                await loadExpenseHistory(getExpenseFilters());
            } catch (error) {
                console.error(error);
                alert(error.message || 'Unable to delete expense');
            }
        });
    });
}

async function loadExpenseHistory(filters = {}) {
    const result = await API.fees.getExpenses(filters);
    if (!result || !result.success) {
        throw new Error(result?.message || 'Unable to fetch expense transactions');
    }

    renderExpenseHistory(result.expenses || [], result.totals || {});
}

async function loadExpenseHeadFilters() {
    const result = await API.fees.getExpenseHeads();
    if (result?.success) {
        populateExpenseHistoryHeads(result.heads || []);
    }
}

function getExpenseFilters() {
    return {
        headOfAccount: document.getElementById('expenseHeadFilter').value,
        paidTo: document.getElementById('expensePaidToFilter').value.trim(),
        paidFor: document.getElementById('expenseParticularFilter').value.trim(),
        paymentMode: document.getElementById('expensePaymentModeFilter').value,
        startDate: document.getElementById('expenseStartDate').value,
        endDate: document.getElementById('expenseEndDate').value
    };
}

function scheduleLiveExpenseFilter() {
    clearTimeout(expenseFilterTimer);
    expenseFilterTimer = setTimeout(async () => {
        try {
            await loadExpenseHistory(getExpenseFilters());
        } catch (error) {
            console.error(error);
        }
    }, 250);
}

document.addEventListener('DOMContentLoaded', async () => {
    if (!Auth.isAuthenticated()) {
        window.location.href = '../pages/login.html';
        return;
    }

    try {
        await Promise.all([
            loadExpenseHeadFilters(),
            loadExpenseHistory()
        ]);
    } catch (error) {
        console.error(error);
        renderExpenseHistory([], {});
    }

    document.getElementById('expenseTransactionFilterForm').addEventListener('submit', async (event) => {
        event.preventDefault();

        try {
            await loadExpenseHistory(getExpenseFilters());
        } catch (error) {
            console.error(error);
            alert(error.message || 'Unable to fetch expense transactions');
        }
    });

    document.getElementById('expenseParticularFilter').addEventListener('input', scheduleLiveExpenseFilter);
    document.getElementById('expensePaidToFilter').addEventListener('input', scheduleLiveExpenseFilter);
    document.getElementById('expenseHeadFilter').addEventListener('change', scheduleLiveExpenseFilter);
    document.getElementById('expensePaymentModeFilter').addEventListener('change', scheduleLiveExpenseFilter);
    document.getElementById('expenseStartDate').addEventListener('change', scheduleLiveExpenseFilter);
    document.getElementById('expenseEndDate').addEventListener('change', scheduleLiveExpenseFilter);

    document.getElementById('resetExpenseFiltersBtn').addEventListener('click', async () => {
        document.getElementById('expenseTransactionFilterForm').reset();
        try {
            await loadExpenseHistory();
        } catch (error) {
            console.error(error);
        }
    });
});
