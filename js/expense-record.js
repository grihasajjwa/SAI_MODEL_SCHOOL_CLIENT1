let editingExpenseId = null;
let expenseOnlineAccountCounter = 0;
const expenseOnlineAccounts = [];
let fuelOptions = {
    centres: [],
    vehicles: []
};
let supplierOptions = { suppliers: [] };
let salaryDueOptions = { employees: [] };
let salaryPaymentPrefillDetails = null;

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

function escapeExpenseHtml(value) {
    return String(value || '').replace(/[&<>"']/g, (char) => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    }[char]));
}

function populateExpenseHeads(heads = [], selectedValue = '') {
    const select = document.getElementById('headOfAccount');
    select.innerHTML = `
        <option value="">Select Head of Account</option>
        ${heads.map((head) => `<option value="${head.name}" ${head.name === selectedValue ? 'selected' : ''}>${head.name}</option>`).join('')}
    `;
}

function getSalaryDuePersonLabel(employee = {}) {
    return [employee.name, employee.designation, employee.employeeType]
        .filter(Boolean)
        .join(' - ');
}

function populateSalaryDueDropdown(selectedPerson = '') {
    const dueSelect = document.getElementById('salaryDuePerson');
    if (!dueSelect) return;

    dueSelect.innerHTML = `
        <option value="">Select Teacher / Staff</option>
        ${salaryDueOptions.employees.map((employee) => {
            const name = employee.name || '';
            const label = getSalaryDuePersonLabel(employee) || name;
            return `<option value="${escapeExpenseHtml(name)}" ${name === selectedPerson ? 'selected' : ''}>${escapeExpenseHtml(label)}</option>`;
        }).join('')}
    `;
}

async function loadSalaryDueOptions(selectedPerson = '') {
    const result = await API.salary.getEmployees();
    if (!result?.success) return;
    salaryDueOptions = { employees: result.employees || [] };
    populateSalaryDueDropdown(selectedPerson);
}

function populateFuelDropdowns(selectedCentre = '') {
    const centreSelect = document.getElementById('fuelCentreName');
    if (!centreSelect) return;

    centreSelect.innerHTML = `
        <option value="">Select Fuel Centre</option>
        ${fuelOptions.centres.map((centre) => {
            const name = centre.name || centre;
            return `<option value="${name}" ${name === selectedCentre ? 'selected' : ''}>${name}</option>`;
        }).join('')}
    `;

}

async function loadFuelOptions(selectedCentre = '') {
    const result = await API.fuel.getOptions();
    if (!result?.success) {
        return;
    }

    fuelOptions = {
        centres: result.centres || [],
        vehicles: result.vehicles || []
    };
    populateFuelDropdowns(selectedCentre);
}

function populateSupplierDropdowns(selectedSupplier = '') {
    const supplierSelect = document.getElementById('supplierName');
    if (!supplierSelect) return;
    supplierSelect.innerHTML = `
        <option value="">Select Supplier</option>
        ${supplierOptions.suppliers.map((supplier) => {
            const name = supplier.name || supplier;
            return `<option value="${name}" ${name === selectedSupplier ? 'selected' : ''}>${name}</option>`;
        }).join('')}
    `;
}

async function loadSupplierOptions(selectedSupplier = '') {
    const result = await API.suppliers.getOptions();
    if (!result?.success) return;
    supplierOptions = { suppliers: result.suppliers || [] };
    populateSupplierDropdowns(selectedSupplier);
}

function isFuelExpenseSelected() {
    const head = document.getElementById('headOfAccount')?.value.toLowerCase() || '';
    const paidFor = document.getElementById('paidFor')?.value.toLowerCase() || '';
    return head.includes('fuel') || paidFor.includes('fuel');
}

function refreshFuelDetailsVisibility() {
    const fuelCard = document.getElementById('fuelDetailsCard');
    if (!fuelCard) return;

    const isFuel = isFuelExpenseSelected();
    fuelCard.classList.toggle('d-none', !isFuel);

    ['fuelCentreName'].forEach((id) => {
        const field = document.getElementById(id);
        if (field) field.required = isFuel;
    });

    if (isFuel) {
        const centre = document.getElementById('fuelCentreName')?.value || '';
        const paidToInput = document.getElementById('paidTo');
        if (centre && paidToInput && !paidToInput.value.trim()) {
            paidToInput.value = centre;
        }
    }
}

function isSupplierExpenseSelected() {
    const head = document.getElementById('headOfAccount')?.value.toLowerCase() || '';
    const paidFor = document.getElementById('paidFor')?.value.toLowerCase() || '';
    return head.includes('supplier') || paidFor.includes('supplier') || paidFor.includes('purchase payment');
}

function isSalaryDueExpenseSelected() {
    const head = document.getElementById('headOfAccount')?.value.trim().toLowerCase() || '';
    return head === 'due';
}

function refreshSalaryDueDetailsVisibility() {
    const dueCard = document.getElementById('salaryDueDetailsCard');
    if (!dueCard) return;

    const isDue = isSalaryDueExpenseSelected();
    dueCard.classList.toggle('d-none', !isDue);

    const field = document.getElementById('salaryDuePerson');
    if (field) field.required = isDue;

    if (isDue) {
        const person = field?.value || '';
        const paidToInput = document.getElementById('paidTo');
        if (person && paidToInput && !paidToInput.value.trim()) {
            paidToInput.value = person;
        }
    }
}

function refreshSupplierDetailsVisibility() {
    const supplierCard = document.getElementById('supplierDetailsCard');
    if (!supplierCard) return;
    const isSupplier = isSupplierExpenseSelected();
    supplierCard.classList.toggle('d-none', !isSupplier);
    const field = document.getElementById('supplierName');
    if (field) field.required = isSupplier;
    if (isSupplier) {
        const supplier = field?.value || '';
        const paidToInput = document.getElementById('paidTo');
        if (supplier && paidToInput && !paidToInput.value.trim()) {
            paidToInput.value = supplier;
        }
    }
}

function getFuelDetailsPayload() {
    if (!isFuelExpenseSelected()) {
        return null;
    }

    return {
        fuelDate: document.getElementById('expenseDate').value,
        fuelCentreName: document.getElementById('fuelCentreName').value,
        amount: Number(document.getElementById('expenseAmount').value) || 0,
        notes: document.getElementById('expenseNotes').value.trim()
    };
}

function validateFuelDetailsPayload(payload) {
    if (!payload) return '';
    if (!payload.fuelCentreName) {
        return 'Fuel centre name is required for fuel expenses.';
    }
    return '';
}

function getSupplierDetailsPayload() {
    if (!isSupplierExpenseSelected()) return null;
    return {
        entryDate: document.getElementById('expenseDate').value,
        supplierName: document.getElementById('supplierName').value,
        amount: Number(document.getElementById('expenseAmount').value) || 0,
        notes: document.getElementById('expenseNotes').value.trim()
    };
}

function validateSupplierDetailsPayload(payload) {
    if (!payload) return '';
    if (!payload.supplierName) return 'Supplier name is required for supplier payment.';
    return '';
}

function validateSalaryDueDetails() {
    if (!isSalaryDueExpenseSelected()) return '';
    if (!document.getElementById('salaryDuePerson')?.value) {
        return 'Teacher / staff name is required for Due expense.';
    }
    return '';
}

function populateFuelDetailsForEdit(fuelDetails = null) {
    if (!fuelDetails) {
        populateFuelDropdowns();
        refreshFuelDetailsVisibility();
        return;
    }

    populateFuelDropdowns(fuelDetails.fuelCentreName || '');
    refreshFuelDetailsVisibility();
}

function populateSupplierDetailsForEdit(supplierDetails = null) {
    if (!supplierDetails) {
        populateSupplierDropdowns();
        refreshSupplierDetailsVisibility();
        return;
    }
    populateSupplierDropdowns(supplierDetails.supplierName || '');
    refreshSupplierDetailsVisibility();
}

function populateSalaryDueDetailsForEdit(personName = '') {
    populateSalaryDueDropdown(personName || '');
    refreshSalaryDueDetailsVisibility();
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
    const options = ['Cash', 'Due', 'Due Payment', ...expenseOnlineAccounts];
    return options.map((option) => `<option value="${option}">${option}</option>`).join('');
}

function inferExpenseBaseMode(modeLabel = '') {
    return ['Cash', 'Due', 'Due Payment'].includes(modeLabel) ? 'Cash' : 'Online';
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
            baseMode: inferExpenseBaseMode(row.querySelector('.expense-payment-mode-select').value || 'Cash'),
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

function isSalaryAdvanceOnlyAdjustment(paymentBreakdown = getExpensePaymentBreakdownPayload()) {
    return !paymentBreakdown.length
        && String(document.getElementById('headOfAccount')?.value || '').trim().toLowerCase() === 'salary'
        && Number(salaryPaymentPrefillDetails?.advanceAdjusted) > 0;
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
    salaryPaymentPrefillDetails = expense.salaryDetails || null;
    document.getElementById('selectedExpenseId').value = expense._id || '';
    document.getElementById('expenseVoucherNo').value = expense.voucherNo || '';
    document.getElementById('expenseDate').value = expense.expenseDate ? new Date(expense.expenseDate).toISOString().split('T')[0] : '';
    document.getElementById('headOfAccount').value = expense.headOfAccount || '';
    document.getElementById('paidTo').value = expense.paidTo || '';
    document.getElementById('paidFor').value = expense.paidFor || '';
    document.getElementById('expenseNotes').value = expense.notes || '';
    populateFuelDetailsForEdit(expense.fuelDetails || null);
    populateSupplierDetailsForEdit(expense.supplierDetails || null);
    populateSalaryDueDetailsForEdit(expense.paidTo || '');

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
    salaryPaymentPrefillDetails = null;
    document.getElementById('selectedExpenseId').value = '';
    document.getElementById('expenseForm').reset();
    document.getElementById('expenseDate').value = new Date().toISOString().split('T')[0];
    const expenseEditReason = document.getElementById('expenseEditReason');
    if (expenseEditReason) expenseEditReason.value = '';
    document.getElementById('expensePaymentEntriesContainer').innerHTML = '';
    hydrateExpensePaymentBreakdown([{ modeLabel: 'Cash', baseMode: 'Cash', amount: 0 }]);
    await loadExpenseHeads();
    populateFuelDetailsForEdit(null);
    populateSupplierDetailsForEdit(null);
    populateSalaryDueDetailsForEdit(null);
    await loadNextExpenseVoucher();
    setExpenseFormMode();
}

async function applySupplierPaymentPrefill(supplierName = '') {
    const normalizedSupplier = String(supplierName || '').trim();
    if (!normalizedSupplier) return;

    document.getElementById('headOfAccount').value = 'Supplier Payment';
    document.getElementById('paidTo').value = normalizedSupplier;
    document.getElementById('paidFor').value = 'Supplier Payment';
    populateSupplierDropdowns(normalizedSupplier);
    document.getElementById('supplierName').value = normalizedSupplier;
    refreshSupplierDetailsVisibility();
}

function parseSalaryAmountDetails(value = '') {
    try {
        const details = JSON.parse(value || '[]');
        if (!Array.isArray(details)) return [];
        return details
            .map((detail) => ({
                label: String(detail?.label || '').trim(),
                amount: Number(detail?.amount) || 0
            }))
            .filter((detail) => detail.label && detail.amount > 0);
    } catch (error) {
        return [];
    }
}

function formatSalaryAmountDetails(details = []) {
    if (!details.length) return '-';
    return details
        .map((detail) => `${detail.label}: Rs. ${formatExpenseMoney(detail.amount)}`)
        .join(', ');
}

async function applySalaryPaymentPrefill(params) {
    const employeeName = String(params.get('employeeName') || '').trim();
    const amount = Number(params.get('amount')) || 0;
    const advanceAdjusted = Number(params.get('advanceAdjusted')) || 0;
    if (!employeeName || (amount <= 0 && advanceAdjusted <= 0)) return;

    const designation = String(params.get('designation') || '').trim();
    const employeeType = String(params.get('employeeType') || '').trim();
    const salaryMonth = String(params.get('salaryMonth') || '').trim();
    const salaryDate = String(params.get('salaryDate') || '').trim();
    const grossSalary = Number(params.get('grossSalary')) || amount;
    const paymentMode = String(params.get('paymentMode') || 'Cash').trim() || 'Cash';
    const remarks = String(params.get('remarks') || '').trim();
    const totalDebit = Number(params.get('totalDebit')) || advanceAdjusted;
    const advanceCarryForward = Number(params.get('advanceCarryForward')) || 0;
    const creditDetails = parseSalaryAmountDetails(params.get('creditDetails') || '');
    const debitDetails = parseSalaryAmountDetails(params.get('debitDetails') || '');
    const paidForParts = ['Salary'];

    if (salaryMonth) paidForParts.push(`for ${salaryMonth}`);
    if (designation) paidForParts.push(`(${designation})`);

    document.getElementById('headOfAccount').value = 'Salary';
    document.getElementById('paidTo').value = employeeName;
    document.getElementById('paidFor').value = paidForParts.join(' ');
    document.getElementById('expenseNotes').value = [
        employeeType ? `Type: ${employeeType}` : '',
        `Credit: ${formatSalaryAmountDetails(creditDetails)}`,
        `Total Credit: Rs. ${formatExpenseMoney(grossSalary)}`,
        `Debit: ${formatSalaryAmountDetails(debitDetails)}`,
        `Total Debit: Rs. ${formatExpenseMoney(totalDebit)}`,
        `Net Payable: Rs. ${formatExpenseMoney(amount)}`,
        advanceAdjusted > 0 ? `Advance adjusted in this salary: Rs. ${formatExpenseMoney(advanceAdjusted)}` : '',
        advanceCarryForward > 0 ? `Advance remaining to carry forward next salary: Rs. ${formatExpenseMoney(advanceCarryForward)}` : 'Advance remaining to carry forward next salary: Rs. 0.00',
        remarks
    ].filter(Boolean).join(' | ');

    salaryPaymentPrefillDetails = {
        employeeName,
        salaryMonth,
        grossSalary,
        advanceAdjusted
    };

    if (salaryDate) {
        document.getElementById('expenseDate').value = salaryDate;
    }

    hydrateExpensePaymentBreakdown([{
        modeLabel: paymentMode,
        baseMode: inferExpenseBaseMode(paymentMode),
        amount
    }]);

    refreshFuelDetailsVisibility();
    refreshSupplierDetailsVisibility();
    refreshSalaryDueDetailsVisibility();
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

    const pageParams = new URLSearchParams(window.location.search);
    const prefilledExpenseId = pageParams.get('expenseId');
    const supplierPaymentName = pageParams.get('supplierName') || '';

    try {
        await Promise.all([
            loadExpensePaymentAccounts(),
            loadFuelOptions(),
            loadSupplierOptions(),
            loadSalaryDueOptions(),
            loadExpenseDashboard(),
            loadRecentExpenses()
        ]);

        await resetExpenseForm();

        if (prefilledExpenseId) {
            await loadExpenseForEdit(prefilledExpenseId);
        } else if (pageParams.get('supplierPayment') === '1') {
            await applySupplierPaymentPrefill(supplierPaymentName);
        } else if (pageParams.get('salaryPayment') === '1') {
            await applySalaryPaymentPrefill(pageParams);
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

    document.getElementById('headOfAccount').addEventListener('change', () => {
        refreshFuelDetailsVisibility();
        refreshSupplierDetailsVisibility();
        refreshSalaryDueDetailsVisibility();
    });
    document.getElementById('paidFor').addEventListener('input', () => {
        refreshFuelDetailsVisibility();
        refreshSupplierDetailsVisibility();
    });
    document.getElementById('fuelCentreName').addEventListener('change', () => {
        const centre = document.getElementById('fuelCentreName').value;
        if (centre) {
            document.getElementById('paidTo').value = centre;
        }
    });

    document.getElementById('addFuelCentreBtn').addEventListener('click', async () => {
        const name = window.prompt('Enter fuel centre name:');
        if (!name) return;

        try {
            const result = await API.fuel.createCentre(name.trim());
            if (!result?.success) {
                throw new Error(result?.message || 'Unable to create fuel centre');
            }

            await loadFuelOptions(result.centre?.name || name.trim(), '');
            document.getElementById('paidTo').value = result.centre?.name || name.trim();
        } catch (error) {
            console.error(error);
            alert(error.message || 'Unable to create fuel centre');
        }
    });

    document.getElementById('supplierName').addEventListener('change', () => {
        const supplier = document.getElementById('supplierName').value;
        if (supplier) document.getElementById('paidTo').value = supplier;
    });

    document.getElementById('salaryDuePerson').addEventListener('change', () => {
        const person = document.getElementById('salaryDuePerson').value;
        if (person) document.getElementById('paidTo').value = person;
    });

    document.getElementById('addSupplierBtn').addEventListener('click', async () => {
        const name = window.prompt('Enter supplier name:');
        if (!name) return;
        try {
            const result = await API.suppliers.createSupplier({ name: name.trim() });
            if (!result?.success) throw new Error(result?.message || 'Unable to create supplier');
            await loadSupplierOptions(result.supplier?.name || name.trim());
            document.getElementById('paidTo').value = result.supplier?.name || name.trim();
        } catch (error) {
            console.error(error);
            alert(error.message || 'Unable to create supplier');
        }
    });

    document.getElementById('expenseForm').addEventListener('submit', async (event) => {
        event.preventDefault();
        hideExpenseFormMessage();

        const paymentBreakdown = getExpensePaymentBreakdownPayload();
        const duplicatePaymentMode = findDuplicateExpensePaymentModes(paymentBreakdown);
        const fuelDetails = getFuelDetailsPayload();
        const supplierDetails = getSupplierDetailsPayload();
        const payload = {
            voucherNo: document.getElementById('expenseVoucherNo').value.trim(),
            headOfAccount: document.getElementById('headOfAccount').value,
            paidTo: document.getElementById('paidTo').value.trim(),
            paidFor: document.getElementById('paidFor').value.trim(),
            amount: Number(document.getElementById('expenseAmount').value) || 0,
            paymentMode: getExpensePaymentModeSummary(paymentBreakdown),
            paymentBreakdown,
            expenseDate: document.getElementById('expenseDate').value,
            notes: document.getElementById('expenseNotes').value.trim(),
            fuelDetails,
            supplierDetails,
            salaryDetails: salaryPaymentPrefillDetails
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

        if ((!paymentBreakdown.length || payload.amount <= 0) && !isSalaryAdvanceOnlyAdjustment(paymentBreakdown)) {
            showExpenseFormMessage('Please add at least one payment row with amount.');
            return;
        }

        if (duplicatePaymentMode) {
            showExpenseFormMessage(`Payment type "${duplicatePaymentMode}" is selected more than once. Please use different payment types.`);
            return;
        }

        const fuelValidationMessage = validateFuelDetailsPayload(fuelDetails);
        if (fuelValidationMessage) {
            showExpenseFormMessage(fuelValidationMessage);
            return;
        }
        const supplierValidationMessage = validateSupplierDetailsPayload(supplierDetails);
        if (supplierValidationMessage) {
            showExpenseFormMessage(supplierValidationMessage);
            return;
        }
        const salaryDueValidationMessage = validateSalaryDueDetails();
        if (salaryDueValidationMessage) {
            showExpenseFormMessage(salaryDueValidationMessage);
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
