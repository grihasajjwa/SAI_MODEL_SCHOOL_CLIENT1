const DEFAULT_FEE_PARTICULARS = [
    'Admission Fee',
    'Re-Admission Fee',
    'Development Fee',
    'Tuition Fee',
    'Exam Fee',
    'Books Fee',
    'Uniform Fee',
    'Diary Fee',
    'I-card',
    'Library',
    'Computer Lab',
    'AC Fee',
    'Digital Smart class',
    'Exercise Copy',
    'Transport Fee',
    'Late Fee',
    'Others',
    'Due Payment'
];

let selectedStudent = null;
let editingReceiptId = null;
let onlineAccountCounter = 0;
let recentTransactionsCache = [];
const customParticulars = new Set();
const onlineAccounts = [];
const queryParams = new URLSearchParams(window.location.search);
const shouldPrefillDuePayment = queryParams.get('collectDue') === '1';

function hasTuitionFee(lineItems = getLineItemsPayload()) {
    return lineItems.some((item) => item.particular === 'Tuition Fee');
}

function monthOptions() {
    return [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
    ];
}

function formatMoney(value) {
    const amount = Number(value) || 0;
    return amount.toLocaleString('en-IN', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
}

function calculateClosingBalance(currentDueTotal, paidAmount) {
    const dueTotal = Number(currentDueTotal) || 0;
    const paid = Number(paidAmount) || 0;
    return dueTotal - paid;
}

function hideFeeFormMessage() {
    const messageBox = document.getElementById('feeFormMessage');
    if (!messageBox) return;

    messageBox.textContent = '';
    messageBox.classList.add('d-none');
}

function showFeeFormMessage(message) {
    const messageBox = document.getElementById('feeFormMessage');
    if (!messageBox) {
        alert(message);
        return;
    }

    messageBox.textContent = message;
    messageBox.classList.remove('d-none');
    messageBox.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function setTodayAsPaymentDate() {
    const paymentDateInput = document.getElementById('paymentDate');
    if (paymentDateInput && !paymentDateInput.value) {
        paymentDateInput.value = new Date().toISOString().split('T')[0];
    }
}

function getAllParticulars() {
    return [...new Set([...DEFAULT_FEE_PARTICULARS, ...Array.from(customParticulars)])].sort((a, b) => a.localeCompare(b));
}

function normalizeFeeParticular(value = '') {
    return String(value || '')
        .trim()
        .replace(/\s+/g, ' ')
        .toLowerCase()
        .replace(/\b[a-z]/g, (letter) => letter.toUpperCase());
}

function normalizeAdmissionNo(value = '') {
    return String(value || '').trim().toUpperCase();
}

function rememberCustomParticular(value) {
    const particular = normalizeFeeParticular(value);
    if (!particular) return;
    customParticulars.add(particular);
}

async function loadFeeParticulars() {
    const result = await API.fees.getParticulars();
    if (!result?.success) {
        return;
    }

    (result.particulars || []).forEach((particular) => {
        rememberCustomParticular(particular.name || particular);
    });

    refreshParticularDropdowns();
}

function createParticularOptions(selectedValue = '') {
    const normalizedSelectedValue = normalizeFeeParticular(selectedValue);
    return `
        <option value="">Select Particular</option>
        ${getAllParticulars().map((item) => `<option value="${item}" ${item === normalizedSelectedValue ? 'selected' : ''}>${item}</option>`).join('')}
    `;
}

function refreshParticularDropdowns() {
    document.querySelectorAll('.particular-select').forEach((select) => {
        const currentValue = normalizeFeeParticular(select.value);
        select.innerHTML = createParticularOptions(currentValue);
        select.value = currentValue;
    });
}

async function promptAndAddParticular(targetSelect = null) {
    const particular = window.prompt('Enter new particular name:');
    if (!particular) return;

    const normalized = normalizeFeeParticular(particular);
    if (!normalized) return;

    const result = await API.fees.createParticular(normalized);
    if (!result?.success) {
        alert(result?.message || 'Unable to save fee particular');
        return;
    }

    rememberCustomParticular(result.particular?.name || normalized);
    refreshParticularDropdowns();

    if (targetSelect) {
        targetSelect.value = result.particular?.name || normalized;
        setDefaultMonthForTuition();
        refreshFeeFormState();
    }
}

function getPaymentModeOptions() {
    const options = ['Cash', ...onlineAccounts];
    return `
        <option value="">Select</option>
        ${options.map((option) => `<option value="${option}">${option}</option>`).join('')}
    `;
}

function inferBaseMode(modeLabel = '') {
    if (!modeLabel) return '';
    return modeLabel === 'Cash' ? 'Cash' : 'Online';
}

function refreshPaymentModeDropdowns() {
    document.querySelectorAll('.payment-mode-select').forEach((select) => {
        const currentValue = select.value;
        select.innerHTML = getPaymentModeOptions();
        if (currentValue && [...select.options].some((option) => option.value === currentValue)) {
            select.value = currentValue;
        }
    });
}

function addOnlineAccountLocally(label = '') {
    const fallbackLabel = `Online-${onlineAccountCounter + 1}`;
    const normalized = String(label || fallbackLabel).trim();
    if (!normalized) return '';
    if (!onlineAccounts.includes(normalized)) {
        onlineAccounts.push(normalized);
    }

    const suffix = Number(String(normalized).split('-')[1]);
    if (normalized.startsWith('Online-') && Number.isFinite(suffix)) {
        onlineAccountCounter = Math.max(onlineAccountCounter, suffix);
    } else {
        onlineAccountCounter += 1;
    }

    refreshPaymentModeDropdowns();
    return normalized;
}

async function loadPaymentAccounts() {
    const result = await API.fees.getPaymentAccounts();
    if (!result?.success) {
        return;
    }

    onlineAccounts.length = 0;
    onlineAccountCounter = 0;

    (result.accounts || []).forEach((account) => {
        addOnlineAccountLocally(account.name || account);
    });

    refreshPaymentModeDropdowns();
}

async function promptAndAddOnlineAccount(targetSelect = null) {
    const suggested = `Online-${onlineAccountCounter + 1}`;
    const modeLabel = window.prompt('Enter online account name:', suggested);
    if (!modeLabel) return;

    const normalizedName = String(modeLabel).trim();
    if (!normalizedName) return;

    const result = await API.fees.createPaymentAccount(normalizedName);
    if (!result?.success) {
        alert(result?.message || 'Unable to create online account');
        return;
    }

    const normalized = addOnlineAccountLocally(result.account?.name || normalizedName);
    if (targetSelect && normalized) {
        targetSelect.value = normalized;
        const row = targetSelect.closest('.payment-entry-row');
        if (row) {
            row.dataset.modeLabel = normalized;
            row.dataset.baseMode = 'Online';
        }
        refreshFeeFormState();
    }
}

function isLineItemRowBlank(row) {
    const particular = normalizeFeeParticular(row.querySelector('.particular-select')?.value || '');
    const amount = Number(row.querySelector('.amount-input')?.value) || 0;
    return !particular && amount <= 0;
}

function focusFirstPaymentType() {
    document.querySelector('.payment-mode-select')?.focus();
}

function removeTrailingBlankLineItems() {
    const rows = Array.from(document.querySelectorAll('.line-item-row'));
    for (let index = rows.length - 1; index >= 0; index -= 1) {
        if (!isLineItemRowBlank(rows[index])) {
            break;
        }

        rows[index].remove();
        rows.pop();
    }
}

function createLineItemRow(particular = '', amount = '') {
    if (particular) {
        rememberCustomParticular(particular);
    }

    const row = document.createElement('tr');
    row.className = 'line-item-row';
    row.innerHTML = `
        <td>
            <select class="form-select particular-select" aria-label="Particular" required>
                ${createParticularOptions(particular)}
            </select>
        </td>
        <td style="width: 28%;">
            <input type="number" class="form-control amount-input" aria-label="Amount" min="0" step="0.01" value="${amount}">
        </td>
        <td class="text-center" style="width: 52px;">
            <button type="button" class="btn btn-outline-danger remove-line-btn" title="Remove row">
                <i class="fas fa-trash"></i>
            </button>
        </td>
    `;

    const particularSelect = row.querySelector('.particular-select');
    particularSelect.addEventListener('change', () => {
        setDefaultMonthForTuition();
        refreshFeeFormState();
    });
    row.querySelector('.amount-input').addEventListener('input', refreshFeeFormState);
    row.querySelector('.amount-input').addEventListener('keydown', (event) => {
        if (event.key !== 'Tab' || event.shiftKey) return;

        if (isLineItemRowBlank(row)) {
            event.preventDefault();
            focusFirstPaymentType();
            return;
        }

        const rows = Array.from(document.querySelectorAll('.line-item-row'));
        const currentIndex = rows.indexOf(row);
        const nextRow = rows[currentIndex + 1] || addLineItemRow();

        event.preventDefault();
        nextRow.querySelector('.particular-select')?.focus();
    });
    row.querySelector('.remove-line-btn').addEventListener('click', () => {
        row.remove();
        if (!document.querySelectorAll('.line-item-row').length) {
            addLineItemRow();
        }
        refreshFeeFormState();
    });

    return row;
}

function getLineItemsTableBody() {
    const container = document.getElementById('lineItemsContainer');
    let tableBody = container.querySelector('tbody');
    if (tableBody) {
        return tableBody;
    }

    container.innerHTML = `
        <table class="table table-sm line-items-table align-middle">
            <thead>
                <tr>
                    <th>Particular</th>
                    <th style="width: 28%;">Amount</th>
                    <th class="text-center" style="width: 52px;"></th>
                </tr>
            </thead>
            <tbody></tbody>
        </table>
    `;
    return container.querySelector('tbody');
}

function addLineItemRow(particular = '', amount = '') {
    const row = createLineItemRow(particular, amount);
    getLineItemsTableBody().appendChild(row);
    return row;
}

function createPaymentEntryRow(modeLabel = '', amount = '', removable = true) {
    if (modeLabel && modeLabel !== 'Cash') {
        addOnlineAccountLocally(modeLabel);
    }

    const row = document.createElement('div');
    row.className = 'payment-entry-row';
    row.dataset.modeLabel = modeLabel;
    row.dataset.baseMode = inferBaseMode(modeLabel);

    row.innerHTML = `
        <div class="row g-2 align-items-end">
            <div class="col-md-4">
                <label class="form-label">Payment Type</label>
                <select class="form-select payment-mode-select" required>
                    ${getPaymentModeOptions()}
                </select>
            </div>
            <div class="col-md-4">
                <label class="form-label">Amount</label>
                <div class="input-group">
                    <span class="input-group-text">Rs.</span>
                    <input type="number" class="form-control payment-amount-input" min="0" step="0.01" value="${amount}">
                </div>
            </div>
            <div class="col-md-4 d-grid">
                <label class="form-label d-none d-md-block">&nbsp;</label>
                <button type="button" class="btn btn-outline-danger remove-payment-btn" ${removable ? '' : 'disabled'} title="Remove payment">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        </div>
    `;

    const paymentModeSelect = row.querySelector('.payment-mode-select');
    paymentModeSelect.value = modeLabel;

    function syncPaymentRowState() {
        const currentMode = paymentModeSelect.value;
        row.dataset.baseMode = inferBaseMode(currentMode);
        row.dataset.modeLabel = currentMode;
    }

    paymentModeSelect.addEventListener('change', () => {
        syncPaymentRowState();
        refreshFeeFormState();
    });
    row.querySelector('.payment-amount-input').addEventListener('input', refreshFeeFormState);
    row.querySelector('.payment-amount-input').addEventListener('keydown', (event) => {
        if (event.key !== 'Tab' || event.shiftKey) return;

        event.preventDefault();
        document.getElementById('saveFeeBtn')?.focus();
    });
    row.querySelector('.remove-payment-btn').addEventListener('click', () => {
        row.remove();
        refreshFeeFormState();
    });

    syncPaymentRowState();

    return row;
}

function hydratePaymentBreakdown(entries = []) {
    const container = document.getElementById('paymentEntriesContainer');
    container.innerHTML = '';

    const normalizedEntries = Array.isArray(entries) && entries.length
        ? entries
        : [{ modeLabel: '', amount: 0, baseMode: '' }];

    normalizedEntries.forEach((entry, index) => {
        const modeLabel = entry.modeLabel || entry.label || entry.paymentMode || '';
        container.appendChild(createPaymentEntryRow(modeLabel, entry.amount || 0, index > 0));
    });

    if (!container.querySelector('.payment-entry-row')) {
        container.appendChild(createPaymentEntryRow('', 0, false));
    }

    const firstRemoveBtn = container.querySelector('.payment-entry-row .remove-payment-btn');
    if (firstRemoveBtn) {
        firstRemoveBtn.disabled = true;
    }

    refreshFeeFormState();
}

function addPaymentRow(modeLabel = '', amount = '') {
    const container = document.getElementById('paymentEntriesContainer');
    container.appendChild(createPaymentEntryRow(modeLabel, amount, true));
    refreshFeeFormState();
}

function getPaymentBreakdownPayload() {
    return Array.from(document.querySelectorAll('.payment-entry-row'))
        .map((row) => ({
            modeLabel: row.dataset.modeLabel || '',
            baseMode: row.querySelector('.payment-mode-select').value ? inferBaseMode(row.querySelector('.payment-mode-select').value) : '',
            amount: Number(row.querySelector('.payment-amount-input').value) || 0
        }))
        .filter((item) => item.amount >= 0);
}

function findDuplicatePaymentModes(paymentBreakdown = getPaymentBreakdownPayload()) {
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

function getPaymentModeSummary(paymentBreakdown = getPaymentBreakdownPayload()) {
    const baseModes = [...new Set(paymentBreakdown.map((entry) => entry.baseMode))];
    if (!baseModes.length) return 'Cash';
    if (baseModes.length === 1) return baseModes[0];
    return 'Mixed';
}

function formatPaymentBreakdown(paymentBreakdown = [], fallbackPaymentMode = '') {
    if (Array.isArray(paymentBreakdown) && paymentBreakdown.length) {
        return paymentBreakdown
            .map((entry) => `${entry.modeLabel || entry.baseMode}: Rs. ${formatMoney(entry.amount)}`)
            .join(', ');
    }

    return fallbackPaymentMode || 'Cash';
}

function escapeHtml(value = '') {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function renderLastFeeEntry(transaction = null) {
    const hint = document.getElementById('lastFeeEntryHint');
    if (!hint) return;

    if (!transaction) {
        hint.classList.add('d-none');
        hint.innerHTML = '';
        return;
    }

    hint.innerHTML = `
        <span class="label">Last Entry:</span>
        Voucher No. <strong>${escapeHtml(transaction.voucherNo || 'N/A')}</strong>
        <span class="mx-1">|</span>
        Admission No. <strong>${escapeHtml(transaction.admissionNo || 'N/A')}</strong>
    `;
    hint.classList.remove('d-none');
}

async function loadLastFeeEntry() {
    const result = await API.fees.getTransactions({ limit: 1 });
    if (!result?.success) {
        renderLastFeeEntry(null);
        return;
    }

    renderLastFeeEntry((result.transactions || [])[0] || null);
}

function validateRequiredFeeFields({ voucherNo, paymentDate, lineItems, paymentBreakdown, paidAmount, monthValue }) {
    if (!voucherNo) {
        return 'Voucher No. is required';
    }

    if (!paymentDate) {
        return 'Payment Date is required';
    }

    const previousDueAmount = Number(document.getElementById('previousDueAmount')?.value) || 0;
    const isDueOnlyPayment = previousDueAmount !== 0 && paidAmount > 0;

    if (!lineItems.length && !isDueOnlyPayment) {
        return 'Please add at least one filled fee row or collect against previous due';
    }

    if (hasTuitionFee(lineItems) && !monthValue) {
        return 'Month is required when Tuition Fee is selected';
    }

    if (!paymentBreakdown.length) {
        return 'Please add at least one payment row';
    }

    if (paymentBreakdown.some((entry) => !entry.modeLabel)) {
        return 'Please select Payment Type';
    }

    return null;
}

function setMonthDropdown() {
    const monthSelect = document.getElementById('feeMonth');
    monthSelect.innerHTML = `
        <option value="">Select Month</option>
        ${monthOptions().map((month) => `<option value="${month}">${month}</option>`).join('')}
    `;
}

function updateMonthRequirement() {
    const monthSelect = document.getElementById('feeMonth');
    const monthHelp = document.getElementById('feeMonthHelp');
    const tuitionSelected = hasTuitionFee();
    const isMissingRequiredMonth = tuitionSelected && !monthSelect.value;

    monthSelect.required = tuitionSelected;
    monthSelect.classList.toggle('is-invalid', isMissingRequiredMonth);

    if (monthHelp) {
        monthHelp.textContent = tuitionSelected
            ? 'Month is mandatory because Tuition Fee is selected.'
            : 'Month is required only when Tuition Fee is selected.';
        monthHelp.classList.toggle('text-danger', isMissingRequiredMonth);
        monthHelp.classList.toggle('fw-semibold', tuitionSelected);
    }
}

function setDefaultMonthForTuition() {
    const monthSelect = document.getElementById('feeMonth');
    if (!monthSelect.value && hasTuitionFee()) {
        monthSelect.value = monthOptions()[new Date().getMonth()];
    }
}

function refreshFeeFormState() {
    calculateTotals();
    updateMonthRequirement();
}

function calculateTotals() {
    const previousDue = Number(document.getElementById('previousDueAmount').value) || 0;
    const paidAmount = getPaymentBreakdownPayload().reduce((sum, entry) => sum + (Number(entry.amount) || 0), 0);

    const currentChargesTotal = Array.from(document.querySelectorAll('.line-item-row')).reduce((sum, row) => {
        const amount = Number(row.querySelector('.amount-input').value) || 0;
        return sum + amount;
    }, 0);

    const currentDueTotal = previousDue + currentChargesTotal;
    const dueAmount = calculateClosingBalance(currentDueTotal, paidAmount);

    document.getElementById('paidAmount').value = paidAmount.toFixed(2);
    document.getElementById('currentChargesTotal').value = currentChargesTotal.toFixed(2);
    document.getElementById('currentDueTotal').value = currentDueTotal.toFixed(2);
    document.getElementById('dueAmount').value = dueAmount.toFixed(2);
}

function renderStudentInfo(student, summary) {
    hideFeeFormMessage();
    document.getElementById('studentInfoCard').classList.remove('d-none');
    document.getElementById('selectedAdmissionNo').value = student.studentId;
    document.getElementById('studentNameView').textContent = student.name || '-';
    document.getElementById('fatherNameView').textContent = student.fatherName || '-';
    document.getElementById('classView').textContent = student.class || '-';
    document.getElementById('sectionView').textContent = student.section || '-';
    document.getElementById('rollNoView').textContent = student.rollNo || '-';
    document.getElementById('sessionView').textContent = student.session || '-';
    document.getElementById('tuitionFeeView').textContent = `Rs. ${formatMoney(student.tuitionFee || 0)}`;
    document.getElementById('transportFeeView').textContent = student.transport?.required
        ? `Rs. ${formatMoney(student.transport?.fees || 0)}`
        : 'Not required';
    document.getElementById('previousDueAmount').value = (summary.previousDueAmount || 0).toFixed(2);
    document.getElementById('totalPaidView').textContent = formatMoney(summary.totalPaid || 0);
    document.getElementById('outstandingView').textContent = formatMoney(summary.totalOutstanding || 0);
    refreshFeeFormState();
}

function setDueCollectionMode(isActive) {
    const hint = document.getElementById('dueCollectionHint');
    if (hint) hint.classList.toggle('d-none', !isActive);
}

function matchesTransactionKeyword(transaction, keyword) {
    const searchableText = [
        transaction.voucherNo,
        transaction.month,
        transaction.notes,
        transaction.paymentMode,
        transaction.paidAmount,
        transaction.dueAmount,
        ...(transaction.lineItems || []).map((item) => `${item.particular} ${item.amount}`),
        ...(transaction.paymentBreakdown || []).map((entry) => `${entry.modeLabel || entry.baseMode} ${entry.amount}`)
    ].join(' ').toLowerCase();

    return searchableText.includes(keyword.toLowerCase());
}

function renderTransactions(transactions = recentTransactionsCache) {
    const container = document.getElementById('recentTransactions');
    const keyword = document.getElementById('recentTransactionsSearch')?.value.trim() || '';
    const filteredTransactions = keyword
        ? transactions.filter((transaction) => matchesTransactionKeyword(transaction, keyword))
        : transactions;

    if (!filteredTransactions.length) {
        container.innerHTML = '<div class="text-muted">No fee transactions found for this student yet.</div>';
        return;
    }

    container.innerHTML = filteredTransactions.map((transaction) => `
        <div class="recent-item">
            <div class="d-flex justify-content-between align-items-start gap-2">
                <div>
                    <div class="small text-success fw-semibold">
                        <i class="fas fa-receipt me-1"></i>
                        Voucher: ${transaction.voucherNo || 'N/A'}
                    </div>
                </div>
                <div class="d-flex gap-2">
                    <a class="btn btn-sm btn-outline-secondary" href="fee-collection.html?receiptId=${transaction._id}">Edit</a>
                    <a class="btn btn-sm btn-outline-primary" href="fee-receipt.html?id=${transaction._id}" target="_blank">Print</a>
                </div>
            </div>
            <div class="small mt-2 fw-bold text-dark">Date: ${new Date(transaction.receiptDate || transaction.createdAt).toLocaleDateString('en-IN')}</div>
            <div class="small mt-2 fw-bold text-primary">
                Particulars: ${(transaction.lineItems || []).map((item) => `${item.particular} (Rs. ${formatMoney(item.amount)})`).join(', ') || '-'}
            </div>
            <div class="small mt-2 fw-bold">Month: ${transaction.month || '-'}</div>
            <div class="small fw-bold">Paid: Rs. ${formatMoney(transaction.paidAmount)}</div>
            <div class="small fw-bold">Due: Rs. ${formatMoney(transaction.dueAmount)}</div>
            <div class="small fw-bold">Payment: ${formatPaymentBreakdown(transaction.paymentBreakdown, transaction.paymentMode)}</div>
        </div>
    `).join('');
}

function setFeeFormMode() {
    const title = document.getElementById('feeFormTitle');
    const saveButton = document.getElementById('saveFeeBtn');
    const editReasonRow = document.getElementById('feeEditReasonRow');
    const deleteButton = document.getElementById('deleteFeeBtn');

    if (editingReceiptId) {
        if (title) title.textContent = 'Edit Fee Receipt';
        saveButton.innerHTML = '<i class="fas fa-pen me-2"></i>Update Receipt';
        if (editReasonRow) editReasonRow.classList.remove('d-none');
        if (deleteButton) deleteButton.classList.toggle('d-none', !Auth.canDeleteFinance());
    } else {
        if (title) title.textContent = 'Particulars';
        saveButton.innerHTML = '<i class="fas fa-save me-2"></i>Save and Open Printable Receipt';
        if (editReasonRow) editReasonRow.classList.add('d-none');
        if (deleteButton) deleteButton.classList.add('d-none');
    }
}

function populateFeeFormForEdit(receipt) {
    editingReceiptId = receipt._id;
    document.getElementById('admissionNoSearch').value = normalizeAdmissionNo(receipt.admissionNo);
    document.getElementById('voucherNo').value = receipt.voucherNo || '';
    document.getElementById('selectedAdmissionNo').value = normalizeAdmissionNo(receipt.admissionNo);
    document.getElementById('previousDueAmount').value = (Number(receipt.previousDueAmount) || 0).toFixed(2);
    document.getElementById('feeMonth').value = receipt.month || '';
    document.getElementById('paymentDate').value = receipt.receiptDate ? new Date(receipt.receiptDate).toISOString().split('T')[0] : '';
    document.getElementById('feeNotes').value = receipt.notes || '';
    document.getElementById('lineItemsContainer').innerHTML = '';
    (receipt.lineItems || []).forEach((item) => addLineItemRow(item.particular, item.amount));
    if (!(receipt.lineItems || []).length) {
        addLineItemRow();
    }

    const fallbackPaymentMode = receipt.paymentMode === 'Online' ? 'Online-1' : 'Cash';
    hydratePaymentBreakdown(receipt.paymentBreakdown?.length
        ? receipt.paymentBreakdown
        : [{ modeLabel: fallbackPaymentMode, baseMode: inferBaseMode(fallbackPaymentMode), amount: receipt.paidAmount || 0 }]);

    refreshFeeFormState();
    setFeeFormMode();
}

function getLineItemsPayload() {
    return Array.from(document.querySelectorAll('.line-item-row')).map((row) => ({
        particular: normalizeFeeParticular(row.querySelector('.particular-select').value),
        amount: Number(row.querySelector('.amount-input').value) || 0
    })).filter((item) => item.particular && item.amount > 0);
}

async function searchStudent(admissionNo, session = '') {
    const result = await API.fees.getStudentFeeSummary(admissionNo, session);

    if (!result || !result.success) {
        throw new Error(result?.message || 'Student not found');
    }

    selectedStudent = result.student;
    recentTransactionsCache = result.transactions || [];
    renderStudentInfo(result.student, result.summary || {});
    if (shouldPrefillDuePayment && !editingReceiptId) {
        hydratePaymentBreakdown([{ modeLabel: 'Cash', baseMode: 'Cash', amount: 0 }]);
        setDueCollectionMode(true);
        document.querySelector('.payment-amount-input')?.focus();
    }
    renderTransactions(recentTransactionsCache);
}

function resetFeeForm() {
    hideFeeFormMessage();
    selectedStudent = null;
    editingReceiptId = null;
    document.getElementById('studentSearchForm').reset();
    document.getElementById('feeForm').reset();
    document.getElementById('studentInfoCard').classList.add('d-none');
    document.getElementById('selectedAdmissionNo').value = '';
    document.getElementById('previousDueAmount').value = '0.00';
    document.getElementById('currentChargesTotal').value = '0.00';
    document.getElementById('currentDueTotal').value = '0.00';
    document.getElementById('dueAmount').value = '0.00';
    document.getElementById('lineItemsContainer').innerHTML = '';
    recentTransactionsCache = [];
    document.getElementById('recentTransactions').innerHTML = 'Search a student to view fee history.';
    document.getElementById('totalPaidView').textContent = '0';
    document.getElementById('outstandingView').textContent = '0';
    document.getElementById('voucherNo').value = '';
    document.getElementById('paymentEntriesContainer').innerHTML = '';
    setDueCollectionMode(false);
    setMonthDropdown();
    addLineItemRow();
    hydratePaymentBreakdown([{ modeLabel: '', baseMode: '', amount: 0 }]);
    document.getElementById('feeMonth').value = '';
    document.getElementById('feeNotes').value = '';
    const feeEditReason = document.getElementById('feeEditReason');
    if (feeEditReason) feeEditReason.value = '';
    setTodayAsPaymentDate();
    refreshFeeFormState();
    setFeeFormMode();
}

async function loadReceiptForEdit(receiptId) {
    const result = await API.fees.getReceipt(receiptId);
    if (!result || !result.success) {
        throw new Error(result?.message || 'Unable to fetch receipt for editing');
    }

    await searchStudent(result.receipt.admissionNo, result.receipt.session || '');
    populateFeeFormForEdit(result.receipt);
}

document.addEventListener('DOMContentLoaded', () => {
    if (!Auth.isAuthenticated()) {
        window.location.href = '../pages/login.html';
        return;
    }

    if (!Auth.canManageFinance()) {
        alert('Only admin or accountant can manage fee transactions.');
        window.location.href = 'fee-transactions.html';
        return;
    }

    setMonthDropdown();
    addLineItemRow();
    hydratePaymentBreakdown([{ modeLabel: '', baseMode: '', amount: 0 }]);
    setTodayAsPaymentDate();
    refreshFeeFormState();

    document.getElementById('addLineItemBtn').addEventListener('click', () => addLineItemRow());
    document.getElementById('addParticularBtn').addEventListener('click', async () => {
        try {
            await promptAndAddParticular();
        } catch (error) {
            console.error(error);
            alert(error.message || 'Unable to save fee particular');
        }
    });
    document.getElementById('addOnlineAccountBtn').addEventListener('click', async () => {
        try {
            await promptAndAddOnlineAccount();
        } catch (error) {
            console.error(error);
            alert(error.message || 'Unable to create online account');
        }
    });
    document.getElementById('addPaymentRowBtn').addEventListener('click', () => addPaymentRow('', 0));
    document.getElementById('feeMonth').addEventListener('change', updateMonthRequirement);
    document.getElementById('resetFeeFormBtn').addEventListener('click', resetFeeForm);
    document.getElementById('recentTransactionsSearch').addEventListener('input', () => renderTransactions(recentTransactionsCache));
    document.getElementById('saveFeeBtn').addEventListener('click', () => {
        removeTrailingBlankLineItems();
        refreshFeeFormState();
    });
    document.getElementById('admissionNoSearch').addEventListener('input', (event) => {
        const upperValue = event.target.value.toUpperCase();
        if (event.target.value !== upperValue) {
            event.target.value = upperValue;
        }
    });

    document.getElementById('studentSearchForm').addEventListener('submit', async (event) => {
        event.preventDefault();
        const admissionNoInput = document.getElementById('admissionNoSearch');
        const admissionNo = normalizeAdmissionNo(admissionNoInput.value);
        admissionNoInput.value = admissionNo;
        const searchButton = document.getElementById('searchStudentBtn');
        const originalHtml = searchButton.innerHTML;

        if (!admissionNo) {
            alert('Please enter an admission number');
            return;
        }

        try {
            hideFeeFormMessage();
            searchButton.disabled = true;
            searchButton.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>Searching...';
            await searchStudent(admissionNo);
        } catch (error) {
            console.error(error);
            alert(error.message || 'Unable to fetch student');
        } finally {
            searchButton.disabled = false;
            searchButton.innerHTML = originalHtml;
        }
    });

    document.getElementById('feeForm').addEventListener('submit', async (event) => {
        event.preventDefault();
        hideFeeFormMessage();

        if (!selectedStudent) {
            alert('Search and select a student first');
            return;
        }

        removeTrailingBlankLineItems();
        refreshFeeFormState();

        const lineItems = getLineItemsPayload();
        const voucherNo = document.getElementById('voucherNo').value.trim();
        const monthValue = document.getElementById('feeMonth').value;
        const paymentDate = document.getElementById('paymentDate').value;
        const paymentBreakdown = getPaymentBreakdownPayload();
        const paidAmount = paymentBreakdown.reduce((sum, entry) => sum + entry.amount, 0);
        const duplicatePaymentMode = findDuplicatePaymentModes(paymentBreakdown);
        const requiredFieldError = validateRequiredFeeFields({
            voucherNo,
            paymentDate,
            lineItems,
            paymentBreakdown,
            paidAmount,
            monthValue
        });

        if (hasTuitionFee(lineItems) && !monthValue) {
            updateMonthRequirement();
        }

        if (requiredFieldError) {
            alert(requiredFieldError);
            return;
        }

        if (duplicatePaymentMode) {
            alert(`Payment type "${duplicatePaymentMode}" is selected more than once. Please use different payment types.`);
            return;
        }

        if (editingReceiptId && !document.getElementById('feeEditReason')?.value.trim()) {
            showFeeFormMessage('Reason for edit is required when updating a fee receipt.');
            return;
        }

        const payload = {
            admissionNo: selectedStudent.studentId,
            session: selectedStudent.session || '',
            voucherNo,
            month: monthValue,
            receiptDate: paymentDate,
            paymentMode: getPaymentModeSummary(paymentBreakdown),
            paymentBreakdown,
            paidAmount,
            notes: document.getElementById('feeNotes').value.trim(),
            lineItems
        };

        if (editingReceiptId) {
            payload.editReason = document.getElementById('feeEditReason')?.value.trim() || '';
        }

        const saveButton = document.getElementById('saveFeeBtn');
        const originalHtml = saveButton.innerHTML;

        try {
            saveButton.disabled = true;
            saveButton.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>Saving...';

            const result = editingReceiptId
                ? await API.fees.updateReceipt(editingReceiptId, payload)
                : await API.fees.saveReceipt(payload);

            if (!result || !result.success) {
                throw new Error(result?.message || `Unable to ${editingReceiptId ? 'update' : 'save'} receipt`);
            }

            const receiptId = result.receipt?._id;
            const successMessage = editingReceiptId
                ? 'Fee receipt updated successfully'
                : 'Fee receipt saved successfully';

            resetFeeForm();
            renderLastFeeEntry(result.receipt || null);
            document.getElementById('admissionNoSearch')?.focus();
            alert(successMessage);

            if (receiptId) {
                window.open(`fee-receipt.html?id=${receiptId}`, '_blank');
            }
        } catch (error) {
            console.error(error);
            showFeeFormMessage(error.message || `Error ${editingReceiptId ? 'updating' : 'saving'} fee receipt`);
        } finally {
            saveButton.disabled = false;
            saveButton.innerHTML = originalHtml;
        }
    });

    const prefilledAdmissionNo = queryParams.get('admissionNo');
    const prefilledReceiptId = queryParams.get('receiptId');
    setFeeFormMode();

    document.getElementById('deleteFeeBtn').addEventListener('click', async () => {
        if (!editingReceiptId) return;

        const editReason = document.getElementById('feeEditReason')?.value.trim() || '';
        if (!editReason) {
            showFeeFormMessage('Delete reason is required before deleting a fee receipt.');
            return;
        }

        const confirmed = window.confirm('Delete this fee receipt? It will stay recoverable in audit.');
        if (!confirmed) return;

        try {
            const result = await API.fees.deleteReceipt(editingReceiptId, { editReason });
            if (!result?.success) {
                throw new Error(result?.message || 'Unable to delete fee receipt');
            }

            alert('Fee receipt deleted successfully.');
            resetFeeForm();
            loadLastFeeEntry().catch((error) => console.error(error));
            window.history.replaceState({}, '', 'fee-collection.html');
        } catch (error) {
            console.error(error);
            showFeeFormMessage(error.message || 'Unable to delete fee receipt');
        }
    });

    loadLastFeeEntry().catch((error) => {
        console.error(error);
        renderLastFeeEntry(null);
    });

    Promise.all([loadPaymentAccounts(), loadFeeParticulars()]).then(() => {
        if (prefilledReceiptId) {
            loadReceiptForEdit(prefilledReceiptId).catch((error) => {
                console.error(error);
                alert(error.message || 'Unable to load receipt for editing');
            });
            return;
        }

        if (prefilledAdmissionNo) {
            document.getElementById('admissionNoSearch').value = normalizeAdmissionNo(prefilledAdmissionNo);
            document.getElementById('studentSearchForm').dispatchEvent(new Event('submit', {
                cancelable: true,
                bubbles: true
            }));
        }
    }).catch((error) => {
        console.error(error);
        alert(error.message || 'Unable to load payment accounts');
    });
});
