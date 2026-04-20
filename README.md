# IT3160-Kyoto
## ⚙️ How to Run

### 1. Install dependencies

Make sure you have Python installed, then run:

```bash
pip install requests
pip install flask
pip install flask_cors
```

---

### 2. Run backend

```bash
python path_finding.py
```

* This starts the backend server
* Keep this terminal running

---

### 3. Run frontend

Open the file:

```bash
map.html
```

You can:

* double-click to open in browser
* or use Live Server in VS Code

---

### 4. Usage

1. Click the button to start selecting points
2. Click **2 locations on the map**:

   * First click → Start point
   * Second click → End point
3. Wait a few seconds
4. The path (if available) will be displayed

---

### ⚠️ Notes

* Backend must be running before opening the frontend
* Project is still under development, some features may not work
* If nothing happens:

  * check browser console (F12)
  * check backend terminal
