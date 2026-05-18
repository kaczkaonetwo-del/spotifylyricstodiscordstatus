// Client state variables
let currentTrackTitle = '';
let currentTrackArtist = '';
let lyricsList = [];
let activeLineIndex = -1;
let trackPosition = 0;
let trackDuration = 0;
let isPlaying = false;
let isSpotifyActive = false;
let offsetSeconds = 0;

// SSE Event Stream Connection
let eventSource = null;

// Page elements
const trackTitleEl = document.getElementById('track-title');
const trackArtistEl = document.getElementById('track-artist');
const progressBarEl = document.getElementById('progress-bar');
const timeCurrentEl = document.getElementById('time-current');
const timeTotalEl = document.getElementById('time-total');
const systemStatusEl = document.getElementById('system-status');
const musicWaveEl = document.getElementById('music-wave');
const lyricsScrollerEl = document.getElementById('lyrics-scroller');
const lyricsViewportEl = document.getElementById('lyrics-viewport');
const discordBadgeEl = document.getElementById('discord-badge');
const discordErrorBoxEl = document.getElementById('discord-error-box');
const discordErrorMsgEl = document.getElementById('discord-error-msg');
const toastEl = document.getElementById('toast');

// Initialize Dashboard
document.addEventListener('DOMContentLoaded', () => {
    // 1. Fetch initial configuration settings
    fetch('/api/config')
        .then(res => res.json())
        .then(config => {
            document.getElementById('discord-token').value = config.discordToken || '';
            document.getElementById('emoji-name').value = config.emojiName || '🎵';
            document.getElementById('prefix').value = config.prefix || '';
            document.getElementById('suffix').value = config.suffix || '';
            document.getElementById('offset-seconds').value = config.offsetSeconds || 0;
            document.getElementById('offset-val').innerText = `${config.offsetSeconds || 0}s`;
            document.getElementById('sync-enabled').checked = config.syncEnabled !== false;
            
            offsetSeconds = parseFloat(config.offsetSeconds || 0);
        })
        .catch(err => console.error('Failed to load config:', err));

    // 2. Connect to Server-Sent Events (SSE) for real-time pushing
    connectEventSource();

    // 3. Keep updating the progress bar and active lyric locally at 10Hz
    setInterval(updatePlaybackTick, 100);

    // 4. Hook range slider event
    document.getElementById('offset-seconds').addEventListener('input', (e) => {
        const val = parseFloat(e.target.value);
        document.getElementById('offset-val').innerText = `${val > 0 ? '+' : ''}${val}s`;
        offsetSeconds = val;
    });
});

// SSE Event Source Listener
function connectEventSource() {
    if (eventSource) eventSource.close();
    
    eventSource = new EventSource('/api/events');
    
    eventSource.onopen = () => {
        console.log('SSE Stream connected.');
    };

    eventSource.onmessage = (event) => {
        try {
            const state = JSON.parse(event.data);
            
            isSpotifyActive = state.spotifyActive;
            isPlaying = state.isPlaying;
            trackPosition = state.position;
            trackDuration = state.duration;

            // System Connection Status
            if (isSpotifyActive) {
                systemStatusEl.innerHTML = `<span class="status-dot green"></span><span class="status-text">Spotify: Aktywny</span>`;
                systemStatusEl.className = 'system-status-pill active';
            } else {
                systemStatusEl.innerHTML = `<span class="status-dot red"></span><span class="status-text">Spotify: Wyłączony</span>`;
                systemStatusEl.className = 'system-status-pill';
            }

            // Wave Visualizer Active State
            if (isPlaying && isSpotifyActive) {
                musicWaveEl.classList.add('active');
            } else {
                musicWaveEl.classList.remove('active');
            }

            // Track info change detection
            if (state.title !== currentTrackTitle || state.artist !== currentTrackArtist) {
                currentTrackTitle = state.title || '';
                currentTrackArtist = state.artist || '';
                lyricsList = state.lyrics || [];
                activeLineIndex = -1;
                
                updateTrackMetadata();
                renderLyrics();
            } else if (JSON.stringify(state.lyrics) !== JSON.stringify(lyricsList)) {
                // If lyrics loaded late
                lyricsList = state.lyrics || [];
                activeLineIndex = -1;
                renderLyrics();
            }

            // Discord connection state badge
            updateDiscordBadge(state.discordStatus, state.discordErrorMsg);

        } catch (e) {
            console.error('Failed to parse SSE payload:', e);
        }
    };

    eventSource.onerror = (err) => {
        console.error('SSE Stream error, retrying in 5 seconds...', err);
        eventSource.close();
        setTimeout(connectEventSource, 5000);
    };
}

// Update track meta labels
function updateTrackMetadata() {
    if (isSpotifyActive && currentTrackTitle) {
        trackTitleEl.innerText = currentTrackTitle;
        trackArtistEl.innerText = currentTrackArtist;
        timeTotalEl.innerText = formatTime(trackDuration);
    } else {
        trackTitleEl.innerText = 'Brak odtwarzanego utworu';
        trackArtistEl.innerText = 'Uruchom Spotify na swoim Windowsie';
        timeCurrentEl.innerText = '0:00';
        timeTotalEl.innerText = '0:00';
        progressBarEl.style.width = '0%';
    }
}

// Discord Badge status transitions
function updateDiscordBadge(status, errorMsg) {
    discordBadgeEl.className = 'status-badge';
    
    if (status === 'Connected') {
        discordBadgeEl.innerText = 'Połączono';
        discordBadgeEl.classList.add('state-connected');
        discordErrorBoxEl.style.display = 'none';
    } else if (status === 'Connecting') {
        discordBadgeEl.innerText = 'Łączenie...';
        discordBadgeEl.classList.add('state-connecting');
        discordErrorBoxEl.style.display = 'none';
    } else if (status === 'Error') {
        discordBadgeEl.innerText = 'Błąd';
        discordBadgeEl.classList.add('state-error');
        discordErrorBoxEl.style.display = 'block';
        discordErrorMsgEl.innerText = errorMsg || 'Nieznany błąd autoryzacji';
    } else {
        discordBadgeEl.innerText = 'Rozłączono';
        discordBadgeEl.classList.add('state-disconnected');
        discordErrorBoxEl.style.display = 'none';
    }
}

// Render lyrics to container viewport
function renderLyrics() {
    lyricsScrollerEl.innerHTML = '';
    
    if (!isSpotifyActive || !currentTrackTitle) {
        lyricsScrollerEl.innerHTML = `
            <div class="lyrics-placeholder">
                <p class="emoji">🎶</p>
                <p>Teksty piosenek pojawią się automatycznie, gdy włączysz muzykę w Spotify.</p>
            </div>
        `;
        return;
    }

    if (lyricsList.length === 0) {
        lyricsScrollerEl.innerHTML = `
            <div class="lyrics-placeholder">
                <p class="emoji">🔍</p>
                <p>Nie znaleziono tekstu dla tej piosenki w bazie LRCLIB.</p>
                <p style="font-size: 11px; margin-top: 5px; color: var(--text-muted);">Ustawimy Twój status na: "${currentTrackArtist} - ${currentTrackTitle}"</p>
            </div>
        `;
        return;
    }

    lyricsList.forEach((line, idx) => {
        const lineEl = document.createElement('div');
        lineEl.className = 'lyric-line';
        lineEl.id = `lyric-line-${idx}`;
        lineEl.innerText = line.text;
        
        // Allow clicking a line to jump in dashboard preview (fun feature!)
        lineEl.addEventListener('click', () => {
            console.log(`Debug Jump to line timestamp: ${line.time}s`);
        });

        lyricsScrollerEl.appendChild(lineEl);
    });
}

// Save Settings Form
function saveSettings() {
    const btnSave = document.getElementById('btn-save');
    btnSave.innerText = 'Zapisywanie...';
    btnSave.disabled = true;

    const payload = {
        discordToken: document.getElementById('discord-token').value.trim(),
        emojiName: document.getElementById('emoji-name').value.trim(),
        prefix: document.getElementById('prefix').value,
        suffix: document.getElementById('suffix').value,
        offsetSeconds: parseFloat(document.getElementById('offset-seconds').value),
        syncEnabled: document.getElementById('sync-enabled').checked
    };

    fetch('/api/settings', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
    })
    .then(res => res.json())
    .then(data => {
        if (data.success) {
            showToast('Zapisano ustawienia!');
        } else {
            showToast('Błąd podczas zapisywania.');
        }
    })
    .catch(err => {
        console.error('Failed to save settings:', err);
        showToast('Błąd sieci.');
    })
    .finally(() => {
        btnSave.innerText = 'Zapisz ustawienia';
        btnSave.disabled = false;
    });
}

// 10Hz Local Tick for animations, smooth timeline scrolling
function updatePlaybackTick() {
    if (!isSpotifyActive || !isPlaying || !currentTrackTitle) return;

    // Extrapolate position locally by 100ms
    trackPosition += 0.1;
    if (trackPosition > trackDuration) trackPosition = trackDuration;

    // Update Progress Bar
    const percent = (trackPosition / trackDuration) * 100;
    progressBarEl.style.width = `${percent}%`;
    timeCurrentEl.innerText = formatTime(trackPosition);

    // Sync active lyric line
    const adjustedPos = trackPosition + offsetSeconds;
    
    if (lyricsList.length > 0) {
        let activeIdx = -1;
        for (let i = 0; i < lyricsList.length; i++) {
            if (adjustedPos >= lyricsList[i].time) {
                activeIdx = i;
            } else {
                break;
            }
        }

        if (activeIdx !== activeLineIndex) {
            // Remove active status from last active element
            if (activeLineIndex >= 0) {
                const prevEl = document.getElementById(`lyric-line-${activeLineIndex}`);
                if (prevEl) prevEl.classList.remove('active');
            }

            activeLineIndex = activeIdx;

            // Set new active element
            if (activeLineIndex >= 0) {
                const currEl = document.getElementById(`lyric-line-${activeLineIndex}`);
                if (currEl) {
                    currEl.classList.add('active');
                    scrollLyricIntoView(currEl);
                }
            }
        }
    }
}

// Scroll active lyric to vertical center of lyrics card
function scrollLyricIntoView(element) {
    const viewportHeight = lyricsViewportEl.clientHeight;
    const elementTop = element.offsetTop;
    const elementHeight = element.clientHeight;
    
    // We want the element to sit exactly at 35% height from top of container for premium layout
    const targetScroll = elementTop - (viewportHeight * 0.35) + (elementHeight / 2);
    
    lyricsViewportEl.scrollTo({
        top: targetScroll,
        behavior: 'smooth'
    });
}

// Collapsible helper accordion
function toggleTokenGuide() {
    const guide = document.getElementById('token-guide');
    guide.classList.toggle('collapsed');
}

// Show/Hide token password toggler
function togglePasswordVisibility() {
    const tokenInput = document.getElementById('discord-token');
    const toggleBtn = document.querySelector('.btn-toggle-pass');
    
    if (tokenInput.type === 'password') {
        tokenInput.type = 'text';
        toggleBtn.innerText = '🔒';
    } else {
        tokenInput.type = 'password';
        toggleBtn.innerText = '👁️';
    }
}

// Click to copy helper
function copyGuideCode(element) {
    const text = element.innerText;
    navigator.clipboard.writeText(text).then(() => {
        const hint = document.getElementById('copy-hint');
        hint.innerText = 'Skopiowano pomyślnie! 🚀';
        hint.style.color = '#1DB954';
        
        setTimeout(() => {
            hint.innerText = 'Kliknij kod, aby skopiować!';
            hint.style.color = 'var(--text-muted)';
        }, 3000);
    }).catch(err => {
        console.error('Failed to copy text:', err);
    });
}

// Toast notification trigger
function showToast(message) {
    toastEl.innerText = message;
    toastEl.classList.add('show');
    setTimeout(() => {
        toastEl.classList.remove('show');
    }, 3000);
}

// Time formater (seconds -> mm:ss)
function formatTime(secs) {
    if (isNaN(secs)) return '0:00';
    const minutes = Math.floor(secs / 60);
    const seconds = Math.floor(secs % 60);
    return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
}
