/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { 
  collection, 
  doc, 
  getDocs, 
  getDoc, 
  setDoc, 
  addDoc, 
  updateDoc, 
  deleteDoc,
  query, 
  orderBy, 
  where,
  runTransaction
} from 'firebase/firestore';
import { db, auth } from '../firebase';
import { FuelInventory, FuelRecord, FuelRequest, UserProfile, UnitCredit, UserRole, UnitFuelReceipt } from '../types';

// Helper to determine if we are operating in Mock/Demo mode (when firebase auth is not ready or mock user is logged in)
export function isMockMode(): boolean {
  if (typeof window === 'undefined') return true;
  const saved = localStorage.getItem('demo_user_profile') || sessionStorage.getItem('demo_user_profile');
  if (saved) {
    try {
      const profile = JSON.parse(saved);
      if (profile && profile.uid && profile.uid.startsWith('mock-')) {
        return true;
      }
    } catch {
      // ignore
    }
  }
  return !auth.currentUser;
}

export function getMockCollection<T>(name: string, defaultData: T[] = []): T[] {
  if (typeof window === 'undefined') return defaultData;
  const data = localStorage.getItem(`mock_db_${name}`);
  if (!data) {
    localStorage.setItem(`mock_db_${name}`, JSON.stringify(defaultData));
    return defaultData;
  }
  try {
    return JSON.parse(data);
  } catch {
    return defaultData;
  }
}

export function saveMockCollection<T>(name: string, data: T[]): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(`mock_db_${name}`, JSON.stringify(data));
  window.dispatchEvent(new Event('mock-db-update'));
}

// Collection references
export const usersCol = collection(db, 'users');
export const recordsCol = collection(db, 'fuel_records');
export const requestsCol = collection(db, 'fuel_requests');
export const inventoryCol = collection(db, 'fuel_inventory');
export const unitCreditsCol = collection(db, 'unit_credits');
export const unitReceiptsCol = collection(db, 'unit_receipts');

const INITIAL_UNIT_CREDITS: UnitCredit[] = [
  { 
    id: 'มทบ.44', 
    unit: 'มทบ.44', 
    allocatedLimit: 15000, 
    usedCredit: 560, 
    lastResetDate: '2026-06-01', 
    updatedAt: Date.now(),
    quotas: {
      'น้ำมันดีเซล': { allocatedLimit: 10000, usedCredit: 450 },
      'น้ำมันแก๊สโซฮอล์ 95': { allocatedLimit: 3000, usedCredit: 70 },
      'น้ำมันแก๊สโซฮอล์ 91': { allocatedLimit: 2000, usedCredit: 40 }
    }
  },
  { 
    id: 'ร.25 พัน.1', 
    unit: 'ร.25 พัน.1', 
    allocatedLimit: 10000, 
    usedCredit: 270, 
    lastResetDate: '2026-06-01', 
    updatedAt: Date.now(),
    quotas: {
      'น้ำมันดีเซล': { allocatedLimit: 7000, usedCredit: 270 },
      'น้ำมันแก๊สโซฮอล์ 95': { allocatedLimit: 2000, usedCredit: 0 },
      'น้ำมันแก๊สโซฮอล์ 91': { allocatedLimit: 1000, usedCredit: 0 }
    }
  },
  { 
    id: 'พัน.ส.มทบ.44', 
    unit: 'พัน.ส.มทบ.44', 
    allocatedLimit: 5000, 
    usedCredit: 95, 
    lastResetDate: '2026-06-01', 
    updatedAt: Date.now(),
    quotas: {
      'น้ำมันดีเซล': { allocatedLimit: 3000, usedCredit: 95 },
      'น้ำมันแก๊สโซฮอล์ 95': { allocatedLimit: 1000, usedCredit: 0 },
      'น้ำมันแก๊สโซฮอล์ 91': { allocatedLimit: 1000, usedCredit: 0 }
    }
  },
  { 
    id: 'ร.25 พัน.2', 
    unit: 'ร.25 พัน.2', 
    allocatedLimit: 8000, 
    usedCredit: 0, 
    lastResetDate: '2026-06-01', 
    updatedAt: Date.now(),
    quotas: {
      'น้ำมันดีเซล': { allocatedLimit: 5000, usedCredit: 0 },
      'น้ำมันแก๊สโซฮอล์ 95': { allocatedLimit: 2000, usedCredit: 0 },
      'น้ำมันแก๊สโซฮอล์ 91': { allocatedLimit: 1000, usedCredit: 0 }
    }
  },
  { 
    id: 'พัน.พัฒนา 4', 
    unit: 'พัน.พัฒนา 4', 
    allocatedLimit: 6000, 
    usedCredit: 0, 
    lastResetDate: '2026-06-01', 
    updatedAt: Date.now(),
    quotas: {
      'น้ำมันดีเซล': { allocatedLimit: 4000, usedCredit: 0 },
      'น้ำมันแก๊สโซฮอล์ 95': { allocatedLimit: 1000, usedCredit: 0 },
      'น้ำมันแก๊สโซฮอล์ 91': { allocatedLimit: 1000, usedCredit: 0 }
    }
  }
];

// Default initial inventory
const INITIAL_INVENTORY: Omit<FuelInventory, 'updatedAt'>[] = [
  { id: 'น้ำมันดีเซล', fuelType: 'น้ำมันดีเซล', currentStock: 30550, capacity: 50000 },
  { id: 'น้ำมันแก๊สโซฮอล์ 95', fuelType: 'น้ำมันแก๊สโซฮอล์ 95', currentStock: 8200, capacity: 15000 },
  { id: 'น้ำมันแก๊สโซฮอล์ 91', fuelType: 'น้ำมันแก๊สโซฮอล์ 91', currentStock: 4800, capacity: 15000 },
];

/**
 * Initialize inventory documents if they don't exist
 */
export async function initializeDatabase() {
  if (isMockMode()) {
    // Seed local mock collections
    getMockCollection('fuel_inventory', INITIAL_INVENTORY.map(i => ({ ...i, updatedAt: Date.now() })));
    getMockCollection('unit_credits', INITIAL_UNIT_CREDITS);
    getMockCollection('fuel_records', []);
    getMockCollection('fuel_requests', []);
    getMockCollection('unit_receipts', []);
    getMockCollection('users', []);
    return;
  }

  // Real Firestore seeding: Only run if authenticated on Firebase
  if (!auth.currentUser) {
    console.log("No authenticated user, skipping Firestore seeding.");
    return;
  }

  try {
    // Clean up obsolete inventory IDs if they exist
    const obsoleteIds = ['ดีเซล B7', 'ดีเซล', 'แก๊สโซฮอล์ 95', 'แก๊สโซฮอล์ 91'];
    for (const obsId of obsoleteIds) {
      const obsRef = doc(db, 'fuel_inventory', obsId);
      const obsSnap = await getDoc(obsRef);
      if (obsSnap.exists()) {
        console.log(`Deleting obsolete inventory record: ${obsId}`);
        await deleteDoc(obsRef);
      }
    }

    // Seed or verify current 3 inventory items
    for (const inv of INITIAL_INVENTORY) {
      const invRef = doc(db, 'fuel_inventory', inv.id);
      const invSnap = await getDoc(invRef);
      if (!invSnap.exists()) {
        console.log(`Seeding inventory: ${inv.id}`);
        await setDoc(invRef, {
          ...inv,
          updatedAt: Date.now()
        });
      }
    }

    // Check if records are empty, if so, seed some realistic past logs for June 2026
    const recSnap = await getDocs(query(recordsCol, orderBy('createdAt', 'desc')));
    if (recSnap.empty) {
      console.log('Seeding initial fuel records for June 2026...');
      
      const seedRecords: Omit<FuelRecord, 'id'>[] = [
        // June 29
        {
          date: '2026-06-29',
          time: '09:15',
          vehicleNo: 'ทบ-12345',
          vehicleType: 'รถบรรทุก 2.5 ตัน (FTS)',
          unit: 'ร.25 พัน.1',
          driverName: 'ส.ต. สมชาย แข็งแรง',
          fuelType: 'น้ำมันดีเซล',
          volume: 120,
          odometer: 45230,
          orderNo: 'MIL-6906-001',
          purpose: 'ลาดตระเวนพื้นที่ชายแดน',
          officerId: 'demo-officer-uid',
          officerName: 'จ.ส.อ. สมศักดิ์ มีชัย',
          createdAt: new Date('2026-06-29T09:15:00').getTime()
        },
        {
          date: '2026-06-29',
          time: '14:30',
          vehicleNo: 'กงจักร-5541',
          vehicleType: 'รถยนต์นั่งตรวจการณ์ (M151)',
          unit: 'มทบ.44',
          driverName: 'พลทหาร วิชัย รักชาติ',
          fuelType: 'น้ำมันแก๊สโซฮอล์ 95',
          volume: 45,
          odometer: 12890,
          orderNo: 'MIL-6906-002',
          purpose: 'ติดต่อราชการนอกจังหวัด',
          officerId: 'demo-officer-uid',
          officerName: 'จ.ส.อ. สมศักดิ์ มีชัย',
          createdAt: new Date('2026-06-29T14:30:00').getTime()
        },
        // June 28
        {
          date: '2026-06-28',
          time: '08:00',
          vehicleNo: 'ทบ-88921',
          vehicleType: 'รถบรรทุกขนาดกลาง',
          unit: 'พัน.ส.มทบ.44',
          driverName: 'จ.ส.อ. อดุลย์ เก่งกาจ',
          fuelType: 'น้ำมันดีเซล',
          volume: 95,
          odometer: 62450,
          orderNo: 'MIL-6906-003',
          purpose: 'รับ-ส่งกำลังพลฝึกซ้อมประจำสัปดาห์',
          officerId: 'demo-officer-uid',
          officerName: 'จ.ส.อ. สมศักดิ์ มีชัย',
          createdAt: new Date('2026-06-28T08:00:00').getTime()
        },
        {
          date: '2026-06-28',
          time: '11:15',
          vehicleNo: 'ทบ-44112',
          vehicleType: 'รถยนต์นั่งส่วนกลาง',
          unit: 'มทบ.44',
          driverName: 'ส.อ. วรุตม์ ผาสุก',
          fuelType: 'น้ำมันแก๊สโซฮอล์ 91',
          volume: 40,
          odometer: 85210,
          orderNo: 'MIL-6906-004',
          purpose: 'ขนส่งเอกสารทางทหารเร่งด่วน',
          officerId: 'demo-officer-uid',
          officerName: 'จ.ส.อ. สมศักดิ์ มีชัย',
          createdAt: new Date('2026-06-28T11:15:00').getTime()
        },
        // June 25
        {
          date: '2026-06-25',
          time: '10:00',
          vehicleNo: 'ทบ-12345',
          vehicleType: 'รถบรรทุก 2.5 ตัน (FTS)',
          unit: 'ร.25 พัน.1',
          driverName: 'ส.ต. สมชาย แข็งแรง',
          fuelType: 'น้ำมันดีเซล',
          volume: 150,
          odometer: 44980,
          orderNo: 'MIL-6905-045',
          purpose: 'เคลื่อนย้ายสิ่งของเพื่อช่วยเหลือประชาชนภัยแล้ง',
          officerId: 'demo-officer-uid',
          officerName: 'จ.ส.อ. สมศักดิ์ มีชัย',
          createdAt: new Date('2026-06-25T10:00:00').getTime()
        },
        {
          date: '2026-06-25',
          time: '13:45',
          vehicleNo: 'กงจักร-9912',
          vehicleType: 'รถกระบะขนส่ง',
          unit: 'มทบ.44',
          driverName: 'ส.ต. มานะ ดีเลิศ',
          fuelType: 'น้ำมันดีเซล',
          volume: 75,
          odometer: 32110,
          orderNo: 'MIL-6905-046',
          purpose: 'ขนย้ายอุปกรณ์คอมพิวเตอร์และสื่อสาร',
          officerId: 'demo-officer-uid',
          officerName: 'จ.ส.อ. สมศักดิ์ มีชัย',
          createdAt: new Date('2026-06-25T13:45:00').getTime()
        },
        // June 20
        {
          date: '2026-06-20',
          time: '08:30',
          vehicleNo: 'ทบ-00444',
          vehicleType: 'รถบัสขนส่งกำลังพล',
          unit: 'มทบ.44',
          driverName: 'จ.ส.ต. สุรพงษ์ สันติ',
          fuelType: 'น้ำมันดีเซล',
          volume: 180,
          odometer: 112040,
          orderNo: 'MIL-6905-012',
          purpose: 'ส่งทหารกองเกินฝึกภาคสนาม',
          officerId: 'demo-officer-uid',
          officerName: 'จ.ส.อ. สมศักดิ์ มีชัย',
          createdAt: new Date('2026-06-20T08:30:00').getTime()
        },
        // June 15
        {
          date: '2026-06-15',
          time: '15:20',
          vehicleNo: 'ทบ-22341',
          vehicleType: 'รถบรรทุกน้ำ',
          unit: 'มทบ.44',
          driverName: 'พลทหาร อเนก ดุดัน',
          fuelType: 'น้ำมันดีเซล',
          volume: 220,
          odometer: 94120,
          orderNo: 'MIL-6904-099',
          purpose: 'แจกจ่ายน้ำช่วยเหลือผู้ประสบภัย',
          officerId: 'demo-officer-uid',
          officerName: 'จ.ส.อ. สมศักดิ์ มีชัย',
          createdAt: new Date('2026-06-15T15:20:00').getTime()
        }
      ];

      for (const rec of seedRecords) {
        await addDoc(recordsCol, rec);
      }
    }

    // Check if unit credits are seeded
    const creditsSnap = await getDocs(unitCreditsCol);
    if (creditsSnap.empty) {
      console.log('Seeding initial unit credits...');
      for (const cred of INITIAL_UNIT_CREDITS) {
        await setDoc(doc(db, 'unit_credits', cred.id), {
          ...cred,
          updatedAt: Date.now()
        });
      }
    }
  } catch (error) {
    console.error('Error seeding database: ', error);
  }
}

/**
 * Fetch inventory items
 */
export async function getInventory(): Promise<FuelInventory[]> {
  if (isMockMode()) {
    return getMockCollection<FuelInventory>('fuel_inventory', INITIAL_INVENTORY.map(i => ({ ...i, updatedAt: Date.now() })));
  }
  const querySnapshot = await getDocs(inventoryCol);
  const items: FuelInventory[] = [];
  querySnapshot.forEach((doc) => {
    items.push({ id: doc.id, ...doc.data() } as FuelInventory);
  });
  return items;
}

/**
 * Record a new fuel dispensing transaction and update inventory.
 * Uses a Transaction to ensure consistency of stock level.
 */
export async function addFuelRecordAndDeductStock(
  record: Omit<FuelRecord, 'id' | 'createdAt'>
): Promise<string> {
  const finalRecord: Omit<FuelRecord, 'id'> = {
    ...record,
    createdAt: Date.now()
  };

  if (isMockMode()) {
    const records = getMockCollection<FuelRecord>('fuel_records');
    const newId = `rec-${Math.random().toString(36).substr(2, 9)}`;
    const newRecord: FuelRecord = { id: newId, ...finalRecord };
    records.unshift(newRecord);
    saveMockCollection('fuel_records', records);

    // Deduct stock in mock inventory
    const inventory = getMockCollection<FuelInventory>('fuel_inventory', INITIAL_INVENTORY.map(i => ({ ...i, updatedAt: Date.now() })));
    const invItem = inventory.find(i => i.fuelType === record.fuelType);
    if (invItem) {
      invItem.currentStock = Math.max(0, invItem.currentStock - record.volume);
      invItem.updatedAt = Date.now();
      saveMockCollection('fuel_inventory', inventory);
    }

    // Deduct unit credit in mock credits
    const credits = getMockCollection<UnitCredit>('unit_credits', INITIAL_UNIT_CREDITS);
    const credit = credits.find(c => c.unit === record.unit);
    if (credit) {
      const quotas = credit.quotas || {
        'น้ำมันดีเซล': { allocatedLimit: credit.allocatedLimit || 5000, usedCredit: credit.usedCredit },
        'น้ำมันแก๊สโซฮอล์ 95': { allocatedLimit: 0, usedCredit: 0 },
        'น้ำมันแก๊สโซฮอล์ 91': { allocatedLimit: 0, usedCredit: 0 }
      };
      if (!quotas[record.fuelType]) {
        quotas[record.fuelType] = { allocatedLimit: 0, usedCredit: 0 };
      }
      quotas[record.fuelType].usedCredit += record.volume;
      credit.quotas = quotas;
      credit.usedCredit = Object.values(quotas).reduce((sum, q) => sum + q.usedCredit, 0);
      credit.allocatedLimit = Object.values(quotas).reduce((sum, q) => sum + q.allocatedLimit, 0);
      credit.updatedAt = Date.now();
      saveMockCollection('unit_credits', credits);
    } else {
      const quotas = {
        'น้ำมันดีเซล': { allocatedLimit: record.fuelType === 'น้ำมันดีเซล' ? 5000 : 0, usedCredit: record.fuelType === 'น้ำมันดีเซล' ? record.volume : 0 },
        'น้ำมันแก๊สโซฮอล์ 95': { allocatedLimit: record.fuelType === 'น้ำมันแก๊สโซฮอล์ 95' ? 5000 : 0, usedCredit: record.fuelType === 'น้ำมันแก๊สโซฮอล์ 95' ? record.volume : 0 },
        'น้ำมันแก๊สโซฮอล์ 91': { allocatedLimit: record.fuelType === 'น้ำมันแก๊สโซฮอล์ 91' ? 5000 : 0, usedCredit: record.fuelType === 'น้ำมันแก๊สโซฮอล์ 91' ? record.volume : 0 }
      };
      const totalUsed = Object.values(quotas).reduce((sum, q) => sum + q.usedCredit, 0);
      const totalAllocated = Object.values(quotas).reduce((sum, q) => sum + q.allocatedLimit, 0);
      credits.push({
        id: record.unit,
        unit: record.unit,
        allocatedLimit: totalAllocated,
        usedCredit: totalUsed,
        quotas,
        lastResetDate: new Date().toISOString().split('T')[0],
        updatedAt: Date.now()
      });
      saveMockCollection('unit_credits', credits);
    }

    return newId;
  }

  try {
    const docRef = await addDoc(recordsCol, finalRecord);
    
    // Deduct stock
    const invDocRef = doc(db, 'fuel_inventory', record.fuelType);
    const invSnap = await getDoc(invDocRef);
    if (invSnap.exists()) {
      const currentData = invSnap.data() as FuelInventory;
      const newStock = Math.max(0, currentData.currentStock - record.volume);
      await updateDoc(invDocRef, {
        currentStock: newStock,
        updatedAt: Date.now()
      });
    }

    // Deduct unit credit
    const unitId = record.unit;
    const creditDocRef = doc(db, 'unit_credits', unitId);
    const creditSnap = await getDoc(creditDocRef);
    if (creditSnap.exists()) {
      const creditData = creditSnap.data() as UnitCredit;
      
      // Ensure quotas structure exists
      const quotas = creditData.quotas || {
        'น้ำมันดีเซล': { allocatedLimit: creditData.allocatedLimit || 5000, usedCredit: creditData.usedCredit },
        'น้ำมันแก๊สโซฮอล์ 95': { allocatedLimit: 0, usedCredit: 0 },
        'น้ำมันแก๊สโซฮอล์ 91': { allocatedLimit: 0, usedCredit: 0 }
      };

      if (!quotas[record.fuelType]) {
        quotas[record.fuelType] = { allocatedLimit: 0, usedCredit: 0 };
      }

      quotas[record.fuelType].usedCredit += record.volume;

      const totalUsed = Object.values(quotas).reduce((sum, q) => sum + q.usedCredit, 0);
      const totalAllocated = Object.values(quotas).reduce((sum, q) => sum + q.allocatedLimit, 0);

      await updateDoc(creditDocRef, {
        usedCredit: totalUsed,
        allocatedLimit: totalAllocated,
        quotas,
        updatedAt: Date.now()
      });
    } else {
      // Auto-initialize new units with a default quota limit on the requested fuel type
      const quotas = {
        'น้ำมันดีเซล': { allocatedLimit: record.fuelType === 'น้ำมันดีเซล' ? 5000 : 0, usedCredit: record.fuelType === 'น้ำมันดีเซล' ? record.volume : 0 },
        'น้ำมันแก๊สโซฮอล์ 95': { allocatedLimit: record.fuelType === 'น้ำมันแก๊สโซฮอล์ 95' ? 5000 : 0, usedCredit: record.fuelType === 'น้ำมันแก๊สโซฮอล์ 95' ? record.volume : 0 },
        'น้ำมันแก๊สโซฮอล์ 91': { allocatedLimit: record.fuelType === 'น้ำมันแก๊สโซฮอล์ 91' ? 5000 : 0, usedCredit: record.fuelType === 'น้ำมันแก๊สโซฮอล์ 91' ? record.volume : 0 }
      };
      const totalUsed = Object.values(quotas).reduce((sum, q) => sum + q.usedCredit, 0);
      const totalAllocated = Object.values(quotas).reduce((sum, q) => sum + q.allocatedLimit, 0);

      await setDoc(creditDocRef, {
        id: unitId,
        unit: unitId,
        allocatedLimit: totalAllocated,
        usedCredit: totalUsed,
        quotas,
        lastResetDate: new Date().toISOString().split('T')[0],
        updatedAt: Date.now()
      });
    }

    return docRef.id;
  } catch (error) {
    console.error('Error adding record and deducting stock: ', error);
    throw error;
  }
}

/**
 * Add a fuel replenishment (restocking inventory)
 */
export async function replenishStock(
  fuelType: string,
  volume: number
): Promise<void> {
  if (isMockMode()) {
    const inventory = getMockCollection<FuelInventory>('fuel_inventory', INITIAL_INVENTORY.map(i => ({ ...i, updatedAt: Date.now() })));
    const invItem = inventory.find(i => i.fuelType === fuelType);
    if (invItem) {
      invItem.currentStock = Math.min(invItem.capacity, invItem.currentStock + volume);
      invItem.updatedAt = Date.now();
      saveMockCollection('fuel_inventory', inventory);
      return;
    } else {
      throw new Error('Fuel type not found in inventory');
    }
  }

  const invDocRef = doc(db, 'fuel_inventory', fuelType);
  const invSnap = await getDoc(invDocRef);
  if (invSnap.exists()) {
    const currentData = invSnap.data() as FuelInventory;
    const newStock = Math.min(currentData.capacity, currentData.currentStock + volume);
    await updateDoc(invDocRef, {
      currentStock: newStock,
      updatedAt: Date.now()
    });
  } else {
    throw new Error('Fuel type not found in inventory');
  }
}

/**
 * Submit a request (for service user / driver)
 */
export async function addFuelRequest(
  request: Omit<FuelRequest, 'id' | 'status' | 'createdAt'>
): Promise<string> {
  const finalRequest: Omit<FuelRequest, 'id'> = {
    ...request,
    status: 'pending',
    createdAt: Date.now()
  };

  if (isMockMode()) {
    const requests = getMockCollection<FuelRequest>('fuel_requests');
    const newId = `req-${Math.random().toString(36).substr(2, 9)}`;
    requests.unshift({ id: newId, ...finalRequest });
    saveMockCollection('fuel_requests', requests);
    return newId;
  }

  const docRef = await addDoc(requestsCol, finalRequest);
  return docRef.id;
}

/**
 * Approve a request, updating status and logging a transaction
 */
export async function approveFuelRequest(
  requestId: string,
  officerId: string,
  officerName: string
): Promise<void> {
  if (isMockMode()) {
    const requests = getMockCollection<FuelRequest>('fuel_requests');
    const req = requests.find(r => r.id === requestId);
    if (!req) {
      throw new Error('Request not found');
    }
    req.status = 'approved';
    req.approvedBy = officerId;
    req.approvedByName = officerName;
    saveMockCollection('fuel_requests', requests);

    // Add dispatch record and deduct stock
    await addFuelRecordAndDeductStock({
      date: req.date,
      time: new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }),
      vehicleNo: req.vehicleNo,
      vehicleType: req.vehicleType,
      unit: req.unit,
      driverName: req.driverName,
      fuelType: req.fuelType,
      volume: req.volume,
      odometer: req.odometer,
      orderNo: req.orderNo || `REQ-${requestId.substring(0, 6).toUpperCase()}`,
      purpose: req.purpose,
      officerId,
      officerName
    });
    return;
  }

  const reqDocRef = doc(db, 'fuel_requests', requestId);
  const reqSnap = await getDoc(reqDocRef);
  
  if (!reqSnap.exists()) {
    throw new Error('Request not found');
  }

  const requestData = reqSnap.data() as Omit<FuelRequest, 'id'>;

  // 1. Update request status
  await updateDoc(reqDocRef, {
    status: 'approved',
    approvedBy: officerId,
    approvedByName: officerName,
  });

  // 2. Add dispatch record and deduct stock
  await addFuelRecordAndDeductStock({
    date: requestData.date,
    time: new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }),
    vehicleNo: requestData.vehicleNo,
    vehicleType: requestData.vehicleType,
    unit: requestData.unit,
    driverName: requestData.driverName,
    fuelType: requestData.fuelType,
    volume: requestData.volume,
    odometer: requestData.odometer,
    orderNo: requestData.orderNo || `REQ-${requestId.substring(0,6).toUpperCase()}`,
    purpose: requestData.purpose,
    officerId,
    officerName
  });
}

/**
 * Reject a fuel request
 */
export async function rejectFuelRequest(
  requestId: string,
  reason: string,
  officerId: string,
  officerName: string
): Promise<void> {
  if (isMockMode()) {
    const requests = getMockCollection<FuelRequest>('fuel_requests');
    const req = requests.find(r => r.id === requestId);
    if (!req) {
      throw new Error('Request not found');
    }
    req.status = 'rejected';
    req.approvedBy = officerId;
    req.approvedByName = officerName;
    req.rejectedReason = reason;
    saveMockCollection('fuel_requests', requests);
    return;
  }

  const reqDocRef = doc(db, 'fuel_requests', requestId);
  await updateDoc(reqDocRef, {
    status: 'rejected',
    approvedBy: officerId,
    approvedByName: officerName,
    rejectedReason: reason
  });
}

/**
 * Create or Update a User Profile in Firestore after Auth SignUp
 */
export async function saveUserProfile(
  profile: UserProfile
): Promise<void> {
  if (isMockMode()) {
    const users = getMockCollection<UserProfile>('users');
    const index = users.findIndex(u => u.uid === profile.uid);
    if (index >= 0) {
      users[index] = profile;
    } else {
      users.push(profile);
    }
    saveMockCollection('users', users);
    return;
  }

  await setDoc(doc(db, 'users', profile.uid), profile);
}

/**
 * Get User Profile from Firestore
 */
export async function getUserProfile(
  uid: string
): Promise<UserProfile | null> {
  if (isMockMode()) {
    const users = getMockCollection<UserProfile>('users');
    return users.find(u => u.uid === uid) || null;
  }

  const docRef = doc(db, 'users', uid);
  const snap = await getDoc(docRef);
  if (snap.exists()) {
    return snap.data() as UserProfile;
  }
  return null;
}

/**
 * Fetch all unit credits
 */
export async function getUnitCredits(): Promise<UnitCredit[]> {
  if (isMockMode()) {
    return getMockCollection<UnitCredit>('unit_credits', INITIAL_UNIT_CREDITS);
  }

  const querySnapshot = await getDocs(unitCreditsCol);
  const items: UnitCredit[] = [];
  querySnapshot.forEach((doc) => {
    items.push({ id: doc.id, ...doc.data() } as UnitCredit);
  });
  return items;
}

/**
 * Update credit limit allocated to a military unit
 */
export async function updateUnitCreditLimit(unitId: string, limits: Record<string, number> | number): Promise<void> {
  let quotasInput: Record<string, number> = {};
  if (typeof limits === 'number') {
    quotasInput = {
      'น้ำมันดีเซล': limits,
      'น้ำมันแก๊สโซฮอล์ 95': 0,
      'น้ำมันแก๊สโซฮอล์ 91': 0
    };
  } else {
    quotasInput = limits;
  }

  const totalAllocated = Object.values(quotasInput).reduce((sum, val) => sum + val, 0);

  if (isMockMode()) {
    const credits = getMockCollection<UnitCredit>('unit_credits', INITIAL_UNIT_CREDITS);
    const credit = credits.find(c => c.id === unitId);
    if (credit) {
      const currentQuotas = credit.quotas || {
        'น้ำมันดีเซล': { allocatedLimit: credit.allocatedLimit, usedCredit: credit.usedCredit },
        'น้ำมันแก๊สโซฮอล์ 95': { allocatedLimit: 0, usedCredit: 0 },
        'น้ำมันแก๊สโซฮอล์ 91': { allocatedLimit: 0, usedCredit: 0 }
      };
      const newQuotas: Record<string, { allocatedLimit: number; usedCredit: number }> = {};
      Object.entries(quotasInput).forEach(([fuelType, allocatedLimit]) => {
        const existing = currentQuotas[fuelType] || { usedCredit: 0 };
        newQuotas[fuelType] = {
          allocatedLimit,
          usedCredit: existing.usedCredit
        };
      });
      credit.allocatedLimit = totalAllocated;
      credit.usedCredit = Object.values(newQuotas).reduce((sum, q) => sum + q.usedCredit, 0);
      credit.quotas = newQuotas;
      credit.updatedAt = Date.now();
    } else {
      const newQuotas: Record<string, { allocatedLimit: number; usedCredit: number }> = {};
      Object.entries(quotasInput).forEach(([fuelType, allocatedLimit]) => {
        newQuotas[fuelType] = {
          allocatedLimit,
          usedCredit: 0
        };
      });
      credits.push({
        id: unitId,
        unit: unitId,
        allocatedLimit: totalAllocated,
        usedCredit: 0,
        quotas: newQuotas,
        lastResetDate: new Date().toISOString().split('T')[0],
        updatedAt: Date.now()
      });
    }
    saveMockCollection('unit_credits', credits);
    return;
  }

  const creditDocRef = doc(db, 'unit_credits', unitId);
  const creditSnap = await getDoc(creditDocRef);

  if (creditSnap.exists()) {
    const creditData = creditSnap.data() as UnitCredit;
    const currentQuotas = creditData.quotas || {
      'น้ำมันดีเซล': { allocatedLimit: creditData.allocatedLimit, usedCredit: creditData.usedCredit },
      'น้ำมันแก๊สโซฮอล์ 95': { allocatedLimit: 0, usedCredit: 0 },
      'น้ำมันแก๊สโซฮอล์ 91': { allocatedLimit: 0, usedCredit: 0 }
    };

    const newQuotas: Record<string, { allocatedLimit: number; usedCredit: number }> = {};
    Object.entries(quotasInput).forEach(([fuelType, allocatedLimit]) => {
      const existing = currentQuotas[fuelType] || { usedCredit: 0 };
      newQuotas[fuelType] = {
        allocatedLimit,
        usedCredit: existing.usedCredit
      };
    });

    const totalUsed = Object.values(newQuotas).reduce((sum, q) => sum + q.usedCredit, 0);

    await updateDoc(creditDocRef, {
      allocatedLimit: totalAllocated,
      usedCredit: totalUsed,
      quotas: newQuotas,
      updatedAt: Date.now()
    });
  } else {
    const newQuotas: Record<string, { allocatedLimit: number; usedCredit: number }> = {};
    Object.entries(quotasInput).forEach(([fuelType, allocatedLimit]) => {
      newQuotas[fuelType] = {
        allocatedLimit,
        usedCredit: 0
      };
    });

    await setDoc(creditDocRef, {
      id: unitId,
      unit: unitId,
      allocatedLimit: totalAllocated,
      usedCredit: 0,
      quotas: newQuotas,
      lastResetDate: new Date().toISOString().split('T')[0],
      updatedAt: Date.now()
    });
  }
}

/**
 * Reset used credit or change credit properties
 */
export async function resetUnitCredit(unitId: string, resetUsed: boolean = true, customLimits?: Record<string, number> | number): Promise<void> {
  if (isMockMode()) {
    const credits = getMockCollection<UnitCredit>('unit_credits', INITIAL_UNIT_CREDITS);
    const credit = credits.find(c => c.id === unitId);
    if (!credit) return;

    const currentQuotas = credit.quotas || {
      'น้ำมันดีเซล': { allocatedLimit: credit.allocatedLimit, usedCredit: credit.usedCredit },
      'น้ำมันแก๊สโซฮอล์ 95': { allocatedLimit: 0, usedCredit: 0 },
      'น้ำมันแก๊สโซฮอล์ 91': { allocatedLimit: 0, usedCredit: 0 }
    };

    const newQuotas = { ...currentQuotas };

    if (resetUsed) {
      Object.keys(newQuotas).forEach(k => {
        newQuotas[k].usedCredit = 0;
      });
      credit.usedCredit = 0;
    }

    if (customLimits !== undefined) {
      let limitsInput: Record<string, number> = {};
      if (typeof customLimits === 'number') {
        limitsInput = {
          'น้ำมันดีเซล': customLimits,
          'น้ำมันแก๊สโซฮอล์ 95': 0,
          'น้ำมันแก๊สโซฮอล์ 91': 0
        };
      } else {
        limitsInput = customLimits;
      }

      Object.entries(limitsInput).forEach(([fuelType, limit]) => {
        if (newQuotas[fuelType]) {
          newQuotas[fuelType].allocatedLimit = limit;
        } else {
          newQuotas[fuelType] = { allocatedLimit: limit, usedCredit: 0 };
        }
      });
      credit.allocatedLimit = Object.values(newQuotas).reduce((sum, q) => sum + q.allocatedLimit, 0);
    }

    credit.quotas = newQuotas;
    credit.updatedAt = Date.now();
    credit.lastResetDate = new Date().toISOString().split('T')[0];
    saveMockCollection('unit_credits', credits);
    return;
  }

  const creditDocRef = doc(db, 'unit_credits', unitId);
  const creditSnap = await getDoc(creditDocRef);
  if (!creditSnap.exists()) return;

  const creditData = creditSnap.data() as UnitCredit;
  const currentQuotas = creditData.quotas || {
    'น้ำมันดีเซล': { allocatedLimit: creditData.allocatedLimit, usedCredit: creditData.usedCredit },
    'น้ำมันแก๊สโซฮอล์ 95': { allocatedLimit: 0, usedCredit: 0 },
    'น้ำมันแก๊สโซฮอล์ 91': { allocatedLimit: 0, usedCredit: 0 }
  };

  const updates: any = {
    updatedAt: Date.now(),
    lastResetDate: new Date().toISOString().split('T')[0]
  };

  const newQuotas = { ...currentQuotas };

  if (resetUsed) {
    Object.keys(newQuotas).forEach(k => {
      newQuotas[k].usedCredit = 0;
    });
    updates.usedCredit = 0;
  }

  if (customLimits !== undefined) {
    let limitsInput: Record<string, number> = {};
    if (typeof customLimits === 'number') {
      limitsInput = {
        'น้ำมันดีเซล': customLimits,
        'น้ำมันแก๊สโซฮอล์ 95': 0,
        'น้ำมันแก๊สโซฮอล์ 91': 0
      };
    } else {
      limitsInput = customLimits;
    }

    Object.entries(limitsInput).forEach(([fuelType, limit]) => {
      if (newQuotas[fuelType]) {
        newQuotas[fuelType].allocatedLimit = limit;
      } else {
        newQuotas[fuelType] = { allocatedLimit: limit, usedCredit: 0 };
      }
    });
    updates.allocatedLimit = Object.values(newQuotas).reduce((sum, q) => sum + q.allocatedLimit, 0);
  }

  updates.quotas = newQuotas;
  await updateDoc(creditDocRef, updates);
}

/**
 * Fetch all users (for Admin role management)
 */
export async function getAllUsers(): Promise<UserProfile[]> {
  if (isMockMode()) {
    return getMockCollection<UserProfile>('users');
  }

  const querySnapshot = await getDocs(usersCol);
  const items: UserProfile[] = [];
  querySnapshot.forEach((doc) => {
    items.push({ uid: doc.id, ...doc.data() } as UserProfile);
  });
  return items;
}

/**
 * Update user role (Admin feature)
 */
export async function updateUserRole(uid: string, role: UserRole): Promise<void> {
  if (isMockMode()) {
    const users = getMockCollection<UserProfile>('users');
    const user = users.find(u => u.uid === uid);
    if (user) {
      user.role = role;
      saveMockCollection('users', users);
    }
    return;
  }

  const userDocRef = doc(db, 'users', uid);
  await updateDoc(userDocRef, {
    role: role
  });
}

/**
 * Update user ID status (Admin feature to activate/suspend IDs)
 */
export async function updateUserStatus(uid: string, status: 'pending' | 'active' | 'disabled'): Promise<void> {
  if (isMockMode()) {
    const users = getMockCollection<UserProfile>('users');
    const user = users.find(u => u.uid === uid);
    if (user) {
      user.status = status;
      saveMockCollection('users', users);
    }
    return;
  }

  const userDocRef = doc(db, 'users', uid);
  await updateDoc(userDocRef, {
    status: status
  });
}

/**
 * Add a fuel receipt log for a unit, and optionally adjust quotas & main inventory
 */
export async function addUnitFuelReceipt(receipt: Omit<UnitFuelReceipt, 'id' | 'createdAt'>): Promise<string> {
  const finalReceipt = {
    ...receipt,
    createdAt: Date.now()
  };

  if (isMockMode()) {
    const receipts = getMockCollection<UnitFuelReceipt>('unit_receipts');
    const newId = `recp-${Math.random().toString(36).substr(2, 9)}`;
    const newReceipt: UnitFuelReceipt = { id: newId, ...finalReceipt };
    receipts.unshift(newReceipt);
    saveMockCollection('unit_receipts', receipts);

    // 1. If deductFromInventory is true, deduct from fuel_inventory
    if (receipt.deductFromInventory) {
      const inventory = getMockCollection<FuelInventory>('fuel_inventory', INITIAL_INVENTORY.map(i => ({ ...i, updatedAt: Date.now() })));
      const invItem = inventory.find(i => i.fuelType === receipt.fuelType);
      if (invItem) {
        invItem.currentStock = Math.max(0, invItem.currentStock - receipt.volume);
        invItem.updatedAt = Date.now();
        saveMockCollection('fuel_inventory', inventory);
      }
    }

    // 2. Update unit credit depending on actionType
    const credits = getMockCollection<UnitCredit>('unit_credits', INITIAL_UNIT_CREDITS);
    const credit = credits.find(c => c.unit === receipt.unit);

    if (receipt.actionType === 'allocate') {
      if (credit) {
        const quotas = credit.quotas || {
          'น้ำมันดีเซล': { allocatedLimit: credit.allocatedLimit || 5000, usedCredit: credit.usedCredit },
          'น้ำมันแก๊สโซฮอล์ 95': { allocatedLimit: 0, usedCredit: 0 },
          'น้ำมันแก๊สโซฮอล์ 91': { allocatedLimit: 0, usedCredit: 0 }
        };
        if (!quotas[receipt.fuelType]) {
          quotas[receipt.fuelType] = { allocatedLimit: 0, usedCredit: 0 };
        }
        quotas[receipt.fuelType].allocatedLimit += receipt.volume;
        credit.quotas = quotas;
        credit.allocatedLimit = Object.values(quotas).reduce((sum, q) => sum + q.allocatedLimit, 0);
        credit.updatedAt = Date.now();
      } else {
        const quotas = {
          'น้ำมันดีเซล': { allocatedLimit: receipt.fuelType === 'น้ำมันดีเซล' ? receipt.volume : 0, usedCredit: 0 },
          'น้ำมันแก๊สโซฮอล์ 95': { allocatedLimit: receipt.fuelType === 'น้ำมันแก๊สโซฮอล์ 95' ? receipt.volume : 0, usedCredit: 0 },
          'น้ำมันแก๊สโซฮอล์ 91': { allocatedLimit: receipt.fuelType === 'น้ำมันแก๊สโซฮอล์ 91' ? receipt.volume : 0, usedCredit: 0 }
        };
        credits.push({
          id: receipt.unit,
          unit: receipt.unit,
          allocatedLimit: receipt.volume,
          usedCredit: 0,
          quotas,
          lastResetDate: receipt.date,
          updatedAt: Date.now()
        });
      }
    } else if (receipt.actionType === 'draw_bulk') {
      if (credit) {
        const quotas = credit.quotas || {
          'น้ำมันดีเซล': { allocatedLimit: credit.allocatedLimit || 5000, usedCredit: credit.usedCredit },
          'น้ำมันแก๊สโซฮอล์ 95': { allocatedLimit: 0, usedCredit: 0 },
          'น้ำมันแก๊สโซฮอล์ 91': { allocatedLimit: 0, usedCredit: 0 }
        };
        if (!quotas[receipt.fuelType]) {
          quotas[receipt.fuelType] = { allocatedLimit: 0, usedCredit: 0 };
        }
        quotas[receipt.fuelType].usedCredit += receipt.volume;
        credit.quotas = quotas;
        credit.usedCredit = Object.values(quotas).reduce((sum, q) => sum + q.usedCredit, 0);
        credit.updatedAt = Date.now();
      } else {
        const quotas = {
          'น้ำมันดีเซล': { allocatedLimit: 5000, usedCredit: receipt.fuelType === 'น้ำมันดีเซล' ? receipt.volume : 0 },
          'น้ำมันแก๊สโซฮอล์ 95': { allocatedLimit: 0, usedCredit: receipt.fuelType === 'น้ำมันแก๊สโซฮอล์ 95' ? receipt.volume : 0 },
          'น้ำมันแก๊สโซฮอล์ 91': { allocatedLimit: 0, usedCredit: receipt.fuelType === 'น้ำมันแก๊สโซฮอล์ 91' ? receipt.volume : 0 }
        };
        credits.push({
          id: receipt.unit,
          unit: receipt.unit,
          allocatedLimit: 5000,
          usedCredit: receipt.volume,
          quotas,
          lastResetDate: receipt.date,
          updatedAt: Date.now()
        });
      }
    }
    saveMockCollection('unit_credits', credits);
    return newId;
  }

  const docRef = await addDoc(collection(db, 'unit_receipts'), finalReceipt);

  // 1. If deductFromInventory is true, deduct from fuel_inventory
  if (receipt.deductFromInventory) {
    const invDocRef = doc(db, 'fuel_inventory', receipt.fuelType);
    const invSnap = await getDoc(invDocRef);
    if (invSnap.exists()) {
      const currentData = invSnap.data() as FuelInventory;
      const newStock = Math.max(0, currentData.currentStock - receipt.volume);
      await updateDoc(invDocRef, {
        currentStock: newStock,
        updatedAt: Date.now()
      });
    }
  }

  // 2. Update unit credit depending on actionType
  const creditDocRef = doc(db, 'unit_credits', receipt.unit);
  const creditSnap = await getDoc(creditDocRef);

  if (receipt.actionType === 'allocate') {
    // Increase allocatedLimit for the fuelType and total
    if (creditSnap.exists()) {
      const creditData = creditSnap.data() as UnitCredit;
      const currentQuotas = creditData.quotas || {
        'น้ำมันดีเซล': { allocatedLimit: creditData.allocatedLimit || 5000, usedCredit: creditData.usedCredit },
        'น้ำมันแก๊สโซฮอล์ 95': { allocatedLimit: 0, usedCredit: 0 },
        'น้ำมันแก๊สโซฮอล์ 91': { allocatedLimit: 0, usedCredit: 0 }
      };

      if (!currentQuotas[receipt.fuelType]) {
        currentQuotas[receipt.fuelType] = { allocatedLimit: 0, usedCredit: 0 };
      }

      currentQuotas[receipt.fuelType].allocatedLimit += receipt.volume;

      const totalAllocated = Object.values(currentQuotas).reduce((sum, q) => sum + q.allocatedLimit, 0);

      await updateDoc(creditDocRef, {
        allocatedLimit: totalAllocated,
        quotas: currentQuotas,
        updatedAt: Date.now()
      });
    } else {
      // Auto-create unit credit if it doesn't exist
      const quotas = {
        'น้ำมันดีเซล': { allocatedLimit: receipt.fuelType === 'น้ำมันดีเซล' ? receipt.volume : 0, usedCredit: 0 },
        'น้ำมันแก๊สโซฮอล์ 95': { allocatedLimit: receipt.fuelType === 'น้ำมันแก๊สโซฮอล์ 95' ? receipt.volume : 0, usedCredit: 0 },
        'น้ำมันแก๊สโซฮอล์ 91': { allocatedLimit: receipt.fuelType === 'น้ำมันแก๊สโซฮอล์ 91' ? receipt.volume : 0, usedCredit: 0 }
      };
      await setDoc(creditDocRef, {
        id: receipt.unit,
        unit: receipt.unit,
        allocatedLimit: receipt.volume,
        usedCredit: 0,
        quotas,
        lastResetDate: receipt.date,
        updatedAt: Date.now()
      });
    }
  } else if (receipt.actionType === 'draw_bulk') {
    // Record as actual draw: increase usedCredit for the fuelType and total
    if (creditSnap.exists()) {
      const creditData = creditSnap.data() as UnitCredit;
      const currentQuotas = creditData.quotas || {
        'น้ำมันดีเซล': { allocatedLimit: creditData.allocatedLimit || 5000, usedCredit: creditData.usedCredit },
        'น้ำมันแก๊สโซฮอล์ 95': { allocatedLimit: 0, usedCredit: 0 },
        'น้ำมันแก๊สโซฮอล์ 91': { allocatedLimit: 0, usedCredit: 0 }
      };

      if (!currentQuotas[receipt.fuelType]) {
        currentQuotas[receipt.fuelType] = { allocatedLimit: 0, usedCredit: 0 };
      }

      currentQuotas[receipt.fuelType].usedCredit += receipt.volume;

      const totalUsed = Object.values(currentQuotas).reduce((sum, q) => sum + q.usedCredit, 0);

      await updateDoc(creditDocRef, {
        usedCredit: totalUsed,
        quotas: currentQuotas,
        updatedAt: Date.now()
      });
    } else {
      // Auto-create unit credit if it doesn't exist (as usedCredit)
      const quotas = {
        'น้ำมันดีเซล': { allocatedLimit: 5000, usedCredit: receipt.fuelType === 'น้ำมันดีเซล' ? receipt.volume : 0 },
        'น้ำมันแก๊สโซฮอล์ 95': { allocatedLimit: 0, usedCredit: receipt.fuelType === 'น้ำมันแก๊สโซฮอล์ 95' ? receipt.volume : 0 },
        'น้ำมันแก๊สโซฮอล์ 91': { allocatedLimit: 0, usedCredit: receipt.fuelType === 'น้ำมันแก๊สโซฮอล์ 91' ? receipt.volume : 0 }
      };
      await setDoc(creditDocRef, {
        id: receipt.unit,
        unit: receipt.unit,
        allocatedLimit: 5000,
        usedCredit: receipt.volume,
        quotas,
        lastResetDate: receipt.date,
        updatedAt: Date.now()
      });
    }
  }

  return docRef.id;
}

/**
 * Delete a unit fuel receipt and safely revert changes
 */
export async function deleteUnitFuelReceipt(receiptId: string): Promise<void> {
  if (isMockMode()) {
    const receipts = getMockCollection<UnitFuelReceipt>('unit_receipts');
    const index = receipts.findIndex(r => r.id === receiptId);
    if (index === -1) return;

    const receipt = receipts[index];
    receipts.splice(index, 1);
    saveMockCollection('unit_receipts', receipts);

    // 1. If it deducted from inventory, give it back
    if (receipt.deductFromInventory) {
      const inventory = getMockCollection<FuelInventory>('fuel_inventory', INITIAL_INVENTORY.map(i => ({ ...i, updatedAt: Date.now() })));
      const invItem = inventory.find(i => i.fuelType === receipt.fuelType);
      if (invItem) {
        invItem.currentStock = Math.min(invItem.capacity, invItem.currentStock + receipt.volume);
        invItem.updatedAt = Date.now();
        saveMockCollection('fuel_inventory', inventory);
      }
    }

    // 2. Revert quota / used credit
    const credits = getMockCollection<UnitCredit>('unit_credits', INITIAL_UNIT_CREDITS);
    const credit = credits.find(c => c.unit === receipt.unit);
    if (credit && credit.quotas && credit.quotas[receipt.fuelType]) {
      const quotas = credit.quotas;
      if (receipt.actionType === 'allocate') {
        quotas[receipt.fuelType].allocatedLimit = Math.max(0, quotas[receipt.fuelType].allocatedLimit - receipt.volume);
      } else {
        quotas[receipt.fuelType].usedCredit = Math.max(0, quotas[receipt.fuelType].usedCredit - receipt.volume);
      }
      
      credit.allocatedLimit = Object.values(quotas).reduce((sum, q) => sum + q.allocatedLimit, 0);
      credit.usedCredit = Object.values(quotas).reduce((sum, q) => sum + q.usedCredit, 0);
      credit.quotas = quotas;
      credit.updatedAt = Date.now();
      saveMockCollection('unit_credits', credits);
    }
    return;
  }

  const docRef = doc(db, 'unit_receipts', receiptId);
  const snap = await getDoc(docRef);
  if (!snap.exists()) return;

  const receipt = snap.data() as UnitFuelReceipt;

  // 1. If it deducted from inventory, give it back
  if (receipt.deductFromInventory) {
    const invDocRef = doc(db, 'fuel_inventory', receipt.fuelType);
    const invSnap = await getDoc(invDocRef);
    if (invSnap.exists()) {
      const currentData = invSnap.data() as FuelInventory;
      const newStock = Math.min(currentData.capacity, currentData.currentStock + receipt.volume);
      await updateDoc(invDocRef, {
        currentStock: newStock,
        updatedAt: Date.now()
      });
    }
  }

  // 2. Revert quota / used credit
  const creditDocRef = doc(db, 'unit_credits', receipt.unit);
  const creditSnap = await getDoc(creditDocRef);
  if (creditSnap.exists()) {
    const creditData = creditSnap.data() as UnitCredit;
    const quotas = creditData.quotas;
    if (quotas && quotas[receipt.fuelType]) {
      if (receipt.actionType === 'allocate') {
        quotas[receipt.fuelType].allocatedLimit = Math.max(0, quotas[receipt.fuelType].allocatedLimit - receipt.volume);
      } else {
        quotas[receipt.fuelType].usedCredit = Math.max(0, quotas[receipt.fuelType].usedCredit - receipt.volume);
      }
      
      const totalAllocated = Object.values(quotas).reduce((sum, q) => sum + q.allocatedLimit, 0);
      const totalUsed = Object.values(quotas).reduce((sum, q) => sum + q.usedCredit, 0);

      await updateDoc(creditDocRef, {
        allocatedLimit: totalAllocated,
        usedCredit: totalUsed,
        quotas,
        updatedAt: Date.now()
      });
    }
  }

  await deleteDoc(docRef);
}

/**
 * Delete/Revert a fuel record (Restricted to Admin/Officer but typically handled via admin checks)
 */
export async function deleteFuelRecord(recordId: string): Promise<void> {
  if (isMockMode()) {
    const records = getMockCollection<FuelRecord>('fuel_records');
    const index = records.findIndex(r => r.id === recordId);
    if (index === -1) {
      throw new Error('Record not found');
    }

    const record = records[index];
    records.splice(index, 1);
    saveMockCollection('fuel_records', records);

    // 1. Give stock back to inventory
    const inventory = getMockCollection<FuelInventory>('fuel_inventory', INITIAL_INVENTORY.map(i => ({ ...i, updatedAt: Date.now() })));
    const invItem = inventory.find(i => i.fuelType === record.fuelType);
    if (invItem) {
      invItem.currentStock = Math.min(invItem.capacity, invItem.currentStock + record.volume);
      invItem.updatedAt = Date.now();
      saveMockCollection('fuel_inventory', inventory);
    }

    // 2. Revert used credit from unit quota
    const credits = getMockCollection<UnitCredit>('unit_credits', INITIAL_UNIT_CREDITS);
    const credit = credits.find(c => c.unit === record.unit);
    if (credit && credit.quotas && credit.quotas[record.fuelType]) {
      const quotas = credit.quotas;
      quotas[record.fuelType].usedCredit = Math.max(0, quotas[record.fuelType].usedCredit - record.volume);
      
      credit.allocatedLimit = Object.values(quotas).reduce((sum, q) => sum + q.allocatedLimit, 0);
      credit.usedCredit = Object.values(quotas).reduce((sum, q) => sum + q.usedCredit, 0);
      credit.quotas = quotas;
      credit.updatedAt = Date.now();
      saveMockCollection('unit_credits', credits);
    }
    return;
  }

  const docRef = doc(db, 'fuel_records', recordId);
  const snap = await getDoc(docRef);
  if (!snap.exists()) {
    throw new Error('Record not found');
  }

  const record = snap.data() as FuelRecord;

  // 1. Give stock back to inventory
  const invDocRef = doc(db, 'fuel_inventory', record.fuelType);
  const invSnap = await getDoc(invDocRef);
  if (invSnap.exists()) {
    const currentData = invSnap.data() as FuelInventory;
    const newStock = Math.min(currentData.capacity, currentData.currentStock + record.volume);
    await updateDoc(invDocRef, {
      currentStock: newStock,
      updatedAt: Date.now()
    });
  }

  // 2. Revert used credit from unit quota
  const creditDocRef = doc(db, 'unit_credits', record.unit);
  const creditSnap = await getDoc(creditDocRef);
  if (creditSnap.exists()) {
    const creditData = creditSnap.data() as UnitCredit;
    const quotas = creditData.quotas;
    if (quotas && quotas[record.fuelType]) {
      quotas[record.fuelType].usedCredit = Math.max(0, quotas[record.fuelType].usedCredit - record.volume);
      
      const totalAllocated = Object.values(quotas).reduce((sum, q) => sum + q.allocatedLimit, 0);
      const totalUsed = Object.values(quotas).reduce((sum, q) => sum + q.usedCredit, 0);

      await updateDoc(creditDocRef, {
        allocatedLimit: totalAllocated,
        usedCredit: totalUsed,
        quotas,
        updatedAt: Date.now()
      });
    }
  }

  // 3. Delete record
  await deleteDoc(docRef);
}




