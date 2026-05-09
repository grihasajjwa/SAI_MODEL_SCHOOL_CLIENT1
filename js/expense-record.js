let editingExpenseId = null;
let expenseOnlineAccountCounter = 0;
const expenseOnlineAccounts = [];

function formatExpenseMoney(value) {
    const amount = Number(value) || 0;
    return amount.toLocaleString('en-IN', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
}

function hideExpenseFormMessage() {
    const messageBox = document.getElementById('expenseFormMessage');
    if (!messageBox) return;

    messageBox.textContent = '';
    messageBox.classList.add('d-none');
}

function showExpenseFormMessage(message) {
    const messageBox = document.getElementById('expenseFormMessage');
    if (!messageBox) {
        alert(message);
        return;
    }

    messageBox.textContent = message;
    messageBox.classList.remove('d-none');
    messageBox.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function populateExpenseHeads(heads = [], selectedValue = '') {
    const select = document.getElementById('headOfAccount');
    select.innerHTML = `
        <option value="">Select Head of Account</option>
        ${heads.map((head) => `<option value="${head.name}" ${head.name === selectedValue ? 'selected' : ''}>${head.name}</option>`).join('')}
    `;
}

async function loadExpenseHeads(selectedValue = '') {
    const result = await API.fees.getExpenseHeads();
    if (!result || !result.success) {
        throw new Error(result?.message || 'Unable to fetch expense heads');
    }

    populateExpenseHeads(result.heads || [], selectedValue);
}

async function loadExpenseDashboard() {
    const result = await API.fees.getDashboard();
    if (!result?.success) {
        return;
    }

    const summary = result.summary || {};
    document.getElementById('expenseDashboardExpense').textContent = formatExpenseMoney(summary.totalExpense || 0);
    document.getElementById('expenseDashboardCollected').textContent = formatExpenseMoney(summary.totalCollected || 0);
    document.getElementById('expenseDashboardOutstanding').textContent = formatExpenseMoney(summary.totalOutstanding || 0);
    document.getElementById('expenseDashboardNet').textContent = formatExpenseMoney(summary.netBalance || 0);
}

function getExpensePaymentModeOptions() {
    const options = ['Cash', ...expenseOnlineAccounts];
    return options.map((option) => `<option value="${option}">${option}</option>`).join('');
}

function inferExpenseBaseMode(modeLabel = '') {
    return modeLabel === 'Cash' ? 'Cash' : 'Online';
}

function refreshExpensePaymentModeDropdowns() {
    document.querySelectorAll('.expense-payment-mode-select').forEach((select) => {
        const currentValue = select.value;
        select.innerHTML = getExpensePaymentModeOptions();
        if (currentValue && [...select.options].some((option) => option.value === currentValue)) {
            select.value = currentValue;
        }
    });
}

function addExpenseOnlineAccountLocally(label = '') {
    const fallbackLabel = `Online-${expenseOnlineAccountCounter + 1}`;
    const normalized = String(label || fallbackLabel).trim();
    if (!normalized) return '';

    if (!expenseOnlineAccounts.includes(normalized)) {
        expenseOnlineAccounts.push(normalized);
    }

    const suffix = Number(String(normalized).split('-')[1]);
    if (normalized.startsWith('Online-') && Number.isFinite(suffix)) {
        expenseOnlineAccountCounter = Math.max(expenseOnlineAccountCounter, suffix);
    } else {
        expenseOnlineAccountCounter += 1;
    }

    refreshExpensePaymentModeDropdowns();
    return normalized;
}

async function loadExpensePaymentAccounts() {
    const result = await API.fees.getPaymentAccounts();
    if (!result?.success) {
        return;
    }

    expenseOnlineAccounts.length = 0;
    expenseOnlineAccountCounter = 0;
    (result.accounts || []).forEach((account) => {
        addExpenseOnlineAccountLocally(account.name || account);
    });
    refreshExpensePaymentModeDropdowns();
}

async function promptAndAddExpenseOnlineAccount(targetSelect = null) {
    const suggested = `Online-${expenseOnlineAccountCounter + 1}`;
    const modeLabel = window.prompt('Enter online account name:', suggested);
    if (!modeLabel) return;

    const normalizedName = String(modeLabel).trim();
    if (!normalizedName) return;

    const result = await API.fees.createPaymentAccount(normalizedName);
    if (!result?.success) {
        throw new Error(result?.message || 'Unable to create online account');
    }

    const normalized = addExpenseOnlineAccountLocally(result.account?.name || normalizedName);
    if (targetSelect && normalized) {
        targetSelect.value = normalized;
        const row = targetSelect.closest('.expense-payment-entry-row');
        if (row) {
            row.dataset.modeLabel = normalized;
            row.dataset.baseMode = 'Online';
        }
        refreshExpenseFormState();
    }
}

function createExpensePaymentEntryRow(modeLabel = 'Cash', amount = '', removable = true) {
    if (modeLabel !== 'Cash') {
        addExpenseOnlineAccountLocally(modeLabel);
    }

    const row = document.createElement('div');
    row.className = 'expense-payment-entry-row payment-entry-row';
    row.dataset.modeLabel = modeLabel;
    row.dataset.baseMode = inferExpenseBaseMode(modeLabel);

    row.innerHTML = `
        <div class="row g-2 align-items-end">
            <div class="col-md-5">
                <label class="form-label">Payment Type</label>
                <select class="form-select expense-payment-mode-select">
                    ${getExpensePaymentModeOptions()}
                </select>
            </div>
            <div class="col-md-5">
                <label class="form-label">Amount</label>
                <div class="input-group">
                    <span class="input-group-text">Rs.</span>
                    <input type="number" class="form-control expense-payment-amount-input" min="0" step="0.01" value="${amount}">
                </div>
            </div>
            <div class="col-md-2 d-grid">
                <label class="form-label d-none d-md-block">&nbsp;</label>
                <button type="button" class="btn btn-outline-danger remove-expense-payment-btn" ${removable ? '' : 'disabled'} title="Remove payment">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        </div>
    `;

    const paymentModeSelect = row.querySelector('.expense-payment-mode-select');
    paymentModeSelect.value = modeLabel;

    function syncExpensePaymentRowState() {
        const currentMode = paymentModeSelect.value || 'Cash';
        row.dataset.baseMode = inferExpenseBaseMode(currentMode);
        row.dataset.modeLabel = currentMode;
    }

    paymentModeSelect.addEventListener('change', () => {
        syncExpensePaymentRowState();
        refreshExpenseFormState();
    });
    row.querySelector('.expense-payment-amount-input').addEventListener('input', refreshExpenseFormState);
    row.querySelector('.remove-expense-payment-btn').addEventListener('click', () => {
        row.remove();
        refreshExpenseFormState();
    });

    syncExpensePaymentRowState();

    return row;
}

function hydrateExpensePaymentBreakdown(entries = []) {
    const container = document.getElementById('expensePaymentEntriesContainer');
    container.innerHTML = '';

    const normalizedEntries = Array.isArray(entries) && entries.length
        ? entries
        : [{ modeLabel: 'Cash', amount: 0, baseMode: 'Cash' }];

    normalizedEntries.forEach((entry, index) => {
        const modeLabel = entry.modeLabel || entry.label || entry.paymentMode || 'Cash';
        container.appendChild(createExpensePaymentEntryRow(modeLabel, entry.amount || 0, index > 0));
    });

    const firstRemoveBtn = container.querySelector('.expense-payment-entry-row .remove-expense-payment-btn');
    if (firstRemoveBtn) {
        firstRemoveBtn.disabled = true;
    }

    refreshExpenseFormState();
}

function addExpensePaymentRow(modeLabel = 'Cash', amount = '') {
    const container = document.getElementById('expensePaymentEntriesContainer');
    container.appendChild(createExpensePaymentEntryRow(modeLabel, amount, true));
    refreshExpenseFormState();
}

function getExpensePaymentBreakdownPayload() {
    return Array.from(document.querySelectorAll('.expense-payment-entry-row'))
        .map((row) => ({
            modeLabel: row.dataset.modeLabel || 'Cash',
            baseMode: row.querySelector('.expense-payment-mode-select').value === 'Cash' ? 'Cash' : 'Online',
            amount: Number(row.querySelector('.expense-payment-amount-input').value) || 0
        }))
        .filter((entry) => entry.amount > 0 && entry.modeLabel);
}

function findDuplicateExpensePaymentModes(paymentBreakdown = getExpensePaymentBreakdownPayload()) {
    const seenModes = new Set();

    for (const entry of paymentBreakdown) {
        const modeKey = String(entry.modeLabel || '').trim().toLowerCase();
        if (!modeKey) continue;
        if (seenModes.has(modeKey)) {
            return entry.modeLabel;
        }
        seenModes.add(modeKey);
    }

    return null;
}

function getExpensePaymentModeSummary(paymentBreakdown = getExpensePaymentBreakdownPayload()) {
    const baseModes = [...new Set(paymentBreakdown.map((entry) => entry.baseMode))];
    if (!baseModes.length) return 'Cash';
    if (baseModes.length === 1) return baseModes[0];
    return 'Mixed';
}

function formatExpensePaymentBreakdown(paymentBreakdown = [], fallbackPaymentMode = '', fallbackAmount = 0) {
    if (Array.isArray(paymentBreakdown) && paymentBreakdown.length) {
        return paymentBreakdown
            .map((entry) => `${entry.modeLabel || entry.baseMode}: Rs. ${formatExpenseMoney(entry.amount)}`)
            .join(', ');
    }

    if (!fallbackPaymentMode) {
        return '-';
    }

    return `${fallbackPaymentMode}: Rs. ${formatExpenseMoney(fallbackAmount)}`;
}

function refreshExpenseFormState() {
    const totalAmount = getExpensePaymentBreakdownPayload().reduce((sum, entry) => sum + (Number(entry.amount) || 0), 0);
    document.getElementById('expenseAmount').value = totalAmount.toFixed(2);
}

function setExpenseFormMode() {
    const title = document.getElementById('expenseFormTitle');
    const saveButton = document.getElementById('saveExpenseBtn');
    const editReasonRow = document.getElementById('expenseEditReasonRow');
    const deleteButton = document.getElementById('deleteExpenseBtn');

    if (editingExpenseId) {
        title.textContent = 'Edit Expense Receipt';
        saveButton.innerHTML = '<i class="fas fa-pen me-2"></i>Update Expense';
        if (editReasonRow) editReasonRow.classList.remove('d-none');
        if (deleteButton) deleteButton.classList.toggle('d-none', !Auth.canDeleteFinance());
    } else {
        title.textContent = 'Expense Receipt';
        saveButton.innerHTML = '<i class="fas fa-save me-2"></i>Save Expense';
        if (editReasonRow) editReasonRow.classList.add('d-none');
        if (deleteButton) deleteButton.classList.add('d-none');
    }
}

async function loadNextExpenseVoucher() {
    const result = await API.fees.getNextExpenseVoucher();
    if (result?.success && result.voucherNo) {
        document.getElementById('expenseVoucherNo').value = result.voucherNo;
    }
}

function renderRecentExpenses(expenses = []) {
    const container = document.getElementById('recentExpenses');

    if (!expenses.length) {
        container.innerHTML = '<div class="text-muted">No expense vouchers recorded yet.</div>';
        return;
    }

    container.innerHTML = expenses.map((expense) => `
        <div class="recent-item">
            <div class="d-flex justify-content-between align-items-start gap-2">
                <div>
                    <div class="small text-success fw-semibold">
                        <i class="fas fa-receipt me-1"></i>
                        Voucher: ${expense.voucherNo || '-'}
                    </div>
                    <div class="small mt-2">${expense.headOfAccount || '-'}</div>
                </div>
                <div class="d-flex gap-2">
                    <a class="btn btn-sm btn-outline-secondary" href="expense-record.html?expenseId=${expense._id}">Edit</a>
                    <a class="btn btn-sm btn-outline-primary" href="expense-receipt.html?id=${expense._id}" target="_blank">Print</a>
                    ${Auth.canDeleteFinance() ? `<button type="button" class="btn btn-sm btn-outline-danger delete-expense-btn" data-expense-id="${expense._id}" data-voucher-no="${expense.voucherNo || '-'}">Delete</button>` : ''}
                </div>
            </div>
            <div class="small mt-2 fw-bold text-dark">Date: ${expense.expenseDate ? new Date(expense.expenseDate).toLocaleDateString('en-IN') : '-'}</div>
            <div class="small mt-2">Paid To: ${expense.paidTo || '-'}</div>
            <div class="small mt-1">Paid For: ${expense.paidFor || '-'}</div>
            <div class="small mt-1 fw-bold">Amount: Rs. ${formatExpenseMoney(expense.amount || 0)}</div>
            <div class="small mt-1">Payment: ${formatExpensePaymentBreakdown(expense.paymentBreakdown, expense.paymentMode, expense.amount)}</div>
        </div>
    `).join('');

    container.querySelectorAll('.delete-expense-btn').forEach((button) => {
        button.addEventListener('click', async () => {
            const expenseId = button.dataset.expenseId;
            const voucherNo = button.dataset.voucherNo;
            const confirmed = window.confirm(`Delete expense voucher ${voucherNo}?`);
            if (!confirmed) return;

            try {
                await deleteExpense(expenseId);
            } catch (error) {
                console.error(error);
                alert(error.message || 'Unable to delete expense');
            }
        });
    });
}

async function loadRecentExpenses() {
    const result = await API.fees.getExpenses({ limit: 10 });
    if (!result?.success) {
        document.getElementById('recentExpenses').innerHTML = '<div class="text-muted">Unable to load recent expenses.</div>';
        return;
    }

    renderRecentExpenses(result.expenses || []);
}

function populateExpenseFormForEdit(expense) {
    editingExpenseId = expense._id;
    document.getElementById('selectedExpenseId').value = expense._id || '';
    document.getElementById('expenseVoucherNo').value = expense.voucherNo || '';
    document.getElementById('expenseDate').value = expense.expenseDate ? new Date(expense.expenseDate).toISOString().split('T')[0] : '';
    document.getElementById('headOfAccount').value = expense.headOfAccount || '';
    document.getElementById('paidTo').value = expense.paidTo || '';
    document.getElementById('paidFor').value = expense.paidFor || '';
    document.getElementById('expenseNotes').value = expense.notes || '';

    const fallbackPaymentMode = expense.paymentMode === 'Cash' ? 'Cash' : 'Online-1';
    hydrateExpensePaymentBreakdown(
        expense.paymentBreakdown?.length
            ? expense.paymentBreakdown
            : [{ modeLabel: fallbackPaymentMode, baseMode: inferExpenseBaseMode(fallbackPaymentMode), amount: expense.amount || 0 }]
    );

    setExpenseFormMode();
}

async function loadExpenseForEdit(expenseId) {
    const result = await API.fees.getExpense(expenseId);
    if (!result || !result.success) {
        throw new Error(result?.message || 'Unable to load expense for editing');
    }

    await loadExpenseHeads(result.expense?.headOfAccount || '');
    populateExpenseFormForEdit(result.expense);
}

async function deleteExpense(expenseId) {
    const reasonInput = document.getElementById('expenseEditReason');
    const promptReason = reasonInput?.value.trim() || window.prompt('Reason for deleting this expense:') || '';
    const editReason = String(promptReason).trim();
    if (!editReason) {
        throw new Error('Delete reason is required for deleting an expense');
    }

    const result = await API.fees.deleteExpense(expenseId, { editReason });
    if (!result?.success) {
        throw new Error(result?.message || 'Unable to delete expense');
    }

    if (editingExpenseId === expenseId) {
        await resetExpenseForm();
    }

    await Promise.all([
        loadRecentExpenses(),
        loadExpenseDashboard()
    ]);
}

async function resetExpenseForm() {
    hideExpenseFormMessage();
    editingExpenseId = null;
    document.getElementById('selectedExpenseId').value = '';
    document.getElementById('expenseForm').reset();
    document.getElementById('expenseDate').value = new Date().toISOString().split('T')[0];
    const expenseEditReason = document.getElementById('expenseEditReason');
    if (expenseEditReason) expenseEditReason.value = '';
    document.getElementById('expensePaymentEntriesContainer').innerHTML = '';
    hydrateExpensePaymentBreakdown([{ modeLabel: 'Cash', baseMode: 'Cash', amount: 0 }]);
    await loadExpenseHeads();
    await loadNextExpenseVoucher();
    setExpenseFormMode();
}

document.addEventListener('DOMContentLoaded', async () => {
    if (!Auth.isAuthenticated()) {
        window.location.href = '../pages/login.html';
        return;
    }

    if (!Auth.canManageFinance()) {
        alert('Only admin or accountant can manage expenses.');
        window.location.href = 'expense-transactions.html';
        return;
    }

    const prefilledExpenseId = new URLSearchParams(window.location.search).get('expenseId');

    try {
        await Promise.all([
            loadExpensePaymentAccounts(),
            loadExpenseDashboard(),
            loadRecentExpenses()
        ]);

        await resetExpenseForm();

        if (prefilledExpenseId) {
            await loadExpenseForEdit(prefilledExpenseId);
        }
    } catch (error) {
        console.error(error);
    }

    document.getElementById('addExpenseHeadBtn').addEventListener('click', async () => {
        const name = window.prompt('Enter new head of account');
        if (!name) return;

        try {
            const result = await API.fees.createExpenseHead(name.trim());
            if (!result || !result.success) {
                throw new Error(result?.message || 'Unable to create head of account');
            }

            await loadExpenseHeads(result.head?.name || name.trim());
        } catch (error) {
            console.error(error);
            alert(error.message || 'Unable to create head of account');
        }
    });

    document.getElementById('addExpenseOnlineAccountBtn').addEventListener('click', async () => {
        try {
            await promptAndAddExpenseOnlineAccount();
        } catch (error) {
            console.error(error);
            alert(error.message || 'Unable to create online account');
        }
    });

    document.getElementById('addExpensePaymentRowBtn').addEventListener('click', () => addExpensePaymentRow('Cash', 0));

    document.getElementById('expenseForm').addEventListener('submit', async (event) => {
        event.preventDefault();
        hideExpenseFormMessage();

        const paymentBreakdown = getExpensePaymentBreakdownPayload();
        const duplicatePaymentMode = findDuplicateExpensePaymentModes(paymentBreakdown);
        const payload = {
            voucherNo: document.getElementById('expenseVoucherNo').value.trim(),
            headOfAccount: document.getElementById('headOfAccount').value,
            paidTo: document.getElementById('paidTo').value.trim(),
            paidFor: document.getElementById('paidFor').value.trim(),
            amount: Number(document.getElementById('expenseAmount').value) || 0,
            paymentMode: getExpensePaymentModeSummary(paymentBreakdown),
            paymentBreakdown,
            expenseDate: document.getElementById('expenseDate').value,
            notes: document.getElementById('expenseNotes').value.trim()
        };

        if (editingExpenseId) {
            payload.editReason = document.getElementById('expenseEditReason')?.value.trim() || '';
        }

        if (!payload.voucherNo || !payload.headOfAccount || !payload.paidTo || !payload.paidFor) {
            showExpenseFormMessage('Voucher no., head of account, paid to and paid for are required.');
            return;
        }

        if (!payload.expenseDate) {
            showExpenseFormMessage('Expense date is required.');
            return;
        }

        if (!paymentBreakdown.length || payload.amount <= 0) {
            showExpenseFormMessage('Please add at least one payment row with amount.');
            return;
        }

        if (duplicatePaymentMode) {
            showExpenseFormMessage(`Payment type "${duplicatePaymentMode}" is selected more than once. Please use different payment types.`);
            return;
        }

        if (editingExpenseId && !payload.editReason) {
            showExpenseFormMessage('Reason for edit is required when updating an expense.');
            return;
        }

        const saveButton = document.getElementById('saveExpenseBtn');
        const originalHtml = saveButton.innerHTML;

        try {
            saveButton.disabled = true;
            saveButton.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>Saving...';

            const result = editingExpenseId
                ? await API.fees.updateExpense(editingExpenseId, payload)
                : await API.fees.saveExpense(payload);

            if (!result || !result.success) {
                throw new Error(result?.message || 'Unable to save expense');
            }

            const expenseId = result.expense?._id;
            alert(editingExpenseId
                ? `Expense updated successfully. Voucher No: ${result.expense?.voucherNo || '-'}`
                : `Expense saved successfully. Voucher No: ${result.expense?.voucherNo || '-'}`);

            await Promise.all([
                loadExpenseDashboard(),
                loadRecentExpenses()
            ]);

            await resetExpenseForm();

            if (expenseId) {
                window.open(`expense-receipt.html?id=${expenseId}`, '_blank');
            }
        } catch (error) {
            console.error(error);
            showExpenseFormMessage(error.message || 'Unable to save expense');
        } finally {
            saveButton.disabled = false;
            saveButton.innerHTML = originalHtml;
        }
    });

    document.getElementById('resetExpenseFormBtn').addEventListener('click', async () => {
        await resetExpenseForm();
        window.history.replaceState({}, '', 'expense-record.html');
    });

    document.getElementById('deleteExpenseBtn').addEventListener('click', async () => {
        if (!editingExpenseId) return;

        const confirmed = window.confirm('Delete this expense? It will stay recoverable in audit.');
        if (!confirmed) return;

        try {
            await deleteExpense(editingExpenseId);
            alert('Expense deleted successfully.');
            await resetExpenseForm();
            window.history.replaceState({}, '', 'expense-record.html');
        } catch (error) {
            console.error(error);
            showExpenseFormMessage(error.message || 'Unable to delete expense');
        }
    });
});
