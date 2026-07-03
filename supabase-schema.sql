-- 
-- SQL Schema for "คลังน้ำมัน มทบ.44" (parunyoo112233-spec's Project)
-- Copy and paste this script into your Supabase SQL Editor to set up the database tables.
--

-- Enable UUID extension if needed
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Table: users
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT,
    role TEXT NOT NULL DEFAULT 'user',
    name TEXT NOT NULL,
    rank TEXT NOT NULL,
    department TEXT NOT NULL,
    phone TEXT,
    position TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    password TEXT
);

-- 2. Table: fuel_inventory
CREATE TABLE IF NOT EXISTS fuel_inventory (
    id TEXT PRIMARY KEY, -- fuelType
    "fuelType" TEXT NOT NULL,
    "currentStock" NUMERIC NOT NULL DEFAULT 0,
    capacity NUMERIC NOT NULL DEFAULT 50000,
    "updatedAt" BIGINT
);

-- 3. Table: fuel_records
CREATE TABLE IF NOT EXISTS fuel_records (
    id TEXT PRIMARY KEY,
    date TEXT NOT NULL,
    time TEXT NOT NULL,
    "vehicleNo" TEXT NOT NULL,
    "vehicleType" TEXT NOT NULL,
    unit TEXT NOT NULL,
    "driverName" TEXT NOT NULL,
    "fuelType" TEXT NOT NULL,
    volume NUMERIC NOT NULL,
    odometer NUMERIC NOT NULL,
    "orderNo" TEXT NOT NULL,
    purpose TEXT NOT NULL,
    "officerId" TEXT NOT NULL,
    "officerName" TEXT NOT NULL,
    "createdAt" BIGINT NOT NULL
);

-- 4. Table: fuel_requests
CREATE TABLE IF NOT EXISTS fuel_requests (
    id TEXT PRIMARY KEY,
    date TEXT NOT NULL,
    "vehicleNo" TEXT NOT NULL,
    "vehicleType" TEXT NOT NULL,
    unit TEXT NOT NULL,
    "driverName" TEXT NOT NULL,
    "fuelType" TEXT NOT NULL,
    volume NUMERIC NOT NULL,
    odometer NUMERIC NOT NULL,
    "orderNo" TEXT,
    purpose TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    "requestedBy" TEXT NOT NULL,
    "requestedByName" TEXT NOT NULL,
    "approvedBy" TEXT,
    "approvedByName" TEXT,
    "rejectedReason" TEXT,
    "createdAt" BIGINT NOT NULL
);

-- 5. Table: unit_credits
CREATE TABLE IF NOT EXISTS unit_credits (
    id TEXT PRIMARY KEY, -- unit name
    unit TEXT NOT NULL,
    "allocatedLimit" NUMERIC NOT NULL DEFAULT 0,
    "usedCredit" NUMERIC NOT NULL DEFAULT 0,
    "lastResetDate" TEXT NOT NULL,
    "updatedAt" BIGINT NOT NULL,
    quotas JSONB NOT NULL DEFAULT '{}'::jsonb
);

-- 6. Table: unit_receipts
CREATE TABLE IF NOT EXISTS unit_receipts (
    id TEXT PRIMARY KEY,
    date TEXT NOT NULL,
    time TEXT NOT NULL,
    unit TEXT NOT NULL,
    "fuelType" TEXT NOT NULL,
    volume NUMERIC NOT NULL,
    "docNo" TEXT NOT NULL,
    "actionType" TEXT NOT NULL,
    "deductFromInventory" BOOLEAN NOT NULL DEFAULT false,
    notes TEXT,
    "officerId" TEXT NOT NULL,
    "officerName" TEXT NOT NULL,
    "createdAt" BIGINT NOT NULL
);

--
-- SEED INITIAL DATA
--

-- Seed: fuel_inventory
INSERT INTO fuel_inventory (id, "fuelType", "currentStock", capacity, "updatedAt")
VALUES 
('น้ำมันดีเซล', 'น้ำมันดีเซล', 30550, 50000, 1783000000000)
ON CONFLICT (id) DO NOTHING;

INSERT INTO fuel_inventory (id, "fuelType", "currentStock", capacity, "updatedAt")
VALUES 
('น้ำมันแก๊สโซฮอล์ 95', 'น้ำมันแก๊สโซฮอล์ 95', 8200, 15000, 1783000000000)
ON CONFLICT (id) DO NOTHING;

INSERT INTO fuel_inventory (id, "fuelType", "currentStock", capacity, "updatedAt")
VALUES 
('น้ำมันแก๊สโซฮอล์ 91', 'น้ำมันแก๊สโซฮอล์ 91', 4800, 15000, 1783000000000)
ON CONFLICT (id) DO NOTHING;

-- Seed: unit_credits
INSERT INTO unit_credits (id, unit, "allocatedLimit", "usedCredit", "lastResetDate", "updatedAt", quotas)
VALUES 
('มทบ.44', 'มทบ.44', 15000, 560, '2026-06-01', 1783000000000, '{
  "น้ำมันดีเซล": {"allocatedLimit": 10000, "usedCredit": 450},
  "น้ำมันแก๊สโซฮอล์ 95": {"allocatedLimit": 3000, "usedCredit": 70},
  "น้ำมันแก๊สโซฮอล์ 91": {"allocatedLimit": 2000, "usedCredit": 40}
}'),
('ร.25 พัน.1', 'ร.25 พัน.1', 10000, 270, '2026-06-01', 1783000000000, '{
  "น้ำมันดีเซล": {"allocatedLimit": 7000, "usedCredit": 270},
  "น้ำมันแก๊สโซฮอล์ 95": {"allocatedLimit": 2000, "usedCredit": 0},
  "น้ำมันแก๊สโซฮอล์ 91": {"allocatedLimit": 1000, "usedCredit": 0}
}'),
('พัน.ส.มทบ.44', 'พัน.ส.มทบ.44', 5000, 95, '2026-06-01', 1783000000000, '{
  "น้ำมันดีเซล": {"allocatedLimit": 3000, "usedCredit": 95},
  "น้ำมันแก๊สโซฮอล์ 95": {"allocatedLimit": 1000, "usedCredit": 0},
  "น้ำมันแก๊สโซฮอล์ 91": {"allocatedLimit": 1000, "usedCredit": 0}
}'),
('ร.25 พัน.2', 'ร.25 พัน.2', 8000, 0, '2026-06-01', 1783000000000, '{
  "น้ำมันดีเซล": {"allocatedLimit": 5000, "usedCredit": 0},
  "น้ำมันแก๊สโซฮอล์ 95": {"allocatedLimit": 2000, "usedCredit": 0},
  "น้ำมันแก๊สโซฮอล์ 91": {"allocatedLimit": 1000, "usedCredit": 0}
}'),
('พัน.พัฒนา 4', 'พัน.พัฒนา 4', 6000, 0, '2026-06-01', 1783000000000, '{
  "น้ำมันดีเซล": {"allocatedLimit": 4000, "usedCredit": 0},
  "น้ำมันแก๊สโซฮอล์ 95": {"allocatedLimit": 1000, "usedCredit": 0},
  "น้ำมันแก๊สโซฮอล์ 91": {"allocatedLimit": 1000, "usedCredit": 0}
}')
ON CONFLICT (id) DO NOTHING;

-- Enable Realtime for all tables in Supabase
-- Run this in your SQL Editor to allow client-side real-time state synchronization:
alter publication supabase_realtime add table users;
alter publication supabase_realtime add table fuel_inventory;
alter publication supabase_realtime add table fuel_records;
alter publication supabase_realtime add table fuel_requests;
alter publication supabase_realtime add table unit_credits;
alter publication supabase_realtime add table unit_receipts;
