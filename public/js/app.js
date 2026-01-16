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
        span.style.transitionDelay = `${1.0 + (index * 0.03)}s`; // Tighter stagger
        mainTitle.appendChild(span);
    });

    // Trigger animations
    setTimeout(() => {
        curtain.classList.add('hidden');

        // Reveal title letters
        requestAnimationFrame(() => {
            const letters = document.querySelectorAll('.letter-span');
            letters.forEach(l => {
                l.style.opacity = '1';
                l.style.transform = 'translateY(0) rotate(0deg)';
            });
        });
    }, 800);
});

// --- SMOOTH 3D TILT EFFECT (Desktop) ---
if (window.matchMedia("(min-width: 768px)").matches) {

    // Lerp function for smooth interpolation
    const lerp = (start, end, factor) => start + (end - start) * factor;

    let targetX = 0, targetY = 0;
    let currentX = 0, currentY = 0;
    let rafId = null;

    const updateTilt = () => {
        // Interpolate current values towards target
        currentX = lerp(currentX, targetX, 0.1); // 0.1 factor for "heavy" smooth feel
        currentY = lerp(currentY, targetY, 0.1);

        // Apply to Brand Card
        if (brandCard) {
            brandCard.style.transform = `perspective(1000px) rotateX(${-currentY * 8}deg) rotateY(${currentX * 8}deg)`;
        }

        // Apply to Info Panel (if active)
        if (panel && panel.classList.contains('active')) {
             panel.style.transform = `perspective(1000px) rotateX(${-currentY * 5}deg) rotateY(${currentX * 5}deg)`;
        }

        // Continue loop if there's significant movement remaining
        if (Math.abs(targetX - currentX) > 0.001 || Math.abs(targetY - currentY) > 0.001) {
            rafId = requestAnimationFrame(updateTilt);
        } else {
            rafId = null;
        }
    };

    document.addEventListener('mousemove', (e) => {
        const { clientX, clientY, innerWidth, innerHeight } = e;

        // Normalize mouse position (-1 to 1)
        targetX = (clientX / innerWidth) * 2 - 1;
        targetY = (clientY / innerHeight) * 2 - 1;

        if (!rafId) {
            rafId = requestAnimationFrame(updateTilt);
        }
    });

    // Reset on mouse leave
    document.addEventListener('mouseleave', () => {
        targetX = 0;
        targetY = 0;
        if (!rafId) rafId = requestAnimationFrame(updateTilt);
    });

    // --- MAGNETIC BUTTONS ---
    const magneticBtns = document.querySelectorAll('.close-btn');
    magneticBtns.forEach(btn => {
        btn.addEventListener('mousemove', (e) => {
            const rect = btn.getBoundingClientRect();
            const x = e.clientX - rect.left - rect.width / 2;
            const y = e.clientY - rect.top - rect.height / 2;

            // Magnetic pull strength
            btn.style.transform = `translate(${x * 0.3}px, ${y * 0.3}px)`;
        });

        btn.addEventListener('mouseleave', () => {
            btn.style.transform = 'translate(0, 0)';
        });
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
            <div class="marker-wrapper" role="button" tabindex="0" aria-label="Explore ${escapeHtml(loc.name)}" aria-haspopup="dialog" aria-expanded="false" aria-controls="info-panel" style="animation-delay: ${1.8 + (index * 0.1)}s">
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
        const targetZoom = 17; // Closer zoom
        const targetPoint = map.project(loc.coords, targetZoom);

        // Mobile offset: shift map center down so marker is visible above panel
        const offset = isMobile ? L.point(0, 250) : L.point(0, 0);
        const targetCenter = map.unproject(targetPoint.add(offset), targetZoom);

        map.flyTo(targetCenter, targetZoom, {
            animate: true,
            duration: 1.5,
            easeLinearity: 0.1 // Softer flight
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

    // Create a fragment for better performance
    const fragment = document.createDocumentFragment();

    words.forEach((word, i) => {
        const span = document.createElement('span');
        span.textContent = word;
        span.style.marginRight = '0.25em';
        span.style.opacity = '0';
        span.style.display = 'inline-block';
        span.style.transform = 'translateY(8px)';
        span.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
        span.style.transitionDelay = `${i * 0.015}s`; // Faster staggered read
        fragment.appendChild(span);
    });
    panelBody.appendChild(fragment);

    // Double RAF to ensure transition triggers
    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            const spans = panelBody.querySelectorAll('span');
            spans.forEach(s => {
                s.style.opacity = '1';
                s.style.transform = 'translateY(0)';
            });
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
        }, 650);
    }
}

// --- MOBILE SWIPE TO CLOSE ---
let touchStartY = 0;
let touchCurrentY = 0;

panel.addEventListener('touchstart', (e) => {
    touchStartY = e.touches[0].clientY;
    // Only allow swipe if we are at the top of the scroll or it's the handle area
    if (panel.scrollTop > 0) return;
}, { passive: true });

panel.addEventListener('touchmove', (e) => {
    if (touchStartY === 0) return; // Not a valid start
    touchCurrentY = e.touches[0].clientY;
    const diff = touchCurrentY - touchStartY;

    // If pulling down
    if (diff > 0 && panel.scrollTop <= 0) {
         // Visual feedback: drag the panel down slightly
         // Use transform but respect the existing transition/transform
         // simpler: just close if threshold met, avoiding complex physics for now to keep it bug-free
    }
}, { passive: true });

panel.addEventListener('touchend', (e) => {
    if (touchStartY === 0) return;
    const diff = touchCurrentY - touchStartY;

    // Threshold to close: 100px
    if (diff > 100 && panel.scrollTop <= 0) {
        hidePanel();
    }

    touchStartY = 0;
    touchCurrentY = 0;
});

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

    // Reset tilt via style if needed, though loop handles it
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
    }, 1000);
});

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') hidePanel();
});
