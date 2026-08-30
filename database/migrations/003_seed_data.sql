-- ============================================================
-- College Grievance Portal
-- Migration 003: Seed Data
-- Default password for all seeded accounts: Admin@1234
-- ============================================================

INSERT INTO users (name, email, phone, password, role, department)
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
   'Faculty', 'Accounts')
ON CONFLICT (email) DO NOTHING;
