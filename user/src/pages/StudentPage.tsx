import type { FormEvent } from 'react';

import type { ActiveClass } from '../types';

type StudentPageProps = {
  liveClasses: ActiveClass[];
  selectedStudentClassId: string;
  studentName: string;
  studentEmail: string;
  coordsReady: boolean;
  loading: boolean;
  onSelectClass: (classId: string) => void;
  onStudentNameChange: (value: string) => void;
  onStudentEmailChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
};

export function StudentPage({
  liveClasses,
  selectedStudentClassId,
  studentName,
  studentEmail,
  coordsReady,
  loading,
  onSelectClass,
  onStudentNameChange,
  onStudentEmailChange,
  onSubmit,
}: StudentPageProps) {
  return (
    <div className="panel-grid">
      <section className="panel">
        <div className="panel-header">
          <h2>Available classes</h2>
          <span>{liveClasses.length} live</span>
        </div>
        {liveClasses.length > 0 ? (
          <div className="class-list">
            {liveClasses.map((item) => (
              <button
                className={item.id === selectedStudentClassId ? 'class-option active' : 'class-option'}
                key={item.id}
                onClick={() => onSelectClass(item.id)}
                type="button"
              >
                <strong>{item.className}</strong>
                <span>{item.facultyName}</span>
                <small>{item.attendanceCount} marked attendance</small>
              </button>
            ))}
          </div>
        ) : (
          <p>No faculty session is active yet. Ask your faculty member to start the class.</p>
        )}
      </section>

      <section className="panel">
        <h2>Mark attendance</h2>
        <form className="form-stack" onSubmit={onSubmit}>
          <label>
            Selected class
            <select
              className="select-field"
              onChange={(event) => onSelectClass(event.target.value)}
              value={selectedStudentClassId}
            >
              <option value="">Choose a live class</option>
              {liveClasses.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.className} - {item.facultyName}
                </option>
              ))}
            </select>
          </label>
          <label>
            Your name
            <input
              value={studentName}
              onChange={(event) => onStudentNameChange(event.target.value)}
              placeholder="Enter your full name"
              required
            />
          </label>
          <label>
            Student email
            <input
              value={studentEmail}
              onChange={(event) => onStudentEmailChange(event.target.value)}
              placeholder="student@college.edu"
              required
              type="email"
            />
          </label>
          <button className="primary-button" disabled={!selectedStudentClassId || !coordsReady || loading} type="submit">
            Submit attendance
          </button>
        </form>
      </section>
    </div>
  );
}
