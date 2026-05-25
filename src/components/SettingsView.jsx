import React from 'react';
import { MapPin, Shield, RefreshCw } from 'lucide-react';
import { Input, Button, Slider, Toast } from 'antd-mobile';

export default function SettingsView({ 
  officeLocation, 
  setOfficeLocation, 
  allowedRadius, 
  setAllowedRadius,
  officeAddress,
  loadingAddress,
  fetchOfficeAddress,
  userLocation
}) {
  const handleResetOffice = () => {
    setOfficeLocation({ lat: 10.36727460696543, lng: 106.352052343414 });
    Toast.show({
      icon: 'success',
      content: 'Đã khôi phục vị trí cơ sở mặc định',
    });
  };

  const handleUseCurrentLocation = () => {
    if (!userLocation) {
      Toast.show({
        icon: 'fail',
        content: 'Chưa lấy được tọa độ GPS hiện tại của thiết bị!',
      });
      return;
    }
    setOfficeLocation({ lat: userLocation.lat, lng: userLocation.lng });
    Toast.show({
      icon: 'success',
      content: 'Đã đặt vị trí hiện tại làm chuẩn kiểm thử',
    });
  };

  return (
    <div className="glass-panel" style={{ marginTop: '5px' }}>
      <h3>
        <Shield size={18} />
        Cấu hình Geofencing
      </h3>

      {/* Allowed Radius Settings */}
      <div className="form-field">
        <label>
          Bán kính vùng chọn (m): <span style={{ color: 'var(--accent-color)', fontWeight: 700, fontSize: '0.85rem' }}>{allowedRadius} mét</span>
        </label>
        <div style={{ padding: '10px 5px' }}>
          <Slider
            min={10}
            max={500}
            step={5}
            value={allowedRadius}
            onChange={(val) => setAllowedRadius(val)}
          />
        </div>
      </div>

      {/* Base GPS Coordinates */}
      <div className="form-field">
        <label>
          <MapPin size={12} /> Vĩ độ vị trí cơ sở
        </label>
        <input
          type="number"
          className="form-input-box"
          value={officeLocation.lat}
          onChange={(e) => setOfficeLocation(prev => ({ ...prev, lat: parseFloat(e.target.value) || 0 }))}
          step="0.00000001"
        />
      </div>

      <div className="form-field">
        <label>
          <MapPin size={12} /> Kinh độ vị trí cơ sở
        </label>
        <input
          type="number"
          className="form-input-box"
          value={officeLocation.lng}
          onChange={(e) => setOfficeLocation(prev => ({ ...prev, lng: parseFloat(e.target.value) || 0 }))}
          step="0.00000001"
        />
      </div>

      {/* Address */}
      <div className="form-field">
        <label>Địa chỉ cơ sở (Nominatim API):</label>
        <div className="display-box">
          {loadingAddress ? (
            <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <RefreshCw size={12} className="lock-icon-wrapper" style={{ animation: 'spin 1.5s linear infinite' }} />
              Đang tra cứu địa chỉ...
            </span>
          ) : officeAddress ? (
            officeAddress
          ) : (
            'Không tìm thấy thông tin địa chỉ.'
          )}
        </div>
      </div>

      {/* Action Buttons */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '15px' }}>
        <Button 
          block 
          color="primary" 
          onClick={handleUseCurrentLocation}
          style={{ fontSize: '0.85rem', height: '36px' }}
        >
          Đặt GPS hiện tại làm chuẩn
        </Button>
        <Button 
          block 
          onClick={handleResetOffice}
          style={{ fontSize: '0.85rem', height: '36px', background: 'rgba(255, 255, 255, 0.05)', color: '#fff', border: '1px solid rgba(255, 255, 255, 0.1)' }}
        >
          Khôi phục vị trí cơ sở mặc định
        </Button>
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
