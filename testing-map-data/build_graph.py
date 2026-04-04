import json
import math

def calculate_distance(lat1, lon1, lat2, lon2):
    R = 6371e3 # Bán kính Trái Đất (mét)
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)

    a = math.sin(delta_phi / 2.0) ** 2 + \
        math.cos(phi1) * math.cos(phi2) * \
        math.sin(delta_lambda / 2.0) ** 2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    
    return R * c 

def buildGraph(osm_data):
    graph = {}
    nodes_info = {}

    # Bước 1: Trích xuất thông tin tọa độ và lọc tên Trạm
    for element in osm_data.get('elements', []):
        if element['type'] == 'node':
            node_id = str(element['id'])
            
            # Khởi tạo thông tin cơ bản cho mọi node
            node_data = {
                'lat': element['lat'],
                'lon': element['lon'],
                'is_station': False # Mặc định gán là False
            }
            
            # Kiểm tra xem node này có chứa 'tags' (thông tin chi tiết) hay không
            if 'tags' in element:
                tags = element['tags']
                
                # Nếu node này được đánh dấu là nhà ga
                if tags.get('railway') == 'station':
                    node_data['is_station'] = True
                    # Ưu tiên lấy tên tiếng Anh, nếu không có thì lấy tên tiếng Nhật
                    node_data['name'] = tags.get('name:en', tags.get('name', 'Unknown Station'))

            nodes_info[node_id] = node_data
            graph[node_id] = {} 

    # Bước 2: Xây dựng các cạnh (edges) từ ways
    for element in osm_data.get('elements', []):
        if element['type'] == 'way':
            node_refs = [str(n) for n in element.get('nodes', [])]
            
            for i in range(len(node_refs) - 1):
                u = node_refs[i]
                v = node_refs[i + 1]

                if u in nodes_info and v in nodes_info:
                    weight = calculate_distance(
                        nodes_info[u]['lat'], nodes_info[u]['lon'],
                        nodes_info[v]['lat'], nodes_info[v]['lon']
                    )

                    graph[u][v] = weight
                    graph[v][u] = weight
# =====================================================================
    # BƯỚC 3 NÂNG CẤP: MÔ HÌNH TRẠM MẸ - TRẠM CON (1 GA NHIỀU ĐƯỜNG RAY)
    # =====================================================================
    station_ids = [n_id for n_id, data in nodes_info.items() if data['is_station']]
    
    # Bán kính phủ sóng của nhà ga (tính bằng mét). Ga lớn có thể set 60m - 100m.
    STATION_RADIUS = 60 

    for station_id in station_ids:
        # Không cần check ga mồ côi nữa, ta sẽ quét quét mọi ga để tìm các Platform của nó
        found_platforms = False
        
        for track_node_id, edges in graph.items():
            # Đảm bảo node kia là một thanh ray đang hoạt động (có kết nối) và không phải chính nó
            if edges and track_node_id != station_id: 
                dist = calculate_distance(
                    nodes_info[station_id]['lat'], nodes_info[station_id]['lon'],
                    nodes_info[track_node_id]['lat'], nodes_info[track_node_id]['lon']
                )
                
                # Nếu thanh ray này nằm trọn trong khuôn viên nhà ga (<= 60 mét)
                if dist <= STATION_RADIUS:
                    # Kéo 1 nét nối (đi bộ trung chuyển) từ Sảnh Ga (Mẹ) xuống Nền Đường Ray (Con)
                    graph[station_id][track_node_id] = dist
                    graph[track_node_id][station_id] = dist
                    found_platforms = True
        
        # Fallback (Phòng hờ): Nhỡ cái ga nào nằm trơ trọi, cách đường ray tới 150m (do data OSM lỗi)
        # Thì ta vẫn phải dùng logic cũ: Tìm 1 thằng gần nhất để vớt nó vào đồ thị
        if not found_platforms:
            min_dist = float('inf')
            closest_track = None
            for track_node_id, edges in graph.items():
                if edges and track_node_id != station_id:
                    dist = calculate_distance(
                        nodes_info[station_id]['lat'], nodes_info[station_id]['lon'],
                        nodes_info[track_node_id]['lat'], nodes_info[track_node_id]['lon']
                    )
                    if dist < min_dist:
                        min_dist = dist
                        closest_track = track_node_id
            
            if closest_track and min_dist < 300: # Ngưỡng vớt tối đa 300m
                graph[station_id][closest_track] = min_dist
                graph[closest_track][station_id] = min_dist
    return graph, nodes_info

def exportGraph(graph, nodes_info, filename="kyoto_graph_weight_ver1.json"):
    output_data = {
        "nodes": nodes_info,
        "adjacency_list": graph
    }
    
    with open(filename, 'w', encoding='utf-8') as f:
        json.dump(output_data, f, ensure_ascii=False, indent=4)
        
    print(f"✅ Đã xuất đồ thị thành công ra file: {filename}")

if __name__ == "__main__":
    input_file = "raw_osm_data.json"
    
    try:
        print(f"Đang đọc dữ liệu từ {input_file}...")
        with open(input_file, 'r', encoding='utf-8') as f:
            raw_osm_data = json.load(f)
            
        print("Đang xây dựng Adjacency List và lọc tên trạm...")
        graph, nodes_info = buildGraph(raw_osm_data)
        
        exportGraph(graph, nodes_info)
        
    except FileNotFoundError:
        print(f"❌ Không tìm thấy file '{input_file}'. Bạn cần chạy file 'fetch_data.py' trước!")