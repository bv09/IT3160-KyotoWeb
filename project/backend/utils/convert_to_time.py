""" hàm đổi từ khoảng cách (m) sang thời gian phút """
TIME_PRECISION = 2
def convert_walk_time(distance_meters):
    # Giả sử tốc độ trung bình là 5 km/h = 5000 m/60 phút
    return round(distance_meters / 5000 * 60, TIME_PRECISION)
def convert_subway_time(distance_meters):
    # Giả sử tốc độ trung bình của tàu điện ngầm là 30 km/h = 30000 m/60 phút
    return round(distance_meters / 30000 * 60, TIME_PRECISION)