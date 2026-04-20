import requests
import json

def fetch_and_save_osm_data(output_filename="raw_osm_data.json"):
    overpass_url = 'https://overpass-api.de/api/interpreter'
    
    # Tăng timeout lên 50 để đảm bảo an toàn cho khu vực nhiều dữ liệu như Kyoto
    query = """
        [out:json][timeout:60];
        area[name="京都市"][admin_level="7"]->.kyoto;

        relation[route~"subway|train|tram"](area.kyoto)->.routes;
        .routes out geom;

        node[railway=station](area.kyoto);
        out geom;

        node(r.routes)(area.kyoto)->.stops;
        .stops out geom;

        way(r.routes)(area.kyoto);
        out geom;

        node[railway=subway_entrance](area.kyoto)->.entrances;
        node[entrance~"main|yes"](area.kyoto)->.entrances2;

        //.entrances out geom;
        //.entrances2 out geom;

        way[highway](area.kyoto);
        //out geom;
    """

    headers = {
        'User-Agent': 'KyotoPathfindingApp/1.0 (HUST Student Project)'
    }
    T = True
    while T :
        try:
            print("Đang gọi Overpass API để lấy dữ liệu Kyoto...")
            
            # 2. BẮT BUỘC: Gói query vào dictionary
            response = requests.post(overpass_url, headers=headers, data={'data': query})
            
            response.raise_for_status()
            data = response.json()
            
            # Đếm thử số lượng trả về để so sánh
            total_elements = len(data.get('elements', []))
            stations_count = 0
            for e in data.get('elements', []) :
                if (e.get('type') == 'node' and 'tags' in e and e['tags'].get('railway') == 'station'):
                    stations_count += 1
            stop_points_count = 0
            for e in data.get('elements', []) :
                if (e.get('type') == 'node' and 'tags' in e and e['tags'].get('railway') == 'stop'):
                    stop_points_count += 1
            node_count = 0;
            for e in data.get('elements', []) :
                if (e.get('type') == 'node'):
                    node_count += 1
            way_count = 0;
            for e in data.get('elements', []) :
                if (e.get('type') == 'way'):
                    way_count += 1
            print(f"Tải thành công {total_elements} phần tử từ OSM.")
            print(f"Phát hiện được {node_count} nút trong dữ liệu raw.")
            print(f"Phát hiện được {stations_count} trạm/nhà ga trong dữ liệu raw.")
            print(f"Phát hiện được {stop_points_count} điểm dừng trong dữ liệu raw.")
            print(f"Phát hiện được {way_count} đường trong dữ liệu raw.")

            # Lưu đè vào file JSON
            with open(output_filename, 'w', encoding='utf-8') as f:
                json.dump(data, f, ensure_ascii=False, indent=4)
                
            print(f"Đã lưu vào: {output_filename}")
            T = False
        except requests.exceptions.RequestException as error:
            print(f"Lỗi : {error}")
            T = True

if __name__ == "__main__":
    fetch_and_save_osm_data()