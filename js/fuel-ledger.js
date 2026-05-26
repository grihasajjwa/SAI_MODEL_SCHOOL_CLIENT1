let fuelLedgerOptions = {
    centres: [],
    vehicles: []
};
let fuelLedgerEntries = [];
let fuelLedgerSummary = { totalAmount: 0, totalVolume: 0, entryCount: 0 };
let fuelLedgerCurrentPage = 1;
let editingFuelEntryId = null;

function formatFuelMoney(value) {
    const amount = Number(value) || 0;
    return amount.toLocaleString('en-IN', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
}

function formatFuelNumber(value) {
    const amount = Number(value) || 0;
    return amount.toLocaleString('en-IN', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
}

function showFuelMessage(message) {
    const box = document.getElementById('fuelLedgerMessage');
    box.textContent = message;
    box.classList.remove('d-none');
}

function hideFuelMessage() {
    const box = document.getElementById('fuelLedgerMessage');
    box.textContent = '';
    box.classList.add('d-none');
}

function populateFuelLedgerOptions(selectedCentre = '', selectedVehicle = '') {
    const centreSelect = document.getElementById('fuelCentreName');
    const vehicleSelect = document.getElementById('fuelVehicleNumber');
    const filterCentreSelect = document.getElementById('fuelFilterCentre');
    const filterVehicleSelect = document.getElementById('fuelFilterVehicle');

    const centreOptions = fuelLedgerOptions.centres.map((centre) => {
        const name = centre.name || centre;
        return `<option value="${name}" ${name === selectedCentre ? 'selected' : ''}>${name}</option>`;
    }).join('');

    centreSelect.innerHTML = `<option value="">Select Fuel Centre</option>${centreOptions}`;

    const currentFilterCentre = filterCentreSelect.value;
    const filterCentreOptions = fuelLedgerOptions.centres.map((centre) => {
        const name = centre.name || centre;
        return `<option value="${name}">${name}</option>`;
    }).join('');
    filterCentreSelect.innerHTML = `<option value="">All Centres</option>${filterCentreOptions}`;
    if (currentFilterCentre && [...filterCentreSelect.options].some((option) => option.value === currentFilterCentre)) {
        filterCentreSelect.value = currentFilterCentre;
    }

    const vehicleOptions = fuelLedgerOptions.vehicles.map((vehicle) => {
        const vehicleNumber = vehicle.vehicleNumber || vehicle;
        return `<option value="${vehicleNumber}" ${vehicleNumber === selectedVehicle ? 'selected' : ''}>${vehicleNumber}</option>`;
    }).join('');

    vehicleSelect.innerHTML = `<option value="">Select Vehicle</option>${vehicleOptions}`;

    const currentFilterVehicle = filterVehicleSelect.value;
    const filterVehicleOptions = fuelLedgerOptions.vehicles.map((vehicle) => {
        const vehicleNumber = vehicle.vehicleNumber || vehicle;
        return `<option value="${vehicleNumber}">${vehicleNumber}</option>`;
    }).join('');
    filterVehicleSelect.innerHTML = `<option value="">All Vehicles</option>${filterVehicleOptions}`;
    if (currentFilterVehicle && [...filterVehicleSelect.options].some((option) => option.value === currentFilterVehicle)) {
        filterVehicleSelect.value = currentFilterVehicle;
    }
}

async function loadFuelLedgerOptions(selectedCentre = '', selectedVehicle = '') {
    const result = await API.fuel.getOptions();
    if (!result?.success) {
        return;
    }

    fuelLedgerOptions = {
        centres: result.centres || [],
        vehicles: result.vehicles || []
    };
    populateFuelLedgerOptions(selectedCentre, selectedVehicle);
}

function getFuelFilters() {
    return {
        startDate: document.getElementById('fuelFilterStartDate').value,
        endDate: document.getElementById('fuelFilterEndDate').value,
        fuelCentreName: document.getElementById('fuelFilterCentre').value,
        vehicleNumber: document.getElementById('fuelFilterVehicle').value
    };
}

function getFuelLedgerPageSize() {
    return Number(document.getElementById('fuelLedgerPageSize')?.value) || 25;
}

function getFuelLedgerPageCount(totalRows = fuelLedgerEntries.length) {
    return Math.max(1, Math.ceil(totalRows / getFuelLedgerPageSize()));
}

function updateFuelLedgerPagination(totalRows = fuelLedgerEntries.length) {
    const pageCount = getFuelLedgerPageCount(totalRows);
    fuelLedgerCurrentPage = Math.min(Math.max(fuelLedgerCurrentPage, 1), pageCount);

    const pageSize = getFuelLedgerPageSize();
    const start = totalRows ? ((fuelLedgerCurrentPage - 1) * pageSize) + 1 : 0;
    const end = Math.min(fuelLedgerCurrentPage * pageSize, totalRows);

    document.getElementById('fuelLedgerPageInfo').textContent = totalRows
        ? `Showing ${start}-${end} of ${totalRows} records`
        : 'Showing 0 records';
    document.getElementById('fuelLedgerPageNumber').textContent = `${fuelLedgerCurrentPage} / ${pageCount}`;
    document.getElementById('fuelLedgerPrevPageBtn').disabled = fuelLedgerCurrentPage <= 1;
    document.getElementById('fuelLedgerNextPageBtn').disabled = fuelLedgerCurrentPage >= pageCount;
}

function renderFuelLedger(entries = [], summary = {}) {
    const billedAmount = entries
        .filter((entry) => !entry.expenseId)
        .reduce((sum, entry) => sum + (Number(entry.amount) || 0), 0);
    const paymentAmount = entries
        .filter((entry) => entry.expenseId)
        .reduce((sum, entry) => sum + (Number(entry.amount) || 0), 0);
    const totalBilledAmount = fuelLedgerEntries
        .filter((entry) => !entry.expenseId)
        .reduce((sum, entry) => sum + (Number(entry.amount) || 0), 0);
    const totalPaymentAmount = fuelLedgerEntries
        .filter((entry) => entry.expenseId)
        .reduce((sum, entry) => sum + (Number(entry.amount) || 0), 0);

    document.getElementById('fuelBalanceAmount').textContent = formatFuelMoney(totalBilledAmount - totalPaymentAmount);
    document.getElementById('fuelTotalVolume').textContent = formatFuelNumber(summary.totalVolume || 0);
    document.getElementById('fuelEntryCount').textContent = String(summary.entryCount || entries.length || 0);
    document.getElementById('fuelFooterVolume').textContent = formatFuelNumber(entries.reduce((sum, entry) => sum + (Number(entry.volumeLtr) || 0), 0));
    document.getElementById('fuelFooterBilled').textContent = formatFuelMoney(billedAmount);
    document.getElementById('fuelFooterPayment').textContent = formatFuelMoney(paymentAmount);
    document.getElementById('fuelFooterBalance').textContent = formatFuelMoney(billedAmount - paymentAmount);

    const tbody = document.getElementById('fuelLedgerTableBody');
    if (!entries.length) {
        tbody.innerHTML = '<tr><td colspan="9" class="text-center text-muted py-4">No fuel bills found.</td></tr>';
        updateFuelLedgerPagination(0);
        return;
    }

    tbody.innerHTML = entries.map((entry) => `
        <tr>
            <td>${entry.fuelDate ? new Date(entry.fuelDate).toLocaleDateString('en-IN') : '-'}</td>
            <td>${entry.fuelCentreName || '-'}</td>
            <td>${entry.receiptNo || '-'}</td>
            <td>${entry.vehicleNumber || '-'}</td>
            <td class="text-end">${formatFuelNumber(entry.volumeLtr || 0)}</td>
            <td class="text-end">${entry.expenseId ? '-' : formatFuelMoney(entry.amount || 0)}</td>
            <td class="text-end">${entry.expenseId ? formatFuelMoney(entry.amount || 0) : '-'}</td>
            <td class="text-end">${Number(entry.recordedKmMeter || 0).toLocaleString('en-IN')}</td>
            <td>
                ${entry.expenseId
                    ? `<div class="d-flex gap-2">
                        <a href="expense-record.html?expenseId=${entry.expenseId}" class="btn btn-sm btn-outline-secondary" title="Edit expense" aria-label="Edit expense"><i class="fas fa-pen"></i></a>
                        <a href="expense-receipt.html?id=${entry.expenseId}" target="_blank" class="btn btn-sm btn-outline-primary" title="Print expense" aria-label="Print expense"><i class="fas fa-print"></i></a>
                        <button type="button" class="btn btn-sm btn-outline-danger delete-fuel-expense-btn" data-expense-id="${entry.expenseId}" data-voucher-no="${entry.expenseVoucherNo || '-'}" title="Delete expense" aria-label="Delete expense"><i class="fas fa-trash"></i></button>
                    </div>`
                    : `<div class="d-flex gap-2">
                        <button type="button" class="btn btn-sm btn-outline-secondary edit-fuel-entry-btn" data-entry-id="${entry._id}" title="Edit fuel bill" aria-label="Edit fuel bill"><i class="fas fa-pen"></i></button>
                        <button type="button" class="btn btn-sm btn-outline-danger delete-fuel-entry-btn" data-entry-id="${entry._id}" data-receipt-no="${entry.receiptNo || '-'}" title="Delete fuel bill" aria-label="Delete fuel bill"><i class="fas fa-trash"></i></button>
                    </div>`}
            </td>
        </tr>
    `).join('');
    bindFuelLedgerActions();
    updateFuelLedgerPagination(fuelLedgerEntries.length);
}

function setFuelFormMode() {
    const title = document.getElementById('fuelFormTitle');
    const saveButton = document.getElementById('saveFuelBillBtn');
    const cancelButton = document.getElementById('cancelFuelEditBtn');

    if (editingFuelEntryId) {
        title.innerHTML = '<i class="fas fa-pen-to-square me-2"></i>Edit Fuel Bill';
        saveButton.innerHTML = '<i class="fas fa-pen me-2"></i>Update Fuel Bill';
        cancelButton.classList.remove('d-none');
        return;
    }

    title.innerHTML = '<i class="fas fa-gas-pump me-2"></i>New Fuel Bill';
    saveButton.innerHTML = '<i class="fas fa-save me-2"></i>Save Fuel Bill';
    cancelButton.classList.add('d-none');
}

function populateFuelForm(entry = {}) {
    editingFuelEntryId = entry._id || null;
    document.getElementById('fuelDate').value = entry.fuelDate ? new Date(entry.fuelDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0];
    populateFuelLedgerOptions(entry.fuelCentreName || '', entry.vehicleNumber || '');
    document.getElementById('fuelCentreName').value = entry.fuelCentreName || '';
    document.getElementById('fuelReceiptNo').value = entry.receiptNo || '';
    document.getElementById('fuelVehicleNumber').value = entry.vehicleNumber || '';
    document.getElementById('fuelVolumeLtr').value = entry.volumeLtr || '';
    document.getElementById('fuelAmount').value = entry.amount || '';
    document.getElementById('fuelRecordedKmMeter').value = entry.recordedKmMeter || '';
    document.getElementById('fuelNotes').value = entry.notes || '';
    setFuelFormMode();
    document.getElementById('fuelLedgerForm').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function bindFuelLedgerActions() {
    document.querySelectorAll('.edit-fuel-entry-btn').forEach((button) => {
        button.addEventListener('click', () => {
            const entry = fuelLedgerEntries.find((item) => item._id === button.dataset.entryId);
            if (entry) {
                populateFuelForm(entry);
            }
        });
    });

    document.querySelectorAll('.delete-fuel-entry-btn').forEach((button) => {
        button.addEventListener('click', async () => {
            const confirmed = window.confirm(`Delete fuel bill ${button.dataset.receiptNo}?`);
            if (!confirmed) return;

            try {
                const result = await API.fuel.deleteEntry(button.dataset.entryId);
                if (!result?.success) {
                    throw new Error(result?.message || 'Unable to delete fuel bill');
                }

                if (editingFuelEntryId === button.dataset.entryId) {
                    await resetFuelForm();
                }
                await loadFuelLedger();
            } catch (error) {
                console.error(error);
                showFuelMessage(error.message || 'Unable to delete fuel bill');
            }
        });
    });

    document.querySelectorAll('.delete-fuel-expense-btn').forEach((button) => {
        button.addEventListener('click', async () => {
            const confirmed = window.confirm(`Delete linked expense ${button.dataset.voucherNo}?`);
            if (!confirmed) return;

            const editReason = window.prompt('Reason for deleting this expense:') || '';
            if (!editReason.trim()) {
                showFuelMessage('Delete reason is required for deleting an expense.');
                return;
            }

            try {
                const result = await API.fees.deleteExpense(button.dataset.expenseId, { editReason: editReason.trim() });
                if (!result?.success) {
                    throw new Error(result?.message || 'Unable to delete linked expense');
                }

                await loadFuelLedger();
            } catch (error) {
                console.error(error);
                showFuelMessage(error.message || 'Unable to delete linked expense');
            }
        });
    });
}

function renderFuelLedgerPage() {
    const pageSize = getFuelLedgerPageSize();
    const pageCount = getFuelLedgerPageCount();
    fuelLedgerCurrentPage = Math.min(Math.max(fuelLedgerCurrentPage, 1), pageCount);

    const startIndex = (fuelLedgerCurrentPage - 1) * pageSize;
    const pageEntries = fuelLedgerEntries.slice(startIndex, startIndex + pageSize);
    renderFuelLedger(pageEntries, fuelLedgerSummary);
}

async function loadFuelLedger() {
    const result = await API.fuel.getEntries(getFuelFilters());
    if (!result?.success) {
        fuelLedgerEntries = [];
        fuelLedgerSummary = { totalAmount: 0, totalVolume: 0, entryCount: 0 };
        fuelLedgerCurrentPage = 1;
        renderFuelLedgerPage();
        return;
    }

    fuelLedgerEntries = result.entries || [];
    fuelLedgerSummary = result.summary || {};
    fuelLedgerCurrentPage = 1;
    renderFuelLedgerPage();
}

function getFuelFormPayload() {
    return {
        fuelDate: document.getElementById('fuelDate').value,
        fuelCentreName: document.getElementById('fuelCentreName').value,
        receiptNo: document.getElementById('fuelReceiptNo').value.trim(),
        vehicleNumber: document.getElementById('fuelVehicleNumber').value,
        volumeLtr: Number(document.getElementById('fuelVolumeLtr').value) || 0,
        amount: Number(document.getElementById('fuelAmount').value) || 0,
        recordedKmMeter: Number(document.getElementById('fuelRecordedKmMeter').value) || 0,
        notes: document.getElementById('fuelNotes').value.trim()
    };
}

function validateFuelFormPayload(payload) {
    if (!payload.fuelDate || !payload.fuelCentreName || !payload.receiptNo || !payload.vehicleNumber) {
        return 'Date, fuel centre, receipt no. and vehicle number are required.';
    }

    if (payload.volumeLtr <= 0 || payload.amount <= 0) {
        return 'Volume and amount must be greater than zero.';
    }

    return '';
}

async function resetFuelForm() {
    editingFuelEntryId = null;
    document.getElementById('fuelLedgerForm').reset();
    document.getElementById('fuelDate').value = new Date().toISOString().split('T')[0];
    setFuelFormMode();
}

document.addEventListener('DOMContentLoaded', async () => {
    if (!Auth.isAuthenticated()) {
        window.location.href = '../pages/login.html';
        return;
    }

    if (!Auth.canManageFinance()) {
        alert('Only admin or accountant can manage fuel bills.');
        window.location.href = 'today-finance.html';
        return;
    }

    await resetFuelForm();
    await Promise.all([
        loadFuelLedgerOptions(),
        loadFuelLedger()
    ]);

    document.getElementById('addFuelCentreBtn').addEventListener('click', async () => {
        const name = window.prompt('Enter fuel centre name:');
        if (!name) return;

        try {
            const result = await API.fuel.createCentre(name.trim());
            if (!result?.success) {
                throw new Error(result?.message || 'Unable to create fuel centre');
            }
            await loadFuelLedgerOptions(result.centre?.name || name.trim(), document.getElementById('fuelVehicleNumber').value);
        } catch (error) {
            console.error(error);
            showFuelMessage(error.message || 'Unable to create fuel centre');
        }
    });

    document.getElementById('addFuelVehicleBtn').addEventListener('click', async () => {
        const vehicleNumber = window.prompt('Enter vehicle number:');
        if (!vehicleNumber) return;

        try {
            const result = await API.fuel.createVehicle(vehicleNumber.trim());
            if (!result?.success) {
                throw new Error(result?.message || 'Unable to create vehicle number');
            }
            await loadFuelLedgerOptions(document.getElementById('fuelCentreName').value, result.vehicle?.vehicleNumber || vehicleNumber.trim().toUpperCase());
        } catch (error) {
            console.error(error);
            showFuelMessage(error.message || 'Unable to create vehicle number');
        }
    });

    document.getElementById('fuelLedgerForm').addEventListener('submit', async (event) => {
        event.preventDefault();
        hideFuelMessage();

        const payload = getFuelFormPayload();
        const validationMessage = validateFuelFormPayload(payload);
        if (validationMessage) {
            showFuelMessage(validationMessage);
            return;
        }

        const button = document.getElementById('saveFuelBillBtn');
        const originalHtml = button.innerHTML;
        let shouldRestoreOriginalButton = true;

        try {
            button.disabled = true;
            button.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>Saving...';
            const result = editingFuelEntryId
                ? await API.fuel.updateEntry(editingFuelEntryId, payload)
                : await API.fuel.saveEntry(payload);
            if (!result?.success) {
                throw new Error(result?.message || 'Unable to save fuel bill');
            }
            await resetFuelForm();
            shouldRestoreOriginalButton = false;
            await Promise.all([
                loadFuelLedgerOptions(),
                loadFuelLedger()
            ]);
        } catch (error) {
            console.error(error);
            showFuelMessage(error.message || 'Unable to save fuel bill');
        } finally {
            button.disabled = false;
            if (shouldRestoreOriginalButton) {
                button.innerHTML = originalHtml;
            } else {
                setFuelFormMode();
            }
        }
    });

    document.getElementById('fuelLedgerFilterForm').addEventListener('submit', async (event) => {
        event.preventDefault();
        await loadFuelLedger();
    });

    document.getElementById('cancelFuelEditBtn').addEventListener('click', async () => {
        await resetFuelForm();
    });

    document.getElementById('resetFuelFiltersBtn').addEventListener('click', async () => {
        document.getElementById('fuelLedgerFilterForm').reset();
        await loadFuelLedger();
    });

    document.getElementById('fuelLedgerPageSize').addEventListener('change', () => {
        fuelLedgerCurrentPage = 1;
        renderFuelLedgerPage();
    });

    document.getElementById('fuelLedgerPrevPageBtn').addEventListener('click', () => {
        if (fuelLedgerCurrentPage <= 1) return;
        fuelLedgerCurrentPage -= 1;
        renderFuelLedgerPage();
    });

    document.getElementById('fuelLedgerNextPageBtn').addEventListener('click', () => {
        if (fuelLedgerCurrentPage >= getFuelLedgerPageCount()) return;
        fuelLedgerCurrentPage += 1;
        renderFuelLedgerPage();
    });

    document.getElementById('printFuelLedgerBtn').addEventListener('click', () => {
        window.print();
    });
});
