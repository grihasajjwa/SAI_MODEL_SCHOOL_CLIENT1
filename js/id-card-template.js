const idCardFields = [
    'studentName',
    'className',
    'section',
    'admissionNo',
    'guardianName',
    'dob',
    'phone',
    'address',
    'session'
];

function resolveIdCardAssetUrl(value, fallback) {
    if (!value) return fallback;
    if (/^(https?:|data:|blob:)/i.test(value)) return value;
    try {
        return new URL(value, new URL(CONFIG.API_URL).origin).toString();
    } catch (error) {
        return value;
    }
}

function formatIdCardDate(value) {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleDateString('en-IN');
}

function setIdCardSchoolProfile(profile = {}) {
    const schoolName = profile.name || profile.schoolName || 'Skyview Public School';
    const idAddress = profile.idCardAddress || profile.shortAddress || 'Tufanganj, Coochbehar';
    const logo = resolveIdCardAssetUrl(profile.logo || profile.logoUrl, '../assets/images/logo1.png');
    const signature = resolveIdCardAssetUrl(profile.principalSignature, '../assets/images/principal-signature1.png');

    document.getElementById('idSchoolName').textContent = schoolName.toUpperCase();
    document.getElementById('idSchoolAddress').textContent = idAddress.toUpperCase();
    document.getElementById('idSchoolLogo').src = logo;
    document.getElementById('idPrincipalSignature').src = signature;
    fitIdCardText();
}

async function loadIdCardSchoolProfile() {
    try {
        const response = await fetch(`${CONFIG.API_URL}/school-profile`);
        const payload = await response.json();
        if (!response.ok || !payload.success) {
            throw new Error(payload.message || 'Unable to load school profile');
        }
        setIdCardSchoolProfile(payload.profile || {});
    } catch (error) {
        console.error('ID card school profile load error:', error);
        setIdCardSchoolProfile({});
    }
}

async function loadCurrentIdCardSession() {
    try {
        const response = await fetch(`${CONFIG.API_URL}/sessions/current`);
        const payload = await response.json();
        const sessionName = payload?.session?.name || 'Default';
        if (sessionName && sessionName !== 'Default') {
            setIdField('session', sessionName);
            document.getElementById('loadSession').value = sessionName;
        }
    } catch (error) {
        console.error('ID card current session load error:', error);
    }
}

function setIdField(field, value) {
    const input = document.querySelector(`[data-id-field="${field}"]`);
    if (input) input.value = value || '';

    document.querySelectorAll(`[data-id-output="${field}"]`).forEach((element) => {
        element.textContent = field === 'dob' ? formatIdCardDate(value) : (value || '-');
    });
    fitIdCardText();
}

function applyIdCardForm() {
    idCardFields.forEach((field) => {
        const input = document.querySelector(`[data-id-field="${field}"]`);
        if (!input) return;
        document.querySelectorAll(`[data-id-output="${field}"]`).forEach((element) => {
            element.textContent = field === 'dob'
                ? formatIdCardDate(input.value)
                : (input.value.trim() || '-');
        });
    });
    fitIdCardText();
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

function fitIdCardText() {
    document.querySelectorAll('.id-school-name').forEach((element) => fitOneLineText(element, 26, 19));
    document.querySelectorAll('.id-school-place').forEach((element) => fitOneLineText(element, 17, 13));
    document.querySelectorAll('.id-class-row').forEach((element) => fitOneLineText(element, 16, 11));
    document.querySelectorAll('[data-id-output]').forEach((element) => fitMultiLineText(element, 13.5, 8.5));
    document.querySelectorAll('[data-id-output="session"]').forEach((element) => fitOneLineText(element, 24, 16));
}

function applyQueryParams() {
    const params = new URLSearchParams(window.location.search);
    const aliases = {
        studentName: ['studentName', 'name'],
        className: ['className', 'class'],
        section: ['section', 'sec'],
        admissionNo: ['admissionNo', 'admnNo', 'studentId'],
        guardianName: ['guardianName', 'fatherName', 'guardian'],
        dob: ['dob', 'dateOfBirth'],
        phone: ['phone', 'contactNo', 'mobile'],
        address: ['address'],
        session: ['session', 'academicYear']
    };

    Object.entries(aliases).forEach(([field, keys]) => {
        const key = keys.find((candidate) => params.has(candidate));
        if (key) setIdField(field, params.get(key));
    });

    if (params.get('photo')) {
        setIdCardPhoto(params.get('photo'));
    }

    const admissionNo = params.get('admissionNo') || params.get('studentId') || '';
    const session = params.get('session') || params.get('academicYear') || '';
    document.getElementById('loadAdmissionNo').value = admissionNo;
    document.getElementById('loadSession').value = session || document.getElementById('sessionInput').value;
}

function setIdCardPhoto(src) {
    const photoBox = document.getElementById('photoBox');
    const image = document.getElementById('studentPhotoPreview');
    if (!src) {
        photoBox.classList.remove('has-photo');
        image.removeAttribute('src');
        return;
    }
    image.src = src;
    photoBox.classList.add('has-photo');
}

function resolveStudentPhoto(photo) {
    if (!photo) return '';
    if (typeof photo === 'string') return photo;
    return photo.url || photo.secure_url || photo.path || '';
}

function sanitizeIdCardFileName(value) {
    return String(value || 'id-card')
        .trim()
        .replace(/[^a-z0-9-_]+/gi, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '')
        || 'id-card';
}

function waitForIdCardImages(card) {
    const images = Array.from(card.querySelectorAll('img'));
    return Promise.all(images.map((image) => {
        if (!image.src || image.complete) return Promise.resolve();
        return new Promise((resolve) => {
            image.onload = resolve;
            image.onerror = resolve;
        });
    }));
}

function waitForNextFrame() {
    return new Promise((resolve) => requestAnimationFrame(() => resolve()));
}

async function downloadIdCardPng() {
    const card = document.getElementById('idCard');
    const button = document.getElementById('downloadIdCardPngBtn');
    const originalHtml = button.innerHTML;

    if (typeof html2canvas === 'undefined') {
        alert('PNG download library is still loading. Please try again.');
        return;
    }

    button.disabled = true;
    button.innerHTML = '<i class="fas fa-spinner fa-spin me-1"></i>PNG';

    try {
        fitIdCardText();
        await waitForIdCardImages(card);
        await waitForNextFrame();
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
        const admissionNo = document.getElementById('admissionInput').value || 'student';
        const session = document.getElementById('sessionInput').value || 'session';
        const link = document.createElement('a');
        link.download = `${sanitizeIdCardFileName(admissionNo)}-${sanitizeIdCardFileName(session)}-id-card.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
    } catch (error) {
        console.error('ID card PNG download error:', error);
        alert(error.message || 'Unable to download ID card PNG');
    } finally {
        button.disabled = false;
        button.innerHTML = originalHtml;
        fitIdCardText();
    }
}

async function loadIdCardStudent() {
    const admissionNo = document.getElementById('loadAdmissionNo').value.trim();
    const session = document.getElementById('loadSession').value.trim() || document.getElementById('sessionInput').value.trim();
    const button = document.getElementById('loadStudentBtn');
    const originalHtml = button.innerHTML;

    if (!admissionNo) {
        alert('Enter admission number first.');
        return;
    }

    button.disabled = true;
    button.innerHTML = '<i class="fas fa-spinner fa-spin me-1"></i>Loading...';

    try {
        const response = await fetch(`${CONFIG.API_URL}/student/${encodeURIComponent(admissionNo)}?session=${encodeURIComponent(session)}`, {
            headers: { Authorization: `Bearer ${Auth.getToken()}` }
        });
        const payload = await response.json();
        if (!response.ok || !payload.success) {
            throw new Error(payload.message || 'Unable to load student');
        }

        const student = payload.student || {};
        setIdField('studentName', student.name || '');
        setIdField('className', student.class || '');
        setIdField('section', student.section || '');
        setIdField('admissionNo', student.studentId || admissionNo);
        setIdField('guardianName', student.fatherName || student.guardianName || '');
        setIdField('dob', student.dob ? String(student.dob).split('T')[0] : '');
        setIdField('phone', student.contactNo || '');
        setIdField('address', student.address || '');
        setIdField('session', student.session || session || '');
        document.getElementById('loadSession').value = student.session || session || '';
        setIdCardPhoto(resolveStudentPhoto(student.photo));
    } catch (error) {
        console.error(error);
        alert(error.message || 'Unable to load student');
    } finally {
        button.disabled = false;
        button.innerHTML = originalHtml;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    if (!Auth.isAuthenticated()) {
        window.location.href = '../pages/login.html';
        return;
    }

    document.querySelectorAll('[data-id-field]').forEach((input) => {
        input.addEventListener('input', applyIdCardForm);
        input.addEventListener('change', applyIdCardForm);
    });

    document.getElementById('photoInput').addEventListener('change', (event) => {
        const file = event.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => setIdCardPhoto(reader.result);
        reader.readAsDataURL(file);
    });

    document.getElementById('loadStudentBtn').addEventListener('click', loadIdCardStudent);
    document.getElementById('printIdCardBtn').addEventListener('click', () => window.print());
    document.getElementById('downloadIdCardPngBtn').addEventListener('click', downloadIdCardPng);
    document.getElementById('loadAdmissionNo').addEventListener('keydown', (event) => {
        if (event.key === 'Enter') loadIdCardStudent();
    });
    window.addEventListener('resize', fitIdCardText);

    Promise.all([
        loadIdCardSchoolProfile(),
        loadCurrentIdCardSession()
    ]).finally(() => {
        applyQueryParams();
        applyIdCardForm();
        setTimeout(fitIdCardText, 100);
    });
});
