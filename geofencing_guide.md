# Hướng dẫn Kỹ thuật: Tính toán Vị trí & Khoảng cách GPS không dùng Thư viện thứ 3

Tài liệu này giải thích chi tiết phương pháp kỹ thuật được sử dụng trong ứng dụng để lấy vị trí thiết bị, tính toán khoảng cách và xác định góc phương vị phục vụ vẽ Radar hiển thị mà không sử dụng bất kỳ thư viện bản đồ nào (như Leaflet, Google Maps API, turf.js).

---

## 1. Lấy Vị trí Thiết bị bằng HTML5 Geolocation API

Trình duyệt hiện đại cung cấp sẵn API định vị phần cứng trực tiếp từ thiết bị (GPS, Wi-Fi, Cell Tower).

### Lấy vị trí một lần (Single Query)
Sử dụng `navigator.geolocation.getCurrentPosition` để lấy tọa độ hiện tại:
```javascript
navigator.geolocation.getCurrentPosition(
  (position) => {
    const lat = position.coords.latitude;
    const lng = position.coords.longitude;
    const accuracy = position.coords.accuracy; // độ chính xác tính bằng mét
    console.log(`Vĩ độ: ${lat}, Kinh độ: ${lng}, Độ chính xác: ${accuracy}m`);
  },
  (error) => {
    console.error("Lỗi lấy vị trí:", error.message);
  },
  {
    enableHighAccuracy: true, // Yêu cầu sử dụng GPS phần cứng cho độ chính xác cao nhất
    timeout: 10000,           // Thời gian chờ tối đa 10 giây
    maximumAge: 0             // Không sử dụng vị trí lưu trong bộ nhớ đệm
  }
);
```

### Theo dõi vị trí liên tục (Real-time Tracking)
Để theo dõi sự thay đổi vị trí của người dùng khi di chuyển, chúng ta sử dụng `navigator.geolocation.watchPosition`. Hàm này trả về một `watchId` dùng để hủy theo dõi khi cần:
```javascript
const watchId = navigator.geolocation.watchPosition(
  (position) => {
    const { latitude, longitude } = position.coords;
    // Xử lý vị trí mới ở đây (so sánh khoảng cách, cập nhật UI...)
  },
  (error) => console.error(error),
  { enableHighAccuracy: true, maximumAge: 0 }
);

// Hủy theo dõi khi hủy mount component
// navigator.geolocation.clearWatch(watchId);
```

---

## 2. Tính Khoảng cách giữa 2 Điểm (Công thức Haversine)

Do Trái Đất có hình cầu (hoặc gần hình cầu), chúng ta không thể sử dụng công thức khoảng cách Euclide (Pythagoras) thông thường cho tọa độ độ/phút/giây vì khoảng cách giữa các kinh tuyến co lại khi đi về phía hai cực.

Công thức **Haversine** được sử dụng để tính toán khoảng cách đường cong ngắn nhất giữa hai điểm trên mặt cầu (Great-Circle Distance):

### Công thức Toán học:
$$a = \sin^2\left(\frac{\Delta\varphi}{2}\right) + \cos(\varphi_1) \cdot \cos(\varphi_2) \cdot \sin^2\left(\frac{\Delta\lambda}{2}\right)$$
$$c = 2 \cdot \operatorname{atan2}\left(\sqrt{a}, \sqrt{1-a}\right)$$
$$d = R \cdot c$$

Trong đó:
* $\varphi_1, \varphi_2$ là vĩ độ của điểm 1 và điểm 2 (đổi sang đơn vị Radian).
* $\Delta\varphi = \varphi_2 - \varphi_1$ (hiệu vĩ độ tính bằng Radian).
* $\Delta\lambda = \lambda_2 - \lambda_1$ (hiệu kinh độ tính bằng Radian).
* $R$ là bán kính trung bình của Trái Đất ($R \approx 6,371,000$ mét hoặc $6,371$ km).
* $d$ là khoảng cách thực tế giữa 2 điểm (mét).

### Triển khai trong Javascript:
```javascript
function calculateHaversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371000; // Bán kính Trái Đất tính bằng mét
  
  // Chuyển đổi độ sang radian
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
  
  return R * c; // Trả về khoảng cách tính bằng mét
}
```

---

## 3. Xác định Vùng Chặn Địa lý (Geofencing Radius)

Để kiểm tra xem người dùng có nằm trong vùng hợp lệ (ví dụ: vị trí cơ sở) hay không:
```javascript
const distance = calculateHaversineDistance(userLat, userLng, officeLat, officeLng);

if (distance <= allowedRadius) {
  console.log("HỢP LỆ: Người dùng nằm trong bán kính cho phép.");
} else {
  console.log("KHÔNG HỢP LỆ: Người dùng đã vượt ra ngoài phạm vi.");
}
```

---

## 4. Tính toán Góc phương vị (Bearing) để Vẽ Radar Canvas

Để hiển thị chấm đỏ/xanh biểu diễn vị trí người dùng xung quanh hồng tâm (vị trí cơ sở) trên màn hình radar 2D, chúng ta cần xác định hướng đi từ vị trí cơ sở tới vị trí người dùng. Hướng đi này gọi là **Góc phương vị (Bearing)** (tính bằng độ từ $0^\circ$ đến $360^\circ$, với $0^\circ$ là hướng Bắc, $90^\circ$ hướng Đông, v.v.).

### Công thức Toán học:
$$\theta = \operatorname{atan2}\left(\sin(\Delta\lambda) \cdot \cos(\varphi_2), \cos(\varphi_1) \cdot \sin(\varphi_2) - \sin(\varphi_1) \cdot \cos(\varphi_2) \cdot \cos(\Delta\lambda)\right)$$

### Triển khai trong Javascript:
```javascript
function calculateBearing(lat1, lon1, lat2, lon2) {
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
  
  // Chuẩn hóa góc về khoảng 0° đến 360°
  return (brng + 360) % 360;
}
```

### Vẽ lên Canvas:
Khi đã có `distance` (khoảng cách thực tế) và `bearing` (góc phương vị):
1. **Tính tỷ lệ hiển thị (Scaling)**: Giả sử bán kính vẽ lớn nhất trên Canvas là `maxPixelRadius` (ví dụ: 150px) tương ứng với bán kính quét lớn nhất `maxDistance` (ví dụ: gấp 1.5 hoặc 2 lần bán kính cấu hình).
   $$\text{pixelDistance} = \frac{\text{distance}}{\text{maxDistance}} \cdot \text{maxPixelRadius}$$
2. **Chuyển đổi góc về Hệ tọa độ Canvas**:
   * Trên Canvas, góc $0$ nằm ở trục X (hướng Đông) và tăng theo chiều kim đồng hồ.
   * Góc phương vị thực tế bắt đầu bằng $0$ ở hướng Bắc (trục Y hướng lên) và tăng theo chiều kim đồng hồ.
   * Để chuyển đổi: $\alpha_{\text{canvas}} = \text{bearing} - 90^\circ$ (chuyển sang Radian bằng cách nhân $\pi/180$).
3. **Tính tọa độ $X, Y$ trên Canvas**:
   $$X = \text{centerX} + \text{pixelDistance} \cdot \cos(\alpha_{\text{canvas}})$$
   $$Y = \text{centerY} + \text{pixelDistance} \cdot \sin(\alpha_{\text{canvas}})$$
