import { locations } from './data.js';

// --- INIT MAP ---
const map = L.map('map', {
    center: [12.6140, 80.1935],
    zoom: 15,
    minZoom: 14,
    maxZoom: 18,
    zoomControl: false,
    attributionControl: true,
    scrollWheelZoom: 'center'
});

// Add Zoom Control at bottom right
L.control.zoom({ position: 'bottomright' }).addTo(map);

// Tile Layer - CartoDB Light
L.tileLayer('https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; OpenStreetMap &copy; CARTO',
    subdomains: 'abcd',
    maxZoom: 20
}).addTo(map);

// --- UI REFS ---
const panel = document.getElementById('info-panel');
const panelTitle = document.getElementById('info-title');
const panelBody = document.getElementById('info-body');
const closeBtn = document.getElementById('close-panel');
const curtain = document.getElementById('curtain');
const brandCard = document.getElementById('brand-card');
const mainTitle = document.getElementById('main-title');

let activeMarkerName = null;
let focusTimeout = null;
const markers = {};

// --- ENTRANCE ANIMATION & TITLE STAGGER ---
window.addEventListener('load', () => {
    // Title Stagger Logic
    const text = mainTitle.innerText;
    mainTitle.innerHTML = '';
    text.split('').forEach((char, index) => {
        const span = document.createElement('span');
        span.textContent = char;
        span.className = 'letter-span';
        span.style.transitionDelay = `${1.2 + (index * 0.05)}s`; // Start after header enter
        mainTitle.appendChild(span);
    });

    // Trigger animations
    setTimeout(() => {
        curtain.classList.add('hidden');
        // Reveal title letters
        const letters = document.querySelectorAll('.letter-span');
        letters.forEach(l => {
            l.style.opacity = '1';
            l.style.transform = 'translateY(0) rotate(0deg)';
        });
    }, 1000);
});

// --- 3D TILT EFFECT (Desktop) ---
if (window.matchMedia("(min-width: 768px)").matches) {
    let lastCall = 0;
    document.addEventListener('mousemove', (e) => {
        const now = Date.now();
        if (now - lastCall < 16) return; // ~60fps throttle
        lastCall = now;

        const { clientX, clientY } = e;

        // Function to apply tilt to an element
        const applyTilt = (el, strength) => {
            if (!el) return;
            const rect = el.getBoundingClientRect();
            const centerX = rect.left + rect.width / 2;
            const centerY = rect.top + rect.height / 2;

            // Calculate distance from center (clamped)
            const x = (clientX - centerX) / (window.innerWidth / 2) * strength;
            const y = (clientY - centerY) / (window.innerHeight / 2) * strength;

            // Rotate opposite to movement
            el.style.transform = `perspective(1000px) rotateX(${-y}deg) rotateY(${x}deg)`;
        };

        // Apply to Brand Card
        applyTilt(brandCard, 8);

        // Apply to Info Panel (only if active)
        if (panel.classList.contains('active')) {
           applyTilt(panel, 5);
        }
    });

    // Reset transform on mouse leave for smoother feel
    document.addEventListener('mouseleave', () => {
        if(brandCard) brandCard.style.transform = 'perspective(1000px) rotateX(0) rotateY(0)';
        if(panel) panel.style.transform = 'translateY(0) scale(1) perspective(1000px) rotateX(0) rotateY(0)';
        // Note: panel reset needs to respect its active state transform.
        // Actually, CSS handles the active state transform (translateY/scale).
        // The mousemove overrides style.transform inline.
        // So resetting it to empty string falls back to CSS.
        brandCard.style.transform = '';
        panel.style.transform = '';
    });
}

// --- MARKER LOGIC ---
const escapeHtml = (text) => {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
};

locations.forEach((loc, index) => {
    const icon = L.divIcon({
        className: 'custom-marker',
        html: `
            <div class="marker-wrapper" role="button" tabindex="0" aria-label="Explore ${escapeHtml(loc.name)}" aria-haspopup="dialog" aria-expanded="false" aria-controls="info-panel" style="animation-delay: ${1.5 + (index * 0.1)}s">
                <div class="marker-tooltip">${escapeHtml(loc.name)}</div>
                <div class="marker-ripple"></div>
                <div class="marker-ripple"></div>
                <div class="marker-dot"></div>
            </div>
        `,
        iconSize: [60, 60],
        iconAnchor: [30, 30]
    });

    const marker = L.marker(loc.coords, { icon: icon, keyboard: false });
    markers[loc.name] = marker;

    const activate = (e) => {
        const isKeyboard = e.type === 'keydown' || (e.originalEvent && e.originalEvent.type === 'keydown');

        Object.values(markers).forEach(m => {
            const el = m.getElement();
            if(el) {
                el.classList.remove('active-marker');
                const wrapper = el.querySelector('.marker-wrapper');
                if (wrapper) wrapper.setAttribute('aria-expanded', 'false');
            }
        });

        const currentEl = marker.getElement();
        if(currentEl) currentEl.classList.add('active-marker');

        const isMobile = window.innerWidth < 768;
        const targetZoom = 16;
        const targetPoint = map.project(loc.coords, targetZoom);
        const offset = isMobile ? L.point(0, 200) : L.point(0, 0);
        const targetCenter = map.unproject(targetPoint.add(offset), targetZoom);

        map.flyTo(targetCenter, targetZoom, {
            animate: true,
            duration: 1.5,
            easeLinearity: 0.25
        });

        showPanel(loc, isKeyboard);

        const event = e.originalEvent || e;
        if(event && event.stopPropagation) event.stopPropagation();
    };

    marker.on('click', activate);

    marker.on('add', () => {
        const el = marker.getElement();
        if (activeMarkerName === loc.name && el) {
            el.classList.add('active-marker');
            const wrapper = el.querySelector('.marker-wrapper');
            if (wrapper) wrapper.setAttribute('aria-expanded', 'true');
        }

        const wrapper = el ? el.querySelector('.marker-wrapper') : null;
        if(wrapper && !wrapper.dataset.hasListener) {
            wrapper.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    activate(e);
                }
            });
            wrapper.dataset.hasListener = 'true';
        }
    });

    marker.addTo(map);
});

// --- PANEL FUNCTIONS ---
function showPanel(data, shouldFocus) {
    panelTitle.innerText = data.name;

    panelBody.innerHTML = '';
    const words = data.text.split(' ');
    words.forEach((word, i) => {
        const span = document.createElement('span');
        span.textContent = word;
        span.style.marginRight = '0.25em';
        span.style.opacity = '0';
        span.style.display = 'inline-block';
        span.style.transform = 'translateY(5px)';
        span.style.transition = 'all 0.4s ease';
        span.style.transitionDelay = `${i * 0.02}s`;
        panelBody.appendChild(span);
    });

    requestAnimationFrame(() => {
        const spans = panelBody.querySelectorAll('span');
        spans.forEach(s => {
            s.style.opacity = '1';
            s.style.transform = 'translateY(0)';
        });
    });

    panel.classList.add('active');
    panel.setAttribute('aria-hidden', 'false');

    if (markers[data.name]) {
        const el = markers[data.name].getElement();
        const wrapper = el ? el.querySelector('.marker-wrapper') : null;
        if(wrapper) wrapper.setAttribute('aria-expanded', 'true');
    }

    activeMarkerName = data.name;

    if (focusTimeout) clearTimeout(focusTimeout);

    if (shouldFocus) {
        focusTimeout = setTimeout(() => {
            if (panel.classList.contains('active')) {
                closeBtn.focus();
            }
        }, 600);
    }
}

function hidePanel() {
    if (!panel.classList.contains('active')) return;

    if (focusTimeout) {
        clearTimeout(focusTimeout);
        focusTimeout = null;
    }

    const prevActive = activeMarkerName;
    panel.classList.remove('active');
    panel.setAttribute('aria-hidden', 'true');
    activeMarkerName = null;

    // Remove tilt manually if it was applied via JS
    panel.style.transform = '';

    Object.values(markers).forEach(m => {
        const el = m.getElement();
        if(el) {
            el.classList.remove('active-marker');
            const wrapper = el.querySelector('.marker-wrapper');
            if (wrapper) wrapper.setAttribute('aria-expanded', 'false');
        }
    });

    if (prevActive && markers[prevActive]) {
        const marker = markers[prevActive];
        const bounds = map.getBounds();
        if (bounds.contains(marker.getLatLng())) {
            const el = marker.getElement();
            const wrapper = el ? el.querySelector('.marker-wrapper') : null;
            if (wrapper) wrapper.focus();
        }
    }
}

// --- EVENTS ---
closeBtn.addEventListener('click', hidePanel);

// Map Click Ripple Effect & Close Panel
map.on('click', (e) => {
    hidePanel();

    // Create Visual Ripple
    const ripple = document.createElement('div');
    ripple.className = 'click-ripple';

    // Calculate position from container event
    const point = e.containerPoint;
    ripple.style.left = `${point.x - 20}px`; // Center of 40px
    ripple.style.top = `${point.y - 20}px`;

    const mapContainer = document.getElementById('map');
    mapContainer.appendChild(ripple);

    // Cleanup
    setTimeout(() => {
        ripple.remove();
    }, 800);
});

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') hidePanel();
});
