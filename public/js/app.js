import { locations } from './data.js';

/**
 * UTILITIES
 */

/**
 * Triggers haptic feedback on supported devices.
 * @param {number|number[]} pattern - Vibration pattern (e.g., 50, or [100, 30, 100])
 */
const triggerHaptic = (pattern = 50) => {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate(pattern);
    }
};

/**
 * Sanitizes a string for safe HTML insertion.
 * @param {string} text - The text to sanitize.
 * @returns {string} - The sanitized HTML string.
 */
const escapeHtml = (text) => {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
};

/**
 * Linearly interpolates between two values.
 * @param {number} start
 * @param {number} end
 * @param {number} factor
 * @returns {number}
 */
const lerp = (start, end, factor) => start + (end - start) * factor;

// --- DOM ELEMENTS ---
const elements = {
    map: document.getElementById('map'),
    panel: document.getElementById('info-panel'),
    panelTitle: document.getElementById('info-title'),
    panelBody: document.getElementById('info-body'),
    closeBtn: document.getElementById('close-panel'),
    curtain: document.getElementById('curtain'),
    brandCard: document.getElementById('brand-card'),
    mainTitle: document.getElementById('main-title'),
    tourControls: document.getElementById('tour-controls'),
    startTourBtn: document.getElementById('start-tour-btn'),
    prevTourBtn: document.getElementById('prev-tour-btn'),
    nextTourBtn: document.getElementById('next-tour-btn'),
    endTourBtn: document.getElementById('end-tour-btn'),
    tourProgress: document.getElementById('tour-progress')
};

// --- STATE ---
const state = {
    activeMarkerName: null,
    focusTimeout: null,
    markers: {},
    tour: {
        active: false,
        currentStep: 0
    },
    tilt: {
        targetX: 0,
        targetY: 0,
        currentX: 0,
        currentY: 0,
        rafId: null
    },
    swipe: {
        startY: 0,
        currentY: 0,
        isDragging: false
    }
};

// --- AUDIO GUIDE SYSTEM ---
const audioGuide = {
    synth: window.speechSynthesis,
    utterance: null,
    isPlaying: false,

    play(text) {
        if (!this.synth) return;
        this.stop();
        this.utterance = new SpeechSynthesisUtterance(text);

        // Try to find a good English voice
        const voices = this.synth.getVoices();
        const preferredVoice = voices.find(v => v.lang.startsWith('en') && v.name.includes('Google')) || voices.find(v => v.lang.startsWith('en'));
        if (preferredVoice) this.utterance.voice = preferredVoice;

        this.utterance.onend = () => {
            this.isPlaying = false;
            this.updateButtonState();
        };

        this.synth.play(this.utterance);
        this.isPlaying = true;
        this.updateButtonState();
    },

    stop() {
        if (!this.synth) return;
        this.synth.cancel();
        this.isPlaying = false;
        this.updateButtonState();
    },

    toggle(text) {
        if (this.isPlaying) {
            this.stop();
        } else {
            this.play(text);
        }
    },

    updateButtonState() {
        const btn = document.getElementById('audio-guide-btn');
        if (!btn) return;
        if (this.isPlaying) {
            btn.innerHTML = `
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <rect x="6" y="4" width="4" height="16"></rect>
                    <rect x="14" y="4" width="4" height="16"></rect>
                </svg>
                Stop Audio
            `;
            btn.classList.add('playing');
        } else {
            btn.innerHTML = `
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
                    <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path>
                </svg>
                Listen
            `;
            btn.classList.remove('playing');
        }
    }
};

// Ensure voices are loaded (Chrome sometimes needs this)
if (window.speechSynthesis) {
    window.speechSynthesis.onvoiceschanged = () => audioGuide.synth.getVoices();
}

// --- MAP INITIALIZATION ---
const map = L.map('map', {
    center: [12.6140, 80.1935],
    zoom: 15,
    minZoom: 14,
    maxZoom: 18,
    zoomControl: false,
    attributionControl: true,
    scrollWheelZoom: 'center'
});

L.control.zoom({ position: 'bottomright' }).addTo(map);

L.tileLayer('https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; OpenStreetMap &copy; CARTO',
    subdomains: 'abcd',
    maxZoom: 20
}).addTo(map);

// --- APP LOGIC ---

/**
 * Handles the entrance animation sequence.
 */
const initEntrance = () => {
    if (!elements.mainTitle) return;

    const text = elements.mainTitle.innerText;
    elements.mainTitle.innerHTML = '';

    text.split('').forEach((char, index) => {
        const span = document.createElement('span');
        span.textContent = char;
        span.className = 'letter-span';
        span.style.transitionDelay = `${1.0 + (index * 0.03)}s`;
        elements.mainTitle.appendChild(span);
    });

    setTimeout(() => {
        if (elements.curtain) {
            elements.curtain.classList.add('hidden');
            setTimeout(() => {
                elements.curtain.style.display = 'none';
            }, 1000);
        }

        requestAnimationFrame(() => {
            const letters = document.querySelectorAll('.letter-span');
            letters.forEach(l => {
                l.style.opacity = '1';
                l.style.transform = 'translateY(0) rotate(0deg)';
            });
        });
    }, 800);
};

window.addEventListener('load', initEntrance);

/**
 * 3D Tilt Effect for Desktop
 */
const initTiltEffect = () => {
    if (!window.matchMedia("(min-width: 768px)").matches) return;

    const updateTilt = () => {
        state.tilt.currentX = lerp(state.tilt.currentX, state.tilt.targetX, 0.1);
        state.tilt.currentY = lerp(state.tilt.currentY, state.tilt.targetY, 0.1);

        if (elements.brandCard) {
            elements.brandCard.style.transform = `perspective(1000px) rotateX(${-state.tilt.currentY * 8}deg) rotateY(${state.tilt.currentX * 8}deg)`;
        }

        if (elements.panel && elements.panel.classList.contains('active')) {
             elements.panel.style.transform = `perspective(1000px) rotateX(${-state.tilt.currentY * 5}deg) rotateY(${state.tilt.currentX * 5}deg)`;
        }

        if (Math.abs(state.tilt.targetX - state.tilt.currentX) > 0.001 || Math.abs(state.tilt.targetY - state.tilt.currentY) > 0.001) {
            state.tilt.rafId = requestAnimationFrame(updateTilt);
        } else {
            state.tilt.rafId = null;
        }
    };

    document.addEventListener('mousemove', (e) => {
        const { clientX, clientY, innerWidth, innerHeight } = e;
        state.tilt.targetX = (clientX / innerWidth) * 2 - 1;
        state.tilt.targetY = (clientY / innerHeight) * 2 - 1;

        if (!state.tilt.rafId) {
            state.tilt.rafId = requestAnimationFrame(updateTilt);
        }
    });

    document.addEventListener('mouseleave', () => {
        state.tilt.targetX = 0;
        state.tilt.targetY = 0;
        if (!state.tilt.rafId) state.tilt.rafId = requestAnimationFrame(updateTilt);
    });

    // Magnetic Buttons
    const magneticBtns = document.querySelectorAll('.close-btn');
    magneticBtns.forEach(btn => {
        btn.addEventListener('mousemove', (e) => {
            const rect = btn.getBoundingClientRect();
            const x = e.clientX - rect.left - rect.width / 2;
            const y = e.clientY - rect.top - rect.height / 2;
            btn.style.transform = `translate(${x * 0.3}px, ${y * 0.3}px)`;
        });

        btn.addEventListener('mouseleave', () => {
            btn.style.transform = 'translate(0, 0)';
        });
    });
};

initTiltEffect();

/**
 * Staggered Text Creation
 */
function createStaggeredText(text, baseDelay = 0) {
    const fragment = document.createDocumentFragment();
    const words = text.split(' ');

    words.forEach((word, i) => {
        const span = document.createElement('span');
        span.textContent = word;
        span.style.marginRight = '0.25em';
        span.style.opacity = '0';
        span.style.display = 'inline-block';
        span.style.transform = 'translateY(8px)';
        span.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
        span.style.transitionDelay = `${baseDelay + (i * 0.01)}s`;
        fragment.appendChild(span);
    });

    return fragment;
}

/**
 * Panel Logic
 */
function hidePanel() {
    if (!elements.panel.classList.contains('active')) return;

    if (state.focusTimeout) {
        clearTimeout(state.focusTimeout);
        state.focusTimeout = null;
    }

    // Stop audio when panel closes
    audioGuide.stop();

    const prevActive = state.activeMarkerName;
    elements.panel.classList.remove('active');
    elements.panel.setAttribute('aria-hidden', 'true');
    state.activeMarkerName = null;

    // Clear transforms
    elements.panel.style.transform = '';

    Object.values(state.markers).forEach(m => {
        const el = m.getElement();
        if(el) {
            el.classList.remove('active-marker');
            const wrapper = el.querySelector('.marker-wrapper');
            if (wrapper) wrapper.setAttribute('aria-expanded', 'false');
        }
    });

    if (prevActive && state.markers[prevActive]) {
        const marker = state.markers[prevActive];
        const bounds = map.getBounds();
        if (bounds.contains(marker.getLatLng())) {
            const el = marker.getElement();
            const wrapper = el ? el.querySelector('.marker-wrapper') : null;
            if (wrapper) wrapper.focus();
        }
    }
}

function showPanel(data, shouldFocus) {
    elements.panelTitle.innerText = data.name;
    elements.panelBody.innerHTML = '';

    // Image
    if (data.image) {
        const imgContainer = document.createElement('div');
        imgContainer.className = 'info-image-container';
        imgContainer.style.opacity = '0';
        imgContainer.style.transform = 'translateY(10px) scale(0.95)';
        imgContainer.style.transition = 'opacity 0.8s ease, transform 0.8s ease';

        const img = document.createElement('img');
        img.src = data.image;
        img.alt = data.name;
        img.className = 'info-image';

        imgContainer.appendChild(img);
        elements.panelBody.appendChild(imgContainer);
    }

    let delayCounter = 0;

    // Helper to add sections
    const addSection = (title, content, delayIndex, container = elements.panelBody) => {
        if (!content) return delayIndex;

        const sectionTitle = document.createElement('h3');
        sectionTitle.className = 'info-subtitle';
        sectionTitle.textContent = title;
        sectionTitle.style.opacity = '0';
        sectionTitle.style.transform = 'translateY(8px)';
        sectionTitle.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
        sectionTitle.style.transitionDelay = `${delayIndex * 0.1}s`;
        container.appendChild(sectionTitle);

        const p = document.createElement('div');
        p.className = 'info-text';
        p.appendChild(createStaggeredText(content, delayIndex * 0.1));
        container.appendChild(p);

        return delayIndex + 2;
    };

    // Visit Info
    if (data.visitInfo) {
        const visitContainer = document.createElement('div');
        visitContainer.className = 'visit-info-container';
        visitContainer.style.opacity = '0';
        visitContainer.style.transform = 'translateY(10px)';
        visitContainer.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
        visitContainer.style.transitionDelay = `${delayCounter * 0.1}s`;

        if (data.visitInfo.hours) {
            const row = document.createElement('div');
            row.className = 'visit-info-item';
            row.innerHTML = `<span class="visit-info-label">Open:</span> <span>${escapeHtml(data.visitInfo.hours)}</span>`;
            visitContainer.appendChild(row);
        }
        if (data.visitInfo.fee) {
            const row = document.createElement('div');
            row.className = 'visit-info-item';
            row.innerHTML = `<span class="visit-info-label">Entry:</span> <span>${escapeHtml(data.visitInfo.fee)}</span>`;
            visitContainer.appendChild(row);
        }

        elements.panelBody.appendChild(visitContainer);
        delayCounter += 2;
    }

    // Actions Container (Directions + Audio Guide)
    const actionContainer = document.createElement('div');
    actionContainer.className = 'action-btn-container';
    actionContainer.style.opacity = '0';
    actionContainer.style.transform = 'translateY(10px)';
    actionContainer.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
    actionContainer.style.transitionDelay = `${delayCounter * 0.1}s`;

    // Directions Button
    if (data.googleMapsUrl) {
        const dirBtn = document.createElement('a');
        dirBtn.href = data.googleMapsUrl;
        dirBtn.target = '_blank';
        dirBtn.rel = 'noopener noreferrer';
        dirBtn.className = 'action-btn';
        dirBtn.textContent = 'Get Directions';
        actionContainer.appendChild(dirBtn);
    }

    // Audio Guide Button
    if (window.speechSynthesis) {
        const audioBtn = document.createElement('button');
        audioBtn.id = 'audio-guide-btn';
        audioBtn.className = 'action-btn audio-btn';
        audioBtn.setAttribute('aria-label', 'Listen to summary');

        // Initial state
        audioBtn.innerHTML = `
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
                <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path>
            </svg>
            Listen
        `;

        const audioText = `${data.name}. ${data.summary} ${state.tour.active ? data.history : ''}`;

        audioBtn.addEventListener('click', () => {
            triggerHaptic(20);
            audioGuide.toggle(audioText);
        });

        actionContainer.appendChild(audioBtn);
    }

    if (actionContainer.hasChildNodes()) {
        elements.panelBody.appendChild(actionContainer);
        delayCounter += 1;
    }

    // Summary
    const summaryP = document.createElement('div');
    summaryP.className = 'info-summary';
    summaryP.appendChild(createStaggeredText(data.summary || data.text, 0));
    elements.panelBody.appendChild(summaryP);
    delayCounter += 3;

    // --- PROGRESSIVE DISCLOSURE SETUP ---
    let detailsContainer = elements.panelBody;
    if (state.tour.active) {
        const wrapper = document.createElement('div');
        wrapper.className = 'tour-hidden';
        elements.panelBody.appendChild(wrapper);
        detailsContainer = wrapper;
    }

    // Sections
    delayCounter = addSection('History', data.history, delayCounter, detailsContainer);
    delayCounter = addSection('Architecture & Details', data.details, delayCounter, detailsContainer);
    if (data.tips) delayCounter = addSection('Visitor Tips', data.tips, delayCounter, detailsContainer);

    // Facts
    if (data.facts && data.facts.length > 0) {
        const factTitle = document.createElement('h3');
        factTitle.className = 'info-subtitle';
        factTitle.textContent = 'Did You Know?';
        factTitle.style.opacity = '0';
        factTitle.style.transform = 'translateY(8px)';
        factTitle.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
        factTitle.style.transitionDelay = `${delayCounter * 0.1}s`;
        detailsContainer.appendChild(factTitle);

        const ul = document.createElement('ul');
        ul.className = 'info-list';
        data.facts.forEach((fact, i) => {
            const li = document.createElement('li');
            li.textContent = fact;
            li.style.opacity = '0';
            li.style.transform = 'translateY(8px)';
            li.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
            li.style.transitionDelay = `${(delayCounter * 0.1) + (i * 0.1)}s`;
            ul.appendChild(li);
        });
        detailsContainer.appendChild(ul);
    }

    // Add Read More Button for Tour
    if (state.tour.active) {
        const btn = document.createElement('button');
        btn.className = 'read-more-btn';
        btn.textContent = 'Dive Deeper';
        btn.onclick = () => {
            detailsContainer.classList.remove('tour-hidden');
            detailsContainer.style.display = 'block';

            // Animate children in
            Array.from(detailsContainer.children).forEach((child, i) => {
                child.style.opacity = '0';
                child.style.transform = 'translateY(10px)';
                child.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
                child.style.transitionDelay = `${i * 0.05}s`;
            });

            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    Array.from(detailsContainer.children).forEach(child => {
                        child.style.opacity = '1';
                        child.style.transform = 'translateY(0)';
                    });
                });
            });

            btn.remove();

            // Focus on first header inside for a11y
            const firstHeader = detailsContainer.querySelector('h3');
            if(firstHeader) firstHeader.setAttribute('tabindex', '-1');
            if(firstHeader) firstHeader.focus();
        };
        elements.panelBody.appendChild(btn);
    }

    // Animate
    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            const spans = elements.panelBody.querySelectorAll('span, .info-subtitle, li');
            spans.forEach(s => {
                s.style.opacity = '1';
                s.style.transform = 'translateY(0)';
            });

            const extras = elements.panelBody.querySelectorAll('.visit-info-container, .action-btn-container');
            extras.forEach(el => {
                el.style.opacity = '1';
                el.style.transform = 'translateY(0)';
            });

            const imgContainer = elements.panelBody.querySelector('.info-image-container');
            if (imgContainer) {
                imgContainer.style.opacity = '1';
                imgContainer.style.transform = 'translateY(0) scale(1)';
            }
        });
    });

    elements.panel.classList.add('active');
    elements.panel.setAttribute('aria-hidden', 'false');

    if (state.markers[data.name]) {
        const el = state.markers[data.name].getElement();
        const wrapper = el ? el.querySelector('.marker-wrapper') : null;
        if(wrapper) wrapper.setAttribute('aria-expanded', 'true');
    }

    state.activeMarkerName = data.name;

    if (state.focusTimeout) clearTimeout(state.focusTimeout);

    if (shouldFocus) {
        state.focusTimeout = setTimeout(() => {
            if (elements.panel.classList.contains('active')) {
                elements.closeBtn.focus();
            }
        }, 650);
    }
}

// --- INITIALIZE MARKERS ---
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
    state.markers[loc.name] = marker;

    const activate = (e) => {
        triggerHaptic([30, 50, 30]); // Distinct pattern for marker activation
        const isKeyboard = e.type === 'keydown' || (e.originalEvent && e.originalEvent.type === 'keydown');

        Object.values(state.markers).forEach(m => {
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
        const targetZoom = 17;
        const targetPoint = map.project(loc.coords, targetZoom);
        const offset = isMobile ? L.point(0, 250) : L.point(0, 0);
        const targetCenter = map.unproject(targetPoint.add(offset), targetZoom);

        map.flyTo(targetCenter, targetZoom, {
            animate: true,
            duration: 1.5,
            easeLinearity: 0.1
        });

        showPanel(loc, isKeyboard);

        const event = e.originalEvent || e;
        if(event && event.stopPropagation) event.stopPropagation();
    };

    marker.on('click', activate);

    marker.on('add', () => {
        const el = marker.getElement();
        if (state.activeMarkerName === loc.name && el) {
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

// --- MOBILE SWIPE LOGIC ---
elements.panel.addEventListener('touchstart', (e) => {
    // Only allow if at top
    if (elements.panel.scrollTop > 0) return;
    state.swipe.startY = e.touches[0].clientY;
    state.swipe.isDragging = true;
    elements.panel.style.transition = 'none'; // Direct tracking
}, { passive: true });

elements.panel.addEventListener('touchmove', (e) => {
    if (!state.swipe.isDragging) return;

    state.swipe.currentY = e.touches[0].clientY;
    const diff = state.swipe.currentY - state.swipe.startY;

    if (diff > 0) {
        if (e.cancelable) e.preventDefault();
        // Resistive drag
        elements.panel.style.transform = `translateY(${diff}px)`;
    }
}, { passive: false });

elements.panel.addEventListener('touchend', () => {
    if (!state.swipe.isDragging) return;
    state.swipe.isDragging = false;
    elements.panel.style.transition = ''; // Restore CSS transition

    const diff = state.swipe.currentY - state.swipe.startY;

    // Threshold to close: 80px
    if (diff > 80) {
        triggerHaptic(50); // Haptic feedback on close
        hidePanel();
    } else {
        // Snap back
        elements.panel.style.transform = '';
    }

    state.swipe.startY = 0;
    state.swipe.currentY = 0;
});


// --- GLOBAL EVENTS ---
elements.closeBtn.addEventListener('click', hidePanel);

map.on('click', (e) => {
    hidePanel();

    // Ripple effect
    const ripple = document.createElement('div');
    ripple.className = 'click-ripple';
    ripple.style.left = `${e.containerPoint.x - 20}px`;
    ripple.style.top = `${e.containerPoint.y - 20}px`;

    document.getElementById('map').appendChild(ripple);

    setTimeout(() => {
        ripple.remove();
    }, 1000);
});

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') hidePanel();
});

/**
 * TOUR MANAGER
 */
class TourManager {
    constructor() {
        this.updateUI();
    }

    start() {
        state.tour.active = true;
        state.tour.currentStep = 0;
        this.updateUI();
        this.goToStep(0);
    }

    end() {
        state.tour.active = false;
        this.updateUI();
        hidePanel();

        // Reset map view
        map.flyTo([12.6140, 80.1935], 15, { duration: 1.5 });
    }

    next() {
        if (state.tour.currentStep < locations.length - 1) {
            this.goToStep(state.tour.currentStep + 1);
        } else {
            this.end();
        }
    }

    prev() {
        if (state.tour.currentStep > 0) {
            this.goToStep(state.tour.currentStep - 1);
        }
    }

    goToStep(index) {
        state.tour.currentStep = index;
        const loc = locations[index];

        // Update Progress
        if (elements.tourProgress) {
            elements.tourProgress.textContent = `${index + 1} / ${locations.length}`;
        }

        // Handle Buttons
        if (elements.prevTourBtn) {
            elements.prevTourBtn.disabled = index === 0;
            elements.prevTourBtn.style.opacity = index === 0 ? '0.3' : '1';
        }

        if (elements.nextTourBtn) {
             if (index === locations.length - 1) {
                elements.nextTourBtn.setAttribute('aria-label', 'Finish Tour');
            } else {
                elements.nextTourBtn.setAttribute('aria-label', 'Next Stop');
            }
        }

        // Fly and Activate
        const marker = state.markers[loc.name];
        if (marker) {
            triggerHaptic(30); // Gentle feedback on tour navigation
            marker.fire('click');

            // Auto-play audio if in tour mode
            setTimeout(() => {
                if (state.tour.active && window.speechSynthesis) {
                    const audioText = `${loc.name}. ${loc.summary} ${loc.history}`;
                    audioGuide.play(audioText);
                }
            }, 1500); // Wait for flyTo and panel open
        }
    }

    updateUI() {
        if (state.tour.active) {
            if (elements.brandCard) elements.brandCard.classList.add('hidden');
            if (elements.tourControls) {
                elements.tourControls.classList.remove('hidden');
                elements.tourControls.setAttribute('aria-hidden', 'false');
            }
        } else {
            if (elements.brandCard) elements.brandCard.classList.remove('hidden');
            if (elements.tourControls) {
                elements.tourControls.classList.add('hidden');
                elements.tourControls.setAttribute('aria-hidden', 'true');
            }
        }
    }
}

const tourManager = new TourManager();

// --- TOUR EVENTS ---
if (elements.startTourBtn) {
    elements.startTourBtn.addEventListener('click', () => tourManager.start());
}

if (elements.prevTourBtn) {
    elements.prevTourBtn.addEventListener('click', () => tourManager.prev());
}

if (elements.nextTourBtn) {
    elements.nextTourBtn.addEventListener('click', () => tourManager.next());
}

if (elements.endTourBtn) {
    elements.endTourBtn.addEventListener('click', () => tourManager.end());
}

document.addEventListener('keydown', (e) => {
    if (!state.tour.active) return;

    if (e.key === 'ArrowRight') {
        tourManager.next();
    } else if (e.key === 'ArrowLeft') {
        tourManager.prev();
    }
});
