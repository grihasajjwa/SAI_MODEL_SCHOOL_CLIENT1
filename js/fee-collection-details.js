const DETAIL_MONTHS = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
];

let detailTransactions = [];
let filteredDetailRows = [];
let detailCurrentPage = 1;
let detailMonthBasis = 'fee';

function detailMoney(value) {
    const amount = Number(value) || 0;
    return amount.toLocaleString('en-IN', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
}

function detailDate(value) {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '-';

    const day = String(date.getDate()).padStart(2, '0');
    const month = date.toLocaleString('en-US', { month: 'short' });
    const year = date.getFullYear();
    return `${day}-${month}-${year}`;
}

function getDetailCollectionMonth(transaction = {}) {
    const date = new Date(transaction.receiptDate || transaction.createdAt);
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleString('en-US', { month: 'long' });
}

function shouldHighlightMonth(particular) {
    const normalized = String(particular || '').trim().toLowerCase();
    return normalized === 'tuition fee' || normalized === 'transport fee';
}

function detailEscape(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function getDetailParams() {
    const params = new URLSearchParams(window.location.search);
    return {
        session: params.get('session') || '',
        month: params.get('month') || '',
        collectionMonth: params.get('collectionMonth') || '',
        particular: params.get('particular') || '',
        studentName: params.get('studentName') || ''
    };
}

function setDetailText(id, value) {
    const element = document.getElementById(id);
    if (element) element.textContent = value;
}

function setupDetailMonths() {
    const select = document.getElementById('detailMonth');
    const params = getDetailParams();
    const selectedMonth = params.collectionMonth || params.month;
    select.innerHTML = '<option value="">All Months</option>' +
        DETAIL_MONTHS.map((month) => `<option value="${month}">${month}</option>`).join('');
    select.value = selectedMonth;
}

async function setupDetailSessions() {
    const select = document.getElementById('detailSession');
    const selectedSession = getDetailParams().session;
    select.innerHTML = '<option value="">Loading sessions...</option>';

    const sessions = await API.sessions.getAll();
    const sessionNames = sessions
        .map((session) => typeof session === 'string' ? session : session.name)
        .filter(Boolean);
    const currentSession = sessions.find((session) => session?.isCurrent)?.name || sessionNames[0] || '';

    select.innerHTML = '<option value="">Select Session</option>' +
        sessionNames.map((session) => `<option value="${detailEscape(session)}">${detailEscape(session)}</option>`).join('');
    select.value = selectedSession || currentSession || '';
}

async function setupDetailParticulars() {
    const select = document.getElementById('detailParticular');
    const selectedParticular = getDetailParams().particular;
    select.innerHTML = '<option value="">Loading particulars...</option>';

    const result = await API.fees.getParticulars();
    const particulars = (result?.particulars || [])
        .map((particular) => particular.name || particular)
        .filter(Boolean)
        .sort((a, b) => a.localeCompare(b));

    select.innerHTML = '<option value="">All Particulars</option>' +
        particulars.map((particular) => `<option value="${detailEscape(particular)}">${detailEscape(particular)}</option>`).join('');
    select.value = selectedParticular;
}

function getDetailFilters() {
    const selectedMonth = document.getElementById('detailMonth').value;
    return {
        session: document.getElementById('detailSession').value,
        month: detailMonthBasis === 'collection' ? '' : selectedMonth,
        collectionMonth: detailMonthBasis === 'collection' ? selectedMonth : '',
        particular: document.getElementById('detailParticular').value,
        studentName: document.getElementById('detailStudentName').value.trim()
    };
}

function updateDetailUrl(filters) {
    const params = new URLSearchParams();
    if (filters.session) params.set('session', filters.session);
    if (filters.month) params.set('month', filters.month);
    if (filters.collectionMonth) params.set('collectionMonth', filters.collectionMonth);
    if (filters.particular) params.set('particular', filters.particular);
    if (filters.studentName) params.set('studentName', filters.studentName);
    window.history.replaceState({}, '', `fee-collection-details.html?${params.toString()}`);
}

function buildDetailRows(transactions = [], filters = {}) {
    const particularFilter = String(filters.particular || '').trim().toLowerCase();
    const studentFilter = String(filters.studentName || '').trim().toLowerCase();
    const collectionMonthFilter = String(filters.collectionMonth || '').trim().toLowerCase();

    return transactions.flatMap((transaction) => {
        if (studentFilter && !String(transaction.studentName || '').toLowerCase().includes(studentFilter)) {
            return [];
        }

        if (collectionMonthFilter && getDetailCollectionMonth(transaction).toLowerCase() !== collectionMonthFilter) {
            return [];
        }

        return (transaction.lineItems || [])
            .filter((item) => {
                if (!particularFilter) return true;
                return String(item.particular || '').trim().toLowerCase() === particularFilter;
            })
            .map((item) => ({
                transaction,
                particular: item.particular || '-',
                amount: Number(item.amount) || 0
            }));
    });
}

function renderDetailRows(rows = []) {
    const tbody = document.getElementById('detailsTableBody');
    const total = rows.reduce((sum, row) => sum + row.amount, 0);
    const filters = getDetailFilters();
    const pageSize = Number(document.getElementById('detailPageSize').value) || 25;
    const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));

    if (detailCurrentPage > totalPages) detailCurrentPage = totalPages;
    if (detailCurrentPage < 1) detailCurrentPage = 1;

    const startIndex = (detailCurrentPage - 1) * pageSize;
    const pageRows = rows.slice(startIndex, startIndex + pageSize);

    setDetailText('detailTotal', detailMoney(total));
    setDetailText('detailCount', rows.length);
    setDetailText('detailSessionCard', filters.session || '-');
    setDetailText('detailParticularCard', filters.particular || 'All Particulars');
    const selectedMonth = filters.collectionMonth || filters.month;
    setDetailText('detailsTitle', `${filters.particular || 'Fee Collection'} Details${selectedMonth ? ` - ${selectedMonth}` : ''}`);
    updateDetailPagination(rows.length, startIndex, pageRows.length, totalPages);

    if (!rows.length) {
        tbody.innerHTML = '<tr><td colspan="8" class="text-center text-muted py-4">No details found.</td></tr>';
        return;
    }

    tbody.innerHTML = pageRows.map((row, index) => {
        const transaction = row.transaction || {};
        const monthClass = shouldHighlightMonth(row.particular) ? 'table-warning fw-bold' : '';
        return `
            <tr>
                <td>${startIndex + index + 1}</td>
                <td>${detailEscape(transaction.admissionNo || '-')}</td>
                <td>${detailEscape(transaction.studentName || '-')}</td>
                <td>${detailEscape(row.particular)}</td>
                <td class="${monthClass}">${detailEscape(transaction.month || '-')}</td>
                <td>${detailDate(transaction.receiptDate || transaction.createdAt)}</td>
                <td class="text-end">${detailMoney(row.amount)}</td>
                <td>
                    <a href="fee-receipt.html?id=${encodeURIComponent(transaction._id || '')}" target="_blank" class="btn btn-sm btn-outline-primary">
                        View
                    </a>
                </td>
            </tr>
        `;
    }).join('');
}

function updateDetailPagination(totalRows, startIndex, shownRows, totalPages) {
    const info = document.getElementById('detailPaginationInfo');
    const prev = document.getElementById('detailPrevPage');
    const next = document.getElementById('detailNextPage');

    if (!totalRows) {
        info.textContent = '0 rows';
        prev.disabled = true;
        next.disabled = true;
        return;
    }

    const from = startIndex + 1;
    const to = startIndex + shownRows;
    info.textContent = `${from}-${to} of ${totalRows} rows | Page ${detailCurrentPage} of ${totalPages}`;
    prev.disabled = detailCurrentPage <= 1;
    next.disabled = detailCurrentPage >= totalPages;
}

function refreshDetailRowsFromCurrentFilters() {
    filteredDetailRows = buildDetailRows(detailTransactions, getDetailFilters());
    renderDetailRows(filteredDetailRows);
}

async function loadDetailRows() {
    const filters = getDetailFilters();
    const tbody = document.getElementById('detailsTableBody');
    updateDetailUrl(filters);
        tbody.innerHTML = '<tr><td colspan="8" class="text-center text-muted py-4">Loading details...</td></tr>';

    const result = await API.fees.getTransactions({
        session: filters.session,
        month: filters.month,
        collectionMonth: filters.collectionMonth,
        particular: filters.particular,
        limit: 1000
    });

    if (!result?.success) {
        throw new Error(result?.message || 'Unable to load fee collection details');
    }

    detailTransactions = result.transactions || [];
    detailCurrentPage = 1;
    filteredDetailRows = buildDetailRows(detailTransactions, filters);
    renderDetailRows(filteredDetailRows);
}

document.addEventListener('DOMContentLoaded', async () => {
    if (!Auth.isAuthenticated()) {
        window.location.href = '../pages/login.html';
        return;
    }

    const params = getDetailParams();
    detailMonthBasis = params.collectionMonth ? 'collection' : 'fee';
    document.getElementById('detailStudentName').value = params.studentName;
    setupDetailMonths();

    try {
        await Promise.all([
            setupDetailSessions(),
            setupDetailParticulars()
        ]);
        await loadDetailRows();
    } catch (error) {
        console.error(error);
        document.getElementById('detailsTableBody').innerHTML = '<tr><td colspan="8" class="text-center text-danger py-4">Unable to load details.</td></tr>';
    }

    document.getElementById('detailsFilterForm').addEventListener('submit', async (event) => {
        event.preventDefault();
        try {
            await loadDetailRows();
        } catch (error) {
            console.error(error);
            alert(error.message || 'Unable to load details');
        }
    });

    document.getElementById('detailStudentName').addEventListener('input', () => {
        detailCurrentPage = 1;
        refreshDetailRowsFromCurrentFilters();
    });

    document.getElementById('detailPageSize').addEventListener('change', () => {
        detailCurrentPage = 1;
        renderDetailRows(filteredDetailRows);
    });

    document.getElementById('detailPrevPage').addEventListener('click', () => {
        detailCurrentPage -= 1;
        renderDetailRows(filteredDetailRows);
    });

    document.getElementById('detailNextPage').addEventListener('click', () => {
        detailCurrentPage += 1;
        renderDetailRows(filteredDetailRows);
    });

    document.getElementById('detailResetBtn').addEventListener('click', async () => {
        document.getElementById('detailMonth').value = '';
        document.getElementById('detailParticular').value = '';
        document.getElementById('detailStudentName').value = '';
        try {
            await loadDetailRows();
        } catch (error) {
            console.error(error);
        }
    });
});
