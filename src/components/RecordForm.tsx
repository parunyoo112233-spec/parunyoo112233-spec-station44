/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { FuelInventory, UserProfile, FuelRecord, UnitCredit } from '../types';
import { addFuelRecordAndDeductStock } from '../lib/db-helpers';
import { db, collection, onSnapshot } from '../firebase';
import { Fuel, Clipboard, Truck, User, Compass, PenTool, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';

interface RecordFormProps {
  currentUser: UserProfile;
  inventory: FuelInventory[];
  onRecordAdded: () => void;
}

export default function RecordForm({ currentUser, inventory, onRecordAdded }: RecordFormProps) {
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [vehicleNo, setVehicleNo] = useState('');
  const [vehicleType, setVehicleType] = useState('รถบรรทุกขนาดกลาง (FTS)');
  const [unit, setUnit] = useState('');
  const [driverName, setDriverName] = useState('');
  const [fuelType, setFuelType] = useState('น้ำมันดีเซล');
  const [volume, setVolume] = useState<number | ''>('');
  const [odometer, setOdometer] = useState<number | ''>('');
  const [orderNo, setOrderNo] = useState('');
  const [purpose, setPurpose] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [unitCredits, setUnitCredits] = useState<UnitCredit[]>([]);

  // Subscribe to real-time unit credits for live quota verification
  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'unit_credits'), (snapshot) => {
      const list: UnitCredit[] = [];
      snapshot.forEach((doc) => {
        list.push({ id: doc.id, ...doc.data() } as UnitCredit);
      });
      setUnitCredits(list);
    });
    return () => unsubscribe();
  }, []);

  const matchedUnitCredit = unitCredits.find(
    uc => (uc.unit || '').toLowerCase() === (unit || '').trim().toLowerCase()
  );

  // Get specific quota for current selected fuelType
  const specificQuota = matchedUnitCredit?.quotas?.[fuelType] || (matchedUnitCredit ? {
    allocatedLimit: fuelType === 'น้ำมันดีเซล' ? matchedUnitCredit.allocatedLimit : 0,
    usedCredit: fuelType === 'น้ำมันดีเซล' ? matchedUnitCredit.usedCredit : 0
  } : null);

  const remainingQuota = specificQuota ? specificQuota.allocatedLimit - specificQuota.usedCredit : 0;

  // Set default current date and time
  useEffect(() => {
    const now = new Date();
    const localDate = now.toISOString().split('T')[0];
    const localTime = now.toTimeString().split(' ')[0].substring(0, 5);
    setDate(localDate);
    setTime(localTime);
  }, []);

  // Set default fuel type based on first inventory item if available
  useEffect(() => {
    if (inventory.length > 0) {
      setFuelType(inventory[0].fuelType);
    }
  }, [inventory]);

  // Selected fuel item stock
  const selectedFuelStock = inventory.find(inv => inv.fuelType === fuelType);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    // Field Validations
    if (!vehicleNo || !unit || !driverName || !fuelType || !volume || !odometer || !orderNo || !purpose) {
      setError('กรุณากรอกข้อมูลให้ครบถ้วนทุกช่อง');
      return;
    }

    if (Number(volume) <= 0) {
      setError('จำนวนลิตรต้องมากกว่า 0');
      return;
    }

    if (Number(odometer) < 0) {
      setError('เลขไมล์สะสมต้องไม่ต่ำกว่า 0');
      return;
    }

    // Stock Validation
    if (selectedFuelStock && Number(volume) > selectedFuelStock.currentStock) {
      setError(`ไม่สามารถจ่ายน้ำมันได้เนื่องจากยอดจ่ายสูงกว่าปริมาณคงเหลือในคลัง (${(selectedFuelStock.currentStock ?? 0).toLocaleString()} ลิตร)`);
      return;
    }

    setLoading(true);

    try {
      await addFuelRecordAndDeductStock({
        date,
        time,
        vehicleNo,
        vehicleType,
        unit,
        driverName,
        fuelType,
        volume: Number(volume),
        odometer: Number(odometer),
        orderNo,
        purpose,
        officerId: currentUser.uid,
        officerName: `${currentUser.rank} ${currentUser.name}`
      });

      setSuccess('บันทึกการเบิกจ่ายน้ำมันและหักยอดในคลังสำเร็จเสร็จสิ้น!');
      
      // Clear form inputs but keep defaults
      setVehicleNo('');
      setUnit('');
      setDriverName('');
      setVolume('');
      setOdometer('');
      setOrderNo('');
      setPurpose('');

      // Refresh parent state
      onRecordAdded();
    } catch (err: any) {
      setError('บันทึกล้มเหลว: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Predefined vehicle types commonly used in Thai military
  const VEHICLE_TYPES = [
    'รถบรรทุกขนาดกลาง (FTS)',
    'รถยนต์นั่งตรวจการณ์ (M151)',
    'รถบรรทุก 1.25 ตัน (M561)',
    'รถกระบะบรรทุกทั่วไป',
    'รถตู้ขนส่งกำลังพล',
    'รถบัสขนกำลังพลขนาดใหญ่',
    'รถตักดิน/แทรกเตอร์ทหาร',
    'รถจักรยานยนต์สายตรวจ'
  ];

  return (
    <div id="record_form_container" className="max-w-2xl mx-auto bg-slate-800 p-5 sm:p-6 rounded-2xl border border-slate-700/60 shadow-xl">
      <div className="flex items-center gap-3 border-b border-slate-700/50 pb-4 mb-5">
        <div className="p-2 bg-emerald-600/10 text-emerald-400 rounded-lg">
          <Fuel className="h-5 w-5" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-white">บันทึกการจ่ายน้ำมันเชื้อเพลิง</h2>
          <p className="text-xs text-slate-400">กรอกแบบฟอร์มเบิกจ่ายน้ำมันและตัดยอดคงเหลือในคลังอัติโนมัติ</p>
        </div>
      </div>

      {error && (
        <div className="mb-4 bg-red-950/40 border border-red-500/30 text-red-400 p-3.5 rounded-xl text-sm flex items-start gap-2 animate-fadeIn">
          <AlertCircle className="h-5 w-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="mb-4 bg-emerald-950/40 border border-emerald-500/30 text-emerald-400 p-3.5 rounded-xl text-sm flex items-start gap-2 animate-fadeIn">
          <CheckCircle className="h-5 w-5 flex-shrink-0" />
          <span>{success}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        
        {/* Date and Time Group */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
              วันที่จ่ายน้ำมัน
            </label>
            <input
              type="date"
              required
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full px-3.5 py-2 bg-slate-900 border border-slate-700 rounded-xl focus:border-emerald-500 outline-none text-white text-sm"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
              เวลาที่จ่ายน้ำมัน
            </label>
            <input
              type="time"
              required
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="w-full px-3.5 py-2 bg-slate-900 border border-slate-700 rounded-xl focus:border-emerald-500 outline-none text-white text-sm"
            />
          </div>
        </div>

        {/* Order Number / Document reference */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
            เลขที่ใบสั่งจ่ายน้ำมัน (บด.4 หรือ รหัสจ่าย)
          </label>
          <div className="relative">
            <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-500">
              <Clipboard className="h-4 w-4" />
            </span>
            <input
              type="text"
              required
              placeholder="เช่น MIL-6906-xxx หรือ 123/2569"
              value={orderNo}
              onChange={(e) => setOrderNo(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-slate-900 border border-slate-700 rounded-xl focus:border-emerald-500 outline-none text-white text-sm"
            />
          </div>
        </div>

        {/* Vehicle Information */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
              หมายเลขกงจักร / ทะเบียนรถทหาร
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-500">
                <Truck className="h-4 w-4" />
              </span>
              <input
                type="text"
                required
                placeholder="เช่น ทบ-12345 หรือ กงจักร-xxxx"
                value={vehicleNo}
                onChange={(e) => setVehicleNo(e.target.value.toUpperCase())}
                className="w-full pl-10 pr-4 py-2.5 bg-slate-900 border border-slate-700 rounded-xl focus:border-emerald-500 outline-none text-white text-sm"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
              ประเภทรถยนต์ทหาร
            </label>
            <select
              value={vehicleType}
              onChange={(e) => setVehicleType(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl focus:border-emerald-500 outline-none text-white text-sm"
            >
              {VEHICLE_TYPES.map(type => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Requester / Unit and Driver */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
              สังกัดหน่วยเบิก (เช่น พัน.ส.มทบ.44, ร.25)
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-500">
                <Compass className="h-4 w-4" />
              </span>
              <input
                type="text"
                required
                placeholder="ระบุสังกัดหน่วยงาน"
                list="unit-options"
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-slate-900 border border-slate-700 rounded-xl focus:border-emerald-500 outline-none text-white text-sm"
              />
              <datalist id="unit-options">
                {unitCredits.map(uc => (
                  <option key={uc.id} value={uc.unit} />
                ))}
              </datalist>
            </div>
            
            {/* Live credit info helper */}
            {unit.trim() && (
              <div className="mt-1 text-xs">
                {matchedUnitCredit ? (
                  <div className="bg-slate-900/60 p-2.5 rounded-xl border border-slate-700/60 flex items-center justify-between text-[11px]">
                    <span className="text-slate-400">
                      เครดิตใช้สะสม: <strong className="text-white">{(matchedUnitCredit.usedCredit ?? 0).toLocaleString()}</strong> / {(matchedUnitCredit.allocatedLimit ?? 0).toLocaleString()} L
                    </span>
                    <span className={(matchedUnitCredit.usedCredit ?? 0) >= (matchedUnitCredit.allocatedLimit ?? 0) ? "text-red-400 font-bold" : "text-emerald-400 font-bold"}>
                      คงเหลือ: {((matchedUnitCredit.allocatedLimit ?? 0) - (matchedUnitCredit.usedCredit ?? 0)).toLocaleString()} L
                    </span>
                  </div>
                ) : (
                  <div className="text-slate-500 italic text-[10px] px-1">
                    * หน่วยงานใหม่ จะได้รับโควตากลาง 5,000 ลิตร เมื่อบันทึกสำเร็จ
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
              ชื่อผู้รับ/ผู้ใช้บริการ (Receiver Name)
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-500">
                <User className="h-4 w-4" />
              </span>
              <input
                type="text"
                required
                placeholder="เช่น พลทหาร วิชัย หรือ ส.ต. สมชาติ"
                value={driverName}
                onChange={(e) => setDriverName(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-slate-900 border border-slate-700 rounded-xl focus:border-emerald-500 outline-none text-white text-sm"
              />
            </div>
          </div>
        </div>

        {/* Fuel and Volume Group */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
              ประเภทน้ำมันที่เบิก
            </label>
            <select
              value={fuelType}
              onChange={(e) => setFuelType(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl focus:border-emerald-500 outline-none text-white text-sm"
            >
              {inventory.map(inv => (
                <option key={inv.fuelType} value={inv.fuelType}>
                  {inv.fuelType} (คงเหลือ {(inv.currentStock ?? 0).toLocaleString()} L)
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
              จำนวนจ่าย (ลิตร)
            </label>
            <input
              type="number"
              required
              min="1"
              placeholder="จำนวนเต็มหรือทศนิยม"
              value={volume}
              onChange={(e) => setVolume(e.target.value !== '' ? Number(e.target.value) : '')}
              className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl focus:border-emerald-500 outline-none text-white text-sm"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
              เลขไมล์สะสมรถยนต์ (กม.)
            </label>
            <input
              type="number"
              required
              min="0"
              placeholder="เช่น 12450"
              value={odometer}
              onChange={(e) => setOdometer(e.target.value !== '' ? Number(e.target.value) : '')}
              className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl focus:border-emerald-500 outline-none text-white text-sm"
            />
          </div>
        </div>

        {/* Purpose / Mission */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
            ภารกิจ / วัตถุประสงค์ในการเบิกใช้
          </label>
          <div className="relative">
            <span className="absolute top-3 left-3 text-slate-500">
              <PenTool className="h-4 w-4" />
            </span>
            <textarea
              required
              placeholder="เช่น ลาดตระเวนพื้นที่ชายแดน หรือ ขนย้ายเอกสารฉุกเฉินนอกหน่วย..."
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
              rows={2}
              className="w-full pl-10 pr-4 py-2.5 bg-slate-900 border border-slate-700 rounded-xl focus:border-emerald-500 outline-none text-white text-sm"
            />
          </div>
        </div>

        {/* Submitter */}
        <div className="bg-slate-900/40 p-3 rounded-xl border border-slate-700/50 flex items-center justify-between text-xs text-slate-400">
          <span>เจ้าหน้าที่บันทึกจ่าย: <strong className="text-white">{currentUser.rank} {currentUser.name}</strong></span>
          <span>คลัง มทบ.44</span>
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={loading}
          className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-500 text-white font-medium rounded-xl shadow-lg shadow-emerald-950/20 active:scale-[0.98] transition duration-150 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 text-sm font-sans"
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            'บันทึกจ่ายน้ำมันพร้อมหักคลัง'
          )}
        </button>

      </form>
    </div>
  );
}
