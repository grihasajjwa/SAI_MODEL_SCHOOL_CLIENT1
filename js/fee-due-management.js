function formatDueMoney(value) {
    const amount = Number(value) || 0;
    return amount.toLocaleString('en-IN', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
}

function escapeDueHtml(value = '') {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function renderDashboardSummary(summary = {}) {
    document.getElementById('dueSummaryOutstanding').textContent = formatDueMoney(summary.totalOutstanding || 0);
    document.getElementById('dueSummaryStudents').textContent = summary.dueStudentCount || 0;
    document.getElementById('dueSummaryCollected').textContent = formatDueMoney(summary.totalCollected || 0);
    document.getElementById('dueSummaryNet').textContent = formatDueMoney(summary.netBalance || 0);
}

function renderDueTable(dues = [], totals = {}) {
    const tbody = document.getElementById('dueTableBody');
    document.getElementById('dueReportTotal').textContent = formatDueMoney(totals.totalOutstanding || 0);
    document.getElementById('dueReportCount').textContent = totals.studentCount || 0;

    if (!dues.length) {
        tbody.innerHTML = `
            <tr>
                <td colspan="11" class="text-center text-muted py-4">No due or excess balances found.</td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = dues.map((item) => {
        const dueAmount = Number(item.dueAmount) || 0;
        const actionHtml = dueAmount > 0
            ? `<a href="fee-collection.html?admissionNo=${encodeURIComponent(item.admissionNo || '')}&collectDue=1" class="btn btn-sm btn-primary">Collect Due</a>`
            : '<span class="badge bg-success-subtle text-success">No Due</span>';

        return `
            <tr>
                <td>${escapeDueHtml(item.admissionNo || '-')}</td>
                <td>${escapeDueHtml(item.studentName || '-')}</td>
                <td>${escapeDueHtml(item.fatherName || '-')}</td>
                <td>${escapeDueHtml(item.className || '-')}${item.section ? ` - ${escapeDueHtml(item.section)}` : ''}</td>
                <td>${escapeDueHtml(item.rollNo || '-')}</td>
                <td>${item.lastReceiptDate ? new Date(item.lastReceiptDate).toLocaleDateString('en-IN') : '-'}</td>
                <td>Rs. ${formatDueMoney(item.chargesTotal || 0)}</td>
                <td>Rs. ${formatDueMoney(item.paidAmount || 0)}</td>
                <td class="fw-bold text-danger">Rs. ${formatDueMoney(dueAmount)}</td>
                <td class="fw-bold text-success">Rs. ${formatDueMoney(item.excessPayment || 0)}</td>
                <td>${actionHtml}</td>
            </tr>
        `;
    }).join('');
}

async function loadDashboardSummary() {
    const result = await API.fees.getDashboard();
    if (result?.success) {
        renderDashboardSummary(result.summary || {});
    }
}

async function loadDueReport(filters = {}) {
    const result = await API.fees.getDueReport(filters);

    if (!result || !result.success) {
        throw new Error(result?.message || 'Unable to load due report');
    }

    renderDueTable(result.dues || [], result.totals || {});
}

document.addEventListener('DOMContentLoaded', async () => {
    if (!Auth.isAuthenticated()) {
        window.location.href = '../pages/login.html';
        return;
    }

    try {
        await Promise.all([
            loadDashboardSummary(),
            loadDueReport()
        ]);
    } catch (error) {
        console.error(error);
        renderDueTable([], {});
    }

    document.getElementById('dueFilterForm').addEventListener('submit', async (event) => {
        event.preventDefault();

        const submitButton = document.getElementById('applyDueFilterBtn');
        const originalHtml = submitButton.innerHTML;
        submitButton.disabled = true;
        submitButton.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>Loading...';

        try {
            await loadDueReport({
                search: document.getElementById('dueSearch').value.trim(),
                className: document.getElementById('dueClassFilter').value.trim(),
                section: document.getElementById('dueSectionFilter').value.trim()
            });
        } catch (error) {
            console.error(error);
            alert(error.message || 'Unable to fetch due report');
        } finally {
            submitButton.disabled = false;
            submitButton.innerHTML = originalHtml;
        }
    });

    document.getElementById('resetDueFiltersBtn').addEventListener('click', async () => {
        document.getElementById('dueFilterForm').reset();
        try {
            await loadDueReport();
        } catch (error) {
            console.error(error);
        }
    });
});
