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
let expenseHistoryRows = [];
let activeExpenseHistoryTab = 'all';

function expenseHasPaymentLabel(expense = {}, label = '') {
    const expected = String(label || '').toLowerCase();
    return (expense.paymentBreakdown || []).some((entry) => String(entry.modeLabel || '').toLowerCase() === expected);
}

function expenseHasHeadOfAccount(expense = {}, headName = '') {
    return String(expense.headOfAccount || '').trim().toLowerCase() === String(headName || '').trim().toLowerCase();
}

function filterExpenseRowsForActiveTab(expenses = []) {
    if (activeExpenseHistoryTab === 'due-list') {
        return expenses.filter((expense) => (
            expenseHasPaymentLabel(expense, 'Due') ||
            (expenseHasHeadOfAccount(expense, 'Due') && !expenseHasPaymentLabel(expense, 'Due Payment'))
        ));
    }

    if (activeExpenseHistoryTab === 'due-payment') {
        return expenses.filter((expense) => expenseHasPaymentLabel(expense, 'Due Payment'));
    }

    return expenses;
}

function getExpenseHistoryTotals(expenses = []) {
    return {
        totalAmount: expenses.reduce((sum, expense) => sum + (Number(expense.amount) || 0), 0),
        transactionCount: expenses.length
    };
}

function getDuePersonBalances(expenses = expenseHistoryRows) {
    return expenses.reduce((balances, expense) => {
        const name = String(expense.paidTo || '').trim();
        if (!name) return balances;

        if (!balances[name]) {
            balances[name] = 0;
        }

        if (expenseHasPaymentLabel(expense, 'Due Payment')) {
            balances[name] -= Number(expense.amount) || 0;
            return balances;
        }

        if (expenseHasPaymentLabel(expense, 'Due') || expenseHasHeadOfAccount(expense, 'Due')) {
            balances[name] += Number(expense.amount) || 0;
        }

        return balances;
    }, {});
}

function populateDuePaymentPeople() {
    const select = document.getElementById('duePaymentReceivedFrom');
    if (!select) return;

    const currentValue = select.value;
    const balances = getDuePersonBalances();
    const people = Object.entries(balances)
        .filter(([, balance]) => balance > 0)
        .sort(([nameA], [nameB]) => nameA.localeCompare(nameB));

    select.innerHTML = `
        <option value="">Select Person</option>
        ${people.map(([name, balance]) => `<option value="${name}">${name} - Due Rs. ${formatExpenseHistoryMoney(balance)}</option>`).join('')}
    `;

    if (currentValue && [...select.options].some((option) => option.value === currentValue)) {
        select.value = currentValue;
    }
    updateDuePaymentCurrentDue();
}

function updateDuePaymentCurrentDue() {
    const select = document.getElementById('duePaymentReceivedFrom');
    const dueInput = document.getElementById('duePaymentCurrentDue');
    if (!select || !dueInput) return;

    const balances = getDuePersonBalances();
    dueInput.value = formatExpenseHistoryMoney(balances[select.value] || 0);
}

function setDuePaymentFormVisibility() {
    const formCard = document.getElementById('duePaymentFormCard');
    if (!formCard) return;

    formCard.classList.toggle('d-none', activeExpenseHistoryTab !== 'due-payment');
    if (activeExpenseHistoryTab === 'due-payment') {
        populateDuePaymentPeople();
    }
}

function setExpenseHistoryTab(tabName = 'all') {
    const nextTab = ['all', 'due-list', 'due-payment'].includes(tabName) ? tabName : 'all';
    activeExpenseHistoryTab = nextTab;
    document.querySelectorAll('[data-expense-tab]').forEach((tabButton) => {
        tabButton.classList.toggle('active', tabButton.dataset.expenseTab === nextTab);
    });
    renderExpenseHistory(expenseHistoryRows);
    setDuePaymentFormVisibility();
}

function getExpenseTabFromHash() {
    return String(window.location.hash || '').replace('#', '').trim();
}

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
    const visibleExpenses = filterExpenseRowsForActiveTab(expenses);
    const visibleTotals = getExpenseHistoryTotals(visibleExpenses);
    document.getElementById('expenseHistoryTotalAmount').textContent = formatExpenseHistoryMoney(visibleTotals.totalAmount || 0);
    document.getElementById('expenseHistoryCount').textContent = visibleTotals.transactionCount || 0;

    if (!visibleExpenses.length) {
        tbody.innerHTML = `
            <tr>
                <td colspan="9" class="text-center text-muted py-4">No expense transactions found.</td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = visibleExpenses.map((expense) => `
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
            const editReason = window.prompt('Enter reason for deleting this expense:');
            if (!editReason || !editReason.trim()) {
                alert('Delete reason is required for deleting an expense.');
                return;
            }

            try {
                const result = await API.fees.deleteExpense(expenseId, { editReason: editReason.trim() });
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

    expenseHistoryRows = result.expenses || [];
    renderExpenseHistory(expenseHistoryRows, result.totals || {});
    populateDuePaymentPeople();
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

    document.querySelectorAll('[data-expense-tab]').forEach((button) => {
        button.addEventListener('click', () => {
            setExpenseHistoryTab(button.dataset.expenseTab || 'all');
        });
    });

    if (getExpenseTabFromHash()) {
        setExpenseHistoryTab(getExpenseTabFromHash());
    }

    window.addEventListener('hashchange', () => {
        setExpenseHistoryTab(getExpenseTabFromHash());
    });

    document.getElementById('duePaymentReceivedFrom').addEventListener('change', updateDuePaymentCurrentDue);

    document.getElementById('duePaymentForm').addEventListener('submit', async (event) => {
        event.preventDefault();

        const receivedFrom = document.getElementById('duePaymentReceivedFrom').value;
        const paymentMode = document.getElementById('duePaymentMode').value;
        const amount = Number(document.getElementById('duePaymentAmount').value) || 0;
        const notes = document.getElementById('duePaymentNotes').value.trim();
        const currentDue = Number(String(document.getElementById('duePaymentCurrentDue').value || '0').replace(/,/g, '')) || 0;

        if (!receivedFrom) {
            alert('Please select Received From.');
            return;
        }

        if (amount <= 0) {
            alert('Received amount must be greater than zero.');
            return;
        }

        if (amount > currentDue) {
            alert('Received amount cannot be greater than current due.');
            return;
        }

        const saveButton = document.getElementById('saveDuePaymentBtn');
        const originalHtml = saveButton.innerHTML;

        try {
            saveButton.disabled = true;
            saveButton.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>Saving';

            const voucherResult = await API.fees.getNextExpenseVoucher();
            if (!voucherResult?.success || !voucherResult.voucherNo) {
                throw new Error(voucherResult?.message || 'Unable to generate voucher number');
            }

            const result = await API.fees.saveExpense({
                voucherNo: voucherResult.voucherNo,
                headOfAccount: 'Due',
                paidTo: receivedFrom,
                paidFor: 'Due Payment',
                amount,
                paymentMode,
                paymentBreakdown: [{
                    modeLabel: 'Due Payment',
                    baseMode: paymentMode === 'Online' ? 'Online' : 'Cash',
                    amount
                }],
                expenseDate: new Date().toISOString().split('T')[0],
                notes
            });

            if (!result?.success) {
                throw new Error(result?.message || 'Unable to save due payment');
            }

            document.getElementById('duePaymentForm').reset();
            await loadExpenseHistory(getExpenseFilters());
            activeExpenseHistoryTab = 'due-payment';
            renderExpenseHistory(expenseHistoryRows);
            setDuePaymentFormVisibility();
            alert('Due payment saved successfully.');
        } catch (error) {
            console.error(error);
            alert(error.message || 'Unable to save due payment');
        } finally {
            saveButton.disabled = false;
            saveButton.innerHTML = originalHtml;
        }
    });
});
