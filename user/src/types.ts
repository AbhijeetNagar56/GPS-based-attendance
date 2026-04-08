export type Coords = {
  lat: number;
  lng: number;
};

export type ActiveClass = {
  id: string;
  className: string;
  facultyEmail: string;
  facultyName: string;
  lat: number;
  lng: number;
  radiusM: number;
  createdAt: string;
  attendanceCount: number;
};

export type AttendanceRecord = {
  name: string;
  email: string;
  distanceM: number;
  markedAt: string;
};

export type Faculty = {
  email: string;
  name: string;
};
