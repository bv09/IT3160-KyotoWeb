import json
import heapq

# 1. Hàm tìm ID của ga dựa vào tên (Vì nhập ID bằng tay rất khó nhớ)
def get_station_id_by_name(nodes_info, station_name):
    # Tìm kiếm không phân biệt hoa thường
    search_name = station_name.lower()
    for node_id, data in nodes_info.items():
        if data.get('is_station'):
            name = data.get('name', '').lower()
            if search_name in name:
                return node_id, data.get('name')
    return None, None

# 2. Thuật toán Dijkstra tìm đường đi ngắn nhất
def find_shortest_path(adjacency_list, start_id, end_id):
    # Khởi tạo khoảng cách đến tất cả các đỉnh là vô cực
    distances = {node: float('infinity') for node in adjacency_list}
    distances[start_id] = 0
    
    # Hàng đợi ưu tiên lưu các tuple: (khoảng_cách_tích_lũy, ID_đỉnh)
    pq = [(0, start_id)]
    
    # Dictionary lưu dấu vết đường đi: đỉnh_hiện_tại -> đỉnh_trước_đó
    previous_nodes = {node: None for node in adjacency_list}
    
    while pq:
        # Lấy đỉnh có khoảng cách ngắn nhất hiện tại ra khỏi hàng đợi
        current_distance, current_node = heapq.heappop(pq)
        
        # Nếu đã đến đích thì dừng sớm để tối ưu
        if current_node == end_id:
            break
            
        # Nếu khoảng cách lấy ra lớn hơn khoảng cách đã ghi nhận -> bỏ qua
        if current_distance > distances[current_node]:
            continue
            
        # Duyệt qua các điểm kề (hàng xóm)
        for neighbor, weight in adjacency_list[current_node].items():
            distance = current_distance + weight
            
            # Nếu tìm được đường ngắn hơn đến neighbor này
            if distance < distances[neighbor]:
                distances[neighbor] = distance
                previous_nodes[neighbor] = current_node
                heapq.heappush(pq, (distance, neighbor))
                
    # Truy vết ngược lại từ đích về xuất phát để lấy lộ trình
    path = []
    current = end_id
    
    # Nếu không có đường đi đến đích (distances vẫn là infinity)
    if distances[end_id] == float('infinity'):
        return None, float('infinity')
        
    while current is not None:
        path.append(current)
        current = previous_nodes[current]
        
    path.reverse() # Đảo ngược mảng để có thứ tự: Xuất phát -> ... -> Đích
    return path, distances[end_id]

if __name__ == "__main__":
    # Thay tên file này bằng tên file JSON bạn đã xuất ra ở bước trước
    graph_file = "kyoto_graph_weight_ver1.json" 
    
    try:
        print("Đang load dữ liệu bản đồ...")
        with open(graph_file, 'r', encoding='utf-8') as f:
            data = json.load(f)
            
        nodes_info = data['nodes']
        adjacency_list = data['adjacency_list']
        
        # Cho phép nhập tên ga xuất phát và đích
        start_name = input("Nhập tên ga xuất phát (VD: Kyoto): ")
        end_name = input("Nhập tên ga đích (VD: Karasuma): ")
        
        start_id, start_full_name = get_station_id_by_name(nodes_info, start_name)
        end_id, end_full_name = get_station_id_by_name(nodes_info, end_name)
        
        if not start_id:
            print(f"❌ Không tìm thấy ga nào có tên '{start_name}'")
        elif not end_id:
            print(f"❌ Không tìm thấy ga nào có tên '{end_name}'")
        else:
            print(f"\nĐang tìm đường từ [{start_full_name}] đến [{end_full_name}]...")
            
            # Chạy thuật toán Dijkstra
            path_ids, total_distance = find_shortest_path(adjacency_list, start_id, end_id)
            
            if path_ids:
                print(f"✅ Đã tìm thấy đường đi! Tổng khoảng cách: {total_distance:.2f} mét")
                print("Lộ trình đi qua các điểm ID:")
                print(" -> ".join(path_ids))
                with open('shortest_path.json', 'w', encoding='utf-8') as f:
                    json.dump(path_ids, f)
                print("Đã lưu lộ trình ra file shortest_path.json")
            else:
                print("❌ Không có đường đi nào kết nối 2 ga này.")
                
    except FileNotFoundError:
        print(f"❌ Không tìm thấy file {graph_file}. Hãy kiểm tra lại tên file!")