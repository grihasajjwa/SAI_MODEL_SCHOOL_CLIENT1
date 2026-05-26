let supplierOptions = { suppliers: [] };
let supplierLedgerEntries = [];
let editingSupplierEntryId = null;

function formatSupplierMoney(value) {
    return (Number(value) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function showSupplierMessage(message) {
    const box = document.getElementById('supplierLedgerMessage');
    box.textContent = message;
    box.classList.remove('d-none');
}

function hideSupplierMessage() {
    const box = document.getElementById('supplierLedgerMessage');
    box.textContent = '';
    box.classList.add('d-none');
}

function populateSupplierOptions(selectedName = '') {
    const options = supplierOptions.suppliers.map((supplier) => {
        const name = supplier.name || supplier;
        return `<option value="${name}" ${name === selectedName ? 'selected' : ''}>${name}</option>`;
    }).join('');
    document.getElementById('supplierName').innerHTML = `<option value="">Select Supplier</option>${options}`;
    document.getElementById('supplierFilterName').innerHTML = `<option value="">All Suppliers</option>${options}`;
    if (selectedName) document.getElementById('supplierFilterName').value = selectedName;
}

async function loadSupplierOptions(selectedName = '') {
    const result = await API.suppliers.getOptions();
    if (result?.success) {
        supplierOptions.suppliers = result.suppliers || [];
        populateSupplierOptions(selectedName);
    }
}

function getSupplierFilters() {
    return {
        startDate: document.getElementById('supplierFilterStartDate').value,
        endDate: document.getElementById('supplierFilterEndDate').value,
        supplierName: document.getElementById('supplierFilterName').value
    };
}

function formatSupplierDate(value) {
    return value ? new Date(value).toLocaleDateString('en-IN') : '';
}

function updateSupplierPrintHeader(summary = {}) {
    const filters = getSupplierFilters();
    const selectedSupplier = filters.supplierName || 'All Suppliers';
    const period = filters.startDate || filters.endDate
        ? `${formatSupplierDate(filters.startDate) || 'Beginning'} to ${formatSupplierDate(filters.endDate) || 'Today'}`
        : 'All Dates';
    const purchase = Number(summary.totalPurchase) || 0;
    const payment = Number(summary.totalPayment) || 0;

    document.getElementById('supplierPrintName').textContent = `Supplier: ${selectedSupplier}`;
    document.getElementById('supplierPrintPeriod').textContent = `Period: ${period}`;
    document.getElementById('supplierPrintDate').textContent = `Printed: ${new Date().toLocaleDateString('en-IN')}`;
    document.getElementById('supplierPrintPurchase').textContent = formatSupplierMoney(purchase);
    document.getElementById('supplierPrintPayment').textContent = formatSupplierMoney(payment);
    document.getElementById('supplierPrintBalance').textContent = formatSupplierMoney(purchase - payment);
}

function renderSupplierLedger(entries = [], summary = {}) {
    const tbody = document.getElementById('supplierLedgerTableBody');
    const purchase = Number(summary.totalPurchase) || 0;
    const payment = Number(summary.totalPayment) || 0;
    document.getElementById('supplierBalanceAmount').textContent = formatSupplierMoney(purchase - payment);
    document.getElementById('supplierTotalPurchase').textContent = formatSupplierMoney(purchase);
    document.getElementById('supplierTotalPayment').textContent = formatSupplierMoney(payment);
    document.getElementById('supplierFooterPurchase').textContent = formatSupplierMoney(purchase);
    document.getElementById('supplierFooterPayment').textContent = formatSupplierMoney(payment);
    document.getElementById('supplierFooterBalance').textContent = formatSupplierMoney(purchase - payment);
    updateSupplierPrintHeader(summary);

    if (!entries.length) {
        tbody.innerHTML = '<tr><td colspan="10" class="text-center text-muted py-4">No supplier ledger entries found.</td></tr>';
        return;
    }

    let runningBalances = {};
    tbody.innerHTML = entries.map((entry) => {
        const supplier = entry.supplierName || '-';
        if (!runningBalances[supplier]) runningBalances[supplier] = 0;
        const billed = entry.entryType === 'PAYMENT' ? 0 : Number(entry.amount) || 0;
        const paid = entry.entryType === 'PAYMENT' ? Number(entry.amount) || 0 : 0;
        runningBalances[supplier] += billed - paid;
        return `
            <tr>
                <td>${entry.entryDate ? new Date(entry.entryDate).toLocaleDateString('en-IN') : '-'}</td>
                <td>${supplier}</td>
                <td>${entry.entryType === 'PAYMENT' ? (entry.expenseVoucherNo || entry.billNo || '-') : (entry.billNo || '-')}</td>
                <td>${entry.itemName || '-'}</td>
                <td class="text-end">${entry.entryType === 'PAYMENT' ? '-' : (Number(entry.quantity) || 0)}</td>
                <td class="text-end">${entry.entryType === 'PAYMENT' ? '-' : formatSupplierMoney(entry.rate || 0)}</td>
                <td class="text-end">${billed ? formatSupplierMoney(billed) : '-'}</td>
                <td class="text-end">${paid ? formatSupplierMoney(paid) : '-'}</td>
                <td class="text-end fw-semibold">${formatSupplierMoney(runningBalances[supplier])}</td>
                <td>
                    <div class="d-flex gap-2">
                        <a href="expense-record.html?supplierPayment=1&supplierName=${encodeURIComponent(supplier)}" class="btn btn-sm btn-outline-success" title="Record payment"><i class="fas fa-money-bill-wave"></i></a>
                        ${entry.expenseId
                            ? `<a href="expense-record.html?expenseId=${entry.expenseId}" class="btn btn-sm btn-outline-secondary" title="Edit expense"><i class="fas fa-pen"></i></a>
                               <a href="expense-receipt.html?id=${entry.expenseId}" target="_blank" class="btn btn-sm btn-outline-primary" title="Print expense"><i class="fas fa-print"></i></a>`
                            : `<button type="button" class="btn btn-sm btn-outline-secondary edit-supplier-entry-btn" data-entry-id="${entry._id}" title="Edit"><i class="fas fa-pen"></i></button>
                               <button type="button" class="btn btn-sm btn-outline-danger delete-supplier-entry-btn" data-entry-id="${entry._id}" data-bill-no="${entry.billNo || '-'}" title="Delete"><i class="fas fa-trash"></i></button>`}
                    </div>
                </td>
            </tr>
        `;
    }).join('');
    bindSupplierLedgerActions();
}

function getSupplierPayload() {
    const quantity = Number(document.getElementById('supplierQuantity').value) || 0;
    const rate = Number(document.getElementById('supplierRate').value) || 0;
    return {
        entryDate: document.getElementById('supplierEntryDate').value,
        supplierName: document.getElementById('supplierName').value,
        billNo: document.getElementById('supplierBillNo').value.trim(),
        itemName: document.getElementById('supplierItemName').value.trim(),
        quantity,
        rate,
        amount: Number(document.getElementById('supplierAmount').value) || (quantity * rate),
        notes: document.getElementById('supplierNotes').value.trim()
    };
}

function setSupplierFormMode() {
    document.getElementById('supplierFormTitle').innerHTML = editingSupplierEntryId
        ? '<i class="fas fa-pen-to-square me-2"></i>Edit Purchase'
        : '<i class="fas fa-truck me-2"></i>New Purchase';
    document.getElementById('saveSupplierPurchaseBtn').innerHTML = editingSupplierEntryId
        ? '<i class="fas fa-pen me-2"></i>Update Purchase'
        : '<i class="fas fa-save me-2"></i>Save Purchase';
    document.getElementById('cancelSupplierEditBtn').classList.toggle('d-none', !editingSupplierEntryId);
}

function populateSupplierForm(entry = {}) {
    editingSupplierEntryId = entry._id || null;
    document.getElementById('supplierEntryDate').value = entry.entryDate ? new Date(entry.entryDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0];
    populateSupplierOptions(entry.supplierName || '');
    document.getElementById('supplierName').value = entry.supplierName || '';
    document.getElementById('supplierBillNo').value = entry.billNo || '';
    document.getElementById('supplierItemName').value = entry.itemName || '';
    document.getElementById('supplierQuantity').value = entry.quantity || '';
    document.getElementById('supplierRate').value = entry.rate || '';
    document.getElementById('supplierAmount').value = entry.amount || '';
    document.getElementById('supplierNotes').value = entry.notes || '';
    setSupplierFormMode();
}

async function resetSupplierForm() {
    editingSupplierEntryId = null;
    document.getElementById('supplierLedgerForm').reset();
    document.getElementById('supplierEntryDate').value = new Date().toISOString().split('T')[0];
    hideSupplierMessage();
    setSupplierFormMode();
}

function bindSupplierLedgerActions() {
    document.querySelectorAll('.edit-supplier-entry-btn').forEach((button) => {
        button.addEventListener('click', () => {
            const entry = supplierLedgerEntries.find((item) => item._id === button.dataset.entryId);
            if (entry) populateSupplierForm(entry);
        });
    });
    document.querySelectorAll('.delete-supplier-entry-btn').forEach((button) => {
        button.addEventListener('click', async () => {
            if (!window.confirm(`Delete purchase bill ${button.dataset.billNo}?`)) return;
            try {
                const result = await API.suppliers.deleteEntry(button.dataset.entryId);
                if (!result?.success) throw new Error(result?.message || 'Unable to delete purchase');
                await loadSupplierLedger();
                await loadSupplierOptions();
            } catch (error) {
                showSupplierMessage(error.message || 'Unable to delete purchase');
            }
        });
    });
}

async function loadSupplierLedger() {
    const result = await API.suppliers.getEntries(getSupplierFilters());
    supplierLedgerEntries = result?.success ? (result.entries || []) : [];
    renderSupplierLedger(supplierLedgerEntries, result?.summary || {});
}

document.addEventListener('DOMContentLoaded', async () => {
    if (!Auth.isAuthenticated()) {
        window.location.href = '../pages/login.html';
        return;
    }
    if (!Auth.canManageFinance()) {
        alert('Only admin or accountant can manage supplier purchases.');
        window.location.href = 'cashbook.html';
        return;
    }

    await resetSupplierForm();
    await Promise.all([loadSupplierOptions(), loadSupplierLedger()]);

    ['supplierQuantity', 'supplierRate'].forEach((id) => {
        document.getElementById(id).addEventListener('input', () => {
            const qty = Number(document.getElementById('supplierQuantity').value) || 0;
            const rate = Number(document.getElementById('supplierRate').value) || 0;
            if (qty && rate) document.getElementById('supplierAmount').value = (qty * rate).toFixed(2);
        });
    });

    document.getElementById('addSupplierBtn').addEventListener('click', async () => {
        const name = window.prompt('Enter supplier name:');
        if (!name) return;
        try {
            const result = await API.suppliers.createSupplier({ name: name.trim() });
            if (!result?.success) throw new Error(result?.message || 'Unable to create supplier');
            await loadSupplierOptions(result.supplier?.name || name.trim());
        } catch (error) {
            showSupplierMessage(error.message || 'Unable to create supplier');
        }
    });

    document.getElementById('supplierLedgerForm').addEventListener('submit', async (event) => {
        event.preventDefault();
        hideSupplierMessage();
        const payload = getSupplierPayload();
        if (!payload.entryDate || !payload.supplierName || !payload.billNo || !payload.itemName || payload.amount <= 0) {
            showSupplierMessage('Date, supplier, bill no., item and amount are required.');
            return;
        }
        try {
            const result = editingSupplierEntryId
                ? await API.suppliers.updateEntry(editingSupplierEntryId, payload)
                : await API.suppliers.saveEntry(payload);
            if (!result?.success) throw new Error(result?.message || 'Unable to save purchase');
            await resetSupplierForm();
            await Promise.all([loadSupplierOptions(), loadSupplierLedger()]);
        } catch (error) {
            showSupplierMessage(error.message || 'Unable to save purchase');
        }
    });

    document.getElementById('supplierLedgerFilterForm').addEventListener('submit', async (event) => {
        event.preventDefault();
        await loadSupplierLedger();
    });
    document.getElementById('resetSupplierFiltersBtn').addEventListener('click', async () => {
        document.getElementById('supplierLedgerFilterForm').reset();
        await loadSupplierLedger();
    });
    document.getElementById('cancelSupplierEditBtn').addEventListener('click', resetSupplierForm);
    document.getElementById('printSupplierLedgerBtn').addEventListener('click', () => {
        const purchase = supplierLedgerEntries.reduce((sum, entry) => sum + (entry.entryType === 'PAYMENT' ? 0 : Number(entry.amount) || 0), 0);
        const payment = supplierLedgerEntries.reduce((sum, entry) => sum + (entry.entryType === 'PAYMENT' ? Number(entry.amount) || 0 : 0), 0);
        updateSupplierPrintHeader({ totalPurchase: purchase, totalPayment: payment });
        window.print();
    });
});
