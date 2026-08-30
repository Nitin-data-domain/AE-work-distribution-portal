-- ============================================================
-- College Grievance Portal — GoDaddy Managed MySQL Schema & Initial Seed Data
-- ============================================================

CREATE TABLE IF NOT EXISTS users (
    user_id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(100) NOT NULL UNIQUE,
    phone VARCHAR(20),
    password VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'Student',
    department VARCHAR(100),
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    otp VARCHAR(10),
    otp_expires DATETIME,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS grievances (
    grievance_id INT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    source VARCHAR(50) NOT NULL DEFAULT 'Portal',
    status VARCHAR(50) NOT NULL DEFAULT 'Submitted',
    created_by INT,
    student_name VARCHAR(100),
    student_email VARCHAR(100),
    student_phone VARCHAR(20),
    admission_no VARCHAR(50),
    program_name VARCHAR(100),
    assigned_dean INT,
    assigned_hod INT,
    assigned_to INT,
    prev_faculty INT,
    remark_student TEXT,
    remark_internal TEXT,
    file_url VARCHAR(500),
    faculty_file_url VARCHAR(500),
    internal_file_url VARCHAR(500),
    resolved_at DATETIME,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by) REFERENCES users(user_id) ON DELETE SET NULL,
    FOREIGN KEY (assigned_to) REFERENCES users(user_id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS grievance_history (
    history_id INT AUTO_INCREMENT PRIMARY KEY,
    grievance_id INT NOT NULL,
    action VARCHAR(150) NOT NULL,
    actor_id INT,
    actor_name VARCHAR(100),
    remark TEXT,
    changed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (grievance_id) REFERENCES grievances(grievance_id) ON DELETE CASCADE
);

-- Seed Initial Administrative & Staff Accounts (Default Password: Admin@1234)
INSERT IGNORE INTO users (name, email, phone, password, role, department)
VALUES
  ('Mr. Deepak Dhalla Sir', 'nitingirdhar521@gmail.com', '+919800000001',
   '$2a$10$lxEh3jfA0RFElSxW/6QvSu7QwBjfrdfla5GOTbeSSReScwZlEjKC2',
   'Dean', 'Administration'),

  ('Dr. Priya Sharma', 'somya@aharadaedu.in', '+919800000002',
   '$2a$10$lxEh3jfA0RFElSxW/6QvSu7QwBjfrdfla5GOTbeSSReScwZlEjKC2',
   'HOD', 'Computer Science'),

  ('Dr. Anil Mehta', 'hod.bba@college.edu', '+919800000003',
   '$2a$10$lxEh3jfA0RFElSxW/6QvSu7QwBjfrdfla5GOTbeSSReScwZlEjKC2',
   'HOD', 'Business Administration'),

  ('Prof. Rajesh Kumar', 'nitin@aharadaedu.in', '+919800000004',
   '$2a$10$lxEh3jfA0RFElSxW/6QvSu7QwBjfrdfla5GOTbeSSReScwZlEjKC2',
   'Faculty', 'Computer Science'),

  ('Prof. Anita Gupta', 'anita@college.edu', '+919800000005',
   '$2a$10$lxEh3jfA0RFElSxW/6QvSu7QwBjfrdfla5GOTbeSSReScwZlEjKC2',
   'Faculty', 'Data Analytics'),

  ('Prof. Vikram Singh', 'vikram@college.edu', '+919800000006',
   '$2a$10$lxEh3jfA0RFElSxW/6QvSu7QwBjfrdfla5GOTbeSSReScwZlEjKC2',
   'Faculty', 'Business Administration'),

  ('Prof. Sunita Rao', 'sunita@college.edu', '+919800000007',
   '$2a$10$lxEh3jfA0RFElSxW/6QvSu7QwBjfrdfla5GOTbeSSReScwZlEjKC2',
   'Faculty', 'Accounts');
