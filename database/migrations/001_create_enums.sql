-- ============================================================
-- College Grievance Portal
-- Migration 001: Create ENUM Types
-- ============================================================

DO $$ BEGIN
  CREATE TYPE user_role AS ENUM ('Student', 'Faculty', 'HOD', 'Dean');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE task_status AS ENUM ('Submitted', 'Assigned', 'In Progress', 'Resolved', 'Closed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TYPE task_status ADD VALUE 'Closed';
EXCEPTION WHEN duplicate_object THEN NULL;
          WHEN invalid_parameter_value THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE task_source AS ENUM ('Google Form', 'Portal', 'Internal');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
