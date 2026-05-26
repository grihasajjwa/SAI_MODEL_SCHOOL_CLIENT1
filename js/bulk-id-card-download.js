const bulkState = {
    sessions: [],
    classesByName: [],
    students: [],
    selected: new Set(),
    profile: null
};

const bulkSessionSelect = document.getElementById('bulkSessionSelect');
const bulkClassSelect = document.getElementById('bulkClassSelect');
const bulkSectionSelect = document.getElementById('bulkSectionSelect');
const bulkStudentBody = document.getElementById('bulkStudentBody');
const bulkStatus = document.getElementById('bulkStatus');
const bulkStudentSearch = document.getElementById('bulkStudentSearch');
const bulkMasterCheck = document.getElementById('bulkMasterCheck');
const downloadBulkZipBtn = document.getElementById('downloadBulkZipBtn');

function authHeaders() {
    return { Authorization: `Bearer ${Auth.getToken()}` };
}

function escapeBulkHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function sanitizeBulkFileName(value) {
    return String(value || 'id-card')
        .trim()
        .replace(/[^a-z0-9-_]+/gi, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '')
        || 'id-card';
}

function resolveBulkAssetUrl(value, fallback) {
    if (!value) return fallback;
    if (/^(https?:|data:|blob:)/i.test(value)) return value;
    try {
        return new URL(value, new URL(CONFIG.API_URL).origin).toString();
    } catch (error) {
        return value;
    }
}

function formatBulkDate(value) {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '-';
    return date.toLocaleDateString('en-IN');
}

function resolveStudentPhoto(photo) {
    if (!photo) return '';
    if (typeof photo === 'string') return resolveBulkAssetUrl(photo, '');
    return resolveBulkAssetUrl(photo.url || photo.secure_url || photo.path || '', '');
}

async function initializeBulkIdPage() {
    const [sessionsResponse, currentResponse, profileResponse] = await Promise.all([
        fetch(`${CONFIG.API_URL}/sessions`, { headers: authHeaders() }),
        fetch(`${CONFIG.API_URL}/sessions/current`, { headers: authHeaders() }),
        fetch(`${CONFIG.API_URL}/school-profile`, { headers: authHeaders() })
    ]);

    const sessionsPayload = sessionsResponse.ok ? await sessionsResponse.json() : {};
    const currentPayload = currentResponse.ok ? await currentResponse.json() : {};
    const profilePayload = profileResponse.ok ? await profileResponse.json() : {};

    bulkState.profile = profilePayload?.profile || {};
    bulkState.sessions = Array.isArray(sessionsPayload.sessions) && sessionsPayload.sessions.length
        ? sessionsPayload.sessions
        : [{ name: 'Default', active: true, isCurrent: true }];

    const currentSession = currentPayload?.session?.name
        || bulkState.sessions.find((session) => session.isCurrent)?.name
        || bulkState.sessions[0]?.name
        || 'Default';

    bulkSessionSelect.innerHTML = bulkState.sessions
        .map((session) => `<option value="${escapeBulkHtml(session.name)}">${escapeBulkHtml(session.name)}</option>`)
        .join('');
    bulkSessionSelect.value = currentSession;
    await loadBulkClasses();
}

async function loadBulkClasses() {
    const session = bulkSessionSelect.value;
    bulkClassSelect.innerHTML = '<option value="">Loading...</option>';
    bulkSectionSelect.innerHTML = '<option value="">Select section</option>';
    bulkState.students = [];
    bulkState.selected.clear();
    renderBulkStudents();

    const response = await fetch(`${CONFIG.API_URL}/classes/year/${encodeURIComponent(session)}`, {
        headers: authHeaders()
    });
    if (!response.ok) throw new Error('Unable to load classes');
    const classes = await response.json();
    const grouped = new Map();

    (Array.isArray(classes) ? classes : []).forEach((entry) => {
        const className = entry.className || '';
        if (!className) return;
        if (!grouped.has(className)) grouped.set(className, []);
        grouped.get(className).push(entry);
    });

    bulkState.classesByName = Array.from(grouped.entries())
        .map(([className, sections]) => ({
            className,
            sections: sections.map((entry) => ({
                section: entry.section || 'A',
                studentCount: Number(entry.studentCount) || 0
            })).sort((a, b) => String(a.section).localeCompare(String(b.section)))
        }))
        .sort((a, b) => a.className.localeCompare(b.className, undefined, { numeric: true }));

    bulkClassSelect.innerHTML = '<option value="">Select class</option>' + bulkState.classesByName
        .map((entry) => `<option value="${escapeBulkHtml(entry.className)}">${escapeBulkHtml(entry.className)}</option>`)
        .join('');
    bulkStatus.textContent = `Session ready: ${session}`;
}

function populateBulkSections() {
    const classEntry = bulkState.classesByName.find((entry) => entry.className === bulkClassSelect.value);
    bulkSectionSelect.innerHTML = '<option value="">Select section</option>';
    if (!classEntry) return;
    bulkSectionSelect.innerHTML += classEntry.sections
        .map((entry) => `<option value="${escapeBulkHtml(entry.section)}">${escapeBulkHtml(entry.section)} (${entry.studentCount})</option>`)
        .join('');
}

async function loadBulkStudents() {
    const session = bulkSessionSelect.value;
    const className = bulkClassSelect.value;
    const section = bulkSectionSelect.value;

    if (!session || !className || !section) {
        alert('Choose session, class and section first.');
        return;
    }

    bulkStatus.textContent = 'Loading students...';
    const response = await fetch(`${CONFIG.API_URL}/students/class/${encodeURIComponent(className)}/${encodeURIComponent(section)}?session=${encodeURIComponent(session)}`, {
        headers: authHeaders()
    });
    if (!response.ok) throw new Error('Unable to load students');

    bulkState.students = await response.json();
    bulkState.selected = new Set(bulkState.students.map((student) => student._id));
    renderBulkStudents();
    bulkStatus.textContent = `${bulkState.students.length} students loaded. ${bulkState.selected.size} selected.`;
}

function getFilteredBulkStudents() {
    const search = bulkStudentSearch.value.trim().toLowerCase();
    if (!search) return bulkState.students;
    return bulkState.students.filter((student) => [
        student.studentId,
        student.name,
        student.fatherName,
        student.contactNo
    ].some((value) => String(value || '').toLowerCase().includes(search)));
}

function renderBulkStudents() {
    const students = getFilteredBulkStudents();
    downloadBulkZipBtn.disabled = bulkState.selected.size === 0;
    bulkMasterCheck.checked = students.length > 0 && students.every((student) => bulkState.selected.has(student._id));

    if (!students.length) {
        bulkStudentBody.innerHTML = '<tr><td colspan="7" class="text-center text-muted py-4">No students found.</td></tr>';
        return;
    }

    bulkStudentBody.innerHTML = students.map((student) => `
        <tr>
            <td><input type="checkbox" class="bulk-student-check" data-id="${escapeBulkHtml(student._id)}" ${bulkState.selected.has(student._id) ? 'checked' : ''}></td>
            <td>${escapeBulkHtml(student.studentId || '-')}</td>
            <td>${escapeBulkHtml(student.name || '-')}</td>
            <td>${escapeBulkHtml(student.class || '-')}</td>
            <td>${escapeBulkHtml(student.section || '-')}</td>
            <td>${escapeBulkHtml(student.fatherName || '-')}</td>
            <td>${escapeBulkHtml(student.contactNo || '-')}</td>
        </tr>
    `).join('');

    bulkStudentBody.querySelectorAll('.bulk-student-check').forEach((checkbox) => {
        checkbox.addEventListener('change', () => {
            if (checkbox.checked) {
                bulkState.selected.add(checkbox.dataset.id);
            } else {
                bulkState.selected.delete(checkbox.dataset.id);
            }
            renderBulkStudents();
            bulkStatus.textContent = `${bulkState.students.length} students loaded. ${bulkState.selected.size} selected.`;
        });
    });
}

function fitOneLineText(element, maxSize, minSize) {
    element.style.fontSize = `${maxSize}px`;
    let size = maxSize;
    while (element.scrollWidth > element.clientWidth && size > minSize) {
        size -= 1;
        element.style.fontSize = `${size}px`;
    }
}

function fitMultiLineText(element, maxSize, minSize) {
    element.style.fontSize = `${maxSize}px`;
    let size = maxSize;
    while ((element.scrollHeight > element.clientHeight || element.scrollWidth > element.clientWidth) && size > minSize) {
        size -= 1;
        element.style.fontSize = `${size}px`;
    }
}

function fitBulkCardText(card) {
    card.querySelectorAll('.id-school-name').forEach((element) => fitOneLineText(element, 26, 19));
    card.querySelectorAll('.id-school-place').forEach((element) => fitOneLineText(element, 17, 13));
    card.querySelectorAll('.id-class-row').forEach((element) => fitOneLineText(element, 16, 11));
    card.querySelectorAll('[data-id-output]').forEach((element) => fitMultiLineText(element, 13.5, 8.5));
    card.querySelectorAll('[data-id-output="session"]').forEach((element) => fitOneLineText(element, 24, 16));
}

function renderIdCardForStudent(student) {
    const profile = bulkState.profile || {};
    const schoolName = (profile.name || profile.schoolName || 'Skyview Public School').toUpperCase();
    const schoolAddress = (profile.idCardAddress || profile.shortAddress || 'Tufanganj, Coochbehar').toUpperCase();
    const logo = resolveBulkAssetUrl(profile.logo || profile.logoUrl, '../assets/images/logo1.png');
    const signature = resolveBulkAssetUrl(profile.principalSignature, '../assets/images/principal-signature1.png');
    const photo = resolveStudentPhoto(student.photo);
    const session = student.session || bulkSessionSelect.value || '';

    return `
        <div class="id-card">
            <div class="id-top-red">IDENTITY CARD</div>
            <div class="id-school-band">
                <div class="id-school-name">${escapeBulkHtml(schoolName)}</div>
                <div class="id-school-place">${escapeBulkHtml(schoolAddress)}</div>
            </div>
            <div class="id-thin-red"></div>
            <img class="id-logo" crossorigin="anonymous" src="${escapeBulkHtml(logo)}" alt="School logo">
            <div class="id-photo-box ${photo ? 'has-photo' : ''}">
                ${photo ? `<img crossorigin="anonymous" src="${escapeBulkHtml(photo)}" alt="Student photo">` : '<img alt="Student photo">'}
            </div>
            <div class="id-details">
                <div class="id-field-row"><span class="id-field-label">Name</span><span class="id-field-sep">:</span><span class="id-field-value" data-id-output="studentName">${escapeBulkHtml(student.name || '-')}</span></div>
                <div class="id-class-row">
                    <div class="id-class-field"><span>Class</span><span>:</span><span data-id-output="className">${escapeBulkHtml(student.class || '-')}</span></div>
                    <div class="id-class-field"><span>Sec.</span><span>:</span><span data-id-output="section">${escapeBulkHtml(student.section || '-')}</span></div>
                </div>
                <div class="id-field-row"><span class="id-field-label">Admn. No</span><span class="id-field-sep">:</span><span class="id-field-value" data-id-output="admissionNo">${escapeBulkHtml(student.studentId || '-')}</span></div>
                <div class="id-field-row"><span class="id-field-label">Guardian's Name</span><span class="id-field-sep">:</span><span class="id-field-value" data-id-output="guardianName">${escapeBulkHtml(student.fatherName || student.guardianName || '-')}</span></div>
                <div class="id-field-row"><span class="id-field-label">D.O.B.</span><span class="id-field-sep">:</span><span class="id-field-value" data-id-output="dob">${escapeBulkHtml(formatBulkDate(student.dob))}</span></div>
                <div class="id-field-row"><span class="id-field-label">Phone No.</span><span class="id-field-sep">:</span><span class="id-field-value" data-id-output="phone">${escapeBulkHtml(student.contactNo || '-')}</span></div>
                <div class="id-field-row"><span class="id-field-label">Address</span><span class="id-field-sep">:</span><span class="id-field-value" data-id-output="address">${escapeBulkHtml(student.address || '-')}</span></div>
            </div>
            <div class="id-signature">
                <img crossorigin="anonymous" src="${escapeBulkHtml(signature)}" alt="Principal signature">
                <div>Principal</div>
            </div>
            <div class="id-session-band">SESSION : <span data-id-output="session">${escapeBulkHtml(session)}</span></div>
        </div>
    `;
}

function waitForImages(root) {
    const images = Array.from(root.querySelectorAll('img'));
    return Promise.all(images.map((image) => {
        if (!image.src || image.complete) return Promise.resolve();
        return new Promise((resolve) => {
            image.onload = resolve;
            image.onerror = resolve;
        });
    }));
}

function canvasToBlob(canvas) {
    return new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
}

async function downloadBulkZip() {
    if (typeof html2canvas === 'undefined' || typeof JSZip === 'undefined') {
        alert('Download libraries are still loading. Please try again.');
        return;
    }

    const selectedStudents = bulkState.students.filter((student) => bulkState.selected.has(student._id));
    if (!selectedStudents.length) {
        alert('Select at least one student.');
        return;
    }

    const originalHtml = downloadBulkZipBtn.innerHTML;
    downloadBulkZipBtn.disabled = true;
    downloadBulkZipBtn.innerHTML = '<i class="fas fa-spinner fa-spin me-1"></i>Preparing...';

    const stage = document.getElementById('idCardRenderStage');
    const zip = new JSZip();

    try {
        for (let index = 0; index < selectedStudents.length; index += 1) {
            const student = selectedStudents[index];
            bulkStatus.textContent = `Generating ${index + 1} of ${selectedStudents.length}: ${student.name || student.studentId || 'Student'}`;
            stage.innerHTML = renderIdCardForStudent(student);
            const card = stage.querySelector('.id-card');
            fitBulkCardText(card);
            await waitForImages(card);
            await new Promise((resolve) => requestAnimationFrame(resolve));

            const canvas = await html2canvas(card, {
                backgroundColor: null,
                scale: 4,
                useCORS: true,
                allowTaint: true,
                width: card.offsetWidth,
                height: card.offsetHeight,
                scrollX: 0,
                scrollY: 0
            });
            const blob = await canvasToBlob(canvas);
            const fileName = `${String(index + 1).padStart(2, '0')}-${sanitizeBulkFileName(student.studentId || student.name)}-id-card.png`;
            zip.file(fileName, blob);
        }

        bulkStatus.textContent = 'Creating ZIP file...';
        const zipBlob = await zip.generateAsync({ type: 'blob' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(zipBlob);
        link.download = `id-cards-${sanitizeBulkFileName(bulkClassSelect.value)}-${sanitizeBulkFileName(bulkSectionSelect.value)}-${sanitizeBulkFileName(bulkSessionSelect.value)}.zip`;
        link.click();
        URL.revokeObjectURL(link.href);
        bulkStatus.textContent = `ZIP ready. ${selectedStudents.length} ID cards downloaded.`;
    } catch (error) {
        console.error('Bulk ID card ZIP error:', error);
        alert(error.message || 'Unable to create ID card ZIP');
        bulkStatus.textContent = 'ZIP creation failed.';
    } finally {
        stage.innerHTML = '';
        downloadBulkZipBtn.disabled = bulkState.selected.size === 0;
        downloadBulkZipBtn.innerHTML = originalHtml;
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    if (!Auth.isAuthenticated()) {
        window.location.href = '../pages/login.html';
        return;
    }

    bulkSessionSelect.addEventListener('change', async () => {
        try {
            await loadBulkClasses();
        } catch (error) {
            console.error(error);
            alert(error.message || 'Unable to load classes');
        }
    });
    bulkClassSelect.addEventListener('change', populateBulkSections);
    document.getElementById('loadBulkStudentsBtn').addEventListener('click', async () => {
        try {
            await loadBulkStudents();
        } catch (error) {
            console.error(error);
            alert(error.message || 'Unable to load students');
            bulkStatus.textContent = 'Unable to load students.';
        }
    });
    bulkStudentSearch.addEventListener('input', renderBulkStudents);
    document.getElementById('selectAllBulkBtn').addEventListener('click', () => {
        getFilteredBulkStudents().forEach((student) => bulkState.selected.add(student._id));
        renderBulkStudents();
        bulkStatus.textContent = `${bulkState.students.length} students loaded. ${bulkState.selected.size} selected.`;
    });
    document.getElementById('clearBulkBtn').addEventListener('click', () => {
        bulkState.selected.clear();
        renderBulkStudents();
        bulkStatus.textContent = `${bulkState.students.length} students loaded. 0 selected.`;
    });
    bulkMasterCheck.addEventListener('change', () => {
        if (bulkMasterCheck.checked) {
            getFilteredBulkStudents().forEach((student) => bulkState.selected.add(student._id));
        } else {
            getFilteredBulkStudents().forEach((student) => bulkState.selected.delete(student._id));
        }
        renderBulkStudents();
        bulkStatus.textContent = `${bulkState.students.length} students loaded. ${bulkState.selected.size} selected.`;
    });
    downloadBulkZipBtn.addEventListener('click', downloadBulkZip);

    try {
        await initializeBulkIdPage();
    } catch (error) {
        console.error(error);
        alert(error.message || 'Unable to initialize bulk ID card page');
        bulkStatus.textContent = 'Unable to initialize page.';
    }
});
