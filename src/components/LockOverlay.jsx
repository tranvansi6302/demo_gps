import React from 'react';
import { Lock } from 'lucide-react';

export default function LockOverlay({ distance, allowedRadius }) {
  const diff = (distance - allowedRadius).toFixed(1);

  return (
    <div className="session-lock-screen">
      <div className="lock-card">
        <div className="lock-icon-wrapper">
          <Lock size={64} strokeWidth={1.5} />
        </div>
        <h2 className="status-title" style={{ color: 'var(--danger-color)', margin: '10px 0' }}>
          ĐÃ KHÓA TRUY CẬP
        </h2>
        <p className="status-desc" style={{ color: 'var(--text-primary)', fontWeight: 500 }}>
          Vị trí thiết bị nằm ngoài bán kính cho phép của văn phòng!
        </p>
        <div 
          className="display-box" 
          style={{ 
            background: 'rgba(239, 68, 68, 0.1)', 
            border: '1px solid rgba(239, 68, 68, 0.2)', 
            color: 'var(--danger-color)',
            fontSize: '0.9rem',
            padding: '10px 15px',
            margin: '10px 0',
            width: '100%'
          }}
        >
          Khoảng cách: <strong>{distance.toFixed(1)} m</strong>
          <br />
          Bán kính tối đa: <strong>{allowedRadius} m</strong>
          <br />
          Cần di chuyển lại gần thêm: <strong>{diff} m</strong>
        </div>
        <p className="status-desc" style={{ fontSize: '0.75rem' }}>
          Ứng dụng sẽ tự động mở khóa khi bạn quay trở lại khu vực văn phòng.
        </p>
      </div>
    </div>
  );
}
