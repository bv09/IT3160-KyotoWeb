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
    # BƯỚC 3: CHUẨN HÓA GA MỒ CÔI (CHỈ NỐI GA VÀO ĐƯỜNG RAY)
    # =====================================================================
    station_ids = [n_id for n_id, data in nodes_info.items() if data['is_station']]
    
    for station_id in station_ids:
        # Nếu ga này đang bị cô lập (chưa nằm trên bất kỳ đường ray nào)
        if not graph[station_id]: 
            min_dist = float('inf')
            closest_track_node = None
            
            # Quét tìm 1 điểm ĐƯỜNG RAY gần cái ga này nhất
            for node_id, edges in graph.items():
                # Điều kiện 'edges': Đảm bảo điểm kia ĐÃ NẰM TRÊN ĐƯỜNG RAY (có kết nối)
                if edges and node_id != station_id: 
                    dist = calculate_distance(
                        nodes_info[station_id]['lat'], nodes_info[station_id]['lon'],
                        nodes_info[node_id]['lat'], nodes_info[node_id]['lon']
                    )
                    if dist < min_dist:
                        min_dist = dist
                        closest_track_node = node_id
            
            # Kéo 1 nét nối từ Ga cắm thẳng vào điểm Đường Ray đó (giới hạn < 200m để không nối bậy)
            if closest_track_node and min_dist < 200:
                graph[station_id][closest_track_node] = min_dist
                graph[closest_track_node][station_id] = min_dist
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