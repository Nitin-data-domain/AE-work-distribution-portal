-- ============================================================
-- College Grievance Portal — GoDaddy Managed MySQL Schema
-- ============================================================

CREATE TABLE IF NOT EXISTS users (
    user_id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(100) NOT NULL UNIQUE,
    phone VARCHAR(20),
    password VARCHAR(255) NOT NULL,
    role ENUM('Student', 'Faculty', 'HOD', 'Dean', 'MD', 'Admin') NOT NULL DEFAULT 'Student',
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
    source ENUM('Portal', 'GoogleForm') NOT NULL DEFAULT 'Portal',
    status ENUM('Submitted', 'Assigned_Faculty', 'In_Progress', 'Faculty_Responded', 'Resolved', 'Rejected') NOT NULL DEFAULT 'Submitted',
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
