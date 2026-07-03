/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { initializeApp, getApp, getApps } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
import { supabase, isSupabaseConfigured } from '../firebase';
import firebaseConfig from '../../firebase-applet-config.json';

export interface MigrationStepProgress {
  collection: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  current: number;
  total: number;
  message: string;
}

export interface MigrationProgress {
  steps: { [key: string]: MigrationStepProgress };
  logs: string[];
  isCompleted: boolean;
  isFailed: boolean;
}

// Helper to initialize a separate, dedicated Firebase App for the migration
function getMigrationFirestore() {
  const appName = 'migration-app';
  let app;
  const existingApps = getApps();
  const existingApp = existingApps.find(a => a.name === appName);
  
  if (existingApp) {
    app = existingApp;
  } else {
    app = initializeApp(firebaseConfig, appName);
  }
  
  return getFirestore(app, firebaseConfig.firestoreDatabaseId);
}

/**
 * Executes the database migration from Firestore to Supabase
 */
export async function runDatabaseMigration(
  onProgress: (progress: MigrationProgress) => void
): Promise<void> {
  const steps: { [key: string]: MigrationStepProgress } = {
    users: { collection: 'users', status: 'pending', current: 0, total: 0, message: 'เตรียมการย้ายข้อมูล...' },
    fuel_inventory: { collection: 'fuel_inventory', status: 'pending', current: 0, total: 0, message: 'เตรียมการย้ายข้อมูล...' },
    fuel_records: { collection: 'fuel_records', status: 'pending', current: 0, total: 0, message: 'เตรียมการย้ายข้อมูล...' },
    fuel_requests: { collection: 'fuel_requests', status: 'pending', current: 0, total: 0, message: 'เตรียมการย้ายข้อมูล...' },
    unit_credits: { collection: 'unit_credits', status: 'pending', current: 0, total: 0, message: 'เตรียมการย้ายข้อมูล...' },
    unit_receipts: { collection: 'unit_receipts', status: 'pending', current: 0, total: 0, message: 'เตรียมการย้ายข้อมูล...' },
  };

  const logs: string[] = [];
  
  const updateProgress = (completed = false, failed = false) => {
    onProgress({
      steps: { ...steps },
      logs: [...logs],
      isCompleted: completed,
      isFailed: failed,
    });
  };

  const addLog = (msg: string) => {
    const timestamp = new Date().toLocaleTimeString();
    logs.push(`[${timestamp}] ${msg}`);
    console.log(`[Migration] ${msg}`);
    updateProgress();
  };

  addLog('เริ่มต้นการย้ายข้อมูลระบบ...');
  
  if (!isSupabaseConfigured) {
    const errMsg = 'ข้อผิดพลาด: ยังไม่ได้ตั้งค่าการเชื่อมต่อ Supabase กรุณาตั้งค่า VITE_SUPABASE_URL และ VITE_SUPABASE_ANON_KEY ในระบบก่อน';
    addLog(errMsg);
    steps.users.status = 'failed';
    steps.users.message = 'Supabase ไม่ได้เชื่อมต่อ';
    updateProgress(false, true);
    return;
  }

  try {
    const firestoreDb = getMigrationFirestore();
    addLog('เชื่อมต่อคลังข้อมูล Firestore (เดิม) สำเร็จ');

    // -----------------------------------------------------------------
    // 1. Migrate fuel_inventory
    // -----------------------------------------------------------------
    addLog('กำลังย้ายข้อมูลสินค้าคงคลัง (fuel_inventory)...');
    steps.fuel_inventory.status = 'running';
    steps.fuel_inventory.message = 'กำลังดึงข้อมูลจาก Firestore...';
    updateProgress();

    const invColRef = collection(firestoreDb, 'fuel_inventory');
    const invSnapshot = await getDocs(invColRef);
    const invDocs = invSnapshot.docs;
    steps.fuel_inventory.total = invDocs.length;
    addLog(`พบข้อมูลสินค้าคงคลังใน Firestore จำนวน ${invDocs.length} รายการ`);

    let invSuccessCount = 0;
    for (const doc of invDocs) {
      const data = doc.data();
      const mapped = {
        id: doc.id,
        fuelType: data.fuelType || doc.id,
        currentStock: Number(data.currentStock) || 0,
        capacity: Number(data.capacity) || 50000,
        updatedAt: Number(data.updatedAt) || Date.now()
      };

      const { error } = await supabase.from('fuel_inventory').upsert(mapped, { onConflict: 'id' });
      if (error) {
        addLog(`[Error] ไม่สามารถบันทึกสินค้าคงคลัง ID ${doc.id}: ${error.message}`);
      } else {
        invSuccessCount++;
        steps.fuel_inventory.current = invSuccessCount;
        steps.fuel_inventory.message = `ย้ายแล้ว ${invSuccessCount}/${invDocs.length} รายการ`;
        updateProgress();
      }
    }
    steps.fuel_inventory.status = invSuccessCount === invDocs.length ? 'completed' : 'failed';
    steps.fuel_inventory.message = `สำเร็จ ${invSuccessCount}/${invDocs.length} รายการ`;
    addLog(`ย้ายข้อมูลสินค้าคงคลังสำเร็จ ${invSuccessCount} รายการ`);

    // -----------------------------------------------------------------
    // 2. Migrate users
    // -----------------------------------------------------------------
    addLog('กำลังย้ายข้อมูลผู้ใช้งาน (users)...');
    steps.users.status = 'running';
    steps.users.message = 'กำลังดึงข้อมูลจาก Firestore...';
    updateProgress();

    const usersColRef = collection(firestoreDb, 'users');
    const usersSnapshot = await getDocs(usersColRef);
    const usersDocs = usersSnapshot.docs;
    steps.users.total = usersDocs.length;
    addLog(`พบข้อมูลผู้ใช้ใน Firestore จำนวน ${usersDocs.length} รายการ`);

    let usersSuccessCount = 0;
    for (const doc of usersDocs) {
      const data = doc.data();
      const mapped = {
        id: doc.id,
        email: data.email || null,
        role: data.role || 'user',
        name: data.name || '',
        rank: data.rank || '',
        department: data.department || '',
        phone: data.phone || null,
        position: data.position || null,
        status: data.status || 'pending',
        password: data.password || null
      };

      const { error } = await supabase.from('users').upsert(mapped, { onConflict: 'id' });
      if (error) {
        addLog(`[Error] ไม่สามารถบันทึกผู้ใช้ ID ${doc.id}: ${error.message}`);
      } else {
        usersSuccessCount++;
        steps.users.current = usersSuccessCount;
        steps.users.message = `ย้ายแล้ว ${usersSuccessCount}/${usersDocs.length} รายการ`;
        updateProgress();
      }
    }
    steps.users.status = usersSuccessCount === usersDocs.length ? 'completed' : 'failed';
    steps.users.message = `สำเร็จ ${usersSuccessCount}/${usersDocs.length} รายการ`;
    addLog(`ย้ายข้อมูลผู้ใช้สำเร็จ ${usersSuccessCount} รายการ`);

    // -----------------------------------------------------------------
    // 3. Migrate unit_credits
    // -----------------------------------------------------------------
    addLog('กำลังย้ายข้อมูลโควตากองร้อย (unit_credits)...');
    steps.unit_credits.status = 'running';
    steps.unit_credits.message = 'กำลังดึงข้อมูลจาก Firestore...';
    updateProgress();

    const creditsColRef = collection(firestoreDb, 'unit_credits');
    const creditsSnapshot = await getDocs(creditsColRef);
    const creditsDocs = creditsSnapshot.docs;
    steps.unit_credits.total = creditsDocs.length;
    addLog(`พบข้อมูลโควตาใน Firestore จำนวน ${creditsDocs.length} รายการ`);

    let creditsSuccessCount = 0;
    for (const doc of creditsDocs) {
      const data = doc.data();
      const mapped = {
        id: doc.id,
        unit: data.unit || doc.id,
        allocatedLimit: Number(data.allocatedLimit) || 0,
        usedCredit: Number(data.usedCredit) || 0,
        lastResetDate: data.lastResetDate || '',
        updatedAt: Number(data.updatedAt) || Date.now(),
        quotas: data.quotas || {}
      };

      const { error } = await supabase.from('unit_credits').upsert(mapped, { onConflict: 'id' });
      if (error) {
        addLog(`[Error] ไม่สามารถบันทึกโควตา ID ${doc.id}: ${error.message}`);
      } else {
        creditsSuccessCount++;
        steps.unit_credits.current = creditsSuccessCount;
        steps.unit_credits.message = `ย้ายแล้ว ${creditsSuccessCount}/${creditsDocs.length} รายการ`;
        updateProgress();
      }
    }
    steps.unit_credits.status = creditsSuccessCount === creditsDocs.length ? 'completed' : 'failed';
    steps.unit_credits.message = `สำเร็จ ${creditsSuccessCount}/${creditsDocs.length} รายการ`;
    addLog(`ย้ายข้อมูลโควตากองร้อยสำเร็จ ${creditsSuccessCount} รายการ`);

    // -----------------------------------------------------------------
    // 4. Migrate fuel_records
    // -----------------------------------------------------------------
    addLog('กำลังย้ายประวัติการจ่ายน้ำมัน (fuel_records)...');
    steps.fuel_records.status = 'running';
    steps.fuel_records.message = 'กำลังดึงข้อมูลจาก Firestore...';
    updateProgress();

    const recordsColRef = collection(firestoreDb, 'fuel_records');
    const recordsSnapshot = await getDocs(recordsColRef);
    const recordsDocs = recordsSnapshot.docs;
    steps.fuel_records.total = recordsDocs.length;
    addLog(`พบประวัติการจ่ายน้ำมันใน Firestore จำนวน ${recordsDocs.length} รายการ`);

    let recordsSuccessCount = 0;
    for (const doc of recordsDocs) {
      const data = doc.data();
      const mapped = {
        id: doc.id,
        date: data.date || '',
        time: data.time || '',
        vehicleNo: data.vehicleNo || '',
        vehicleType: data.vehicleType || '',
        unit: data.unit || '',
        driverName: data.driverName || '',
        fuelType: data.fuelType || '',
        volume: Number(data.volume) || 0,
        odometer: Number(data.odometer) || 0,
        orderNo: data.orderNo || '',
        purpose: data.purpose || '',
        officerId: data.officerId || '',
        officerName: data.officerName || '',
        createdAt: Number(data.createdAt) || Date.now()
      };

      const { error } = await supabase.from('fuel_records').upsert(mapped, { onConflict: 'id' });
      if (error) {
        addLog(`[Error] ไม่สามารถบันทึกประวัติจ่ายน้ำมัน ID ${doc.id}: ${error.message}`);
      } else {
        recordsSuccessCount++;
        steps.fuel_records.current = recordsSuccessCount;
        steps.fuel_records.message = `ย้ายแล้ว ${recordsSuccessCount}/${recordsDocs.length} รายการ`;
        updateProgress();
      }
    }
    steps.fuel_records.status = recordsSuccessCount === recordsDocs.length ? 'completed' : 'failed';
    steps.fuel_records.message = `สำเร็จ ${recordsSuccessCount}/${recordsDocs.length} รายการ`;
    addLog(`ย้ายข้อมูลประวัติการจ่ายน้ำมันสำเร็จ ${recordsSuccessCount} รายการ`);

    // -----------------------------------------------------------------
    // 5. Migrate fuel_requests
    // -----------------------------------------------------------------
    addLog('กำลังย้ายคิวคำขอเติมน้ำมัน (fuel_requests)...');
    steps.fuel_requests.status = 'running';
    steps.fuel_requests.message = 'กำลังดึงข้อมูลจาก Firestore...';
    updateProgress();

    const requestsColRef = collection(firestoreDb, 'fuel_requests');
    const requestsSnapshot = await getDocs(requestsColRef);
    const requestsDocs = requestsSnapshot.docs;
    steps.fuel_requests.total = requestsDocs.length;
    addLog(`พบรายการคำขอเติมน้ำมันใน Firestore จำนวน ${requestsDocs.length} รายการ`);

    let requestsSuccessCount = 0;
    for (const doc of requestsDocs) {
      const data = doc.data();
      const mapped = {
        id: doc.id,
        date: data.date || '',
        vehicleNo: data.vehicleNo || '',
        vehicleType: data.vehicleType || '',
        unit: data.unit || '',
        driverName: data.driverName || '',
        fuelType: data.fuelType || '',
        volume: Number(data.volume) || 0,
        odometer: Number(data.odometer) || 0,
        orderNo: data.orderNo || null,
        purpose: data.purpose || '',
        status: data.status || 'pending',
        requestedBy: data.requestedBy || '',
        requestedByName: data.requestedByName || '',
        approvedBy: data.approvedBy || null,
        approvedByName: data.approvedByName || null,
        rejectedReason: data.rejectedReason || null,
        createdAt: Number(data.createdAt) || Date.now()
      };

      const { error } = await supabase.from('fuel_requests').upsert(mapped, { onConflict: 'id' });
      if (error) {
        addLog(`[Error] ไม่สามารถบันทึกคำขอ ID ${doc.id}: ${error.message}`);
      } else {
        requestsSuccessCount++;
        steps.fuel_requests.current = requestsSuccessCount;
        steps.fuel_requests.message = `ย้ายแล้ว ${requestsSuccessCount}/${requestsDocs.length} รายการ`;
        updateProgress();
      }
    }
    steps.fuel_requests.status = requestsSuccessCount === requestsDocs.length ? 'completed' : 'failed';
    steps.fuel_requests.message = `สำเร็จ ${requestsSuccessCount}/${requestsDocs.length} รายการ`;
    addLog(`ย้ายข้อมูลคำขอเติมน้ำมันสำเร็จ ${requestsSuccessCount} รายการ`);

    // -----------------------------------------------------------------
    // 6. Migrate unit_receipts
    // -----------------------------------------------------------------
    addLog('กำลังย้ายประวัติการรับน้ำมันเข้าหน่วย (unit_receipts)...');
    steps.unit_receipts.status = 'running';
    steps.unit_receipts.message = 'กำลังดึงข้อมูลจาก Firestore...';
    updateProgress();

    const receiptsColRef = collection(firestoreDb, 'unit_receipts');
    const receiptsSnapshot = await getDocs(receiptsColRef);
    const receiptsDocs = receiptsSnapshot.docs;
    steps.unit_receipts.total = receiptsDocs.length;
    addLog(`พบประวัติรับน้ำมันเข้าหน่วยใน Firestore จำนวน ${receiptsDocs.length} รายการ`);

    let receiptsSuccessCount = 0;
    for (const doc of receiptsDocs) {
      const data = doc.data();
      const mapped = {
        id: doc.id,
        date: data.date || '',
        time: data.time || '',
        unit: data.unit || '',
        fuelType: data.fuelType || '',
        volume: Number(data.volume) || 0,
        docNo: data.docNo || '',
        actionType: data.actionType || '',
        deductFromInventory: Boolean(data.deductFromInventory),
        notes: data.notes || null,
        officerId: data.officerId || '',
        officerName: data.officerName || '',
        createdAt: Number(data.createdAt) || Date.now()
      };

      const { error } = await supabase.from('unit_receipts').upsert(mapped, { onConflict: 'id' });
      if (error) {
        addLog(`[Error] ไม่สามารถบันทึกประวัติรับน้ำมัน ID ${doc.id}: ${error.message}`);
      } else {
        receiptsSuccessCount++;
        steps.unit_receipts.current = receiptsSuccessCount;
        steps.unit_receipts.message = `ย้ายแล้ว ${receiptsSuccessCount}/${receiptsDocs.length} รายการ`;
        updateProgress();
      }
    }
    steps.unit_receipts.status = receiptsSuccessCount === receiptsDocs.length ? 'completed' : 'failed';
    steps.unit_receipts.message = `สำเร็จ ${receiptsSuccessCount}/${receiptsDocs.length} รายการ`;
    addLog(`ย้ายข้อมูลประวัติการรับน้ำมันสำเร็จ ${receiptsSuccessCount} รายการ`);

    addLog('เสร็จสิ้นการย้ายข้อมูลระบบทั้งหมดสำเร็จเรียบร้อย! 🎉');
    updateProgress(true, false);

  } catch (err: any) {
    addLog(`[Critical Error] การย้ายข้อมูลล้มเหลว: ${err?.message || err}`);
    updateProgress(false, true);
  }
}
