let currentAuditLogs = [];
let currentAuditGroups = [];

function formatAuditDate(value) {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '-';
    return date.toLocaleString('en-IN');
}

function escapeAuditHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function formatAuditSimpleValue(field, value) {
    if (value === null || value === undefined || value === '') {
        return '-';
    }

    if (field === 'receiptDate' || field === 'expenseDate' || field === 'createdAt' || field === 'updatedAt') {
        return formatAuditDate(value);
    }

    if (Array.isArray(value)) {
        if (field === 'lineItems') {
            return value.length
                ? value.map((item) => `${item.particular || 'Item'}: ${item.amount ?? 0}`).join(', ')
                : '-';
        }

        if (field === 'paymentBreakdown') {
            return value.length
                ? value.map((item) => `${item.modeLabel || item.baseMode || 'Payment'}: ${item.amount ?? 0}`).join(', ')
                : '-';
        }

        return value.length ? value.map((item) => formatAuditSimpleValue('', item)).join(', ') : '-';
    }

    if (typeof value === 'object') {
        const simpleEntries = Object.entries(value)
            .filter(([, entryValue]) => entryValue !== null && entryValue !== undefined && entryValue !== '')
            .map(([key, entryValue]) => `${key}: ${formatAuditSimpleValue(key, entryValue)}`);

        return simpleEntries.length ? simpleEntries.join(', ') : '-';
    }

    return String(value);
}

function renderAuditBadge(value, type) {
    const badgeClass = type === 'entity'
        ? (value === 'Expense' ? 'badge-expense' : 'badge-fee')
        : (value === 'DELETE' ? 'badge-delete' : 'badge-update');

    const label = type === 'entity'
        ? (value === 'Expense' ? 'Expense' : 'Fee Collection')
        : (value === 'DELETE' ? 'Deleted' : 'Updated');

    return `<span class="badge-soft ${badgeClass}">${escapeAuditHtml(label)}</span>`;
}

function getAuditFilters() {
    return {
        entityType: document.getElementById('auditEntityType').value,
        action: document.getElementById('auditAction').value,
        actor: document.getElementById('auditActor').value.trim(),
        voucherNo: document.getElementById('auditVoucherNo').value.trim(),
        admissionNo: document.getElementById('auditAdmissionNo').value.trim(),
        startDate: document.getElementById('auditStartDate').value,
        endDate: document.getElementById('auditEndDate').value,
        limit: 500
    };
}

function setDefaultAuditDates() {
    const today = new Date();
    const from = new Date();
    from.setDate(today.getDate() - 30);

    document.getElementById('auditEndDate').value = today.toISOString().split('T')[0];
    document.getElementById('auditStartDate').value = from.toISOString().split('T')[0];
}

function buildAuditGroups(logs = []) {
    const grouped = new Map();

    logs.forEach((log) => {
        const key = [
            log.entityType || '',
            log.documentId || '',
            log.voucherNo || '',
            log.referenceNo || ''
        ].join('::');

        if (!grouped.has(key)) {
            grouped.set(key, {
                key,
                entityType: log.entityType,
                documentId: log.documentId,
                voucherNo: log.voucherNo,
                referenceNo: log.referenceNo,
                admissionNo: log.admissionNo,
                title: log.title,
                logs: []
            });
        }

        grouped.get(key).logs.push(log);
    });

    return Array.from(grouped.values())
        .map((group) => {
            group.logs.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
            group.firstLog = group.logs[0] || null;
            group.lastLog = group.logs[group.logs.length - 1] || null;
            group.changeSteps = group.logs.length;
            group.changedFieldsCount = group.logs.reduce((sum, log) => sum + ((log.changedFields || []).length || 0), 0);
            return group;
        })
        .sort((a, b) => new Date(b.lastLog?.createdAt || 0) - new Date(a.lastLog?.createdAt || 0));
}

function renderAuditStats(groups = []) {
    const feeCount = groups.filter((group) => group.entityType === 'FeeReceipt').length;
    const expenseCount = groups.filter((group) => group.entityType === 'Expense').length;
    const deleteCount = groups.filter((group) => group.lastLog?.action === 'DELETE').length;

    document.getElementById('auditStatTotal').textContent = String(groups.length);
    document.getElementById('auditStatFees').textContent = String(feeCount);
    document.getElementById('auditStatExpenses').textContent = String(expenseCount);
    document.getElementById('auditStatDeletes').textContent = String(deleteCount);
}

function buildComparisonFields(log) {
    const changedFields = Array.isArray(log.changedFields) ? log.changedFields : [];
    const beforeSnapshot = log.snapshotBefore && typeof log.snapshotBefore === 'object' ? log.snapshotBefore : {};
    const afterSnapshot = log.snapshotAfter && typeof log.snapshotAfter === 'object' ? log.snapshotAfter : {};

    if (changedFields.length) {
        return changedFields.map((change) => ({
            field: change.field,
            previousValue: change.previousValue,
            updatedValue: change.updatedValue
        }));
    }

    return [...new Set([
        ...Object.keys(beforeSnapshot),
        ...Object.keys(afterSnapshot)
    ])].map((field) => ({
        field,
        previousValue: beforeSnapshot[field],
        updatedValue: afterSnapshot[field]
    }));
}

function buildLogStepTable(log, stepIndex) {
    const comparisonFields = buildComparisonFields(log);
    const comparisonTable = comparisonFields.length
        ? `
            <div class="table-responsive">
                <table class="table table-bordered table-sm align-middle changes-table mb-0">
                    <thead>
                        <tr>
                            <th style="width: 18%;">Field</th>
                            <th style="width: 41%;">What Was Before</th>
                            <th style="width: 41%;">What Is After Edited</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${comparisonFields.map((change) => `
                            ${(() => {
                                const previousText = formatAuditSimpleValue(change.field, change.previousValue);
                                const updatedText = formatAuditSimpleValue(change.field, change.updatedValue);
                                const updatedClass = previousText === updatedText
                                    ? 'previous-value'
                                    : 'edited-value';

                                return `
                            <tr>
                                <td class="fw-semibold">${escapeAuditHtml(change.field)}</td>
                                <td><div class="value-box previous-value">${escapeAuditHtml(previousText)}</div></td>
                                <td><div class="value-box ${updatedClass}">${escapeAuditHtml(updatedText)}</div></td>
                            </tr>
                                `;
                            })()}
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `
        : '<div class="text-muted">No comparison data is available for this audit step.</div>';

    return `
        <div class="detail-panel mb-3">
            <div class="d-flex justify-content-between align-items-start flex-wrap gap-2 mb-3">
                <div>
                    <div class="fw-semibold">Change Step ${stepIndex + 1}</div>
                    <div class="small text-muted">${escapeAuditHtml(formatAuditDate(log.createdAt))}</div>
                </div>
                <div class="text-end">
                    <div class="fw-semibold">${escapeAuditHtml(log.actor?.username || 'Unknown')}</div>
                    <div class="small text-muted">${escapeAuditHtml(log.actor?.role || '-')}</div>
                </div>
            </div>
            ${comparisonTable}
        </div>
    `;
}

function buildAuditDetailsMarkup(group, detailId) {
    return `
        <tr class="detail-row d-none" id="${detailId}">
            <td colspan="8">
                <div class="detail-panel">
                    <div class="row g-3 mb-3">
                        <div class="col-md-3">
                            <div class="small text-muted">Voucher No.</div>
                            <div class="fw-semibold">${escapeAuditHtml(group.voucherNo || '-')}</div>
                        </div>
                        <div class="col-md-3">
                            <div class="small text-muted">Reference No.</div>
                            <div class="fw-semibold">${escapeAuditHtml(group.referenceNo || '-')}</div>
                        </div>
                        <div class="col-md-3">
                            <div class="small text-muted">Admission No.</div>
                            <div class="fw-semibold">${escapeAuditHtml(group.admissionNo || '-')}</div>
                        </div>
                        <div class="col-md-3">
                            <div class="small text-muted">Total Edit Steps</div>
                            <div class="fw-semibold">${group.changeSteps}</div>
                        </div>
                    </div>
                    <div class="small text-muted mb-3">Change flow for this transaction</div>
                    ${group.logs.map((log, index) => buildLogStepTable(log, index)).join('')}
                </div>
            </td>
        </tr>
    `;
}

function renderAuditTable(groups = []) {
    const tbody = document.getElementById('auditTableBody');
    document.getElementById('auditRowCountBadge').textContent = `${groups.length} transactions`;

    if (!groups.length) {
        tbody.innerHTML = '<tr><td colspan="8" class="text-center text-muted py-4">No audit logs found for the current filters.</td></tr>';
        return;
    }

    tbody.innerHTML = groups.map((group, index) => {
        const detailId = `audit-detail-${index}`;
        const lastLog = group.lastLog || {};

        return `
            <tr>
                <td>${escapeAuditHtml(formatAuditDate(lastLog.createdAt))}</td>
                <td>${renderAuditBadge(group.entityType, 'entity')}</td>
                <td>${renderAuditBadge(lastLog.action, 'action')}</td>
                <td>
                    <div class="fw-semibold">${escapeAuditHtml(group.voucherNo || '-')}</div>
                    <div class="small text-muted">${escapeAuditHtml(group.referenceNo || '-')}</div>
                </td>
                <td>
                    <div class="fw-semibold">${escapeAuditHtml(lastLog.actor?.username || 'Unknown')}</div>
                    <div class="small text-muted">${escapeAuditHtml(lastLog.actor?.role || '-')}</div>
                </td>
                <td>
                    <div class="fw-semibold">${escapeAuditHtml(group.title || '-')}</div>
                    <div class="small text-muted">${escapeAuditHtml(group.admissionNo || group.documentId || '-')}</div>
                </td>
                <td>
                    <div class="fw-semibold">${group.changeSteps} step${group.changeSteps === 1 ? '' : 's'}</div>
                    <div class="small text-muted">${group.changedFieldsCount} field changes</div>
                </td>
                <td>
                    <button type="button" class="btn btn-sm btn-outline-primary toggle-detail-btn" data-detail-id="${detailId}">
                        View
                    </button>
                </td>
            </tr>
            ${buildAuditDetailsMarkup(group, detailId)}
        `;
    }).join('');

    tbody.querySelectorAll('.toggle-detail-btn').forEach((button) => {
        button.addEventListener('click', () => {
            const detailRow = document.getElementById(button.dataset.detailId);
            if (!detailRow) return;

            const isHidden = detailRow.classList.contains('d-none');
            detailRow.classList.toggle('d-none', !isHidden);
            button.textContent = isHidden ? 'Hide' : 'View';
        });
    });
}

async function loadAuditLogs() {
    const loadBtn = document.getElementById('loadAuditBtn');
    const exportBtn = document.getElementById('exportAuditBtn');
    const printBtn = document.getElementById('printAuditBtn');
    const statusText = document.getElementById('auditStatusText');
    const originalHtml = loadBtn.innerHTML;

    try {
        loadBtn.disabled = true;
        exportBtn.disabled = true;
        printBtn.disabled = true;
        loadBtn.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>Loading...';
        statusText.textContent = 'Loading audit trail...';

        const result = await API.fees.getAuditLogs(getAuditFilters());
        if (!result || !result.success) {
            throw new Error(result?.message || 'Unable to fetch audit logs');
        }

        currentAuditLogs = result.logs || [];
        currentAuditGroups = buildAuditGroups(currentAuditLogs);
        renderAuditTable(currentAuditGroups);
        renderAuditStats(currentAuditGroups);
        exportBtn.disabled = !currentAuditGroups.length;
        printBtn.disabled = !currentAuditGroups.length;
        statusText.textContent = currentAuditGroups.length
            ? `${currentAuditGroups.length} transactions with audit history loaded`
            : 'No audit entries found';
    } catch (error) {
        console.error(error);
        currentAuditLogs = [];
        currentAuditGroups = [];
        renderAuditTable([]);
        renderAuditStats([]);
        statusText.textContent = 'Unable to load audit logs';
        alert(error.message || 'Unable to load audit logs');
    } finally {
        loadBtn.disabled = false;
        loadBtn.innerHTML = originalHtml;
    }
}

function exportAuditLogs() {
    if (!currentAuditGroups.length || !window.XLSX) {
        return;
    }

    const workbook = XLSX.utils.book_new();
    const summarySheet = XLSX.utils.json_to_sheet(currentAuditGroups.map((group) => ({
        LastAuditDate: formatAuditDate(group.lastLog?.createdAt),
        TransactionType: group.entityType === 'Expense' ? 'Expense' : 'Fee Collection',
        CurrentStatus: group.lastLog?.action === 'DELETE' ? 'Deleted' : 'Updated',
        VoucherNo: group.voucherNo || '',
        ReferenceNo: group.referenceNo || '',
        AdmissionNo: group.admissionNo || '',
        LastEditedBy: group.lastLog?.actor?.username || 'Unknown',
        Record: group.title || '',
        ChangeSteps: group.changeSteps,
        ChangedFields: group.changedFieldsCount
    })));

    const detailSheet = XLSX.utils.json_to_sheet(currentAuditGroups.flatMap((group) =>
        group.logs.flatMap((log, index) => {
            const comparisonFields = buildComparisonFields(log);
            return comparisonFields.length
                ? comparisonFields.map((change) => ({
                    VoucherNo: group.voucherNo || '',
                    Step: index + 1,
                    AuditDate: formatAuditDate(log.createdAt),
                    Actor: log.actor?.username || 'Unknown',
                    Action: log.action,
                    Field: change.field,
                    Previous: formatAuditSimpleValue(change.field, change.previousValue),
                    AfterEdit: formatAuditSimpleValue(change.field, change.updatedValue)
                }))
                : [{
                    VoucherNo: group.voucherNo || '',
                    Step: index + 1,
                    AuditDate: formatAuditDate(log.createdAt),
                    Actor: log.actor?.username || 'Unknown',
                    Action: log.action,
                    Field: '',
                    Previous: '-',
                    AfterEdit: '-'
                }];
        })
    ));

    XLSX.utils.book_append_sheet(workbook, summarySheet, 'Transactions');
    XLSX.utils.book_append_sheet(workbook, detailSheet, 'Change Flow');
    XLSX.writeFile(workbook, `transaction-audit-${new Date().toISOString().split('T')[0]}.xlsx`);
}

document.addEventListener('DOMContentLoaded', async () => {
    if (!Auth.isAuthenticated()) {
        window.location.href = '../pages/login.html';
        return;
    }

    setDefaultAuditDates();
    renderAuditStats([]);

    document.getElementById('auditFilterForm').addEventListener('submit', async (event) => {
        event.preventDefault();
        await loadAuditLogs();
    });

    document.getElementById('exportAuditBtn').addEventListener('click', exportAuditLogs);
    document.getElementById('printAuditBtn').addEventListener('click', () => window.print());
    document.getElementById('resetAuditBtn').addEventListener('click', async () => {
        document.getElementById('auditFilterForm').reset();
        setDefaultAuditDates();
        await loadAuditLogs();
    });

    await loadAuditLogs();
});
