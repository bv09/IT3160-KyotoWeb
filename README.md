# 🚇 KyotoWeb — Kyoto Path Finder

> **IT3160 — Introduction to AI** | Ứng dụng web tìm đường đi ngắn nhất trên hệ thống giao thông công cộng Kyoto (tàu điện ngầm, tàu hỏa, xe điện) sử dụng thuật toán **A\*** trên dữ liệu thực từ OpenStreetMap.

---

## 📋 Mục lục

- [Giới thiệu](#giới-thiệu)
- [Tính năng](#tính-năng)
- [Kiến trúc hệ thống](#kiến-trúc-hệ-thống)
- [Tech Stack](#tech-stack)
- [Cài đặt & Chạy](#cài-đặt--chạy)
- [API Reference](#api-reference)
- [Cấu trúc thư mục](#cấu-trúc-thư-mục)
- [Docker](#docker)

---

## Giới thiệu

KyotoWeb là một Application cho phép người dùng tìm tuyến đường tối ưu trên mạng lưới giao thông công cộng thành phố Kyoto. Hệ thống sử dụng dữ liệu thực từ **OpenStreetMap** (qua Overpass API) và cung cấp đồng thời hai phương án di chuyển:

- **Đường đi ngắn nhất** — tối ưu theo tổng khoảng cách (mét).
- **Đường đi nhanh nhất** — tối ưu theo thời gian di chuyển (phút)

---

## Tính năng

- 🗺️ **Bản đồ tương tác** toàn màn hình với Leaflet, hiển thị đầy đủ nodes, edges và tuyến đường được tính.
- 🔍 **Tìm đường thông minh** — click trực tiếp trên bản đồ để chọn điểm đi/đến; backend tự động snap về node gần nhất qua KD-Tree.
- ⚖️ **Hai chế độ tối ưu** — xem song song tuyến ngắn nhất và nhanh nhất trên cùng một màn hình.
- 🚧 **Sandbox mô phỏng sự cố** — toggle trạng thái blocked cho từng trạm để quan sát cách thuật toán tái định tuyến (rerouting).
- 📱 **Responsive** — giao diện sidebar trên desktop, bottom sheet trên mobile.
- ⏱️ Ước tính thời gian di chuyển tự động (tách biệt đoạn đi tàu và đi bộ).

---

## Kiến trúc hệ thống

```
┌─────────────────────────────────────────────────────────────┐
│                        CLIENT (Browser)                      │
│   React + Vite + TypeScript + React-Leaflet + shadcn/ui     │
│   └─ Gọi REST API → hiển thị tuyến đường trên bản đồ       │
└──────────────────────────┬──────────────────────────────────┘
                           │ HTTP (JSON)
┌──────────────────────────▼──────────────────────────────────┐
│                   BACKEND (Flask API)                        │
│   ┌─────────────┐  ┌────────────────┐  ┌────────────────┐  │
│   │  OSM Loader │  │  SubwayGraph   │  │  A* Pathfinder │  │
│   │  (Overpass) │→ │  (Adjacency    │→ │  (Haversine    │  │
│   │             │  │   List + KD-T) │  │   heuristic)   │  │
│   └─────────────┘  └────────────────┘  └────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────┐
│              DATA (OpenStreetMap / Overpass API)             │
│              data/raw_osm_data.json (cached local)          │
└─────────────────────────────────────────────────────────────┘
```

### Thuật toán tìm đường

Backend sử dụng **A\*** với heuristic Haversine thay vì Dijkstra thuần túy:

| Chế độ | Hàm chi phí | Heuristic |
|--------|-------------|-----------|
| Ngắn nhất | Khoảng cách Haversine (m) | `h = haversine(current, end)` |
| Nhanh nhất | Thời gian di chuyển (phút) | `h = haversine(current, end) / 500` *(30 km/h)* |

Heuristic **admissible** — không bao giờ overestimate — đảm bảo kết quả tối ưu toàn cục.

---

## Tech Stack

| Layer | Công nghệ |
|-------|-----------|
| **Frontend** | React 19, TypeScript, Vite 6 |
| **UI** | Tailwind CSS, shadcn/ui, Framer Motion |
| **Bản đồ** | Leaflet, React-Leaflet |
| **Backend** | Python, Flask, flask-cors |
| **Thuật toán** | A* (Haversine heuristic), KD-Tree (spatial index) |
| **Dữ liệu** | OpenStreetMap (Overpass API) |
| **Deployment** | Docker, Gunicorn |

---

## Cài đặt & Chạy

### Yêu cầu

- Python ≥ 3.11 
- Node.js ≥ 18
- (Tuỳ chọn) Docker & Docker Compose

### Backend

```bash
cd project

# 1. Tạo virtual environment
python -m venv .venv
source .venv/bin/activate      # Linux/macOS
# .venv\Scripts\activate       # Windows

# 2. Cài đặt dependencies
make install

# 3. Cấu hình biến môi trường
cp .env.example .env
# Chỉnh sửa .env nếu cần (DATA_FILE, PORT, ...)

# 4. Tải dữ liệu OSM từ Overpass API (chỉ cần chạy lần đầu)
make fetch-data

# 5. Khởi chạy server
make run
```

API server sẽ chạy tại: `http://localhost:5010`

### Frontend

```bash
# Di chuyển vào thư mục frontend
cd project/frontend-v2

# Cài đặt dependencies
npm install

# Chạy development server
npm run dev
```

Truy cập ứng dụng tại: `http://localhost:5173`

### Cách sử dụng

1. Mở ứng dụng trên trình duyệt.
2. **Click chuột phải** trên bản đồ để chọn **điểm xuất phát** và **điểm đến**.
3. (Tuỳ chọn) Chọn **Disable/Enable Station Mode** để click vào trạm và toggle trạng thái blocked, quan sát quá trình tái định tuyến.

---

## API Reference

Base URL: `http://localhost:5010`

### `POST /api/v1/pathfind`

Tìm đồng thời đường đi ngắn nhất và nhanh nhất giữa hai toạ độ.

**Request Body:**
```json
{
  "start": [35.0116, 135.7681],
  "end":   [34.9850, 135.7590]
}
```

**Response `200 OK`:**
```json
{
  "shortest": {
    "path": [[[35.0116, 135.7681], "Kyoto Station", "station"], ...],
    "distance_meters": 3456.78,
    "estimate_time": 12.5
  },
  "fastest": {
    "path": [...],
    "distance_meters": 4100.0,
    "estimate_time": 9.2
  }
}
```
---

### `GET /api/v1/map-data`

Trả về toàn bộ dữ liệu OSM thô (nodes, edges) để frontend vẽ bản đồ.

---

### `GET /api/v1/graph-edges`

Trả về danh sách edges tĩnh của đồ thị (dùng cho hiển thị lớp đường ray).

---

### `POST /api/v1/toggle-node`

Chặn / bỏ chặn một node (trạm) trong đồ thị.

**Request Body:**
```json
{ "node_id": 12345678 }
```

---

### `POST /api/v1/unblock-all`

Bỏ chặn toàn bộ các node đang bị blocked — reset mạng lưới về trạng thái ban đầu.

---

## Cấu trúc thư mục

```
IT3160-KyotoWeb/
├── docs/                        # Tài liệu thiết kế & kế hoạch
│   ├── Plan.md
│   ├── implementation_plan.md
│   └── task.md
└── project/
    ├── .env.example             # Mẫu biến môi trường
    ├── Dockerfile
    ├── docker-compose.yml
    ├── Makefile                 # Các lệnh tắt (install, run, test, ...)
    ├── backend/
    │   ├── app.py               # App factory (Flask)
    │   ├── config.py            # Cấu hình dev / prod / test
    │   ├── models/
    │   │   └── graph.py         # SubwayGraph dataclass
    │   ├── routes/
    │   │   └── api.py           # Tất cả API endpoints
    │   ├── services/
    │   │   ├── osm_loader.py    # Parse & build graph từ OSM JSON
    │   │   └── pathfinding.py   # A* (shortest + fastest)
    │   ├── scripts/
    │   │   └── fetch_data.py    # Tải dữ liệu từ Overpass API
    │   └── utils/
    │       ├── geo.py           # Haversine distance
    │       ├── nearest_points.py# KD-Tree spatial index
    │       ├── convert_to_time.py
    │       └── validation.py
    └── frontend-v2/             # React SPA
        ├── src/
        │   ├── components/
        │   │   ├── layout/      # Sidebar, MobileSheet
        │   │   ├── map/         # MapCanvas, MapContextMenu, StationMarker, ...
        │   │   ├── route/       # RouteSearch, RouteCard, RouteTimeline
        │   │   ├── station/     # StationManager (Sandbox mode)
        │   │   └── ui/          # shadcn/ui components
        │   ├── context/
        │   │   └── AppContext.tsx# Global state (React Context)
        │   ├── lib/
        │   │   └── api.ts       # Wrapper gọi backend API
        │   └── types/
        │       └── index.ts     # TypeScript type definitions
        └── package.json
```

---

## Docker

Cách nhanh nhất để chạy toàn bộ ứng dụng:

```bash
cd project

# Build image và khởi chạy container
make docker-up

# Kiểm tra logs
docker-compose logs -f

# Dừng và xoá container
make docker-down
```

---

## Biến môi trường

Tham khảo file `.env.example`:

| Biến | Mặc định | Mô tả |
|------|----------|-------|
| `FLASK_ENV` | `development` | Môi trường chạy (`development` / `production`) |
| `FLASK_DEBUG` | `1` | Bật debug mode |
| `DATA_FILE` | `data/raw_osm_data.json` | Đường dẫn tới file dữ liệu OSM |
| `HOST` | `0.0.0.0` | Host bind cho Flask server |
| `PORT` | `5010` | Port của backend server |

---

## Môn học

**IT3160 — Introduction to Artificial Intelligence**  
Trường Đại học Bách Khoa Hà Nội (HUST)
