import React, { useState, useEffect } from 'react';

// --- MATH HELPERS (Kept outside since they don't change) ---
const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

const calculateBearing = (lat1, lon1, lat2, lon2) => {
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const lat1Rad = (lat1 * Math.PI) / 180;
  const lat2Rad = (lat2 * Math.PI) / 180;

  const y = Math.sin(dLon) * Math.cos(lat2Rad);
  const x =
    Math.cos(lat1Rad) * Math.sin(lat2Rad) -
    Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(dLon);

  let brng = Math.atan2(y, x);
  brng = (brng * 180) / Math.PI;
  return (brng + 360) % 360;
};

const App = () => {
  // 1. Live Radar Configuration State (what the radar is currently using)
  const [config, setConfig] = useState({
    lat: 51.33,
    lon: -0.74,
    range: 80,
  });

  // 2. Form Input State (what the user is currently typing)
  const [inputs, setInputs] = useState({
    lat: 51.33,
    lon: -0.74,
    range: 80,
  });

  const [aircraft, setAircraft] = useState([]);
  const [error, setError] = useState(null);

  // Derived maximum range in KM for the math functions
  const maxRangeKm = config.range * 1.852;

  // Handle form submission
  const handleUpdate = (e) => {
    e.preventDefault();
    // Move the typed inputs into the active config
    setConfig({
      lat: parseFloat(inputs.lat),
      lon: parseFloat(inputs.lon),
      range: parseFloat(inputs.range),
    });
    setAircraft([]); // Clear old planes while fetching new ones
  };

  useEffect(() => {
    const fetchLiveAircraft = async () => {
      try {
        // Fetching via the proxy we set up earlier
        const response = await fetch(
          `/api/v2/lat/${config.lat}/lon/${config.lon}/dist/${config.range}`
        );
        
        if (!response.ok) throw new Error('Failed to fetch data');
        
        const data = await response.json();
        
        if (!data.ac) {
          setAircraft([]);
          return;
        }

        const livePlanes = data.ac
          .map((plane) => {
            if (!plane.lat || !plane.lon) return null;

            // Use the active config coordinates to calculate distance/bearing
            const distanceKm = calculateDistance(config.lat, config.lon, plane.lat, plane.lon);
            const angle = calculateBearing(config.lat, config.lon, plane.lat, plane.lon);

            const distancePercent = (distanceKm / maxRangeKm) * 50;

            let altFeet = 0;
            if (typeof plane.alt_baro === 'number') {
              altFeet = plane.alt_baro;
            } else if (typeof plane.alt_geom === 'number') {
              altFeet = plane.alt_geom;
            }

            return {
              id: plane.hex,
              callsign: plane.flight ? plane.flight.trim() : plane.hex,
              altitude: Math.floor(altFeet / 100),
              distance: distancePercent,
              angle: angle,
              distanceKm: distanceKm
            };
          })
          .filter((plane) => plane !== null && plane.distanceKm <= maxRangeKm);

        setAircraft(livePlanes);
        setError(null);
      } catch (err) {
        console.error("API Fetch Error:", err);
        setError("Unable to reach ADSB.lol API...");
      }
    };

    fetchLiveAircraft();
    const interval = setInterval(fetchLiveAircraft, 5000); 

    return () => clearInterval(interval);
  }, [config, maxRangeKm]); // Re-run this effect whenever the config changes

  return (
    <div style={styles.container}>
      <style>
        {`
          @keyframes radar-sweep {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
          @keyframes blip-pulse {
            0% { opacity: 1; transform: scale(1); }
            50% { opacity: 0.6; transform: scale(1.2); }
            100% { opacity: 1; transform: scale(1); }
          }
        `}
      </style>

      {/* Floating Control Panel */}
      <form style={styles.controlPanel} onSubmit={handleUpdate}>
        <div style={styles.panelTitle}>RADAR SETTINGS</div>
        <div style={styles.inputGroup}>
          <label>Lat:</label>
          <input 
            type="number" 
            step="0.0001"
            value={inputs.lat} 
            onChange={(e) => setInputs({...inputs, lat: e.target.value})}
            style={styles.input}
          />
        </div>
        <div style={styles.inputGroup}>
          <label>Lon:</label>
          <input 
            type="number" 
            step="0.0001"
            value={inputs.lon} 
            onChange={(e) => setInputs({...inputs, lon: e.target.value})}
            style={styles.input}
          />
        </div>
        <div style={styles.inputGroup}>
          <label>Range (NM):</label>
          <input 
            type="number" 
            value={inputs.range} 
            onChange={(e) => setInputs({...inputs, range: e.target.value})}
            style={styles.input}
          />
        </div>
        <button type="submit" style={styles.button}>UPDATE RADAR</button>
      </form>

      {error && <div style={styles.errorBanner}>{error}</div>}

      <div style={styles.radarWrapper}>
        <div style={styles.radarCircle}>
          
          <div style={{...styles.ring, width: '75%', height: '75%'}}></div>
          <div style={{...styles.ring, width: '50%', height: '50%'}}></div>
          <div style={{...styles.ring, width: '25%', height: '25%'}}></div>

          <div style={styles.horizontalLine}></div>
          <div style={styles.verticalLine}></div>

          <div style={styles.sweep}></div>

          {aircraft.map((plane) => {
            const adjustedAngle = plane.angle - 90;
            const top = 50 + plane.distance * Math.sin((adjustedAngle * Math.PI) / 180);
            const left = 50 + plane.distance * Math.cos((adjustedAngle * Math.PI) / 180);

            return (
              <div
                key={plane.id}
                style={{
                  ...styles.blipContainer,
                  top: `${top}%`,
                  left: `${left}%`,
                }}
              >
                <div style={styles.blipDot}></div>
                <div style={styles.blipData}>
                  <div>{plane.callsign}</div>
                  <div>FL{plane.altitude}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

// Styles mapped below
const styles = {
  container: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    height: '100vh',
    backgroundColor: '#050a05',
    fontFamily: 'monospace',
    color: '#00ff00',
    overflow: 'hidden',
    position: 'relative',
  },
  controlPanel: {
    position: 'absolute',
    top: '20px',
    left: '20px',
    backgroundColor: 'rgba(0, 20, 0, 0.8)',
    border: '1px solid #00ff0060',
    padding: '15px',
    borderRadius: '8px',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    zIndex: 20,
    boxShadow: '0 4px 6px rgba(0,0,0,0.5)',
  },
  panelTitle: {
    fontWeight: 'bold',
    borderBottom: '1px solid #00ff0040',
    paddingBottom: '8px',
    marginBottom: '4px',
    textAlign: 'center',
  },
  inputGroup: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '10px',
  },
  input: {
    backgroundColor: '#050a05',
    border: '1px solid #00ff0040',
    color: '#00ff00',
    padding: '4px 8px',
    width: '80px',
    fontFamily: 'monospace',
    outline: 'none',
  },
  button: {
    backgroundColor: '#00ff0020',
    border: '1px solid #00ff00',
    color: '#00ff00',
    padding: '8px',
    cursor: 'pointer',
    fontFamily: 'monospace',
    fontWeight: 'bold',
    marginTop: '5px',
    transition: 'background-color 0.2s',
  },
  errorBanner: {
    position: 'absolute',
    top: '20px',
    right: '20px',
    color: '#ff4444',
    background: '#220000',
    padding: '8px 16px',
    borderRadius: '4px',
    border: '1px solid #ff4444',
    zIndex: 10,
  },
  radarWrapper: {
    position: 'relative',
    width: '80vmin',
    height: '80vmin',
    maxWidth: '600px',
    maxHeight: '600px',
    backgroundColor: '#0a1a0a',
    borderRadius: '50%',
    boxShadow: '0 0 20px #00ff0040, inset 0 0 40px #00ff0020',
    border: '2px solid #00ff0060',
  },
  radarCircle: {
    position: 'relative',
    width: '100%',
    height: '100%',
    borderRadius: '50%',
    overflow: 'hidden',
  },
  ring: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    border: '1px solid #00ff0040',
    borderRadius: '50%',
  },
  horizontalLine: {
    position: 'absolute',
    top: '50%',
    left: '0',
    width: '100%',
    height: '1px',
    backgroundColor: '#00ff0040',
  },
  verticalLine: {
    position: 'absolute',
    top: '0',
    left: '50%',
    width: '1px',
    height: '100%',
    backgroundColor: '#00ff0040',
  },
  sweep: {
    position: 'absolute',
    top: '0',
    left: '0',
    width: '100%',
    height: '100%',
    borderRadius: '50%',
    background: 'conic-gradient(from 0deg, transparent 0%, transparent 270deg, rgba(0, 255, 0, 0.1) 340deg, rgba(0, 255, 0, 0.8) 360deg)',
    animation: 'radar-sweep 4s linear infinite',
    transformOrigin: 'center center',
  },
  blipContainer: {
    position: 'absolute',
    transform: 'translate(-50%, -50%)',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    pointerEvents: 'none',
    transition: 'top 1s linear, left 1s linear',
  },
  blipDot: {
    width: '6px',
    height: '6px',
    backgroundColor: '#00ff00',
    borderRadius: '50%',
    boxShadow: '0 0 8px #00ff00',
    animation: 'blip-pulse 1.5s infinite ease-in-out',
  },
  blipData: {
    fontSize: '10px',
    lineHeight: '1.2',
    color: '#00ff00',
    textShadow: '0 0 2px #000',
    background: 'rgba(0, 20, 0, 0.6)',
    padding: '2px 4px',
    borderRadius: '2px',
  }
};

export default App;