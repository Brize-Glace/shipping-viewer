// Variables defined in config.js: API_KEY, TRACKING_NUMBER

document.addEventListener('DOMContentLoaded', () => {
    fetchTracking();
});

async function fetchTracking() {
    try {
        const response = await fetch('https://api.ship24.com/public/v1/trackers/track', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': API_KEY
            },
            body: JSON.stringify({ trackingNumber: TRACKING_NUMBER })
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        console.log('Données reçues:', data);
        renderTracking(data);
    } catch (error) {
        console.error('Erreur lors de la récupération du suivi:', error);

        const statusElement = document.getElementById('main-status');
        if (statusElement) {
            statusElement.textContent = 'Erreur API';
            statusElement.style.backgroundColor = '#fee2e2';
            statusElement.style.color = '#991b1b';
        }
    }
}

function renderTracking(data) {
    if (!data.data || !data.data.trackings || data.data.trackings.length === 0) {
        console.warn('Aucune donnée de tracking trouvée');
        return;
    }

    const trackingInfo = data.data.trackings[0];
    const shipment = trackingInfo.shipment;
    const events = trackingInfo.events;

    // Header Info
    const trackingNumElement = document.getElementById('tracking-number');
    if (trackingNumElement) {
        trackingNumElement.textContent = trackingInfo.tracker.trackingNumber;
    }

    // Route Info - Flags
    const origin = shipment.originCountryCode || 'XX';
    const destination = shipment.destinationCountryCode || 'XX';

    // Fallback SVG for unknown country codes (e.g. XX)
    const flagFallback = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80"><rect width="80" height="80" rx="8" fill="%23e2e8f0"/><text x="50%" y="54%" dominant-baseline="middle" text-anchor="middle" font-family="Inter,sans-serif" font-size="28" fill="%2394a3b8">🌐</text></svg>')}`;

    const originElement = document.getElementById('origin');
    if (originElement) {
        originElement.innerHTML = `
            <img src="https://flagcdn.com/w80/${origin.toLowerCase()}.png" alt="${origin}" class="country-flag" onerror="this.onerror=null;this.src='${flagFallback}'">
            <span class="country-code">${origin}</span>
        `;
    }

    const destElement = document.getElementById('destination');
    if (destElement) {
        destElement.innerHTML = `
            <img src="https://flagcdn.com/w80/${destination.toLowerCase()}.png" alt="${destination}" class="country-flag" onerror="this.onerror=null;this.src='${flagFallback}'">
            <span class="country-code">${destination}</span>
        `;
    }

    const statusElement = document.getElementById('main-status');
    const milestone = shipment.statusMilestone;

    if (statusElement) {
        statusElement.textContent = formatMilestone(milestone);
        statusElement.style = '';
        statusElement.className = 'status-badge';

        if (milestone === 'delivered') {
            statusElement.style.backgroundColor = '#dcfce7';
            statusElement.style.color = '#15803d';
        } else if (milestone === 'out_for_delivery') {
            statusElement.style.backgroundColor = '#dbeafe';
            statusElement.style.color = '#1e40af';
        } else if (milestone === 'failed_attempt') {
            statusElement.style.backgroundColor = '#fef3c7';
            statusElement.style.color = '#b45309';
        }
    }

    // ETA Display
    const deliveryEstimateElement = document.getElementById('delivery-estimate');
    if (deliveryEstimateElement) {
        if (milestone === 'delivered') {
            deliveryEstimateElement.innerHTML = `<i class="fa-solid fa-circle-check"></i> Delivered`;
            deliveryEstimateElement.classList.add('eta-delivered');
        } else {
            const delivery = shipment.delivery || {};
            const courierEta = delivery.courierEstimatedDeliveryDate;
            const etaRaw = (courierEta && courierEta.from) || delivery.estimatedDeliveryDate || null;

            if (etaRaw) {
                const etaDate = new Date(etaRaw);
                const now = new Date();

                const etaFormatted = new Intl.DateTimeFormat('fr-FR', {
                    weekday: 'long',
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric'
                }).format(etaDate);

                // Calculate remaining time
                const diffMs = etaDate - now;
                let etaLabel = '';

                if (diffMs <= 0) {
                    etaLabel = `<span class="eta-overdue"><i class="fa-solid fa-triangle-exclamation"></i> Delivery expected: overdue</span>`;
                } else {
                    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

                    if (diffDays === 0) {
                        etaLabel = `<i class="fa-solid fa-clock"></i> Estimated arrival <strong>today</strong>`;
                    } else if (diffDays === 1) {
                        etaLabel = `<i class="fa-solid fa-clock"></i> Estimated arrival in <strong>1 day</strong>`;
                    } else {
                        etaLabel = `<i class="fa-solid fa-clock"></i> Estimated arrival in <strong>${diffDays} days</strong>`;
                    }
                }

                deliveryEstimateElement.innerHTML = `
                    <span class="eta-date"><i class="fa-regular fa-calendar"></i> ${etaFormatted}</span>
                    <span class="eta-countdown">${etaLabel}</span>
                `;
            } else {
                deliveryEstimateElement.innerHTML = `<i class="fa-solid fa-clock"></i> ETA not available`;
                deliveryEstimateElement.classList.add('eta-unavailable');
            }
        }
    }

    const transitTimeElement = document.getElementById('transit-time');
    if (transitTimeElement && events.length > 0) {
        const sortedEvents = [...events].sort((a, b) => new Date(a.datetime) - new Date(b.datetime));

        const firstEventDate = new Date(sortedEvents[0].datetime);
        let lastEventDate = new Date();

        if (milestone === 'delivered') {
            const deliveredEvent = sortedEvents.find(e => e.statusMilestone === 'delivered') || sortedEvents[sortedEvents.length - 1];
            lastEventDate = new Date(deliveredEvent.datetime);
        }

        const diffTime = Math.abs(lastEventDate - firstEventDate);
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
        const diffHours = Math.floor((diffTime % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

        transitTimeElement.innerHTML = `Time in transit: <strong>${diffDays} days ${diffHours} hours</strong>`;
    }

    const timelineList = document.getElementById('timeline-list');
    if (timelineList) {
        timelineList.innerHTML = '';

        events.forEach((event, index) => {
            const item = document.createElement('li');
            item.className = 'timeline-item';
            if (index === 0) item.classList.add('active');

            const date = new Date(event.datetime);
            const dateStr = new Intl.DateTimeFormat('fr-FR', {
                day: 'numeric', month: 'short', year: 'numeric',
                hour: '2-digit', minute: '2-digit'
            }).format(date);

            let statusClass = 'status-transit';
            if (event.statusMilestone === 'delivered') statusClass = 'status-delivered';
            if (event.statusMilestone === 'failed_attempt') statusClass = 'status-attemptfail';

            item.innerHTML = `
                 <div class="timeline-marker ${statusClass}"></div>
                 <div class="timeline-date">${dateStr}</div>
                 <div class="timeline-status">${event.status}</div>
                 ${event.location ? `<div class="timeline-location"><i class="fa-solid fa-location-dot location-icon"></i> ${event.location}</div>` : ''}
            `;

            timelineList.appendChild(item);
        });
    }
}

function formatMilestone(snakeCase) {
    if (!snakeCase) return 'En Transit';
    return snakeCase.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
}