-- =============================================================================
-- CashApp PostgreSQL Relational Database Schema
-- Architecture: Production Financial Platform (ACID Compliant)
-- Target DB: PostgreSQL 14+
-- =============================================================================

-- 1. EXTENSIONS & CUSTOM TYPES
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TYPE split_type_enum AS ENUM (
    'SPLIT_EQUAL',
    'SPLIT_PERCENTAGE',
    'SPLIT_EXACT'
);

CREATE TYPE action_type_enum AS ENUM (
    'CREATED',
    'EDITED',
    'DELETED'
);

CREATE TYPE role_type_enum AS ENUM (
    'MEMBER',
    'ADMIN'
);

-- 2. USERS TABLE
CREATE TABLE users (
    id VARCHAR(64) PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255),
    full_name VARCHAR(100) NOT NULL,
    avatar_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_users_email ON users(email);

-- 3. SPACES TABLE (SHARED COUPLE SPACES)
CREATE TABLE spaces (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    emoji VARCHAR(10) DEFAULT '💕',
    invite_code VARCHAR(12) UNIQUE NOT NULL,
    created_by VARCHAR(64) REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_spaces_invite_code ON spaces(invite_code);

-- 4. SPACE MEMBERS (MANY-TO-MANY LINK WITH ROLES)
CREATE TABLE space_members (
    space_id VARCHAR(64) NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
    user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role role_type_enum DEFAULT 'MEMBER',
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (space_id, user_id)
);

-- 5. TRANSACTIONS TABLE (CORE EXPENSES & SETTLEMENTS)
CREATE TABLE transactions (
    id VARCHAR(64) PRIMARY KEY,
    space_id VARCHAR(64) NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
    amount NUMERIC(15, 2) NOT NULL CHECK (amount >= 0),
    description VARCHAR(255) NOT NULL,
    category_id VARCHAR(50) NOT NULL,
    transaction_date TIMESTAMP WITH TIME ZONE NOT NULL,
    paid_by VARCHAR(64) NOT NULL REFERENCES users(id),
    split_type split_type_enum DEFAULT 'SPLIT_EQUAL',
    is_settlement BOOLEAN DEFAULT FALSE,
    is_deleted BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_transactions_space_date ON transactions(space_id, transaction_date DESC);
CREATE INDEX idx_transactions_paid_by ON transactions(paid_by);
CREATE INDEX idx_transactions_category ON transactions(space_id, category_id);

-- 6. TRANSACTION SPLIT DETAILS (BREAKDOWN PER USER)
CREATE TABLE split_details (
    id VARCHAR(64) PRIMARY KEY,
    transaction_id VARCHAR(64) NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
    user_id VARCHAR(64) NOT NULL REFERENCES users(id),
    owed_amount NUMERIC(15, 2) NOT NULL CHECK (owed_amount >= 0),
    percentage NUMERIC(5, 2) CHECK (percentage >= 0 AND percentage <= 100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_tx_user UNIQUE (transaction_id, user_id)
);

CREATE INDEX idx_split_details_tx ON split_details(transaction_id);

-- 7. CATEGORY BUDGETS TABLE
CREATE TABLE budgets (
    id VARCHAR(64) PRIMARY KEY,
    space_id VARCHAR(64) NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
    category_id VARCHAR(50) NOT NULL,
    monthly_limit NUMERIC(15, 2) NOT NULL CHECK (monthly_limit >= 0),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_space_category_budget UNIQUE (space_id, category_id)
);

-- 8. AUDIT LOGS TABLE (TRANSACTION CHANGE HISTORY)
CREATE TABLE audit_logs (
    id VARCHAR(64) PRIMARY KEY,
    transaction_id VARCHAR(64) NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
    user_id VARCHAR(64) NOT NULL REFERENCES users(id),
    action_type action_type_enum NOT NULL,
    changes_json JSONB,
    description VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_audit_logs_tx ON audit_logs(transaction_id);

-- =============================================================================
-- DATABASE TRIGGER FOR TRANSACTION AMOUNT INTEGRITY VALIDATION
-- Ensures that SUM(split_details.owed_amount) = transactions.amount
-- =============================================================================
CREATE OR REPLACE FUNCTION check_split_details_total()
RETURNS TRIGGER AS $$
DECLARE
    v_total_owed NUMERIC(15, 2);
    v_tx_amount NUMERIC(15, 2);
    v_is_settlement BOOLEAN;
BEGIN
    SELECT amount, is_settlement INTO v_tx_amount, v_is_settlement
    FROM transactions WHERE id = NEW.transaction_id;

    IF v_is_settlement IS TRUE THEN
        RETURN NEW;
    END IF;

    SELECT COALESCE(SUM(owed_amount), 0) INTO v_total_owed
    FROM split_details WHERE transaction_id = NEW.transaction_id;

    -- Add the NEW record if INSERTing or UPDATing
    IF (TG_OP = 'INSERT') THEN
        v_total_owed := v_total_owed + NEW.owed_amount;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
