import React, { useState, useEffect, useRef } from 'react';
import { Compass, Settings, AlertTriangle } from 'lucide-react';
import { TabBar, Toast } from 'antd-mobile';
import RadarView from './components/RadarView';
import SettingsView from './components/SettingsView';
import LockOverlay from './components/LockOverlay';

// Default base coordinates
const DEFAULT_BASE_LOCATION = {
  lat: 10.36727460696543,
  lng: 106.352052343414
};

// Haversine formula to compute distance in meters
const calculateHaversineDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371000; // meters
  const toRad = (angle) => (angle * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const rLat1 = toRad(lat1);
  const rLat2 = toRad(lat2);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(rLat1) * Math.cos(rLat2) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

export default function App() {
  const [activeTab, setActiveTab] = useState('radar');

  // Geofencing parameters
  const [officeLocation, setOfficeLocation] = useState(DEFAULT_BASE_LOCATION);
  const [allowedRadius, setAllowedRadius] = useState(100); // 100 meters standard

  // Real-time GPS location states
  const [userLocation, setUserLocation] = useState(null);
  const [distance, setDistance] = useState(null);
  const [isWithinFence, setIsWithinFence] = useState(null);
  const [gpsLogs, setGpsLogs] = useState([]);
  const [error, setError] = useState(null);

  // Address lookup states
  const [officeAddress, setOfficeAddress] = useState('');
  const [userAddress, setUserAddress] = useState('');
  const [loadingOfficeAddress, setLoadingOfficeAddress] = useState(false);
  const [loadingUserAddress, setLoadingUserAddress] = useState(false);

  // Refs for tracking movement threshold
  const lastToastLocationRef = useRef(null);
  const lastGeocodedLocationRef = useRef(null);
  const watchIdRef = useRef(null);

  // Helper to add log entry
  const addLog = (text, type = 'info') => {
    const timeStr = new Date().toLocaleTimeString();
    setGpsLogs(prev => [{ time: timeStr, text, type }, ...prev.slice(0, 49)]);
  };

  // Reverse lookup handler
  const fetchAddress = async (lat, lng, setAddress, setLoading, label) => {
    setLoading(true);
    try {
      // Nominatim reverse lookup
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`,
        {
          headers: {
            'Accept-Language': 'vi,en;q=0.9',
            'User-Agent': 'AntigravityGeofence/2.0' // OSM friendly user agent
          }
        }
      );
      if (!res.ok) throw new Error('OSM server error');
      const data = await res.json();
      const addr = data.display_name || 'Không xác định được địa chỉ';
      setAddress(addr);
      console.log(`OSM reverse lookup for ${label}:`, addr);
    } catch (err) {
      console.error(`Lookup error for ${label}:`, err);
      setAddress('Không thể tải địa chỉ (Lỗi kết nối mạng)');
    } finally {
      setLoading(false);
    }
  };

  // 1. Debounced reverse lookup for Office Location edits
  useEffect(() => {
    const delayTimer = setTimeout(() => {
      fetchAddress(
        officeLocation.lat,
        officeLocation.lng,
        setOfficeAddress,
        setLoadingOfficeAddress,
        'Office'
      );
    }, 1200);

    return () => clearTimeout(delayTimer);
  }, [officeLocation.lat, officeLocation.lng]);

  // 2. Watch device location continuously via watchPosition
  const requestGpsPermission = () => {
    if (!navigator.geolocation) {
      setError("Trình duyệt không hỗ trợ định vị GPS phần cứng.");
      addLog("Lỗi: Trình duyệt không hỗ trợ HTML5 Geolocation", "error");
      return;
    }

    // Clear old watcher if any
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
    }

    addLog("Đang kết nối GPS phần cứng của thiết bị...", "info");

    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        const { latitude, longitude, accuracy } = position.coords;
        const newLoc = { lat: latitude, lng: longitude, accuracy };

        setUserLocation(newLoc);
        setError(null);

        // Compute distance to current office coordinate
        const dist = calculateHaversineDistance(latitude, longitude, officeLocation.lat, officeLocation.lng);
        setDistance(dist);

        const inside = dist <= allowedRadius;
        setIsWithinFence(inside);

        // Check if movement threshold is met (>= 0.5 meters) for toast notification
        if (lastToastLocationRef.current) {
          const moveDist = calculateHaversineDistance(
            lastToastLocationRef.current.lat,
            lastToastLocationRef.current.lng,
            latitude,
            longitude
          );

          if (moveDist >= 0.5) {
            // Trigger Toast alert on Noticeable Move
            Toast.show({
              content: `Bạn vừa di chuyển ${moveDist.toFixed(1)}m (Độ chính xác: ±${accuracy.toFixed(1)}m)`,
              duration: 2000,
              position: 'bottom',
            });
            addLog(`Di chuyển ${moveDist.toFixed(1)}m. Khoảng cách VP: ${dist.toFixed(1)}m.`, 'success');
            lastToastLocationRef.current = { lat: latitude, lng: longitude };
          }
        } else {
          // Initial coordinate received
          Toast.show({
            content: `Đã kết nối GPS! Khoảng cách văn phòng: ${dist.toFixed(1)}m`,
            duration: 2000,
            position: 'bottom',
          });
          addLog(`Nhận vị trí ban đầu. Khoảng cách VP: ${dist.toFixed(1)}m. Sai số: ±${accuracy.toFixed(1)}m`, 'success');
          lastToastLocationRef.current = { lat: latitude, lng: longitude };
        }

        // Fetch address only when moving >= 5.0 meters to prevent spamming OSM servers
        let shouldFetchAddr = false;
        if (!lastGeocodedLocationRef.current) {
          shouldFetchAddr = true;
        } else {
          const moveDistForGeo = calculateHaversineDistance(
            lastGeocodedLocationRef.current.lat,
            lastGeocodedLocationRef.current.lng,
            latitude,
            longitude
          );
          if (moveDistForGeo >= 5.0) {
            shouldFetchAddr = true;
          }
        }

        if (shouldFetchAddr) {
          lastGeocodedLocationRef.current = { lat: latitude, lng: longitude };
          fetchAddress(latitude, longitude, setUserAddress, setLoadingUserAddress, 'User');
        }
      },
      (err) => {
        let msg = "Lỗi lấy vị trí.";
        switch (err.code) {
          case err.PERMISSION_DENIED:
            msg = "Từ chối cấp quyền truy cập GPS. Vui lòng cấp quyền định vị.";
            break;
          case err.POSITION_UNAVAILABLE:
            msg = "Vị trí GPS không khả dụng (Không bắt được sóng vệ tinh/mạng).";
            break;
          case err.TIMEOUT:
            msg = "Quá thời gian tìm kiếm GPS.";
            break;
        }
        setError(msg);
        addLog(`Lỗi định vị: ${msg}`, 'error');

        Toast.show({
          icon: 'fail',
          content: msg,
        });
      },
      {
        enableHighAccuracy: true, // Use hardware GPS
        timeout: 15000,
        maximumAge: 0 // No cached GPS coordinates
      }
    );
  };

  useEffect(() => {
    requestGpsPermission();

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, [officeLocation.lat, officeLocation.lng, allowedRadius]); // Recalculate if geofence details change

  const renderContent = () => {
    if (activeTab === 'radar') {
      return (
        <RadarView
          userLocation={userLocation}
          officeLocation={officeLocation}
          distance={distance}
          isWithinFence={isWithinFence}
          allowedRadius={allowedRadius}
          userAddress={userAddress}
          loadingAddress={loadingUserAddress}
          gpsLogs={gpsLogs}
          error={error}
          requestGpsPermission={requestGpsPermission}
        />
      );
    }
    if (activeTab === 'settings') {
      return (
        <SettingsView
          officeLocation={officeLocation}
          setOfficeLocation={setOfficeLocation}
          allowedRadius={allowedRadius}
          setAllowedRadius={setAllowedRadius}
          officeAddress={officeAddress}
          loadingAddress={loadingOfficeAddress}
          userLocation={userLocation}
        />
      );
    }
    return null;
  };

  // Determine if active lock screen is required:
  // User GPS is loaded AND user is outside the allowed boundary (isWithinFence === false)
  const isLocked = userLocation && isWithinFence === false;

  return (
    <div className="app-container">
      <div className="phone-mockup">
        {/* If out of boundary, draw the fullscreen lock overlay screen */}
        {isLocked && (
          <LockOverlay
            distance={distance}
            allowedRadius={allowedRadius}
          />
        )}

        <div className="phone-screen">
          {/* App Header */}
          <div className="app-header">
            <h1 className="app-title">
              <Compass size={24} /> GEOFENCE RADAR
            </h1>
            <p className="app-subtitle">Hệ thống Giám sát Vị trí Thiết bị Thực tế</p>
          </div>

          {/* Core Content */}
          <div style={{ flexGrow: 1 }}>
            {renderContent()}
          </div>
        </div>

        {/* Tab Navigation */}
        <TabBar activeKey={activeTab} onChange={(key) => setActiveTab(key)}>
          <TabBar.Item
            key="radar"
            title="Màn hình Radar"
            icon={<Compass size={20} />}
          />
          <TabBar.Item
            key="settings"
            title="Cấu hình"
            icon={<Settings size={20} />}
          />
        </TabBar>
      </div>
    </div>
  );
}
