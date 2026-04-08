import type { FormEvent } from 'react';

import type { AttendanceRecord, Faculty, ActiveClass } from '../types';

type FacultyPageProps = {
  faculty: Faculty | null;
  facultyClasses: ActiveClass[];
  selectedFacultyClass: ActiveClass | null;
  selectedFacultyClassId: string;
  facultyEmail: string;
  facultyPassword: string;
  className: string;
  radiusM: number;
  attendance: AttendanceRecord[];
  coordsReady: boolean;
  loading: boolean;
  onFacultyEmailChange: (value: string) => void;
  onFacultyPasswordChange: (value: string) => void;
  onLogin: (event: FormEvent<HTMLFormElement>) => void;
  onLogout: () => void;
  onClassNameChange: (value: string) => void;
  onRadiusChange: (value: number) => void;
  onCreateClass: (event: FormEvent<HTMLFormElement>) => void;
  onSelectFacultyClass: (classId: string) => void;
  onEndClass: () => void;
  onDownloadAttendance: () => void;
};

export function FacultyPage({
  faculty,
  facultyClasses,
  selectedFacultyClass,
  selectedFacultyClassId,
  facultyEmail,
  facultyPassword,
  className,
  radiusM,
  attendance,
  coordsReady,
  loading,
  onFacultyEmailChange,
  onFacultyPasswordChange,
  onLogin,
  onLogout,
  onClassNameChange,
  onRadiusChange,
  onCreateClass,
  onSelectFacultyClass,
  onEndClass,
  onDownloadAttendance,
}: FacultyPageProps) {
  return (
    <div className="panel-grid">
      <section className="panel">
        <div className="panel-header">
          <h2>Faculty login</h2>
          {faculty ? (
            <button className="secondary-button compact-button" onClick={onLogout} type="button">
              Logout
            </button>
          ) : null}
        </div>
        {!faculty ? (
          <form className="form-stack" onSubmit={onLogin}>
            <label>
              Faculty email
              <input
                value={facultyEmail}
                onChange={(event) => onFacultyEmailChange(event.target.value)}
                type="email"
                required
              />
            </label>
            <label>
              Password
              <input
                value={facultyPassword}
                onChange={(event) => onFacultyPasswordChange(event.target.value)}
                type="password"
                required
              />
            </label>
            <button className="primary-button" disabled={loading} type="submit">
              Login
            </button>
          </form>
        ) : (
          <div className="signed-in-card">
            <p>Logged in as</p>
            <strong>{faculty.name}</strong>
            <span>{faculty.email}</span>
            <small>{facultyClasses.length} live class(es) created by you</small>
          </div>
        )}
      </section>

      <section className="panel">
        <h2>Create attendance class</h2>
        <form className="form-stack" onSubmit={onCreateClass}>
          <label>
            Class name
            <input
              value={className}
              onChange={(event) => onClassNameChange(event.target.value)}
              placeholder="Example: Operating Systems Lab"
              required
            />
          </label>
          <label>
            Allowed radius in meters
            <input
              value={radiusM}
              onChange={(event) => onRadiusChange(Number(event.target.value))}
              min={10}
              max={500}
              required
              type="number"
            />
          </label>
          <button className="primary-button" disabled={!faculty || !coordsReady || loading} type="submit">
            Start class
          </button>
        </form>
      </section>

      <section className="panel attendance-panel">
        <div className="panel-header">
          <h2>Your live classes</h2>
          <span>{facultyClasses.length} live</span>
        </div>
        {facultyClasses.length > 0 ? (
          <>
            <label>
              Manage class
              <select
                className="select-field"
                onChange={(event) => onSelectFacultyClass(event.target.value)}
                value={selectedFacultyClassId}
              >
                <option value="">Choose your class</option>
                {facultyClasses.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.className} - {item.attendanceCount} present
                  </option>
                ))}
              </select>
            </label>

            {selectedFacultyClass ? (
              <div className="live-summary">
                <p>Current class: {selectedFacultyClass.className}</p>
                <p>Attendance radius: {selectedFacultyClass.radiusM} meters</p>
                <div className="action-row">
                  <button className="secondary-button" onClick={onEndClass} type="button">
                    End selected class
                  </button>
                  <button
                    className="secondary-button"
                    disabled={loading}
                    onClick={onDownloadAttendance}
                    type="button"
                  >
                    Download CSV
                  </button>
                </div>
              </div>
            ) : null}

            <p className="helper-copy">Download attendance for the selected class as a CSV file.</p>

            <div className="panel-header">
              <h2>Marked attendance</h2>
              <span>{attendance.length} present</span>
            </div>
            {attendance.length > 0 ? (
              <div className="attendance-list">
                {attendance.map((entry) => (
                  <article className="attendance-item" key={entry.email}>
                    <strong>{entry.name}</strong>
                    <span>{entry.email}</span>
                    <small>{entry.distanceM}m from faculty location</small>
                  </article>
                ))}
              </div>
            ) : (
              <p>No student has checked in yet for the selected class.</p>
            )}
          </>
        ) : (
          <p>You do not have any live class right now.</p>
        )}
      </section>
    </div>
  );
}
