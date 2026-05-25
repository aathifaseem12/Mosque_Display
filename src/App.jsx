import { useState, useEffect, useRef } from 'react';
import timetable from './assets/timetable.json';
import settings from './assets/settings.json';

// IMPORTANT: Ensure this exactly matches the file extension in your assets folder!
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

// Helper to get YYYY-MM-DD in local Sri Lanka time safely
const getLocalDateString = (d) => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export default function App() {
  const [time, setTime] = useState(new Date());
  const [activeAlert, setActiveAlert] = useState(null); 
  const [countdown, setCountdown] = useState(0);
  
  const [adminPreview, setAdminPreview] = useState(null);
  const [selectedPrayer, setSelectedPrayer] = useState(null);
  
  const lastTriggered = useRef(null);
  const previewTimer = useRef(null);
  const interactionTimer = useRef(null);

  // BULLETPROOF STATE INITIALIZATION: Safely merges old cache with new features
  const [prefs, setPrefs] = useState(() => {
    const saved = localStorage.getItem('mosque_settings');
    const defaultPrefs = {
      c_idx_masjid: settings.c_idx_masjid || 0,
      c_idx_clock: settings.c_idx_clock || 1,
      c_idx_prayer: settings.c_idx_prayer || 2,
      c_idx_prayer_high: settings.c_idx_prayer_high || 0,
      c_idx_greg_cal: settings.c_idx_greg_cal || 3,
      c_idx_hijri_cal: settings.c_idx_hijri_cal || 0,
      c_idx_iqamath_text: settings.c_idx_iqamath_text || 3,
      c_idx_iqamath_bg: settings.c_idx_iqamath_bg || 0,
      hijri_offset: settings.hijri_offset || -1,
      prayerOverrides: {} 
    };

    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return { ...defaultPrefs, ...parsed, prayerOverrides: parsed.prayerOverrides || {} };
      } catch (e) {
        return defaultPrefs;
      }
    }
    return defaultPrefs;
  });

  useEffect(() => {
    localStorage.setItem('mosque_settings', JSON.stringify(prefs));
  }, [prefs]);

  const showPreview = (title, detail, txtColor = null, bgColor = null) => {
    setAdminPreview({ title, detail, txtColor, bgColor });
    if (previewTimer.current) clearTimeout(previewTimer.current);
    previewTimer.current = setTimeout(() => setAdminPreview(null), 3000);
  };

  const resetInteraction = () => {
    if (interactionTimer.current) clearTimeout(interactionTimer.current);
    interactionTimer.current = setTimeout(() => setSelectedPrayer(null), 10000);
  };

  useEffect(() => {
    const handleKeyDown = (e) => {
      const key = e.key;
      const keyLower = key.toLowerCase();

      if (key.match(/^F[1-9]$/)) e.preventDefault(); 
      resetInteraction();

      setPrefs(prev => {
        let newPrefs = { ...prev };
        
        switch(key) {
          case 'F1': newPrefs.c_idx_masjid = (prev.c_idx_masjid + 1) % COLORS.length; break;
          case 'F2': newPrefs.c_idx_clock = (prev.c_idx_clock + 1) % COLORS.length; break;
          case 'F3': newPrefs.c_idx_prayer = (prev.c_idx_prayer + 1) % COLORS.length; break;
          case 'F7': newPrefs.c_idx_greg_cal = (prev.c_idx_greg_cal + 1) % COLORS.length; break;
          case 'F8': newPrefs.c_idx_hijri_cal = (prev.c_idx_hijri_cal + 1) % COLORS.length; break;
          case 'F9': 
            newPrefs.c_idx_prayer_high = (prev.c_idx_prayer_high + 1) % COLORS.length; 
            showPreview("HIGHLIGHT COLOR", "ACTIVE PRAYER COLOR", COLORS[newPrefs.c_idx_prayer_high]);
            break;
          case 'F5': 
            newPrefs.c_idx_iqamath_text = (prev.c_idx_iqamath_text + 1) % COLORS.length; 
            showPreview("COUNTDOWN TEXT", "COLOR UPDATED", COLORS[newPrefs.c_idx_iqamath_text]);
            break;
          case 'F6': 
            newPrefs.c_idx_iqamath_bg = (prev.c_idx_iqamath_bg + 1) % BG_COLORS.length; 
            showPreview("COUNTDOWN BG", "BG COLOR UPDATED", COLORS[newPrefs.c_idx_iqamath_text], BG_COLORS[newPrefs.c_idx_iqamath_bg]);
            break;
          case '[': 
            newPrefs.hijri_offset = prev.hijri_offset - 1; 
            showPreview("HIJRI ADJUST", `New Offset: ${newPrefs.hijri_offset} Days`);
            break;
          case ']': 
            newPrefs.hijri_offset = prev.hijri_offset + 1; 
            showPreview("HIJRI ADJUST", `New Offset: ${newPrefs.hijri_offset} Days`);
            break;
        }

        if (['1','2','3','4','5','6'].includes(key)) {
          setSelectedPrayer(PRAYER_ORDER[parseInt(key) - 1]);
          return newPrefs; 
        }

        if (selectedPrayer && ['h', 'm', '+', '-'].includes(keyLower)) {
          const todayKey = getLocalDateString(new Date());
          const baseData = timetable[todayKey]?.[selectedPrayer] || settings.prayer_data[selectedPrayer];
          const baseTime = Array.isArray(baseData) ? baseData : baseData.time;
          
          let p = { ...(newPrefs.prayerOverrides[selectedPrayer] || {}) };
          if (p.h === undefined) p.h = baseTime[0];
          if (p.m === undefined) p.m = baseTime[1];
          if (p.iq === undefined) p.iq = baseData.iqamath || 15;
          if (p.jiq === undefined) p.jiq = baseData.jumuah_iqamath || 45;

          const isFriday = new Date().getDay() === 5;
          const isJumuah = isFriday && selectedPrayer === 'Dhuhr';

          if (keyLower === 'h') p.h = (p.h + 1) % 24;
          if (keyLower === 'm') p.m = (p.m + 1) % 60;
          if (keyLower === '+') isJumuah ? p.jiq++ : p.iq++;
          if (keyLower === '-') isJumuah ? p.jiq = Math.max(0, p.jiq - 1) : p.iq = Math.max(0, p.iq - 1);

          newPrefs.prayerOverrides = { ...newPrefs.prayerOverrides, [selectedPrayer]: p };
          
          const currentIq = isJumuah ? p.jiq : p.iq;
          showPreview(`EDITING: ${selectedPrayer}`, `TIME ${p.h.toString().padStart(2,'0')}:${p.m.toString().padStart(2,'0')} | IQ ${currentIq}m`);
        }

        return newPrefs;
      });
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedPrayer]);

  // Safely consolidates JSON data + Manual overrides without crashing
  const getPrayerData = (prayer) => {
    const todayKey = getLocalDateString(time);
    const base = timetable[todayKey]?.[prayer] || settings.prayer_data[prayer];
    
    // Failsafe fallback
    if (!base) return { h: 0, m: 0, iq: 15, jiq: 45 };

    const baseTime = Array.isArray(base) ? base : base.time;
    const baseIq = base.iqamath || 15;
    const baseJum = base.jumuah_iqamath || 45;

    const override = (prefs.prayerOverrides && prefs.prayerOverrides[prayer]) ? prefs.prayerOverrides[prayer] : {};
    
    return {
      h: override.h !== undefined ? override.h : baseTime[0],
      m: override.m !== undefined ? override.m : baseTime[1],
      iq: override.iq !== undefined ? override.iq : baseIq,
      jiq: override.jiq !== undefined ? override.jiq : baseJum
    };
  };

  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      setTime(now);

      if (activeAlert || adminPreview) return; 

      const currentHour = now.getHours();
      const currentMin = now.getMinutes();
      const currentSec = now.getSeconds();
      const timeStr = `${currentHour}:${currentMin}`;

      if (currentSec === 0 && lastTriggered.current !== timeStr) {
        for (const prayer of PRAYER_ORDER) {
          if (prayer === "Sunrise") continue; 
          
          const pData = getPrayerData(prayer);
          if (currentHour === pData.h && currentMin === pData.m) {
            lastTriggered.current = timeStr;
            triggerIqamathSequence(prayer, pData, now);
            break;
          }
        }
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [activeAlert, adminPreview, prefs]);

  const triggerIqamathSequence = (prayer, pData, now) => {
    setActiveAlert('azan'); 
    const delayMinutes = (now.getDay() === 5 && prayer === 'Dhuhr') ? pData.jiq : pData.iq;
    setTimeout(() => {
      setCountdown(delayMinutes * 60); 
      setActiveAlert('iqamath');
    }, 10000); 
  };

  useEffect(() => {
    let interval = null;
    if (activeAlert === 'iqamath' && countdown > 0) {
      interval = setInterval(() => setCountdown(prev => prev - 1), 1000);
    } else if (activeAlert === 'iqamath' && countdown <= 0) {
      setActiveAlert(null); 
    }
    return () => clearInterval(interval);
  }, [activeAlert, countdown]);

  const timeString = time.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const dateString = time.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  const offsetTime = new Date(time.getTime() + (prefs.hijri_offset * 24 * 60 * 60 * 1000));
  const hijriString = new Intl.DateTimeFormat('en-TN-u-ca-islamic', { day: 'numeric', month: 'long', year: 'numeric' }).format(offsetTime) + " AH";

  return (
    <div className="app-container" style={{ backgroundImage: `url(${bgImage})` }}>
      
      {adminPreview && !activeAlert && (
        <div className="alert-overlay" style={{ backgroundColor: adminPreview.bgColor || BG_COLORS[prefs.c_idx_iqamath_bg], color: adminPreview.txtColor || COLORS[prefs.c_idx_iqamath_text] }}>
          <h1 style={{ fontSize: '5rem', textShadow: '4px 4px 0px black' }}>{adminPreview.title}</h1>
          <h2 style={{ fontSize: '3rem', marginTop: '20px' }}>{adminPreview.detail}</h2>
        </div>
      )}

      {activeAlert && (
        <div className="alert-overlay" style={{ backgroundColor: BG_COLORS[prefs.c_idx_iqamath_bg], color: COLORS[prefs.c_idx_iqamath_text] }}>
          <h1>{activeAlert === 'azan' ? "TIME FOR AZAN" : "IQAMATH IN"}</h1>
          {activeAlert === 'iqamath' && <h2>{Math.floor(countdown / 60)}:{(countdown % 60).toString().padStart(2, '0')}</h2>}
        </div>
      )}

      <div className="glass-panel" style={{ visibility: (activeAlert || adminPreview) ? 'hidden' : 'visible' }}>
        <h1 className="masjid-title" style={{ color: COLORS[prefs.c_idx_masjid] }}>{MASJID_NAME}</h1>
        
        <div className="clock-section">
          <h2 className="clock-time" style={{ color: COLORS[prefs.c_idx_clock] }}>{timeString}</h2>
          <h3 className="clock-date" style={{ color: COLORS[prefs.c_idx_greg_cal] }}>{dateString}</h3>
          <h3 className="clock-hijri" style={{ color: COLORS[prefs.c_idx_hijri_cal] }}>{hijriString}</h3>
        </div>

        <div className="prayer-grid">
          {PRAYER_ORDER.map((prayer) => {
            const pData = getPrayerData(prayer);
            const ampm = pData.h >= 12 ? 'PM' : 'AM';
            const displayHour = pData.h % 12 || 12;
            
            let color = COLORS[prefs.c_idx_prayer];
            if (prayer === selectedPrayer) {
              color = "red"; 
            } else {
              const prayerTime = new Date(time);
              prayerTime.setHours(pData.h, pData.m, 0, 0);
              const diffMinutes = (time - prayerTime) / (1000 * 60);
              if (diffMinutes >= 0 && diffMinutes <= 60) color = COLORS[prefs.c_idx_prayer_high];
            }
            
            return (
              <div key={prayer} className="prayer-card" style={{ color: color }}>
                <h2>{prayer}</h2>
                <p>{`${displayHour}:${pData.m.toString().padStart(2, '0')} ${ampm}`}</p>
              </div>
            );
          })}
        </div>
      </div>

      <div className="ticker-container" style={{ visibility: (activeAlert || adminPreview) ? 'hidden' : 'visible' }}>
        <div className="ticker-text" style={{ color: COLORS[prefs.c_idx_masjid] }}>
          {settings.raw_announcements.replace(/;;/g, ' ★ ').replace(/,,/g, ' • ')}
        </div>
      </div>
    </div>
  );
}