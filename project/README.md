# KyotoSubway — Shortest Path Finder

Ứng dụng web tìm đường đi ngắn nhất trên hệ thống đường sắt Kyoto (tàu điện ngầm, tàu hỏa, xe điện), sử dụng thuật toán Dijkstra trên dữ liệu OpenStreetMap.

## Kiến trúc

```
project/
├── backend/          # Flask API server
│   ├── app.py        # App factory
│   ├── config.py     # Cấu hình (dev/prod/test)
│   ├── models/       # SubwayGraph dataclass
│   ├── services/     # Dijkstra, OSM loader
│   ├── routes/       # API endpoints
│   ├── utils/        # Haversine, validation
│   └── scripts/      # Overpass API fetcher
├── frontend/         # Leaflet.js SPA
│   ├── index.html
│   ├── css/
│   └── js/
├── data/             # Dữ liệu OSM (không commit)
├── tests/            # Unit + integration tests
├── Dockerfile
└── docker-compose.yml
```

## Cài đặt

```bash
# 1. Tạo virtual environment
python -m venv .venv
source .venv/bin/activate  # Linux/Mac
# .venv\Scripts\activate   # Windows

# 2. Cài đặt dependencies
make install

# 3. Tải dữ liệu từ Overpass API (chạy lần đầu)
make fetch-data

# 4. Cấu hình environment
cp .env.example .env

# 5. Chạy server
make run
```

Mở trình duyệt tại `http://localhost:5000`

## Sử dụng

1. Bấm nút **"Tìm đường"**
2. Chọn 2 điểm trên bản đồ (hoặc bấm vào các trạm/điểm dừng)
3. Đường đi ngắn nhất sẽ được vẽ bằng đường xanh lá

## API

| Method | Endpoint | Mô tả |
|--------|----------|-------|
| `POST` | `/api/v1/pathfind` | Tìm đường ngắn nhất giữa 2 tọa độ |
| `GET`  | `/api/v1/map-data` | Lấy dữ liệu bản đồ OSM |

### `POST /api/v1/pathfind`

**Request:**
```json
{
  "start": [35.0116, 135.7681],
  "end": [34.9850, 135.7590]
}
```

**Response (200):**
```json
{
  "path": [[[35.0116, 135.7681], "Kyoto"], [[34.99, 135.76], null], ...],
  "distance_meters": 3456.78
}
```

## Docker

```bash
# Build và chạy
make docker-up

# Dừng
make docker-down
```

## Chạy test

```bash
make test
```

## Tech Stack

- **Backend**: Python, Flask, flask-cors
- **Thuật toán**: Dijkstra (min-heap), Haversine distance
- **Frontend**: Leaflet.js (vanilla JS modules)
- **Dữ liệu**: OpenStreetMap (Overpass API)
- **Deployment**: Docker, Gunicorn
