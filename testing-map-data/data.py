import requests
import json

def fetch_and_save_osm_data(output_filename="raw_osm_data.json"):
    overpass_url = 'https://overpass-api.de/api/interpreter'
    
    # Tăng timeout lên 50 để đảm bảo an toàn cho khu vực nhiều dữ liệu như Kyoto
    query = """
        [out:json][timeout:50];
        area["name:en"="Kyoto"]->.searchArea;
        (
          way["railway"~"rail|subway|tram"](area.searchArea);
          node["railway"="station"](area.searchArea);
          relation["route" = "subway"](area.searchArea);
        );
        out body;
        >;
        out skel qt;
    """

    # 1. BẮT BUỘC: Giả lập User-Agent thành một ứng dụng hợp lệ
    headers = {
        'User-Agent': 'KyotoPathfindingApp/1.0 (HUST Student Project)'
    }

    try:
        print("Đang gọi Overpass API để lấy dữ liệu Kyoto...")
        
        # 2. BẮT BUỘC: Gói query vào dictionary
        response = requests.post(overpass_url, headers=headers, data={'data': query})
        
        response.raise_for_status()
        data = response.json()
        
        # Đếm thử số lượng trả về để so sánh
        total_elements = len(data.get('elements', []))
        stations_count = sum(1 for e in data.get('elements', []) if e.get('type') == 'node' and 'tags' in e and e['tags'].get('railway') == 'station')
        
        print(f"✅ Tải thành công {total_elements} phần tử từ OSM.")
        print(f"🚉 Phát hiện được {stations_count} trạm/nhà ga trong dữ liệu raw.")
        
        # Lưu đè vào file JSON
        with open(output_filename, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=4)
            
        print(f"✅ Đã lưu vào: {output_filename}")

    except requests.exceptions.RequestException as error:
        print(f"❌ Lỗi khi tải dữ liệu: {error}")

if __name__ == "__main__":
    fetch_and_save_osm_data()