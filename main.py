import qrcode
import io
import base64
from fastapi import FastAPI, Form, Request
from fastapi.responses import HTMLResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from typing import List

app = FastAPI()

# In-memory storage for demo (use a DB for production)
attendance_records = []

# 1. Root: Serve the single index.html file
# Add this above your /submit route
@app.get("/form", response_class=HTMLResponse)
async def read_form():
    with open("index.html", "r") as f:
        return f.read()

# 2. Generate QR Code
@app.get("/generate-qr")
async def generate_qr():
    # STEP 1: Find your IP (e.g., 192.168.1.15) and put it here:
    your_ip = "0.0.0.0" 
    
    # STEP 2: The URL must point to your IP and port 8000
    # Note: We use /#form so the single-file index.html can detect the "page"
    form_url = f"http://{your_ip}:8000/form"
    
    qr = qrcode.QRCode(version=1, box_size=10, border=5)
    qr.add_data(form_url)
    qr.make(fit=True)
    
    img = qr.make_image(fill_color="black", back_color="white")
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    img_str = base64.b64encode(buf.getvalue()).decode()
    
    return {"qr_code": f"data:image/png;base64,{img_str}", "url": form_url}

# 3. Submit Attendance
@app.post("/submit")
async def submit_attendance(name: str = Form(...), roll_no: str = Form(...)):
    attendance_records.append({"name": name, "roll_no": roll_no})
    return {"status": "success", "message": f"Recorded {name}"}

# 4. Get Records for the Dashboard
@app.get("/records")
async def get_records():
    return attendance_records
