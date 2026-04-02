# 📌 PROJECT: HỆ THỐNG TÌM ĐƯỜNG TRÊN BẢN ĐỒ KYOTO (RAILWAY)

---

# 🔥 1. MỤC TIÊU PROJECT

Xây dựng hệ thống cho phép:

* USER: tìm đường đi từ điểm A → B trên mạng lưới đường ray Kyoto
* ADMIN: tạo tình huống (đóng ga / tuyến không sử dụng)
* Hiển thị kết quả trực quan trên bản đồ

---

# 🔥 2. KIẾN TRÚC HỆ THỐNG

```
Frontend (HTML + JS + Map)
        ↓
API (Flask - Python)
        ↓
Thuật toán (Dijkstra / A*)
        ↓
Dữ liệu (graph.json + scenario.json)
```

---

# 🔥 3. WORKFLOW CHÍNH

## 🧩 Giai đoạn 1: Chuẩn bị dữ liệu

1. Lấy dữ liệu từ OpenStreetMap (Overpass API)

2. Dữ liệu gồm:

   * node (tọa độ)
   * way (đường nối các node)

3. Convert → graph

```
node + way → graph (adjacency list)
```

4. Lưu thành:

```
graph.json
```

---

## ⚙️ Giai đoạn 2: Backend

1. Load graph:

```
graph = load_graph()
```

2. Apply scenario:

```
remove node bị đóng
```

3. Chạy thuật toán:

* Dijkstra (bắt buộc)
* A* (optional)

4. Trả kết quả:

```json
{
  "path": [1, 5, 10],
  "distance": 12.3
}
```

---

## 🎨 Giai đoạn 3: Frontend

1. Hiển thị bản đồ Kyoto
2. Chọn điểm A, B
3. Gửi request:

```
fetch("/find-path")
```

4. Nhận dữ liệu và vẽ đường

---

## 👑 Giai đoạn 4: Admin

1. Chọn ga / tuyến cần đóng
2. Gửi request:

```
/close-station
```

3. Backend update:

```
scenario.json
```

4. User tìm lại đường → kết quả thay đổi

---

# 🔥 4. PHÂN CÔNG CÔNG VIỆC (6 NGƯỜI)

---

## 👨‍💻 BACKEND (3 người)

### 🔹 BE1 – Data & Graph

* Lấy dữ liệu OSM
* Viết buildGraph()
* Xuất graph.json

---

### 🔹 BE2 – Algorithm

* Cài đặt Dijkstra
* (Optional) A*
* Test path

---

### 🔹 BE3 – API & Scenario

* Viết Flask API:

  * /find-path
  * /close-station
* Load graph
* Apply scenario

---

## 🎨 FRONTEND (3 người)

---

### 🔹 FE1 – UI

* Form chọn điểm A, B
* Nút Find Path

---

### 🔹 FE2 – Map

* Hiển thị bản đồ
* Vẽ marker
* Vẽ đường đi

---

### 🔹 FE3 – Admin UI

* Giao diện admin
* Nút đóng/mở ga
* Gọi API

---

# 🔥 5. LUỒNG HOẠT ĐỘNG

## USER

```
Chọn A, B
   ↓
Gửi request
   ↓
Backend tính toán
   ↓
Trả path
   ↓
Frontend vẽ đường
```

---

## ADMIN

```
Đóng ga
   ↓
Update scenario
   ↓
User tìm lại đường
   ↓
Path thay đổi
```

---

# 🔥 6. FILE CẦN THIẾT

```
backend/
  app.py
  algorithm/
    dijkstra.py
    astar.py
  data/
    graph.json
    scenario.json

frontend/
  index.html
  admin.html
  script.js
  style.css
```

---

# 🔥 7. THỨ TỰ TRIỂN KHAI (QUAN TRỌNG)

1. Build graph.json
2. Code thuật toán
3. Tạo API Flask
4. Làm frontend (mock data)
5. Nối frontend với backend

---

# 🔥 8. KẾT LUẬN

Project gồm 3 phần chính:

* Data (graph)
* Backend (logic + API)
* Frontend (UI + map)

Trọng tâm:

```
Graph → Thuật toán → API → Hiển thị
```

Nếu làm đúng workflow, hệ thống sẽ hoạt động ổn định và dễ mở rộng.

---
