import React, { useRef, useEffect } from 'react';
import { Compass, Navigation, MapPin, RefreshCw } from 'lucide-react';
import { Button } from 'antd-mobile';

export default function RadarView({ 
  userLocation, 
  officeLocation, 
  distance, 
  isWithinFence, 
  allowedRadius,
  userAddress,
  loadingAddress,
  gpsLogs,
  error,
  requestGpsPermission
}) {
  const canvasRef = useRef(null);
  const sweepAngleRef = useRef(0);

  // Compute bearing between two coordinates
  const calculateBearing = (lat1, lon1, lat2, lon2) => {
    const toRad = (angle) => (angle * Math.PI) / 180;
    const toDeg = (angle) => (angle * 180) / Math.PI;

    const dLon = toRad(lon2 - lon1);
    const rLat1 = toRad(lat1);
    const rLat2 = toRad(lat2);

    const y = Math.sin(dLon) * Math.cos(rLat2);
    const x =
      Math.cos(rLat1) * Math.sin(rLat2) -
      Math.sin(rLat1) * Math.cos(rLat2) * Math.cos(dLon);

    let brng = Math.atan2(y, x);
    brng = toDeg(brng);
    return (brng + 360) % 360;
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    let animationFrameId;

    // Render loop
    const render = () => {
      // Clear canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const width = canvas.width;
      const height = canvas.height;
      const centerX = width / 2;
      const centerY = height / 2;
      const maxPixelRadius = (width / 2) * 0.82; // leaving margin for labels

      // Determine the scale dynamically
      // So both geofence boundary and user dot fit nicely
      const currentDistance = distance || 0;
      const maxDistanceVal = Math.max(allowedRadius * 1.4, currentDistance * 1.15, 30); // minimum scale is 30m

      // Draw background dark grid
      ctx.fillStyle = '#060913';
      ctx.fillRect(0, 0, width, height);

      // Draw concentric rings
      const rings = [0.25, 0.5, 0.75, 1.0];
      ctx.strokeStyle = 'rgba(59, 130, 246, 0.1)';
      ctx.lineWidth = 1;
      rings.forEach(ratio => {
        ctx.beginPath();
        ctx.arc(centerX, centerY, maxPixelRadius * ratio, 0, 2 * Math.PI);
        ctx.stroke();

        // Write distance grid text
        ctx.fillStyle = 'rgba(148, 163, 184, 0.4)';
        ctx.font = '9px Outfit, sans-serif';
        const labelDistance = (maxDistanceVal * ratio).toFixed(0);
        ctx.fillText(`${labelDistance}m`, centerX + 4, centerY - (maxPixelRadius * ratio) + 10);
      });

      // Draw crosshairs
      ctx.beginPath();
      ctx.moveTo(centerX - maxPixelRadius, centerY);
      ctx.lineTo(centerX + maxPixelRadius, centerY);
      ctx.moveTo(centerX, centerY - maxPixelRadius);
      ctx.lineTo(centerX, centerY + maxPixelRadius);
      ctx.strokeStyle = 'rgba(59, 130, 246, 0.08)';
      ctx.stroke();

      // Draw Geofence allowed circle boundary
      const fencePixelRadius = (allowedRadius / maxDistanceVal) * maxPixelRadius;
      ctx.beginPath();
      ctx.arc(centerX, centerY, fencePixelRadius, 0, 2 * Math.PI);
      if (isWithinFence) {
        ctx.strokeStyle = 'rgba(16, 185, 129, 0.5)'; // Safe green
        ctx.fillStyle = 'rgba(16, 185, 129, 0.03)';
      } else {
        ctx.strokeStyle = 'rgba(239, 68, 68, 0.4)'; // Out-of-bounds red
        ctx.fillStyle = 'rgba(239, 68, 68, 0.02)';
      }
      ctx.lineWidth = 2.5;
      ctx.fill();
      ctx.stroke();

      // Radar Sweep Animation Line
      sweepAngleRef.current = (sweepAngleRef.current + 1.2) % 360;
      const sweepRad = (sweepAngleRef.current * Math.PI) / 180;
      
      // Sweep gradient
      const sweepGradient = ctx.createRadialGradient(centerX, centerY, 5, centerX, centerY, maxPixelRadius);
      sweepGradient.addColorStop(0, 'rgba(59, 130, 246, 0.25)');
      sweepGradient.addColorStop(1, 'rgba(59, 130, 246, 0)');
      
      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.arc(
        centerX, 
        centerY, 
        maxPixelRadius, 
        sweepRad - (22 * Math.PI / 180), // wide angle trailing fade
        sweepRad, 
        false
      );
      ctx.closePath();
      ctx.fillStyle = 'rgba(59, 130, 246, 0.06)';
      ctx.fill();

      // Main sweep line
      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.lineTo(
        centerX + maxPixelRadius * Math.cos(sweepRad),
        centerY + maxPixelRadius * Math.sin(sweepRad)
      );
      ctx.strokeStyle = 'rgba(59, 130, 246, 0.4)';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Office Marker in Center
      ctx.fillStyle = '#ef4444'; // office red star/dot
      ctx.shadowBlur = 10;
      ctx.shadowColor = '#ef4444';
      ctx.beginPath();
      ctx.arc(centerX, centerY, 6, 0, 2 * Math.PI);
      ctx.fill();
      ctx.shadowBlur = 0; // reset shadow

      // Center label
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 9px Outfit, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText("VP Bến Tre", centerX, centerY - 10);

      // User location dot mapping
      if (userLocation) {
        const bearing = calculateBearing(
          officeLocation.lat,
          officeLocation.lng,
          userLocation.lat,
          userLocation.lng
        );

        // Convert bearing direction (0 is North) to canvas angle (0 is East)
        const userCanvasAngle = ((bearing - 90) * Math.PI) / 180;
        const userPixelDistance = (currentDistance / maxDistanceVal) * maxPixelRadius;

        const userX = centerX + userPixelDistance * Math.cos(userCanvasAngle);
        const userY = centerY + userPixelDistance * Math.sin(userCanvasAngle);

        // Accuracy Circle mapping
        if (userLocation.accuracy) {
          const accuracyPixelRadius = (userLocation.accuracy / maxDistanceVal) * maxPixelRadius;
          ctx.beginPath();
          ctx.arc(userX, userY, accuracyPixelRadius, 0, 2 * Math.PI);
          ctx.strokeStyle = isWithinFence ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.12)';
          ctx.fillStyle = isWithinFence ? 'rgba(16, 185, 129, 0.04)' : 'rgba(239, 68, 68, 0.03)';
          ctx.lineWidth = 1;
          ctx.fill();
          ctx.stroke();
        }

        // Draw User Marker
        const pulseRatio = (Math.sin(Date.now() / 250) + 1.2) / 2.2; // pulse effect
        const markerColor = isWithinFence ? '#10b981' : '#ef4444';
        
        ctx.shadowBlur = 12 * pulseRatio;
        ctx.shadowColor = markerColor;
        ctx.fillStyle = markerColor;
        ctx.beginPath();
        ctx.arc(userX, userY, 7, 0, 2 * Math.PI);
        ctx.fill();
        ctx.shadowBlur = 0; // reset

        // Inner glowing white core
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(userX, userY, 2.5, 0, 2 * Math.PI);
        ctx.fill();

        // Label user
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 9px Outfit, sans-serif';
        ctx.fillText("BẠN", userX, userY - 12);
      }

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [userLocation, officeLocation, distance, isWithinFence, allowedRadius]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Visual Canvas */}
      <div className="radar-display-wrapper">
        <canvas ref={canvasRef} id="radar-canvas" width={320} height={320} />
        
        {/* Visual Badges Over Canvas */}
        <div className="radar-badge-wrapper">
          <div className="mini-badge">
            <span className={`badge-dot ${isWithinFence ? 'success' : 'danger'}`} />
            {isWithinFence ? 'Trong vùng chọn' : 'Ngoài phạm vi'}
          </div>
          {userLocation && (
            <div className="mini-badge" style={{ fontFamily: 'monospace' }}>
              GPS: ±{userLocation.accuracy?.toFixed(1) || 0}m
            </div>
          )}
        </div>
      </div>

      {/* Geofence Status Section */}
      <div className="criteria-card" style={{ background: 'rgba(255, 255, 255, 0.02)', padding: '12px 15px', borderRadius: '12px', border: '1px solid rgba(255, 255, 255, 0.05)', marginBottom: '15px' }}>
        <div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Khoảng cách văn phòng</div>
          <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#fff', marginTop: '2px' }}>
            {distance !== null ? `${distance.toFixed(1)} m` : '---'}
          </div>
        </div>
        <div>
          <span className={`status-badge ${isWithinFence ? 'passed' : 'failed'}`}>
            {isWithinFence ? 'HỢP LỆ (GREEN)' : 'KHÔNG HỢP LỆ (RED)'}
          </span>
        </div>
      </div>

      {/* Real-time Address */}
      <div className="form-field" style={{ marginBottom: '15px' }}>
        <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
          <Navigation size={10} style={{ marginRight: '4px' }} /> Vị trí hiện tại của bạn:
        </label>
        <div className="display-box" style={{ background: 'rgba(10, 15, 28, 0.4)', minHeight: '44px', display: 'flex', alignItems: 'center' }}>
          {loadingAddress ? (
            <span style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.8rem' }}>
              <RefreshCw size={12} className="lock-icon-wrapper" style={{ animation: 'spin 1.5s linear infinite' }} />
              Đang xác định địa chỉ GPS...
            </span>
          ) : userAddress ? (
            <span style={{ fontSize: '0.8rem', color: '#fff' }}>{userAddress}</span>
          ) : error ? (
            <span style={{ color: 'var(--danger-color)', fontSize: '0.75rem' }}>{error}</span>
          ) : (
            <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>Đang đợi định vị GPS từ điện thoại...</span>
          )}
        </div>
      </div>

      {/* GPS Logs console */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
        <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Nhật ký định vị (Real-time GPS Logs)</span>
        {!userLocation && (
          <Button 
            size="mini" 
            color="primary"
            onClick={requestGpsPermission}
            style={{ fontSize: '0.7rem', padding: '3px 8px' }}
          >
            Kích hoạt GPS
          </Button>
        )}
      </div>
      
      <div className="console-logs-mobile">
        {gpsLogs.length === 0 ? (
          <div style={{ color: 'var(--text-muted)', fontStyle: 'italic', textAlign: 'center', marginTop: '40px' }}>
            Không có hoạt động. Vui lòng bật định vị GPS.
          </div>
        ) : (
          gpsLogs.map((log, index) => (
            <div key={index} className="console-line" style={{ color: log.type === 'error' ? 'var(--danger-color)' : log.type === 'warning' ? 'var(--warning-color)' : log.type === 'success' ? 'var(--success-color)' : 'var(--text-secondary)' }}>
              [{log.time}] {log.text}
            </div>
          ))
        )}
      </div>

      <style dangerouslySetInnerHTML={{__html: `
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}} />
    </div>
  );
}
