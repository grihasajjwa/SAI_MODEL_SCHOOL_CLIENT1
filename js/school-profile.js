(function () {
    const DEFAULT_PROFILE = {
        name: 'Skyview Public School',
        shortName: 'SKYVIEW',
        tagline: '(An English Medium school based on CBSE curriculum)',
        addressLine1: 'Uttar Andaranfulbari, Tufanganj, Coochbehar, West Bengal, India, PIN: 736159',
        addressLine2: '',
        phone: '+91-86535-54323',
        email: 'skyviewpublicschool@gmail.com',
        website: 'www.skyviewpublicschool.in',
        logo: '/assets/images/logo1.png',
        watermarkText: 'SKYVIEW PUBLIC SCHOOL'
    };

    let cachedProfile = null;
    let loadPromise = null;

    function getApiBaseUrl() {
        if (window.CONFIG?.API_URL) {
            return window.CONFIG.API_URL;
        }

        const { protocol, hostname } = window.location;
        return `${protocol}//${hostname}:5000/api`;
    }

    function getApiOrigin() {
        try {
            return new URL(getApiBaseUrl()).origin;
        } catch (error) {
            return window.location.origin;
        }
    }

    function resolveAssetUrl(value) {
        if (!value) return DEFAULT_PROFILE.logo;
        if (/^https?:\/\//i.test(value)) return value;
        return new URL(value, getApiOrigin()).toString();
    }

    function buildContactLine(profile) {
        const parts = [];
        if (profile.phone) parts.push(`Contact No. ${profile.phone}`);
        if (profile.email) parts.push(`Email: ${profile.email}`);
        return parts.join(' | ');
    }

    function buildAddressLine(profile) {
        return [profile.addressLine1, profile.addressLine2].filter(Boolean).join(' | ');
    }

    function setText(selector, value) {
        document.querySelectorAll(selector).forEach((element) => {
            element.textContent = value || '';
        });
    }

    function setImage(selector, src, alt) {
        document.querySelectorAll(selector).forEach((element) => {
            element.src = resolveAssetUrl(src);
            if (alt) {
                element.alt = alt;
            }
        });
    }

    function applyTitle(profile) {
        const replacements = [
            [/Skyview Public School/gi, profile.name],
            [/SKYVIEW PUBLIC SCHOOL/gi, profile.name.toUpperCase()],
            [/SKYVIEW\b/gi, profile.shortName || profile.name],
            [/SAI MODEL SCHOOL/gi, profile.name.toUpperCase()]
        ];

        let nextTitle = document.title || profile.name;
        replacements.forEach(([pattern, value]) => {
            nextTitle = nextTitle.replace(pattern, value);
        });
        document.title = nextTitle;
    }

    function applySchoolProfile(profile) {
        const effectiveProfile = { ...DEFAULT_PROFILE, ...(profile || {}) };
        const contactLine = buildContactLine(effectiveProfile);
        const addressLine = buildAddressLine(effectiveProfile);

        applyTitle(effectiveProfile);

        setText('[data-school-name]', effectiveProfile.name);
        setText('[data-school-short-name]', effectiveProfile.shortName || effectiveProfile.name);
        setText('[data-school-tagline]', effectiveProfile.tagline);
        setText('[data-school-address-line1]', effectiveProfile.addressLine1);
        setText('[data-school-address-line2]', effectiveProfile.addressLine2);
        setText('[data-school-address]', addressLine);
        setText('[data-school-contact-line]', contactLine);
        setText('[data-school-phone]', effectiveProfile.phone);
        setText('[data-school-email]', effectiveProfile.email);
        setText('[data-school-website]', effectiveProfile.website);
        setText('[data-school-watermark]', effectiveProfile.watermarkText || effectiveProfile.name.toUpperCase());
        setImage('[data-school-logo]', effectiveProfile.logo, `${effectiveProfile.name} logo`);

        const navbarBrandName = document.querySelector('.school-brand-name');
        if (navbarBrandName) {
            navbarBrandName.textContent = effectiveProfile.name;
        }

        const schoolHeaderBlocks = document.querySelectorAll('.school-header');
        schoolHeaderBlocks.forEach((header) => {
            const title = header.querySelector('h2');
            const paragraphs = header.querySelectorAll('p');
            const logo = header.querySelector('.school-logo');

            if (title && !title.hasAttribute('data-preserve-school-profile')) {
                title.textContent = effectiveProfile.name.toUpperCase();
            }
            if (paragraphs[0] && !paragraphs[0].hasAttribute('data-preserve-school-profile')) {
                paragraphs[0].textContent = addressLine;
            }
            if (paragraphs[1] && !paragraphs[1].hasAttribute('data-preserve-school-profile')) {
                paragraphs[1].textContent = contactLine;
            }
            if (logo) {
                logo.src = resolveAssetUrl(effectiveProfile.logo);
                logo.alt = `${effectiveProfile.name} logo`;
            }
        });

        const feeReceiptName = document.querySelector('.school-name');
        if (feeReceiptName) {
            feeReceiptName.textContent = effectiveProfile.name.toUpperCase();
        }

        const feeReceiptCopy = document.querySelector('.school-copy');
        if (feeReceiptCopy) {
            const copyLines = [
                effectiveProfile.tagline || '',
                addressLine,
                contactLine,
                effectiveProfile.website || ''
            ].filter(Boolean);
            feeReceiptCopy.innerHTML = `
                ${copyLines.join('<br>')}
            `;
        }

        document.querySelectorAll('.watermark').forEach((element) => {
            if (element.children.length === 0 && element.textContent.trim()) {
                element.textContent = effectiveProfile.watermarkText || effectiveProfile.name.toUpperCase();
            }
        });
    }

    async function fetchSchoolProfile(force = false) {
        if (cachedProfile && !force) {
            return cachedProfile;
        }

        if (loadPromise && !force) {
            return loadPromise;
        }

        loadPromise = fetch(`${getApiBaseUrl()}/school-profile`)
            .then((response) => {
                if (!response.ok) {
                    throw new Error(`Failed to load school profile: ${response.status}`);
                }
                return response.json();
            })
            .then((payload) => {
                cachedProfile = { ...DEFAULT_PROFILE, ...(payload.profile || {}) };
                applySchoolProfile(cachedProfile);
                return cachedProfile;
            })
            .catch((error) => {
                console.error('School profile load error:', error);
                cachedProfile = { ...DEFAULT_PROFILE };
                applySchoolProfile(cachedProfile);
                return cachedProfile;
            })
            .finally(() => {
                loadPromise = null;
            });

        return loadPromise;
    }

    function getCachedProfile() {
        return cachedProfile ? { ...cachedProfile } : { ...DEFAULT_PROFILE };
    }

    window.SchoolProfile = {
        apply: applySchoolProfile,
        fetch: fetchSchoolProfile,
        getCachedProfile
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => fetchSchoolProfile());
    } else {
        fetchSchoolProfile();
    }
})();
