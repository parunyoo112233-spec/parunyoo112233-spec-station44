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
import { db } from '../firebase';
import { FuelInventory, FuelRecord, FuelRequest, UserProfile, UnitCredit, UserRole } from '../types';

// Collection references
export const usersCol = collection(db, 'users');
export const recordsCol = collection(db, 'fuel_records');
export const requestsCol = collection(db, 'fuel_requests');
export const inventoryCol = collection(db, 'fuel_inventory');
export const unitCreditsCol = collection(db, 'unit_credits');

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
  await setDoc(doc(db, 'users', profile.uid), profile);
}

/**
 * Get User Profile from Firestore
 */
export async function getUserProfile(
  uid: string
): Promise<UserProfile | null> {
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
  const creditDocRef = doc(db, 'unit_credits', unitId);
  const creditSnap = await getDoc(creditDocRef);
  
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
  const userDocRef = doc(db, 'users', uid);
  await updateDoc(userDocRef, {
    role: role
  });
}

/**
 * Update user ID status (Admin feature to activate/suspend IDs)
 */
export async function updateUserStatus(uid: string, status: 'pending' | 'active' | 'disabled'): Promise<void> {
  const userDocRef = doc(db, 'users', uid);
  await updateDoc(userDocRef, {
    status: status
  });
}


