import csv
import io
from pathlib import Path
from datetime import datetime, timezone
from uuid import uuid4

from flask import Flask, Response, jsonify, request, send_from_directory
from flask_cors import CORS
from geopy.distance import geodesic

BASE_DIR = Path(__file__).resolve().parent.parent
FRONTEND_DIST_DIR = BASE_DIR / "user" / "dist"

app = Flask(__name__, static_folder=str(FRONTEND_DIST_DIR), static_url_path="")
CORS(app)


DEFAULT_RADIUS_METERS = 60

active_classes = {}


def load_env_file():
    env_path = Path(__file__).with_name(".env")
    if not env_path.exists():
        return {}

    env_values = {}
    for raw_line in env_path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue

        key, value = line.split("=", 1)
        env_values[key.strip()] = value.strip()

    return env_values


ENV = load_env_file()

FACULTY_ACCOUNTS = {
    ENV.get("FACULTY_EMAIL", "faculty@college.edu").strip().lower(): {
        "name": ENV.get("FACULTY_NAME", "Faculty Admin").strip() or "Faculty Admin",
        "password": ENV.get("FACULTY_PASSWORD", "faculty123").strip() or "faculty123",
    }
}


def iso_now():
    return datetime.now(timezone.utc).isoformat()


def error(message, status_code=400):
    return jsonify({"error": message}), status_code


def parse_location(data):
    lat = data.get("lat")
    lng = data.get("lng")

    if lat is None or lng is None:
        return None, "Latitude and longitude are required."

    try:
        return (float(lat), float(lng)), None
    except (TypeError, ValueError):
        return None, "Latitude and longitude must be valid numbers."


def get_class_or_error(class_id):
    active_class = active_classes.get(class_id)
    if not active_class:
        return None, error("Class not found.", 404)
    return active_class, None


def get_request_ip():
    forwarded_for = request.headers.get("X-Forwarded-For", "").strip()
    if forwarded_for:
        return forwarded_for.split(",")[0].strip()
    return (request.remote_addr or "").strip() or "unknown"


def serialize_class(active_class):
    return {
        "id": active_class["id"],
        "className": active_class["class_name"],
        "facultyEmail": active_class["faculty_email"],
        "facultyName": active_class["faculty_name"],
        "lat": active_class["location"][0],
        "lng": active_class["location"][1],
        "radiusM": active_class["radius_m"],
        "createdAt": active_class["created_at"],
        "attendanceCount": len(active_class["attendance_list"]),
    }


def build_attendance_rows(active_class):
    rows = []
    for record in active_class["attendance_list"]:
        rows.append(
            {
                "classId": active_class["id"],
                "className": active_class["class_name"],
                "facultyName": active_class["faculty_name"],
                "facultyEmail": active_class["faculty_email"],
                "studentName": record["name"],
                "studentEmail": record["email"],
                "ipAddress": record["ipAddress"],
                "distanceM": record["distanceM"],
                "markedAt": record["markedAt"],
                "classLatitude": active_class["location"][0],
                "classLongitude": active_class["location"][1],
                "allowedRadiusM": active_class["radius_m"],
                "createdAt": active_class["created_at"],
            }
        )
    return rows


def class_filename(active_class):
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%d-%H%M%S")
    safe_name = active_class["class_name"].strip().replace(" ", "-").lower() or "attendance"
    return f"{safe_name}-{timestamp}.csv"


def serve_frontend(path=""):
    requested_path = FRONTEND_DIST_DIR / path
    if path and requested_path.exists() and requested_path.is_file():
        return send_from_directory(FRONTEND_DIST_DIR, path)

    return send_from_directory(FRONTEND_DIST_DIR, "index.html")


@app.route("/health", methods=["GET"])
def health():
    return jsonify({"ok": True, "timestamp": iso_now()})


@app.route("/login", methods=["POST"])
def login():
    data = request.get_json(silent=True) or {}
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""

    faculty = FACULTY_ACCOUNTS.get(email)
    if not faculty or faculty["password"] != password:
        return error("Invalid faculty email or password.", 401)

    return jsonify(
        {
            "message": "Faculty login successful.",
            "faculty": {
                "email": email,
                "name": faculty["name"],
            },
        }
    )


@app.route("/classes/active", methods=["GET"])
def get_active_classes():
    faculty_email = (request.args.get("facultyEmail") or "").strip().lower()

    classes = [serialize_class(active_class) for active_class in active_classes.values()]
    if faculty_email:
        classes = [item for item in classes if item["facultyEmail"] == faculty_email]

    classes.sort(key=lambda item: item["createdAt"], reverse=True)
    return jsonify({"active": bool(classes), "classes": classes})


@app.route("/classes", methods=["POST"])
def create_class():
    data = request.get_json(silent=True) or {}
    email = (data.get("email") or "").strip().lower()
    class_name = (data.get("className") or "").strip()

    faculty = FACULTY_ACCOUNTS.get(email)
    if not faculty:
        return error("Faculty account not found.", 401)

    if not class_name:
        return error("Class name is required.")

    location, location_error = parse_location(data)
    if location_error:
        return error(location_error)

    radius_m = data.get("radiusM", DEFAULT_RADIUS_METERS)
    try:
        radius_m = max(10, min(500, int(radius_m)))
    except (TypeError, ValueError):
        return error("Radius must be a whole number between 10 and 500 meters.")

    class_id = str(uuid4())
    active_class = {
        "id": class_id,
        "class_name": class_name,
        "faculty_email": email,
        "faculty_name": faculty["name"],
        "location": location,
        "radius_m": radius_m,
        "created_at": iso_now(),
        "attendance_list": [],
    }
    active_classes[class_id] = active_class

    return jsonify(
        {
            "message": f"{class_name} is now live for attendance.",
            "class": serialize_class(active_class),
        }
    )


@app.route("/classes/end", methods=["POST"])
def end_class():
    data = request.get_json(silent=True) or {}
    class_id = (data.get("classId") or "").strip()
    faculty_email = (data.get("email") or "").strip().lower()

    if not class_id:
        return error("Class ID is required to end a class.")

    active_class, class_error = get_class_or_error(class_id)
    if class_error:
        return class_error

    if faculty_email and active_class["faculty_email"] != faculty_email:
        return error("You can only end your own class.", 403)

    closed_snapshot = serialize_class(active_class)
    closed_snapshot["attendance"] = active_class["attendance_list"]
    del active_classes[class_id]

    return jsonify(
        {
            "message": "Attendance session ended.",
            "closedClass": closed_snapshot,
        }
    )


@app.route("/attendance", methods=["POST"])
def mark_attendance():
    data = request.get_json(silent=True) or {}
    class_id = (data.get("classId") or "").strip()
    name = (data.get("name") or "").strip()
    email = (data.get("email") or "").strip().lower()

    if not class_id:
        return error("Please select a class before marking attendance.")

    active_class, class_error = get_class_or_error(class_id)
    if class_error:
        return class_error

    if not name:
        return error("Student name is required.")
    if not email:
        return error("Student email is required.")

    student_location, location_error = parse_location(data)
    if location_error:
        return error(location_error)

    for record in active_class["attendance_list"]:
        if record["email"] == email:
            return error("Attendance has already been marked for this email in this class.", 409)

    request_ip = get_request_ip()
    for record in active_class["attendance_list"]:
        if record["ipAddress"] == request_ip:
            return error("This IP address has already submitted attendance for this class.", 409)

    distance = geodesic(active_class["location"], student_location).meters
    if distance > active_class["radius_m"]:
        return (
            jsonify(
                {
                    "error": (
                        "You are outside the attendance zone."
                        f" Current distance: {round(distance, 2)} meters."
                    ),
                    "distanceM": round(distance, 2),
                    "allowedRadiusM": active_class["radius_m"],
                }
            ),
            403,
        )

    record = {
        "name": name,
        "email": email,
        "ipAddress": request_ip,
        "distanceM": round(distance, 2),
        "markedAt": iso_now(),
    }
    active_class["attendance_list"].append(record)

    return jsonify(
        {
            "message": f"Attendance marked successfully for {active_class['class_name']}.",
            "record": record,
            "attendanceCount": len(active_class["attendance_list"]),
        }
    )


@app.route("/attendance", methods=["GET"])
def get_attendance():
    class_id = (request.args.get("classId") or "").strip()

    if not class_id:
        return jsonify({"attendance": []})

    active_class, class_error = get_class_or_error(class_id)
    if class_error:
        return class_error

    return jsonify(
        {
            "class": serialize_class(active_class),
            "attendance": active_class["attendance_list"],
        }
    )


@app.route("/attendance/export", methods=["GET"])
def export_attendance():
    class_id = (request.args.get("classId") or "").strip()
    active_class, class_error = get_class_or_error(class_id)
    if class_error:
        return class_error

    rows = build_attendance_rows(active_class)
    output = io.StringIO()
    fieldnames = [
        "classId",
        "className",
        "facultyName",
        "facultyEmail",
        "studentName",
        "studentEmail",
        "ipAddress",
        "distanceM",
        "markedAt",
        "classLatitude",
        "classLongitude",
        "allowedRadiusM",
        "createdAt",
    ]
    writer = csv.DictWriter(output, fieldnames=fieldnames)
    writer.writeheader()
    writer.writerows(rows)

    return Response(
        output.getvalue(),
        mimetype="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{class_filename(active_class)}"'},
    )


@app.route("/", defaults={"path": ""})
@app.route("/<path:path>")
def frontend(path):
    if path.startswith(("health", "login", "classes", "attendance")):
        return error("Route not found.", 404)

    return serve_frontend(path)


if __name__ == "__main__":
    app.run(debug=True, port=5000)
