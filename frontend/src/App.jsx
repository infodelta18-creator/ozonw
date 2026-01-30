import React, { useState, useEffect } from 'react';
import { Wind, MapPin, Activity, AlertCircle, RefreshCw, Info, Thermometer, Droplets } from 'lucide-react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

// Fix Leaflet icon issue
import L from 'leaflet';
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
    iconUrl: icon,
    shadowUrl: iconShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41]
});

L.Marker.prototype.options.icon = DefaultIcon;

function ChangeView({ center, zoom }) {
    const map = useMap();
    map.setView(center, zoom);
    return null;
}

function App() {
    const [loading, setLoading] = useState(false);
    const [data, setData] = useState(null);
    const [error, setError] = useState(null);
    const [coords, setCoords] = useState([51.505, -0.09]); // Default London

    const getLocation = () => {
        setLoading(true);
        setError(null);

        if (!navigator.geolocation) {
            setError('Bu brauzeringiz qo'llab quvvatlanmadi,iltimos boshqa brauzerdan foydalaning');
            setLoading(false);
            return;
        }

        navigator.geolocation.getCurrentPosition(
            (position) => {
                const { latitude, longitude } = position.coords;
                setCoords([latitude, longitude]);
                fetchData(latitude, longitude);
            },
            (err) => {
                setError('Brauzeringiz qo'llab quvvatlanmaydi,iltimos boshqa brauzerdan foydalaning');
                setLoading(false);
            }
        );
    };

    const fetchData = async (lat, lon) => {
        try {
            const response = await fetch('/analyze', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ latitude: lat, longitude: lon }),
            });

            if (!response.ok) throw new Error('Analysis failed');

            const result = await response.json();
            setData(result);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const getAQIColorClass = (aqi) => {
        if (aqi <= 50) return 'aqi-good';
        if (aqi <= 100) return 'aqi-moderate';
        if (aqi <= 150) return 'aqi-unhealthy';
        return 'aqi-hazardous';
    };

    const getAQIStatus = (aqi) => {
        if (aqi <= 50) return 'Excellent';
        if (aqi <= 100) return 'Moderate';
        if (aqi <= 150) return 'Unhealthy';
        return 'Hazardous';
    };

    return (
        <>
            <nav className="navbar slide-down">
                <div className="nav-brand">
                    <Wind size={24} className="spin-slow" />
                    <span>Ozon Netlivy</span>
                </div>
                <button className="btn-primary pulse-hover" onClick={getLocation} disabled={loading}>
                    {loading ? <RefreshCw className="spin" size={18} /> : <MapPin size={18} />}
                    {loading ? 'Updating...' : 'Use My Location'}
                </button>
            </nav>

            <main className="main-content fade-in">
                {error && (
                    <div className="card" style={{ borderLeft: '4px solid #ef4444', color: '#ef4444' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <AlertCircle size={24} />
                            <span>{error}</span>
                        </div>
                    </div>
                )}

                {!data && !loading && !error && (
                    <div className="card empty-state">
                        <Wind size={64} style={{ opacity: 0.2, marginBottom: '20px' }} className="float" />
                        <h2>Welcome to Netlivy</h2>
                        <p>Havo sifati, ob-havo ma'lumotlari va sun'iy intellektga asoslangan sog'liqni saqlash bo'yicha real vaqt rejimida maslahatlar oling</p>
                        <p>"Use My Location" boshlash uchun.</p>
                    </div>
                )}

                {loading && !data && (
                    <div className="card empty-state">
                        <div className="loading-spinner"></div>
                        <p>Atmosfera maʼlumoti yuklanmoqda...</p>
                    </div>
                )}

                {data && (
                    <div className="dashboard-grid">
                        {/* Left Column: AQI & Weather */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                            <div className="card aqi-section">
                                <div className="location-header" style={{ width: '100%' }}>
                                    <span className="location-title">Joriy havo sifati</span>
                                    <Info size={20} color="#9ca3af" />
                                </div>

                                <div className={`aqi-circle ${getAQIColorClass(data.aqi_data.us_aqi)} pulse-border`}>
                                    <span className="aqi-value">{data.aqi_data.us_aqi}</span>
                                    <span className="aqi-label">US AQI</span>
                                </div>

                                <div className={`aqi-status-text ${getAQIColorClass(data.aqi_data.us_aqi)}`}>
                                    {getAQIStatus(data.aqi_data.us_aqi)}
                                </div>
                            </div>

                            <div className="card weather-section">
                                <h3 style={{ marginTop: 0, marginBottom: '15px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <Thermometer size={20} /> Ob-havo sharoitlari
                                </h3>
                                <div className="weather-grid">
                                    <div className="weather-item">
                                        <span className="weather-value">{data.weather_data.temperature_2m}°C</span>
                                        <span className="weather-label">Harorat</span>
                                    </div>
                                    <div className="weather-item">
                                        <span className="weather-value">{data.weather_data.relative_humidity_2m}%</span>
                                        <span className="weather-label">Namlik</span>
                                    </div>
                                    <div className="weather-item">
                                        <span  className="weather-value">{data.weather_data.wind_speed_10m} <span style={{ fontSize: '0.8rem' }}>km/h</span></span>
                                        <span className="weather-label">Shamol</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Right Column: Map, Pollutants & AI */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

                            {/* Map Card */}
                            <div className="card" style={{ padding: 0, overflow: 'hidden', height: '300px' }}>
                                <MapContainer center={coords} zoom={13} style={{ height: '100%', width: '100%' }}>
                                    <ChangeView center={coords} zoom={13} />
                                    <TileLayer
                                        url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
                                        attribution='&copy; <a href="">Netlivy Openstreetmap</a> contributors &copy; <a href="https://instagram.com/car1movvvvv">instagram</a>'
                                    />
                                    <Marker position={coords}>
                                        <Popup>
                                            AQI: {data.aqi_data.us_aqi} <br /> Temp: {data.weather_data.temperature_2m}°C
                                        </Popup>
                                    </Marker>
                                </MapContainer>
                            </div>

                            <div className="card">
                                <h3 style={{ marginTop: 0, marginBottom: '15px', borderBottom: '1px solid #e5e7eb', paddingBottom: '10px' }}>
                                    Ifloslantiruvchi moddalar tafsilotlari
                                </h3>
                                <div className="pollutants-grid">
                                    <div className="pollutant-card">
                                        <div className="pollutant-name">PM2.5</div>
                                        <div className="pollutant-value">{data.aqi_data.pm2_5}</div>
                                        <div className="pollutant-unit">µg/m³</div>
                                    </div>
                                    <div className="pollutant-card">
                                        <div className="pollutant-name">PM10</div>
                                        <div className="pollutant-value">{data.aqi_data.pm10}</div>
                                        <div className="pollutant-unit">µg/m³</div>
                                    </div>
                                    <div className="pollutant-card">
                                        <div className="pollutant-name">NO₂</div>
                                        <div className="pollutant-value">{data.aqi_data.nitrogen_dioxide || 'N/A'}</div>
                                        <div className="pollutant-unit">µg/m³</div>
                                    </div>
                                    <div className="pollutant-card">
                                        <div className="pollutant-name">O₃</div>
                                        <div className="pollutant-value">{data.aqi_data.ozone || 'N/A'}</div>
                                        <div className="pollutant-unit">µg/m³</div>
                                    </div>
                                </div>
                            </div>

                            <div className="card analysis-section">
                                <div className="analysis-header">
                                    <Activity size={24} className="" />
                                    <span>Netlivy AI maslahati</span>
                                </div>
                                <div className="analysis-list">
                                    {data.analysis.split('\n').map((line, index) => {
                                        const cleanLine = line.replace(/^[-*•]\s*/, '').trim();
                                        if (!cleanLine) return null;
                                        return (
                                            <div key={index} className="analysis-item">
                                                <div className="analysis-bullet"></div>
                                                <p>{cleanLine}</p>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </main>

            <footer className="footer fade-in" style={{ animationDelay: '1s' }}>
                <p>
                    Developed with <span style={{ color: '#ef4444' }}></span> by Netlivy
                </p>
                <p className="footer-sub">
                    Powered by Netlivy, Netlivy AI model beta version
                </p>
            </footer>
        </>
    );
}

export default App;
