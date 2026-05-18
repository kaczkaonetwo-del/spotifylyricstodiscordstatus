const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const readline = require('readline');

const PORT = 3000;
const CONFIG_PATH = path.join(__dirname, 'config.json');

// Default Configuration
let config = {
  discordToken: '',
  emojiName: '🎵',
  prefix: '',
  suffix: '',
  offsetSeconds: 0,
  syncEnabled: true
};

// Load existing configuration
if (fs.existsSync(CONFIG_PATH)) {
  try {
    const saved = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
    config = { ...config, ...saved };
  } catch (err) {
    console.error('Failed to parse config.json, resetting to defaults.', err);
  }
}

// Save configuration helper
function saveConfig() {
  try {
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf8');
  } catch (err) {
    console.error('Failed to save config.json', err);
  }
}

// Current App State
let appState = {
  spotifyActive: false,
  title: '',
  artist: '',
  isPlaying: false,
  position: 0,
  duration: 0,
  lyrics: [],
  activeLineIndex: -1,
  discordStatus: 'Disconnected', // 'Connected', 'Error', 'Disconnected'
  discordErrorMsg: ''
};

// Keep track of active SSE connections
let sseClients = [];

// Helper to broadcast state to all dashboard clients
function broadcastState() {
  const data = JSON.stringify(appState);
  sseClients.forEach(client => {
    client.write(`data: ${data}\n\n`);
  });
}

// LRC Lyrics Parser
function parseLrc(lrcText) {
  if (!lrcText) return [];
  const lines = lrcText.split(/\r?\n/);
  const result = [];
  const regex = /\[(\d+):(\d+)(?:\.(\d+))?\](.*)/;
  
  for (const line of lines) {
    const match = line.match(regex);
    if (match) {
      const min = parseInt(match[1], 10);
      const sec = parseInt(match[2], 10);
      const msStr = match[3] || '0';
      const ms = parseInt(msStr.padEnd(3, '0').slice(0, 3), 10);
      const time = min * 60 + sec + ms / 1000;
      const text = match[4].trim();
      result.push({ time, text });
    }
  }
  
  // Sort lines chronologically just in case
  result.sort((a, b) => a.time - b.time);
  return result;
}

// Fetch Lyrics from LRCLIB
let lastFetchedKey = '';
async function fetchLyrics(title, artist, duration) {
  const key = `${title} - ${artist}`;
  if (key === lastFetchedKey) return;
  lastFetchedKey = key;

  appState.lyrics = [];
  appState.activeLineIndex = -1;
  
  if (!title || !artist) {
    broadcastState();
    return;
  }

  console.log(`Fetching lyrics for: ${artist} - ${title} (Duration: ${duration}s)`);
  
  try {
    const url = `https://lrclib.net/api/get?artist_name=${encodeURIComponent(artist)}&track_name=${encodeURIComponent(title)}&duration=${Math.round(duration)}`;
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Spotify-Discord-Lyrics-Status/1.0.0 (https://github.com/motog/spotify-discord-status)'
      }
    });

    if (response.ok) {
      const data = await response.json();
      if (data.syncedLyrics) {
        appState.lyrics = parseLrc(data.syncedLyrics);
        console.log(`Loaded ${appState.lyrics.length} synced lyric lines.`);
      } else if (data.plainLyrics) {
        // Fallback: Parse plain lyrics as a single static block or lines
        console.log('Synced lyrics not found, falling back to plain lyrics.');
        appState.lyrics = data.plainLyrics.split(/\r?\n/).map((line, idx) => ({
          time: idx * 8, // Estimate 8s per line for display
          text: line.trim()
        })).filter(item => item.text.length > 0);
      } else {
        console.log('No lyrics found for this song.');
      }
    } else {
      console.log(`LRCLIB returned status code: ${response.status}`);
      // Fallback search without duration
      const searchUrl = `https://lrclib.net/api/search?q=${encodeURIComponent(artist + ' ' + title)}`;
      const searchRes = await fetch(searchUrl, {
        headers: {
          'User-Agent': 'Spotify-Discord-Lyrics-Status/1.0.0 (https://github.com/motog/spotify-discord-status)'
        }
      });
      if (searchRes.ok) {
        const searchData = await searchRes.json();
        if (searchData.length > 0) {
          const matched = searchData[0];
          if (matched.syncedLyrics) {
            appState.lyrics = parseLrc(matched.syncedLyrics);
            console.log(`Loaded ${appState.lyrics.length} synced lyric lines from search.`);
          }
        }
      }
    }
  } catch (err) {
    console.error('Error fetching lyrics from LRCLIB:', err);
  }
  
  broadcastState();
}

// Discord Custom Status Updater
let lastDiscordStatusText = '';
let discordRequestTimeout = null;

async function updateDiscordStatus(text) {
  if (!config.syncEnabled || !config.discordToken) {
    appState.discordStatus = 'Disconnected';
    appState.discordErrorMsg = '';
    return;
  }

  // Formatting status
  const emoji = config.emojiName || null;
  const statusText = text ? `${config.prefix || ''}${text}${config.suffix || ''}`.substring(0, 128) : '';

  // Prevent redundant API requests if text hasn't changed
  if (statusText === lastDiscordStatusText && appState.discordStatus === 'Connected') {
    return;
  }

  // Throttle Discord API calls to prevent immediate rate limits
  if (discordRequestTimeout) clearTimeout(discordRequestTimeout);

  discordRequestTimeout = setTimeout(async () => {
    try {
      const payload = {
        custom_status: statusText ? {
          text: statusText,
          emoji_name: emoji,
          emoji_id: null
        } : null
      };

      const response = await fetch('https://discord.com/api/v9/users/@me/settings', {
        method: 'PATCH',
        headers: {
          'Authorization': config.discordToken,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        appState.discordStatus = 'Connected';
        appState.discordErrorMsg = '';
        lastDiscordStatusText = statusText;
        console.log(`Discord Status Updated: "${statusText}"`);
      } else {
        const errData = await response.json().catch(() => ({}));
        appState.discordStatus = 'Error';
        appState.discordErrorMsg = errData.message || `API Error: ${response.status}`;
        console.error(`Discord API Error (${response.status}):`, errData);
      }
    } catch (err) {
      appState.discordStatus = 'Error';
      appState.discordErrorMsg = err.message;
      console.error('Failed to communicate with Discord API:', err);
    }
    broadcastState();
  }, 100);
}

// Monitor Lyrics synchronization
function checkLyricsSync() {
  if (!appState.spotifyActive || !appState.isPlaying) {
    if (lastDiscordStatusText !== '') {
      updateDiscordStatus('');
    }
    return;
  }

  const adjustedPosition = appState.position + (config.offsetSeconds || 0);
  
  if (appState.lyrics.length > 0) {
    let activeIdx = -1;
    for (let i = 0; i < appState.lyrics.length; i++) {
      if (adjustedPosition >= appState.lyrics[i].time) {
        activeIdx = i;
      } else {
        break;
      }
    }

    if (activeIdx !== appState.activeLineIndex) {
      appState.activeLineIndex = activeIdx;
      const currentLineText = activeIdx >= 0 ? appState.lyrics[activeIdx].text : '';
      
      // Update Discord
      if (currentLineText) {
        updateDiscordStatus(currentLineText);
      } else {
        // Fallback to song title if index is -1
        updateDiscordStatus(`${appState.artist} - ${appState.title}`);
      }
      
      broadcastState();
    }
  } else {
    // If no lyrics, fall back to showing the song name
    if (appState.activeLineIndex !== -2) {
      appState.activeLineIndex = -2; // Marker for "no lyrics, showing song name"
      updateDiscordStatus(`${appState.artist} - ${appState.title}`);
      broadcastState();
    }
  }
}

// Spawn Spotify Windows Monitor
function startSpotifyMonitor() {
  const scriptPath = path.join(__dirname, 'monitor_spotify.ps1');
  console.log(`Spawning Spotify Monitor script at: ${scriptPath}`);
  
  const ps = spawn('powershell.exe', [
    '-NoProfile',
    '-ExecutionPolicy', 'Bypass',
    '-File', scriptPath
  ]);

  const rl = readline.createInterface({
    input: ps.stdout,
    terminal: false
  });

  rl.on('line', (line) => {
    try {
      const data = JSON.parse(line.trim());
      if (data.Status === 'active') {
        appState.spotifyActive = true;
        appState.title = data.Title || '';
        appState.artist = data.Artist || '';
        appState.isPlaying = data.IsPlaying || false;
        appState.position = data.Position || 0;
        appState.duration = data.Duration || 0;

        // Fetch lyrics on song change
        if (appState.title && appState.artist) {
          fetchLyrics(appState.title, appState.artist, appState.duration);
        }
      } else {
        // Spotify closed or inactive
        appState.spotifyActive = false;
        appState.isPlaying = false;
        appState.title = '';
        appState.artist = '';
        appState.position = 0;
        appState.duration = 0;
        appState.lyrics = [];
        appState.activeLineIndex = -1;
      }
      
      // Keep lyrics timeline in sync
      checkLyricsSync();
      broadcastState();
    } catch (e) {
      // Ignore parse errors from background garbage
    }
  });

  ps.stderr.on('data', (data) => {
    console.error(`PS Monitor Error: ${data.toString()}`);
  });

  ps.on('close', (code) => {
    console.log(`Spotify Monitor process exited with code ${code}. Restarting in 5s...`);
    appState.spotifyActive = false;
    broadcastState();
    setTimeout(startSpotifyMonitor, 5000);
  });
}

// Setup HTTP Server
const server = http.createServer((req, res) => {
  const parsedUrl = new URL(req.url, `http://${req.headers.host}`);
  const pathname = parsedUrl.pathname;

  // Serve Dashboard HTML
  if (pathname === '/' || pathname === '/index.html') {
    const filePath = path.join(__dirname, 'public', 'index.html');
    fs.readFile(filePath, (err, content) => {
      if (err) {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('Error loading dashboard page.');
      } else {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(content);
      }
    });
    return;
  }

  // Serve Static assets (css, js)
  if (pathname === '/style.css') {
    const filePath = path.join(__dirname, 'public', 'style.css');
    fs.readFile(filePath, (err, content) => {
      if (err) {
        res.writeHead(404);
        res.end();
      } else {
        res.writeHead(200, { 'Content-Type': 'text/css' });
        res.end(content);
      }
    });
    return;
  }

  if (pathname === '/app.js') {
    const filePath = path.join(__dirname, 'public', 'app.js');
    fs.readFile(filePath, (err, content) => {
      if (err) {
        res.writeHead(404);
        res.end();
      } else {
        res.writeHead(200, { 'Content-Type': 'application/javascript' });
        res.end(content);
      }
    });
    return;
  }

  // API Settings Endpoint
  if (pathname === '/api/settings' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });
    req.on('end', () => {
      try {
        const data = JSON.parse(body);
        
        // Update local settings config
        config.discordToken = typeof data.discordToken === 'string' ? data.discordToken.trim() : config.discordToken;
        config.emojiName = typeof data.emojiName === 'string' ? data.emojiName.trim() : config.emojiName;
        config.prefix = typeof data.prefix === 'string' ? data.prefix : config.prefix;
        config.suffix = typeof data.suffix === 'string' ? data.suffix : config.suffix;
        config.offsetSeconds = typeof data.offsetSeconds === 'number' ? data.offsetSeconds : config.offsetSeconds;
        config.syncEnabled = typeof data.syncEnabled === 'boolean' ? data.syncEnabled : config.syncEnabled;
        
        saveConfig();
        
        // Reset discord state so it immediately retries with new settings
        appState.discordStatus = config.discordToken ? 'Connecting' : 'Disconnected';
        appState.discordErrorMsg = '';
        lastDiscordStatusText = '';
        
        // Push status change to user settings
        if (config.syncEnabled && config.discordToken) {
          const currentText = (appState.lyrics.length > 0 && appState.activeLineIndex >= 0) 
            ? appState.lyrics[appState.activeLineIndex].text 
            : (appState.title ? `${appState.artist} - ${appState.title}` : '');
          
          if (currentText) updateDiscordStatus(currentText);
        } else {
          // Clear discord status if disabled
          updateDiscordStatus('');
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, config }));
        
        broadcastState();
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid JSON request' }));
      }
    });
    return;
  }

  // Get Current Config Endpoint
  if (pathname === '/api/config' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(config));
    return;
  }

  // SSE (Server-Sent Events) Endpoint
  if (pathname === '/api/events') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*'
    });
    
    // Send initial configuration and state
    res.write(`data: ${JSON.stringify(appState)}\n\n`);
    
    sseClients.push(res);
    
    req.on('close', () => {
      sseClients = sseClients.filter(client => client !== res);
    });
    return;
  }

  // 404 Not Found
  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('Not Found');
});

// Start application
server.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(`🎵 Spotify-to-Discord Synced Lyrics Status Server 🎵`);
  console.log(`Local Web Console: http://localhost:${PORT}`);
  console.log(`====================================================`);
  
  // Start the background Spotify process monitor
  startSpotifyMonitor();
  
  // Run an internal timer loop to increment position locally by 100ms
  // UWP API updates only on major events, so we extrapolate position between updates
  setInterval(() => {
    if (appState.spotifyActive && appState.isPlaying) {
      appState.position += 0.1;
      if (appState.position > appState.duration) {
        appState.position = appState.duration;
      }
      checkLyricsSync();
      // Only broadcast every second to minimize network overhead, unless the line changes
      if (Math.floor(appState.position * 10) % 10 === 0) {
        broadcastState();
      }
    }
  }, 100);
});
