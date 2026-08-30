-- ============================================================
-- College Grievance Portal
-- Migration 002: Create Core Tables
-- ============================================================

-- -----------------------------------------------
-- Table: Users
-- -----------------------------------------------
CREATE TABLE IF NOT EXISTS users (
    user_id     SERIAL PRIMARY KEY,
    name        VARCHAR(100)    NOT NULL,
    email       VARCHAR(100)    NOT NULL UNIQUE,
    phone       VARCHAR(20),
    password    VARCHAR(255)    NOT NULL,
    role        user_role       NOT NULL DEFAULT 'Student',
    department  VARCHAR(100),
    is_active   BOOLEAN         NOT NULL DEFAULT true,
    otp         VARCHAR(10),
    otp_expires TIMESTAMP,
    created_at  TIMESTAMP       NOT NULL DEFAULT NOW()
);

-- -----------------------------------------------
-- Table: Grievances
-- Student-submitted OR internally created tasks
-- -----------------------------------------------
CREATE TABLE IF NOT EXISTS grievances (
    grievance_id    SERIAL PRIMARY KEY,
    title           VARCHAR(255)    NOT NULL,
    description     TEXT            NOT NULL,
    source          task_source     NOT NULL DEFAULT 'Portal',
    status          task_status     NOT NULL DEFAULT 'Submitted',

    -- Originator (student or staff)
    created_by      INT REFERENCES users(user_id) ON DELETE SET NULL,
    student_name    VARCHAR(100),   -- denormalized (Google Form)
    student_email   VARCHAR(100),   -- denormalized (Google Form)
    student_phone   VARCHAR(20),
    admission_no    VARCHAR(50),
    program_name    VARCHAR(100),

    -- Assignment chain
    assigned_dean   INT REFERENCES users(user_id) ON DELETE SET NULL,
    assigned_hod    INT REFERENCES users(user_id) ON DELETE SET NULL,
    assigned_to     INT REFERENCES users(user_id) ON DELETE SET NULL,  -- current faculty
    prev_faculty    INT REFERENCES users(user_id) ON DELETE SET NULL,  -- previous faculty

    -- Remarks
    remark_student  TEXT,     -- visible to student + emailed
    remark_internal TEXT,     -- internal only (Dean/HOD/Faculty)

    -- Attachments
    file_url        VARCHAR(500),         -- student attachment
    faculty_file_url VARCHAR(500),        -- faculty response attachment (for student)
    internal_file_url VARCHAR(500),       -- internal attachment (staff only)

    -- Timestamps
    resolved_at     TIMESTAMP,
    created_at      TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMP NOT NULL DEFAULT NOW()
);

-- -----------------------------------------------
-- Table: Grievance History (Full Audit Trail)
-- -----------------------------------------------
CREATE TABLE IF NOT EXISTS grievance_history (
    history_id      SERIAL PRIMARY KEY,
    grievance_id    INT NOT NULL REFERENCES grievances(grievance_id) ON DELETE CASCADE,
    action          VARCHAR(150)    NOT NULL,
    actor_id        INT REFERENCES users(user_id) ON DELETE SET NULL,
    actor_name      VARCHAR(100),    -- denormalized for display
    remark          TEXT,
    changed_at      TIMESTAMP NOT NULL DEFAULT NOW()
);

-- -----------------------------------------------
-- Indexes for Performance
-- -----------------------------------------------
CREATE INDEX IF NOT EXISTS idx_grievances_created_by    ON grievances(created_by);
CREATE INDEX IF NOT EXISTS idx_grievances_assigned_to   ON grievances(assigned_to);
CREATE INDEX IF NOT EXISTS idx_grievances_assigned_hod  ON grievances(assigned_hod);
CREATE INDEX IF NOT EXISTS idx_grievances_status        ON grievances(status);
CREATE INDEX IF NOT EXISTS idx_grievances_created_at    ON grievances(created_at);
CREATE INDEX IF NOT EXISTS idx_history_grievance_id     ON grievance_history(grievance_id);
CREATE INDEX IF NOT EXISTS idx_users_role               ON users(role);
