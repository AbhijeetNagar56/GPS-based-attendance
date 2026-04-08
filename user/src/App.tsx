import { useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';

import { apiRequest, getApiUrl } from './lib/api';
import { FacultyPage } from './pages/FacultyPage';
import { StudentPage } from './pages/StudentPage';
import type { ActiveClass, AttendanceRecord, Coords, Faculty } from './types';

function App() {
  const [mode, setMode] = useState<'student' | 'faculty'>('student');
  const [coords, setCoords] = useState<Coords | null>(null);
  const [locationStatus, setLocationStatus] = useState('Fetching your current GPS location...');
  const [liveClasses, setLiveClasses] = useState<ActiveClass[]>([]);
  const [selectedStudentClassId, setSelectedStudentClassId] = useState('');
  const [selectedFacultyClassId, setSelectedFacultyClassId] = useState('');
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const [studentName, setStudentName] = useState('');
  const [studentEmail, setStudentEmail] = useState('');

  const [facultyEmail, setFacultyEmail] = useState('');
  const [facultyPassword, setFacultyPassword] = useState('');
  const [faculty, setFaculty] = useState<Faculty | null>(null);
  const [className, setClassName] = useState('');

  const facultyClasses = useMemo(() => {
    if (!faculty) {
      return [];
    }
    return liveClasses.filter((item) => item.facultyEmail === faculty.email);
  }, [faculty, liveClasses]);

  const selectedStudentClass =
    liveClasses.find((item) => item.id === selectedStudentClassId) ?? null;
  const selectedFacultyClass =
    facultyClasses.find((item) => item.id === selectedFacultyClassId) ?? null;

  const refreshClasses = async () => {
    try {
      const data = await apiRequest<{ active: boolean; classes: ActiveClass[] }>('/classes/active');
      setLiveClasses(data.classes);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to load class status.');
    }
  };

  const refreshAttendance = async (classId: string) => {
    if (!classId) {
      setAttendance([]);
      return;
    }

    try {
      const data = await apiRequest<{ attendance: AttendanceRecord[] }>(
        `/attendance?classId=${encodeURIComponent(classId)}`
      );
      setAttendance(data.attendance || []);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to load attendance.');
    }
  };

  useEffect(() => {
    if (!navigator.geolocation) {
      setLocationStatus('Geolocation is not supported in this browser.');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setCoords({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
        setLocationStatus('GPS location is ready for attendance.');
      },
      () => {
        setLocationStatus('Please enable location permission to continue.');
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, []);

  useEffect(() => {
    void refreshClasses();
    const intervalId = window.setInterval(() => {
      void refreshClasses();
    }, 4000);

    return () => window.clearInterval(intervalId);
  }, []);

  useEffect(() => {
    const studentClassStillExists = liveClasses.some((item) => item.id === selectedStudentClassId);
    if (!selectedStudentClassId || !studentClassStillExists) {
      setSelectedStudentClassId(liveClasses[0]?.id ?? '');
    }
  }, [liveClasses, selectedStudentClassId]);

  useEffect(() => {
    if (faculty) {
      const facultyClassStillExists = facultyClasses.some((item) => item.id === selectedFacultyClassId);
      if (!selectedFacultyClassId || !facultyClassStillExists) {
        setSelectedFacultyClassId(facultyClasses[0]?.id ?? '');
      }
      return;
    }

    setSelectedFacultyClassId('');
    setAttendance([]);
  }, [faculty, facultyClasses, selectedFacultyClassId]);

  useEffect(() => {
    if (faculty && selectedFacultyClassId) {
      void refreshAttendance(selectedFacultyClassId);
    }
  }, [faculty, selectedFacultyClassId]);

  const handleFacultyLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setMessage('');

    try {
      const data = await apiRequest<{ message: string; faculty: Faculty }>('/login', {
        method: 'POST',
        body: JSON.stringify({
          email: facultyEmail,
          password: facultyPassword,
        }),
      });
      setFaculty(data.faculty);
      setMode('faculty');
      setMessage(data.message);
      await refreshClasses();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Faculty login failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleFacultyLogout = () => {
    setFaculty(null);
    setSelectedFacultyClassId('');
    setAttendance([]);
    setMessage('Faculty logged out.');
  };

  const handleCreateClass = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!faculty) {
      setMessage('Faculty login is required before creating a class.');
      return;
    }

    if (!coords) {
      setMessage('Faculty location is required to create a GPS attendance zone.');
      return;
    }

    setLoading(true);
    setMessage('');

    try {
      const data = await apiRequest<{ message: string; class: ActiveClass }>('/classes', {
        method: 'POST',
        body: JSON.stringify({
          email: faculty.email,
          className,
          lat: coords.lat,
          lng: coords.lng,
        }),
      });
      setMessage(data.message);
      setClassName('');
      await refreshClasses();
      setSelectedFacultyClassId(data.class.id);
      await refreshAttendance(data.class.id);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to create class.');
    } finally {
      setLoading(false);
    }
  };

  const handleEndClass = async () => {
    if (!faculty || !selectedFacultyClass) {
      setMessage('Select one of your live classes first.');
      return;
    }

    setLoading(true);
    setMessage('');

    try {
      const data = await apiRequest<{ message: string }>('/classes/end', {
        method: 'POST',
        body: JSON.stringify({
          classId: selectedFacultyClass.id,
          email: faculty.email,
        }),
      });
      setMessage(data.message);
      await refreshClasses();
      setSelectedFacultyClassId('');
      setAttendance([]);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to end class.');
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadAttendance = async () => {
    if (!selectedFacultyClass) {
      setMessage('Select one of your classes before downloading attendance.');
      return;
    }

    setLoading(true);
    setMessage('');

    try {
      const response = await fetch(
        getApiUrl(`/attendance/export?classId=${encodeURIComponent(selectedFacultyClass.id)}`)
      );
      const blob = await response.blob();

      if (!response.ok) {
        const text = await blob.text();
        try {
          const parsed = JSON.parse(text) as { error?: string };
          throw new Error(parsed.error || 'Attendance export failed.');
        } catch {
          throw new Error('Attendance export failed.');
        }
      }

      const fileUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      const disposition = response.headers.get('Content-Disposition');
      const matchedName = disposition?.match(/filename="(.+)"/)?.[1] || 'attendance.csv';

      link.href = fileUrl;
      link.download = matchedName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(fileUrl);
      setMessage('Attendance CSV downloaded.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to download attendance.');
    } finally {
      setLoading(false);
    }
  };

  const handleAttendanceSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!coords) {
      setMessage('Your device location is required to mark attendance.');
      return;
    }

    if (!selectedStudentClassId) {
      setMessage('Please select a class before submitting attendance.');
      return;
    }

    setLoading(true);
    setMessage('');

    try {
      const data = await apiRequest<{ message: string }>('/attendance', {
        method: 'POST',
        body: JSON.stringify({
          classId: selectedStudentClassId,
          name: studentName,
          email: studentEmail,
          lat: coords.lat,
          lng: coords.lng,
        }),
      });
      setMessage(data.message);
      setStudentName('');
      setStudentEmail('');
      await refreshClasses();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Attendance could not be submitted.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="app-shell">
      <section className="hero-card">
        <p className="eyebrow">GPS Attendance Platform</p>
        <h1>Run location-based attendance for every live class.</h1>
        <p className="hero-copy">
          Students can select the correct live class and mark attendance with their current location.
          Faculty can run multiple subjects at the same time, manage their own sessions separately,
          and review where each attendance entry was submitted from.
        </p>

        <div className="status-grid">
          <div className="status-card">
            <span>Location</span>
            <strong>{locationStatus}</strong>
          </div>
          <div className="status-card">
            <span>Live Classes</span>
            <strong>{liveClasses.length > 0 ? `${liveClasses.length} class(es) active` : 'No class is live right now'}</strong>
          </div>
          <div className="status-card">
            <span>Selected Class</span>
            <strong>{selectedStudentClass ? selectedStudentClass.className : 'Choose a class below'}</strong>
          </div>
        </div>
      </section>

      <section className="workspace-card">
        <div className="tab-row">
          <button
            className={mode === 'student' ? 'tab active' : 'tab'}
            onClick={() => setMode('student')}
            type="button"
          >
            Student
          </button>
          <button
            className={mode === 'faculty' ? 'tab active' : 'tab'}
            onClick={() => setMode('faculty')}
            type="button"
          >
            Faculty
          </button>
        </div>

        {mode === 'student' ? (
          <StudentPage
            coordsReady={Boolean(coords)}
            liveClasses={liveClasses}
            loading={loading}
            onSelectClass={setSelectedStudentClassId}
            onStudentEmailChange={setStudentEmail}
            onStudentNameChange={setStudentName}
            onSubmit={handleAttendanceSubmit}
            selectedStudentClassId={selectedStudentClassId}
            studentEmail={studentEmail}
            studentName={studentName}
          />
        ) : (
          <FacultyPage
            attendance={attendance}
            className={className}
            coordsReady={Boolean(coords)}
            faculty={faculty}
            facultyClasses={facultyClasses}
            facultyEmail={facultyEmail}
            facultyPassword={facultyPassword}
            loading={loading}
            onClassNameChange={setClassName}
            onCreateClass={handleCreateClass}
            onDownloadAttendance={handleDownloadAttendance}
            onEndClass={handleEndClass}
            onFacultyEmailChange={setFacultyEmail}
            onFacultyPasswordChange={setFacultyPassword}
            onLogin={handleFacultyLogin}
            onLogout={handleFacultyLogout}
            onSelectFacultyClass={setSelectedFacultyClassId}
            selectedFacultyClass={selectedFacultyClass}
            selectedFacultyClassId={selectedFacultyClassId}
          />
        )}

        {message ? <p className="message-banner">{message}</p> : null}
      </section>
    </main>
  );
}

export default App;
