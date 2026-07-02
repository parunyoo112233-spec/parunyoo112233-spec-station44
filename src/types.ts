/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type UserRole = 'admin' | 'officer' | 'user';

export interface UserProfile {
  uid: string;
  email: string;
  role: UserRole;
  name: string;
  rank: string;       // ยศ (e.g. พลทหาร, ส.ต., ส.อ., จ.ส.อ., ร.ท., พ.ต.)
  department: string; // สังกัด/หน่วยงาน (e.g. มทบ.44, พัน.ส.มทบ.44, ร.25)
  phone?: string;
  position?: string;  // ตำแหน่งหน้าที่ (e.g. ผู้ใช้, นายทหารส่งกำลัง, ผู้บังคับกองร้อย)
  status?: 'pending' | 'active' | 'disabled'; // สถานะไอดี (pending = รออนุมัติเปิดใช้งาน, active = เปิดใช้งานแล้ว, disabled = ระงับการใช้งาน)
  password?: string;  // รหัสผ่านสำหรับบัญชีทดสอบ/จำลอง
}

export interface FuelRecord {
  id: string;
  date: string;         // วันที่ (YYYY-MM-DD)
  time: string;         // เวลา (HH:MM)
  vehicleNo: string;    // ทะเบียนรถ/เลขกงจักร
  vehicleType: string;  // ประเภทรถ (e.g. รถบรรทุก, รถยนต์นั่ง, รถจักรยานยนต์)
  unit: string;         // สังกัดหน่วยเบิก
  driverName: string;   // ชื่อคนขับ/ผู้รับน้ำมัน
  fuelType: string;     // ประเภทน้ำมัน (น้ำมันดีเซล, น้ำมันแก๊สโซฮอล์ 95, น้ำมันแก๊สโซฮอล์ 91)
  volume: number;       // จำนวนจ่าย (ลิตร)
  odometer: number;     // เลขไมล์สะสม
  orderNo: string;      // เลขที่ใบสั่งจ่ายน้ำมัน
  purpose: string;      // ภารกิจ/วัตถุประสงค์
  officerId: string;    // เจ้าหน้าที่ผู้จ่ายน้ำมัน (UID)
  officerName: string;  // ชื่อเจ้าหน้าที่ผู้จ่ายน้ำมัน
  createdAt: number;    // timestamp
}

export interface FuelRequest {
  id: string;
  date: string;
  vehicleNo: string;
  vehicleType: string;
  unit: string;
  driverName: string;
  fuelType: string;
  volume: number;
  odometer: number;
  orderNo: string;
  purpose: string;
  status: 'pending' | 'approved' | 'rejected';
  requestedBy: string;      // UID ผู้ขอเบิก
  requestedByName: string;  // ชื่อผู้ขอเบิก
  approvedBy?: string;      // UID เจ้าหน้าที่ผู้อนุมัติ
  approvedByName?: string;  // ชื่อเจ้าหน้าที่ผู้อนุมัติ
  rejectedReason?: string;
  createdAt: number;
}

export interface FuelInventory {
  id: string;          // fuelType
  fuelType: string;    // น้ำมันดีเซล, น้ำมันแก๊สโซฮอล์ 95, น้ำมันแก๊สโซฮอล์ 91
  currentStock: number; // ปริมาณคงเหลือ (ลิตร)
  capacity: number;     // ความจุถังเก็บ (ลิตร)
  updatedAt: number;
}

export interface FuelQuota {
  allocatedLimit: number;
  usedCredit: number;
}

export interface UnitCredit {
  id: string;          // unit name
  unit: string;        // e.g. "ร.25 พัน.1"
  allocatedLimit: number; // วงเงินเครดิตรวมทั้งหมด (ลิตร)
  usedCredit: number;  // จำนวนหน่วยลิตรรวมที่ใช้ไปแล้ว
  lastResetDate: string; // วันที่อัปเดต/รีเซ็ตร่าสุด (YYYY-MM-DD)
  updatedAt: number;
  quotas?: Record<string, FuelQuota>; // รายการโควตาแยกชนิดน้ำมัน
}

