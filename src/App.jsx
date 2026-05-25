import { useState, useEffect, useRef } from 'react';
import timetable from './assets/timetable.json';
import settings from './assets/settings.json';
import bgImage from './assets/images.png';
import './App.css';

const PRAYER_ORDER = ["Fajr", "Sunrise", "Dhuhr", "Asr", "Maghrib", "Isha"];
const MASJID_NAME = "Porwai Muhiyaddeen \n Jumma Masjid";

const COLORS = [
  "gold", "cyan", "#00FF00", "white", "#00CCFF", "red", "#FFBF00", "magenta",
  "#FF5733", "#33FFBD", "#A033FF", "#FF3385", "#33FFF5", "#F3FF33", "#99FF99",
  "#FF8C00", "#00CED1", "#FF1493", "#ADFF2F", "#00BFFF"
];

const BG_COLORS = ["black", "#110000", "#001100", "#000011", "#111100", "#1a1a1a", "#002222", "#220022", "#1e1e2e", "#0a0e14"];

export default function App() {
  const [time, setTime] = useState(new Date());
  const [activeAlert, setActiveAlert] = useState(null); 
  const [countdown, setCountdown] = useState(0);
  
  // Tracks the last time Azan was triggered to prevent repeating in the same minute
  const lastTriggered = useRef(null);

  // Load preferences from localStorage (or fallback to settings.json)
  const [prefs, setPrefs] = useState(() => {
    const saved = localStorage.getItem('mosque_settings');
    if (saved) return JSON.parse(saved);
    return {
      c_idx_masjid: settings.c_idx_masjid || 0,
      c_idx_clock: settings.c_idx_clock || 1,
      c_idx_prayer: settings.c_idx_prayer || 2,
      c_idx_prayer_high: settings.c_idx_prayer_high || 0,
      c_idx_greg_cal: settings.c_idx_greg_cal || 3,
      c_idx_hijri_cal: settings.c_idx_hijri_cal || 0,
      c_idx_iqamath_text: settings.c_idx_iqamath_text || 3,
      c_idx_iqamath_bg: settings.c_idx_iqamath_bg || 0,
      hijri_offset: settings.hijri_offset || -1,
    };
  });

  // Save to localStorage whenever preferences change
  useEffect(() => {
    localStorage.setItem('mosque_settings', JSON.stringify(prefs));
  }, [prefs]);

  // Keyboard Event Listener (F1-F9 and brackets)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (['F1', 'F2', 'F3', 'F5', 'F6', 'F7', 'F8', 'F9'].includes(e.key)) {
        e.preventDefault(); 
      }

      setPrefs(prev => {
        let newPrefs = { ...prev };
        switch(e.key) {
          case 'F1': newPrefs.c_idx_masjid = (prev.c_idx_masjid + 1) % COLORS.length; break;
          case 'F2': newPrefs.c_idx_clock = (prev.c_idx_clock + 1) % COLORS.length; break;
          case 'F3': newPrefs.c_idx_prayer = (prev.c_idx_prayer + 1) % COLORS.length; break;
          case 'F5': newPrefs.c_idx_iqamath_text = (prev.c_idx_iqamath_text + 1) % COLORS.length; break;
          case 'F6': newPrefs.c_idx_iqamath_bg = (prev.c_idx_iqamath_bg + 1) % BG_COLORS.length; break;
          case 'F7': newPrefs.c_idx_greg_cal = (prev.c_idx_greg_cal + 1) % COLORS.length; break;
          case 'F8': newPrefs.c_idx_hijri_cal = (prev.c_idx_hijri_cal + 1) % COLORS.length; break;
          case 'F9': newPrefs.c_idx_prayer_high = (prev.c_idx_prayer_high + 1) % COLORS.length; break;
          case '[': newPrefs.hijri_offset = prev.hijri_offset - 1; break;
          case ']': newPrefs.hijri_offset = prev.hijri_offset + 1; break;
          default: break;
        }
        return newPrefs;
      });
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Fetch today's prayer times
  const todayKey = time.toISOString().split('T')[0];
  const todaysTimes = timetable[todayKey] || settings.prayer_data;

  // 1. MAIN CLOCK & TRIGGER SYSTEM
  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      setTime(now);

      if (activeAlert) return; 

      const currentHour = now.getHours();
      const currentMin = now.getMinutes();
      const currentSec = now.getSeconds();
      const timeStr = `${currentHour}:${currentMin}`;

      if (currentSec === 0 && lastTriggered.current !== timeStr) {
        for (const prayer of PRAYER_ORDER) {
          if (prayer === "Sunrise") continue; 

          const timeData = todaysTimes[prayer];
          const p_hour = Array.isArray(timeData) ? timeData[0] : timeData.time[0];
          const p_min = Array.isArray(timeData) ? timeData[1] : timeData.time[1];

          if (currentHour === p_hour && currentMin === p_min) {
            lastTriggered.current = timeStr;
            triggerIqamathSequence(prayer, timeData, now);
            break;
          }
        }
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [activeAlert, todaysTimes]);

  // 2. AZAN TO IQAMATH TRANSITION
  const triggerIqamathSequence = (prayer, timeData, now) => {
    setActiveAlert('azan'); 
    
    const isFriday = now.getDay() === 5;
    let delayMinutes = timeData.iqamath || 15; 
    
    // Check Jumuah specific settings for Friday Dhuhr
    if (prayer === 'Dhuhr' && isFriday && timeData.jumuah_iqamath !== undefined) {
      delayMinutes = timeData.jumuah_iqamath;
    }

    setTimeout(() => {
      setCountdown(delayMinutes * 60); 
      setActiveAlert('iqamath');
    }, 10000); // Wait 10 seconds before switching to countdown
  };

  // 3. THE TICKING COUNTDOWN
  useEffect(() => {
    let interval = null;
    if (activeAlert === 'iqamath' && countdown > 0) {
      interval = setInterval(() => {
        setCountdown((prev) => prev - 1);
      }, 1000);
    } else if (activeAlert === 'iqamath' && countdown <= 0) {
      setActiveAlert(null); 
    }
    return () => clearInterval(interval);
  }, [activeAlert, countdown]);

  // Format Dates & UI Strings
  const timeString = time.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const dateString = time.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  
  const offsetTime = new Date(time.getTime() + (prefs.hijri_offset * 24 * 60 * 60 * 1000));
  const hijriString = new Intl.DateTimeFormat('en-TN-u-ca-islamic', {
    day: 'numeric', month: 'long', year: 'numeric'
  }).format(offsetTime) + " AH";

  return (
    <div className="app-container" style={{ backgroundImage: `url(${bgImage})` }}>
      
      {/* ALERT OVERLAY (Azan / Iqamath) */}
      {activeAlert && (
        <div className="alert-overlay" style={{ backgroundColor: BG_COLORS[prefs.c_idx_iqamath_bg], color: COLORS[prefs.c_idx_iqamath_text] }}>
          <h1>{activeAlert === 'azan' ? "TIME FOR AZAN" : "IQAMATH IN"}</h1>
          {activeAlert === 'iqamath' && <h2>{Math.floor(countdown / 60)}:{(countdown % 60).toString().padStart(2, '0')}</h2>}
        </div>
      )}

      {/* MAIN SCREEN */}
      <div className="glass-panel">
        <h1 className="masjid-title" style={{ color: COLORS[prefs.c_idx_masjid] }}>{MASJID_NAME}</h1>
        
        <div className="clock-section">
          <h2 className="clock-time" style={{ color: COLORS[prefs.c_idx_clock] }}>{timeString}</h2>
          <h3 className="clock-date" style={{ color: COLORS[prefs.c_idx_greg_cal] }}>{dateString}</h3>
          <h3 className="clock-hijri" style={{ color: COLORS[prefs.c_idx_hijri_cal] }}>{hijriString}</h3>
        </div>

        <div className="prayer-grid">
          {PRAYER_ORDER.map((prayer) => {
            const timeData = todaysTimes[prayer];
            const isArray = Array.isArray(timeData);
            const hours = isArray ? timeData[0] : timeData.time[0];
            const mins = isArray ? timeData[1] : timeData.time[1];
            
            const ampm = hours >= 12 ? 'PM' : 'AM';
            const displayHour = hours % 12 || 12;
            
            // Check if this specific prayer is currently active (within 1 hour)
            const prayerTime = new Date(time);
            prayerTime.setHours(hours, mins, 0, 0);
            const diffMinutes = (time - prayerTime) / (1000 * 60);
            const isHighlighted = diffMinutes >= 0 && diffMinutes <= 60;
            
            return (
              <div key={prayer} className="prayer-card" style={{ color: isHighlighted ? COLORS[prefs.c_idx_prayer_high] : COLORS[prefs.c_idx_prayer] }}>
                <h2>{prayer}</h2>
                <p>{`${displayHour}:${mins.toString().padStart(2, '0')} ${ampm}`}</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* ANNOUNCEMENT TICKER */}
      <div className="ticker-container">
        <div className="ticker-text" style={{ color: COLORS[prefs.c_idx_masjid] }}>
          {settings.raw_announcements.replace(/;;/g, ' ★ ').replace(/,,/g, ' • ')}
        </div>
      </div>
    </div>
  );
}