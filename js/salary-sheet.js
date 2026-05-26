let salarySheetRows = [];
let savedSalarySheets = [];
let salaryCustomColumns = [];
let salaryHistoryEmployees = [];
let recentSalarySheetPage = 1;
const recentSalarySheetPageSize = 10;

function formatSalarySheetMoney(value) {
    return (Number(value) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function escapeSalarySheetHtml(value) {
    return String(value || '').replace(/[&<>"']/g, (char) => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    }[char]));
}

function currentMonthValue() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function makeSalaryCustomColumnKey(label) {
    const base = String(label || '')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '')
        .slice(0, 40) || 'custom';
    let key = `${base}_${Date.now().toString(36)}`;
    let counter = 1;
    while (salaryCustomColumns.some((column) => column.key === key)) {
        key = `${base}_${counter}`;
        counter += 1;
    }
    return key;
}

function normalizeSalaryCustomColumns(columns = []) {
    const usedKeys = new Set();
    return (Array.isArray(columns) ? columns : [])
        .map((column, index) => {
            const label = String(column.label || '').trim();
            if (!label) return null;
            let key = String(column.key || '').trim().replace(/[^a-zA-Z0-9_-]/g, '_');
            if (!key) key = `custom_${index + 1}`;
            while (usedKeys.has(key)) key = `${key}_${index + 1}`;
            usedKeys.add(key);
            return {
                key,
                label,
                calculationType: String(column.calculationType || '').toLowerCase() === 'debit' ? 'debit' : 'credit'
            };
        })
        .filter(Boolean);
}

function mergeSalaryCustomColumns(...columnGroups) {
    const merged = [];
    const seenKeys = new Set();
    const seenLabels = new Set();
    columnGroups.forEach((columns) => {
        normalizeSalaryCustomColumns(columns).forEach((column) => {
            const labelKey = column.label.toLowerCase();
            if (seenKeys.has(column.key) || seenLabels.has(labelKey)) return;
            seenKeys.add(column.key);
            seenLabels.add(labelKey);
            merged.push(column);
        });
    });
    return merged;
}

function getSalaryRowCustomValues(row = {}) {
    const values = row.customValues || {};
    return salaryCustomColumns.reduce((normalized, column) => {
        normalized[column.key] = Number(values[column.key]) || 0;
        return normalized;
    }, {});
}

function calculateSalaryRowNet(row = {}) {
    const customValues = row.customValues || {};
    return salaryCustomColumns.reduce((net, column) => {
        const amount = Number(customValues[column.key]) || 0;
        return column.calculationType === 'debit' ? net - amount : net + amount;
    }, (Number(row.basicSalary) || 0) + (Number(row.allowances) || 0) - (Number(row.deductions) || 0));
}

function buildSalaryAmountDetails(row = {}) {
    const customValues = row.customValues || {};
    const creditDetails = [
        { label: 'Basic', amount: Number(row.basicSalary) || 0 },
        { label: 'Allowances', amount: Number(row.allowances) || 0 }
    ];
    const debitDetails = [
        { label: 'Advance', amount: Number(row.deductions) || 0 }
    ];

    salaryCustomColumns.forEach((column) => {
        const amount = Number(customValues[column.key]) || 0;
        const target = column.calculationType === 'debit' ? debitDetails : creditDetails;
        target.push({ label: column.label, amount });
    });

    return {
        creditDetails: creditDetails.filter((detail) => detail.amount > 0),
        debitDetails: debitDetails.filter((detail) => detail.amount > 0)
    };
}

function showSalarySheetMessage(message) {
    const box = document.getElementById('salarySheetMessage');
    box.textContent = message;
    box.classList.remove('d-none');
}

function hideSalarySheetMessage() {
    const box = document.getElementById('salarySheetMessage');
    box.textContent = '';
    box.classList.add('d-none');
}

function getSalarySheetTotals() {
    return salarySheetRows.reduce((totals, row) => {
        const basic = Number(row.basicSalary) || 0;
        const allowances = Number(row.allowances) || 0;
        const deductions = Number(row.deductions) || 0;
        totals.basic += basic;
        totals.allowances += allowances;
        totals.deductions += deductions;
        totals.net += calculateSalaryRowNet(row);
        return totals;
    }, { basic: 0, allowances: 0, deductions: 0, net: 0 });
}

function updateSalarySheetTotals() {
    const totals = getSalarySheetTotals();
    document.getElementById('salaryTotalBasic').textContent = formatSalarySheetMoney(totals.basic);
    document.getElementById('salaryTotalAllowances').textContent = formatSalarySheetMoney(totals.allowances);
    document.getElementById('salaryTotalDeductions').textContent = formatSalarySheetMoney(totals.deductions);
    document.getElementById('salaryTotalNet').textContent = formatSalarySheetMoney(totals.net);
    updateSalaryPrintHeader();
}

function renderSalaryTableTotalRow() {
    const totals = getSalarySheetTotals();
    const creditColumns = salaryCustomColumns.filter((column) => column.calculationType !== 'debit');
    const deductionColumns = salaryCustomColumns.filter((column) => column.calculationType === 'debit');
    const customTotals = salarySheetRows.reduce((columnTotals, row) => {
        const values = row.customValues || {};
        salaryCustomColumns.forEach((column) => {
            columnTotals[column.key] = (columnTotals[column.key] || 0) + (Number(values[column.key]) || 0);
        });
        return columnTotals;
    }, {});

    const creditCustomCells = creditColumns.map((column) => `<td class="text-end salary-credit-cell">${formatSalarySheetMoney(customTotals[column.key] || 0)}</td>`).join('');
    const deductionCustomCells = deductionColumns.map((column) => `<td class="text-end salary-deduction-cell">${formatSalarySheetMoney(customTotals[column.key] || 0)}</td>`).join('');

    return `
        <tr class="table-light fw-bold salary-total-row">
            <td class="text-end">Total</td>
            <td class="text-end salary-credit-cell">${formatSalarySheetMoney(totals.basic)}</td>
            <td class="text-end salary-credit-cell">${formatSalarySheetMoney(totals.allowances)}</td>
            ${creditCustomCells}
            <td class="text-end salary-deduction-cell">${formatSalarySheetMoney(totals.deductions)}</td>
            ${deductionCustomCells}
            <td class="text-end">${formatSalarySheetMoney(totals.net)}</td>
            <td colspan="3"></td>
        </tr>
    `;
}

function updateSalaryPrintHeader() {
    const month = document.getElementById('salarySheetMonth').value || '-';
    const salaryDate = document.getElementById('salarySheetDate').value;
    const totals = getSalarySheetTotals();
    document.getElementById('salaryPrintMonth').textContent = `Month: ${month}`;
    document.getElementById('salaryPrintDate').textContent = `Date: ${salaryDate ? new Date(salaryDate).toLocaleDateString('en-IN') : '-'}`;
    document.getElementById('salaryPrintTotal').textContent = `Total: ${formatSalarySheetMoney(totals.net)}`;
}

function syncSalaryRowsFromDom() {
    salarySheetRows = Array.from(document.querySelectorAll('[data-salary-row-index]')).map((tr) => {
        const index = Number(tr.dataset.salaryRowIndex);
        const existing = salarySheetRows[index] || {};
        const basicSalary = Number(tr.querySelector('.salary-basic-input').value) || 0;
        const allowances = Number(tr.querySelector('.salary-allowances-input').value) || 0;
        const deductions = Number(tr.querySelector('.salary-deductions-input').value) || 0;
        const customValues = salaryCustomColumns.reduce((values, column) => {
            values[column.key] = Number(tr.querySelector(`[data-custom-column-key="${column.key}"]`)?.value) || 0;
            return values;
        }, {});
        const row = {
            ...existing,
            basicSalary,
            allowances,
            deductions,
            customValues
        };
        return {
            ...row,
            employeeType: existing.employeeType || 'Staff',
            name: tr.querySelector('.salary-name-input').textContent.trim(),
            designation: tr.querySelector('.salary-designation-input').textContent.trim(),
            code: existing.code || '',
            phone: existing.phone || '',
            bankName: existing.bankName || '',
            accountNo: existing.accountNo || '',
            netSalary: calculateSalaryRowNet(row),
            paymentMode: tr.querySelector('.salary-payment-select').value,
            remarks: tr.querySelector('.salary-remarks-input').value.trim()
        };
    });
}

function renderSalaryCustomColumnList() {
    const list = document.getElementById('salaryCustomColumnList');
    if (!list) return;
    if (!salaryCustomColumns.length) {
        list.innerHTML = '<span class="text-muted small">No manual columns added.</span>';
        return;
    }
    list.innerHTML = salaryCustomColumns.map((column) => `
        <span class="salary-custom-column-pill">
            <span>${escapeSalarySheetHtml(column.label)} <small class="text-muted">${column.calculationType === 'debit' ? 'Deduction' : 'Credit'}</small></span>
            <button type="button" class="remove-salary-column-btn" data-column-key="${escapeSalarySheetHtml(column.key)}" title="Remove column">&times;</button>
        </span>
    `).join('');
    document.querySelectorAll('.remove-salary-column-btn').forEach((button) => {
        button.addEventListener('click', async () => {
            if (!window.confirm('Remove this manual column from the sheet?')) return;
            syncSalaryRowsFromDom();
            try {
                const result = await API.salary.deleteColumn(button.dataset.columnKey);
                if (result && !result.success) throw new Error(result.message || 'Unable to delete salary column');
            } catch (error) {
                if (!String(error.message || '').toLowerCase().includes('not found')) {
                    showSalarySheetMessage(error.message || 'Unable to delete salary column');
                    return;
                }
            }
            salaryCustomColumns = salaryCustomColumns.filter((column) => column.key !== button.dataset.columnKey);
            salarySheetRows = salarySheetRows.map((row) => {
                const customValues = { ...(row.customValues || {}) };
                delete customValues[button.dataset.columnKey];
                return { ...row, customValues };
            });
            renderSalarySheetRows();
        });
    });
}

function renderSalaryTableHead() {
    const creditColumns = salaryCustomColumns.filter((column) => column.calculationType !== 'debit');
    const deductionColumns = salaryCustomColumns.filter((column) => column.calculationType === 'debit');
    const creditHeaders = creditColumns.map((column) => `
        <th class="text-end salary-credit-head">
            ${escapeSalarySheetHtml(column.label)}
        </th>
    `).join('');
    const deductionHeaders = deductionColumns.map((column) => `
        <th class="text-end salary-deduction-head">
            ${escapeSalarySheetHtml(column.label)}
        </th>
    `).join('');
    document.getElementById('salarySheetTableHead').innerHTML = `
        <tr>
            <th rowspan="2">Staff Name / Designation</th>
            <th colspan="${2 + creditColumns.length}" class="salary-section-head salary-credit-head">Credit</th>
            <th colspan="${1 + deductionColumns.length}" class="salary-section-head salary-deduction-head">Deduction</th>
            <th rowspan="2" class="text-end">Net</th>
            <th rowspan="2">Mode</th>
            <th rowspan="2">Remarks</th>
            <th rowspan="2" class="no-print salary-actions-col">Actions</th>
        </tr>
        <tr>
            <th class="text-end salary-credit-head">Basic</th>
            <th class="text-end salary-credit-head">Allowances</th>
            ${creditHeaders}
            <th class="text-end salary-deduction-head">Advance</th>
            ${deductionHeaders}
        </tr>
    `;
}

function getSalaryTableColspan() {
    return 8 + salaryCustomColumns.length;
}

function renderSalarySheetRows() {
    const tbody = document.getElementById('salarySheetTableBody');
    hideSalarySheetMessage();
    renderSalaryCustomColumnList();
    renderSalaryTableHead();
    if (!salarySheetRows.length) {
        tbody.innerHTML = `<tr><td colspan="${getSalaryTableColspan()}" class="text-center text-muted py-4">No active teacher or staff found. Add active staff first or click Generate again.</td></tr>`;
        updateSalarySheetTotals();
        return;
    }

    tbody.innerHTML = salarySheetRows.map((row, index) => {
        const customValues = getSalaryRowCustomValues(row);
        row.customValues = customValues;
        const net = calculateSalaryRowNet(row);
        const salaryPayment = row.salaryPayment || {};
        const isPaid = !!salaryPayment.isPaid;
        const lockAttr = isPaid ? 'disabled' : '';
        const paidBadge = isPaid ? '<span class="badge bg-success ms-1">Paid</span>' : '';
        const creditCustomCells = salaryCustomColumns
            .filter((column) => column.calculationType !== 'debit')
            .map((column) => `
            <td class="salary-credit-cell"><input type="number" class="form-control form-control-sm text-end salary-table-input salary-custom-input" min="0" step="0.01" data-custom-column-key="${escapeSalarySheetHtml(column.key)}" value="${Number(customValues[column.key]) || 0}" ${lockAttr}></td>
        `).join('');
        const deductionCustomCells = salaryCustomColumns
            .filter((column) => column.calculationType === 'debit')
            .map((column) => `
            <td class="salary-deduction-cell"><input type="number" class="form-control form-control-sm text-end salary-table-input salary-custom-input" min="0" step="0.01" data-custom-column-key="${escapeSalarySheetHtml(column.key)}" value="${Number(customValues[column.key]) || 0}" ${lockAttr}></td>
        `).join('');
        return `
            <tr data-salary-row-index="${index}">
                <td>
                    <span class="salary-name-input d-block fw-semibold">${escapeSalarySheetHtml(row.name || '')}</span>${paidBadge}
                    <span class="salary-designation-input d-block small text-muted">${escapeSalarySheetHtml(row.designation || '')}</span>
                </td>
                <td class="salary-credit-cell"><input type="number" class="form-control form-control-sm text-end salary-table-input salary-basic-input" min="0" step="0.01" value="${Number(row.basicSalary) || 0}" ${lockAttr}></td>
                <td class="salary-credit-cell"><input type="number" class="form-control form-control-sm text-end salary-table-input salary-allowances-input" min="0" step="0.01" value="${Number(row.allowances) || 0}" ${lockAttr}></td>
                ${creditCustomCells}
                <td class="salary-deduction-cell"><input type="number" class="form-control form-control-sm text-end salary-table-input salary-deductions-input" min="0" step="0.01" value="${Number(row.deductions) || 0}" ${lockAttr}></td>
                ${deductionCustomCells}
                <td class="text-end fw-semibold"><span class="salary-net-cell">${formatSalarySheetMoney(net)}</span></td>
                <td>
                    <select class="form-select form-select-sm salary-payment-select" ${lockAttr}>
                        <option value="Cash" ${row.paymentMode === 'Cash' ? 'selected' : ''}>Cash</option>
                        <option value="Bank" ${row.paymentMode === 'Bank' ? 'selected' : ''}>Bank</option>
                        <option value="Cheque" ${row.paymentMode === 'Cheque' ? 'selected' : ''}>Cheque</option>
                        <option value="Online" ${row.paymentMode === 'Online' ? 'selected' : ''}>Online</option>
                    </select>
                </td>
                <td><input type="text" class="form-control form-control-sm salary-remarks-input" value="${escapeSalarySheetHtml(row.remarks || '')}" ${lockAttr}></td>
                <td class="no-print salary-actions-col">
                    <div class="d-flex gap-1">
                        <button type="button" class="btn btn-sm btn-outline-success pay-salary-row-btn" title="Pay salary" ${isPaid ? 'disabled' : ''}>
                            <i class="fas fa-money-bill-wave me-1"></i>Pay
                        </button>
                        ${isPaid && salaryPayment.expenseId ? `<a class="btn btn-sm btn-outline-primary" href="expense-receipt.html?id=${encodeURIComponent(salaryPayment.expenseId)}" target="_blank" title="View salary slip"><i class="fas fa-file-invoice me-1"></i>Slip</a>` : ''}
                        <button type="button" class="btn btn-sm btn-outline-danger remove-salary-row-btn" title="Remove" ${isPaid ? 'disabled' : ''}>
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join('') + renderSalaryTableTotalRow();

    document.querySelectorAll('#salarySheetTableBody input, #salarySheetTableBody select').forEach((field) => {
        field.addEventListener('input', () => {
            syncSalaryRowsFromDom();
            renderSalaryNetCells();
            updateSalarySheetTotals();
        });
        field.addEventListener('change', () => {
            syncSalaryRowsFromDom();
            renderSalaryNetCells();
            updateSalarySheetTotals();
        });
    });

    document.querySelectorAll('.remove-salary-row-btn').forEach((button) => {
        button.addEventListener('click', () => {
            syncSalaryRowsFromDom();
            const row = button.closest('[data-salary-row-index]');
            salarySheetRows.splice(Number(row.dataset.salaryRowIndex), 1);
            renderSalarySheetRows();
        });
    });

    document.querySelectorAll('.pay-salary-row-btn').forEach((button) => {
        button.addEventListener('click', () => {
            syncSalaryRowsFromDom();
            const tableRow = button.closest('[data-salary-row-index]');
            const row = salarySheetRows[Number(tableRow.dataset.salaryRowIndex)] || {};
            const netSalary = calculateSalaryRowNet(row);
            const amountDetails = buildSalaryAmountDetails(row);
            const advanceAmount = Number(row.deductions) || 0;
            const totalCredit = amountDetails.creditDetails.reduce((sum, detail) => sum + detail.amount, 0);
            const totalDebit = amountDetails.debitDetails.reduce((sum, detail) => sum + detail.amount, 0);
            const debitBeforeAdvance = Math.max(0, totalDebit - advanceAmount);
            const salaryBeforeAdvance = Math.max(0, totalCredit - debitBeforeAdvance);
            const advanceAdjusted = Math.min(advanceAmount, salaryBeforeAdvance);
            const advanceCarryForward = Math.max(0, advanceAmount - advanceAdjusted);
            const paymentAmount = Math.max(0, netSalary);

            if (!row.name || (paymentAmount <= 0 && advanceAdjusted <= 0)) {
                showSalarySheetMessage('Please enter employee name and a salary or advance adjustment amount before payment.');
                return;
            }

            const params = new URLSearchParams({
                salaryPayment: '1',
                employeeName: row.name,
                designation: row.designation || '',
                employeeType: row.employeeType || '',
                salaryMonth: document.getElementById('salarySheetMonth').value || '',
                salaryDate: document.getElementById('salarySheetDate').value || '',
                amount: String(paymentAmount.toFixed(2)),
                grossSalary: String(totalCredit.toFixed(2)),
                advanceAdjusted: String(advanceAdjusted.toFixed(2)),
                advanceCarryForward: String(advanceCarryForward.toFixed(2)),
                totalDebit: String(totalDebit.toFixed(2)),
                creditDetails: JSON.stringify(amountDetails.creditDetails),
                debitDetails: JSON.stringify(amountDetails.debitDetails),
                paymentMode: row.paymentMode || 'Cash',
                remarks: row.remarks || ''
            });

            window.location.href = `expense-record.html?${params.toString()}`;
        });
    });

    updateSalarySheetTotals();
}

function renderSalaryNetCells() {
    document.querySelectorAll('[data-salary-row-index]').forEach((tr) => {
        const basic = Number(tr.querySelector('.salary-basic-input').value) || 0;
        const allowances = Number(tr.querySelector('.salary-allowances-input').value) || 0;
        const deductions = Number(tr.querySelector('.salary-deductions-input').value) || 0;
        const customValues = salaryCustomColumns.reduce((values, column) => {
            values[column.key] = Number(tr.querySelector(`[data-custom-column-key="${column.key}"]`)?.value) || 0;
            return values;
        }, {});
        tr.querySelector('.salary-net-cell').textContent = formatSalarySheetMoney(calculateSalaryRowNet({ basicSalary: basic, allowances, deductions, customValues }));
    });
}

async function generateSalarySheetRows() {
    const month = document.getElementById('salarySheetMonth').value;
    if (month) {
        const existingResult = await API.salary.getSheets({ month });
        const existingSheet = existingResult?.success ? (existingResult.sheets || [])[0] : null;
        if (existingSheet?._id) {
            const result = await API.salary.getSheet(existingSheet._id);
            if (!result?.success) {
                throw new Error(result?.message || 'Unable to open saved salary sheet');
            }
            populateSalarySheet(result.sheet);
            return;
        }
    }

    const result = await API.salary.previewSheet({ month });
    if (!result?.success) {
        throw new Error(result?.message || 'Unable to generate salary sheet');
    }
    salarySheetRows = result.entries || [];
    renderSalarySheetRows();
}

function populateSalarySheet(sheet = {}) {
    document.getElementById('salarySheetMonth').value = sheet.month || currentMonthValue();
    document.getElementById('salarySheetDate').value = sheet.salaryDate ? new Date(sheet.salaryDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0];
    document.getElementById('salarySheetNotes').value = sheet.notes || '';
    salaryCustomColumns = mergeSalaryCustomColumns(salaryCustomColumns, sheet.customColumns || []);
    salarySheetRows = sheet.entries || [];
    renderSalarySheetRows();
}

function buildSalarySheetPayload(replaceExisting = false) {
    syncSalaryRowsFromDom();
    return {
        month: document.getElementById('salarySheetMonth').value,
        salaryDate: document.getElementById('salarySheetDate').value,
        notes: document.getElementById('salarySheetNotes').value.trim(),
        customColumns: salaryCustomColumns,
        entries: salarySheetRows,
        replaceExisting
    };
}

async function saveSalarySheet(replaceExisting = false) {
    const payload = buildSalarySheetPayload(replaceExisting);
    if (!payload.month || !payload.salaryDate) {
        showSalarySheetMessage('Salary month and salary date are required.');
        return;
    }
    if (!payload.entries.length || payload.entries.some((entry) => !entry.name)) {
        showSalarySheetMessage('Please keep at least one row and make sure every row has a name.');
        return;
    }

    try {
        const result = await API.salary.saveSheet(payload);
        if (!result?.success) throw new Error(result?.message || 'Unable to save salary sheet');
        hideSalarySheetMessage();
        alert(result.message || 'Salary sheet saved successfully.');
        await loadRecentSalarySheets();
    } catch (error) {
        if (String(error.message || '').includes('already exists')) {
            const replace = window.confirm('Salary sheet already exists for this month. Replace it?');
            if (replace) {
                await saveSalarySheet(true);
            }
            return;
        }
        showSalarySheetMessage(error.message || 'Unable to save salary sheet');
    }
}

function renderRecentSalarySheets() {
    const tbody = document.getElementById('recentSalarySheetsBody');
    if (!savedSalarySheets.length) {
        tbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted py-3">No salary sheets saved yet.</td></tr>';
        renderRecentSalarySheetsPagination();
        return;
    }

    const totalPages = Math.max(1, Math.ceil(savedSalarySheets.length / recentSalarySheetPageSize));
    recentSalarySheetPage = Math.min(Math.max(1, recentSalarySheetPage), totalPages);
    const startIndex = (recentSalarySheetPage - 1) * recentSalarySheetPageSize;
    const pageSheets = savedSalarySheets.slice(startIndex, startIndex + recentSalarySheetPageSize);

    tbody.innerHTML = pageSheets.map((sheet) => `
        <tr>
            <td>${escapeSalarySheetHtml(sheet.month || '-')}</td>
            <td>${sheet.salaryDate ? new Date(sheet.salaryDate).toLocaleDateString('en-IN') : '-'}</td>
            <td class="text-end">${(sheet.entries || []).length}</td>
            <td class="text-end">${formatSalarySheetMoney(sheet.totalNet || 0)}</td>
            <td>
                <div class="d-flex gap-2">
                    <button type="button" class="btn btn-sm btn-outline-primary load-salary-sheet-btn" data-sheet-id="${sheet._id}">Open</button>
                    <button type="button" class="btn btn-sm btn-outline-danger delete-salary-sheet-btn" data-sheet-id="${sheet._id}" data-sheet-month="${escapeSalarySheetHtml(sheet.month || '-')}">Delete</button>
                </div>
            </td>
        </tr>
    `).join('');

    document.querySelectorAll('.load-salary-sheet-btn').forEach((button) => {
        button.addEventListener('click', async () => {
            const result = await API.salary.getSheet(button.dataset.sheetId);
            if (!result?.success) {
                showSalarySheetMessage(result?.message || 'Unable to open salary sheet');
                return;
            }
            const sheet = result.sheet;
            populateSalarySheet(sheet);
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
    });

    document.querySelectorAll('.delete-salary-sheet-btn').forEach((button) => {
        button.addEventListener('click', async () => {
            if (!window.confirm(`Delete salary sheet ${button.dataset.sheetMonth}?`)) return;
            try {
                const result = await API.salary.deleteSheet(button.dataset.sheetId);
                if (!result?.success) throw new Error(result?.message || 'Unable to delete salary sheet');
                await loadRecentSalarySheets();
            } catch (error) {
                showSalarySheetMessage(error.message || 'Unable to delete salary sheet');
            }
        });
    });

    renderRecentSalarySheetsPagination();
}

function renderRecentSalarySheetsPagination() {
    const container = document.getElementById('recentSalarySheetsPagination');
    if (!container) return;

    const totalPages = Math.max(1, Math.ceil(savedSalarySheets.length / recentSalarySheetPageSize));
    if (!savedSalarySheets.length || totalPages <= 1) {
        container.innerHTML = '';
        return;
    }

    container.innerHTML = `
        <div class="d-flex justify-content-between align-items-center flex-wrap gap-2 p-3 border-top">
            <span class="text-muted small">Page ${recentSalarySheetPage} of ${totalPages}</span>
            <div class="btn-group btn-group-sm">
                <button type="button" class="btn btn-outline-secondary" id="recentSalaryPrevBtn" ${recentSalarySheetPage <= 1 ? 'disabled' : ''}>Previous</button>
                <button type="button" class="btn btn-outline-secondary" id="recentSalaryNextBtn" ${recentSalarySheetPage >= totalPages ? 'disabled' : ''}>Next</button>
            </div>
        </div>
    `;

    document.getElementById('recentSalaryPrevBtn')?.addEventListener('click', () => {
        recentSalarySheetPage -= 1;
        renderRecentSalarySheets();
    });
    document.getElementById('recentSalaryNextBtn')?.addEventListener('click', () => {
        recentSalarySheetPage += 1;
        renderRecentSalarySheets();
    });
}

function getSalaryHistoryCustomAmount(entry = {}, column = {}) {
    const values = entry.customValues || {};
    if (values instanceof Map) {
        return Number(values.get(column.key)) || 0;
    }
    return Number(values[column.key]) || 0;
}

function normalizeSalaryHistoryType(value = '') {
    return String(value || '').trim().toLowerCase();
}

function getSalaryHistoryRows() {
    return savedSalarySheets.flatMap((sheet) => {
        const sheetColumns = normalizeSalaryCustomColumns(sheet.customColumns || []);
        const deductionColumns = sheetColumns.filter((column) => column.calculationType === 'debit');
        return (sheet.entries || []).map((entry) => {
            const customDeductions = deductionColumns.reduce((sum, column) => sum + getSalaryHistoryCustomAmount(entry, column), 0);
            const totalDeductions = (Number(entry.deductions) || 0) + customDeductions;
            return {
                sheetId: sheet._id || '',
                employeeId: entry.employeeId || '',
                month: sheet.month || '',
                salaryDate: sheet.salaryDate || '',
                employeeType: entry.employeeType || '',
                name: entry.name || '',
                designation: entry.designation || '',
                basicSalary: Number(entry.basicSalary) || 0,
                allowances: Number(entry.allowances) || 0,
                deductions: totalDeductions,
                netSalary: Number(entry.netSalary) || 0,
                paymentMode: entry.paymentMode || '',
                salaryPayment: entry.salaryPayment || null
            };
        });
    });
}

function makeSalaryHistoryPersonKey(row = {}) {
    const employeeId = row.employeeId || row._id || '';
    if (employeeId) return `id::${employeeId}`;
    return `${row.employeeType || ''}::${String(row.name || '').trim().toLowerCase()}`;
}

function salaryHistoryRowMatchesEmployee(row = {}, employeeFilter = '') {
    if (!employeeFilter) return true;
    if (makeSalaryHistoryPersonKey(row) === employeeFilter) return true;

    const [, employeeId = ''] = employeeFilter.split('::');
    const employee = salaryHistoryEmployees.find((item) => String(item._id || '') === employeeId);
    if (!employee) return false;

    return String(row.name || '').trim().toLowerCase() === String(employee.name || '').trim().toLowerCase()
        && normalizeSalaryHistoryType(row.employeeType) === normalizeSalaryHistoryType(employee.employeeType);
}

function populateSalaryHistoryFilter() {
    const select = document.getElementById('salaryHistoryEmployeeFilter');
    if (!select) return;

    const currentValue = select.value;
    const typeFilter = document.getElementById('salaryHistoryTypeFilter')?.value || '';
    const people = salaryHistoryEmployees
        .filter((employee) => employee.name)
        .filter((employee) => !typeFilter || normalizeSalaryHistoryType(employee.employeeType) === normalizeSalaryHistoryType(typeFilter))
        .map((employee) => ({
            key: makeSalaryHistoryPersonKey(employee),
            label: `${employee.name}${employee.designation ? ` - ${employee.designation}` : ''} (${employee.employeeType || '-'})`
        }))
        .sort((a, b) => a.label.localeCompare(b.label));

    select.innerHTML = `
        <option value="">All Teachers / Staff</option>
        ${people.map((person) => `<option value="${escapeSalarySheetHtml(person.key)}">${escapeSalarySheetHtml(person.label)}</option>`).join('')}
    `;

    if (currentValue && people.some((person) => person.key === currentValue)) {
        select.value = currentValue;
    }
}

function renderSalaryHistory() {
    const tbody = document.getElementById('salaryHistoryTableBody');
    if (!tbody) return;

    const rows = getSalaryHistoryRows();
    populateSalaryHistoryFilter();

    const employeeFilter = document.getElementById('salaryHistoryEmployeeFilter')?.value || '';
    const typeFilter = document.getElementById('salaryHistoryTypeFilter')?.value || '';
    const visibleRows = rows
        .filter((row) => salaryHistoryRowMatchesEmployee(row, employeeFilter))
        .filter((row) => !typeFilter || normalizeSalaryHistoryType(row.employeeType) === normalizeSalaryHistoryType(typeFilter))
        .sort((a, b) => String(b.month).localeCompare(String(a.month)) || String(a.name).localeCompare(String(b.name)));

    document.getElementById('salaryHistoryCount').textContent = String(visibleRows.length);
    document.getElementById('salaryHistoryTotalNet').textContent = formatSalarySheetMoney(
        visibleRows.reduce((sum, row) => sum + (Number(row.netSalary) || 0), 0)
    );

    if (!visibleRows.length) {
        tbody.innerHTML = '<tr><td colspan="11" class="text-center text-muted py-4">No salary history found.</td></tr>';
        return;
    }

    tbody.innerHTML = visibleRows.map((row) => {
        const payment = row.salaryPayment || {};
        const isPaid = !!payment.isPaid;
        return `
            <tr>
                <td>${escapeSalarySheetHtml(row.month || '-')}</td>
                <td>${row.salaryDate ? new Date(row.salaryDate).toLocaleDateString('en-IN') : '-'}</td>
                <td>${escapeSalarySheetHtml(row.employeeType || '-')}</td>
                <td class="fw-semibold">${escapeSalarySheetHtml(row.name || '-')}</td>
                <td>${escapeSalarySheetHtml(row.designation || '-')}</td>
                <td class="text-end">${formatSalarySheetMoney(row.basicSalary)}</td>
                <td class="text-end">${formatSalarySheetMoney(row.allowances)}</td>
                <td class="text-end">${formatSalarySheetMoney(row.deductions)}</td>
                <td class="text-end fw-semibold">${formatSalarySheetMoney(row.netSalary)}</td>
                <td><span class="badge ${isPaid ? 'bg-success' : 'bg-warning text-dark'}">${isPaid ? 'Paid' : 'Unpaid'}</span></td>
                <td>
                    ${isPaid && payment.expenseId
                        ? `<a class="btn btn-sm btn-outline-primary" href="expense-receipt.html?id=${encodeURIComponent(payment.expenseId)}" target="_blank"><i class="fas fa-file-invoice me-1"></i>Slip</a>`
                        : '<span class="text-muted small">No slip</span>'}
                </td>
            </tr>
        `;
    }).join('');
}

async function loadRecentSalarySheets() {
    const result = await API.salary.getSheets();
    savedSalarySheets = result?.success ? (result.sheets || []) : [];
    recentSalarySheetPage = 1;
    renderRecentSalarySheets();
    renderSalaryHistory();
}

async function loadSalaryHistoryEmployees() {
    const result = await API.salary.getEmployees({ includeInactive: true });
    salaryHistoryEmployees = result?.success ? (result.employees || []) : [];
    populateSalaryHistoryFilter();
}

async function loadSalaryColumns() {
    const result = await API.salary.getColumns();
    salaryCustomColumns = result?.success ? normalizeSalaryCustomColumns(result.columns || []) : [];
}

function addBlankSalaryRow() {
    syncSalaryRowsFromDom();
    salarySheetRows.push({
        employeeType: 'Staff',
        name: '',
        designation: '',
        code: '',
        phone: '',
        bankName: '',
        accountNo: '',
        basicSalary: 0,
        allowances: 0,
        deductions: 0,
        customValues: getSalaryRowCustomValues({}),
        netSalary: 0,
        paymentMode: 'Cash',
        remarks: ''
    });
    renderSalarySheetRows();
}

async function addSalaryCustomColumn() {
    syncSalaryRowsFromDom();
    const nameInput = document.getElementById('salaryCustomColumnName');
    const typeInput = document.getElementById('salaryCustomColumnType');
    const label = nameInput.value.trim();
    if (!label) {
        showSalarySheetMessage('Please enter a manual column name.');
        return;
    }
    if (salaryCustomColumns.some((column) => column.label.toLowerCase() === label.toLowerCase())) {
        showSalarySheetMessage('A manual column with this name already exists.');
        return;
    }
    const columnPayload = {
        key: makeSalaryCustomColumnKey(label),
        label,
        calculationType: typeInput.value === 'debit' ? 'debit' : 'credit',
        sortOrder: salaryCustomColumns.length + 1
    };
    try {
        const result = await API.salary.saveColumn(columnPayload);
        if (!result?.success) throw new Error(result?.message || 'Unable to save salary column');
        salaryCustomColumns.push(normalizeSalaryCustomColumns([result.column || columnPayload])[0]);
    } catch (error) {
        showSalarySheetMessage(error.message || 'Unable to save salary column');
        return;
    }
    salarySheetRows = salarySheetRows.map((row) => ({
        ...row,
        customValues: getSalaryRowCustomValues(row)
    }));
    nameInput.value = '';
    hideSalarySheetMessage();
    renderSalarySheetRows();
}

document.addEventListener('DOMContentLoaded', async () => {
    if (!Auth.isAuthenticated()) {
        window.location.href = '../pages/login.html';
        return;
    }
    if (!Auth.canManageSalary()) {
        alert('Only admin can access salary sheets.');
        window.location.href = 'cashbook.html';
        return;
    }

    document.getElementById('salarySheetMonth').value = currentMonthValue();
    document.getElementById('salarySheetDate').value = new Date().toISOString().split('T')[0];
    await loadSalaryColumns();
    await loadSalaryHistoryEmployees();
    renderSalarySheetRows();
    updateSalarySheetTotals();
    await loadRecentSalarySheets();

    document.getElementById('salarySheetSetupForm').addEventListener('submit', async (event) => {
        event.preventDefault();
        const generateButton = document.getElementById('generateSalarySheetBtn');
        const originalHtml = generateButton.innerHTML;
        try {
            generateButton.disabled = true;
            generateButton.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>Generating...';
            await generateSalarySheetRows();
        } catch (error) {
            showSalarySheetMessage(error.message || 'Unable to generate salary sheet');
        } finally {
            generateButton.disabled = false;
            generateButton.innerHTML = originalHtml;
        }
    });

    document.getElementById('addSalaryRowBtn').addEventListener('click', addBlankSalaryRow);
    document.getElementById('addSalaryColumnBtn').addEventListener('click', addSalaryCustomColumn);
    document.getElementById('salaryCustomColumnName').addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
            event.preventDefault();
            addSalaryCustomColumn();
        }
    });
    document.getElementById('saveSalarySheetBtn').addEventListener('click', () => saveSalarySheet(false));
    document.getElementById('salaryHistoryEmployeeFilter').addEventListener('change', renderSalaryHistory);
    document.getElementById('salaryHistoryTypeFilter').addEventListener('change', () => {
        document.getElementById('salaryHistoryEmployeeFilter').value = '';
        renderSalaryHistory();
    });
    document.getElementById('resetSalaryHistoryFilterBtn').addEventListener('click', () => {
        document.getElementById('salaryHistoryEmployeeFilter').value = '';
        document.getElementById('salaryHistoryTypeFilter').value = '';
        renderSalaryHistory();
    });
    document.getElementById('printSalarySheetBtn').addEventListener('click', () => {
        syncSalaryRowsFromDom();
        updateSalarySheetTotals();
        window.print();
    });
    ['salarySheetMonth', 'salarySheetDate'].forEach((id) => {
        document.getElementById(id).addEventListener('change', updateSalaryPrintHeader);
    });
});
