import json
import math
import heapq
from flask import Flask, request, jsonify, render_template
from flask_cors import CORS

Node_Map = {}
Stop_Map = {}

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

# Data Preprocessing
def buildGraph(osm_data):
    graph = {}
    for element in osm_data.get('elements', []):
        if (element['type'] == 'node' and 'tags' in element and element['tags'].get('railway') == 'stop'):
            coord = (round(element['lat'], 7), round(element['lon'], 7))
            Stop_Map[coord] = element['tags'].get('name:en', element['tags'].get('name', f"Station_{element['id']}"))
            Stop_Map[element['id']] = Stop_Map[coord]
            
        if element['type'] == 'way' and 'nodes' in element:
            Nodes = element['nodes']
            for i in range(len(Nodes) - 1):
                node1, node2 = Nodes[i], Nodes[i + 1]
                if node1 not in graph:
                    graph[node1] = []
                if node2 not in graph:
                    graph[node2] = []
                
                lat1, lon1 = element['geometry'][i]['lat'], element['geometry'][i]['lon']
                lat2, lon2 = element['geometry'][i + 1]['lat'], element['geometry'][i + 1]['lon']
                if (None in (lat1, lon1, lat2, lon2)):
                    print(f"Cảnh báo: Phát hiện tọa độ không hợp lệ trong way ID {element['id']} giữa node {node1} và node {node2}. Bỏ qua đoạn này.")  
                    continue
                
                Node_Map[(round(lat1, 7), round(lon1, 7))] = node1
                Node_Map[(round(lat2, 7), round(lon2, 7))] = node2
                Node_Map[node1] = (round(lat1, 7), round(lon1, 7))
                Node_Map[node2] = (round(lat2, 7), round(lon2, 7))
                distance = calculate_distance(lat1, lon1, lat2, lon2)
                
                if (element['tags'] and element['tags'].get('oneway') == 'yes'):
                    if (node2 not in graph[node1]):
                        graph[node1].append((node2, distance))
                else:
                    if (node2 not in graph[node1]):
                        graph[node1].append((node2, distance))
                    if (node1 not in graph[node2]):
                        graph[node2].append((node1, distance))
    return graph
      
# Dijkstra's algorithm for pathfinding
def path_finding(graph, start, end):
    if start is None or end is None or start not in graph or end not in graph:
        print("Lỗi: Điểm bắt đầu hoặc kết thúc không hợp lệ.")
        return None
    path = {start: None} # previous nodes
    cost = {start: 0} # cost from start to node
    heap = [(0, start)]  # (cost, current_node)
    
    while heap:
        current_cost, current_node = heapq.heappop(heap)
        if current_node == end:
            break
        if current_cost > cost.get(current_node, float('inf')):
            continue
        for node, edge_cost in graph.get(current_node, []):
            new_cost = current_cost + edge_cost
            if new_cost < cost.get(node, float('inf')):
                cost[node] = new_cost
                path[node] = current_node
                heapq.heappush(heap, (new_cost, node))
                
    if (cost.get(end, float('inf')) == float('inf')):
        return None
    return path

# POST request handler
app = Flask(__name__)
CORS(app) # Cho phép CORS để frontend có thể gọi API từ domain khác
@app.route('/save_input', methods=['POST'])
def save_input():
    data = request.get_json()
    Node_start = Node_Map.get(tuple(data['start']), None)
    Node_end = Node_Map.get(tuple(data['end']), None)
    path = path_finding(graph, Node_start, Node_end)
    if path is None:
        return "No path found", 404
    shortest_path = []
    i = Node_end
    while path.get(i, None) is not None:
        shortest_path.append((Node_Map.get(i, None), Stop_Map.get(i, None)))
        i = path.get(i)
    shortest_path.append((Node_Map.get(Node_start, None), Stop_Map.get(Node_start, None)))
    shortest_path.reverse()
    # with open("shortest_path.json", 'w', encoding='utf-8') as f:
    #     json.dump(shortest_path, f, ensure_ascii=False, indent=4)
    # print("Đã lưu đường đi ngắn nhất vào 'shortest_path.json'.")
    return jsonify(shortest_path) #200 OK
@app.route('/raw_osm_data.json')
def get_raw_osm_data():
    try:
        with open("raw_osm_data.json", 'r', encoding='utf-8') as f:
            raw_osm_data = json.load(f)
        return jsonify(raw_osm_data)
    except FileNotFoundError:
        return "File 'raw_osm_data.json' not found. Please run 'fetch_data.py' first!", 404
    
if __name__ == "__main__":
    input_file = "raw_osm_data.json"
    graph = None
    try:
        print(f"Đang đọc dữ liệu từ {input_file}...")
        with open(input_file, 'r', encoding='utf-8') as f:
            raw_osm_data = json.load(f)
        graph = buildGraph(raw_osm_data)
        app.run(debug=True, port=5000)
    except FileNotFoundError:
        print(f"Không tìm thấy file '{input_file}'.Cần chạy file 'fetch_data.py' trước!")
    