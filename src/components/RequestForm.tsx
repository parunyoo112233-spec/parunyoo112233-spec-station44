/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { FuelInventory, UserProfile } from '../types';
import { addFuelRequest } from '../lib/db-helpers';
import { Fuel, Clipboard, Truck, User, Compass, PenTool, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';

interface RequestFormProps {
  currentUser: UserProfile;
  inventory: FuelInventory[];
  onRequestSubmitted: () => void;
}

export default function RequestForm({ currentUser, inventory, onRequestSubmitted }: RequestFormProps) {
  const [date, setDate] = useState('');
  const [vehicleNo, setVehicleNo] = useState('');
  const [vehicleType, setVehicleType] = useState('รถบรรทุกขนาดกลาง (FTS)');
  const [unit, setUnit] = useState(currentUser.department || '');
  const [driverName, setDriverName] = useState(`${currentUser.rank} ${currentUser.name}` || '');
  const [fuelType, setFuelType] = useState('น้ำมันดีเซล');
  const [volume, setVolume] = useState<number | ''>('');
  const [odometer, setOdometer] = useState<number | ''>('');
  const [orderNo, setOrderNo] = useState('');
  const [purpose, setPurpose] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    const now = new Date();
    setDate(now.toISOString().split('T')[0]);
  }, []);

  useEffect(() => {
    if (inventory.length > 0) {
      setFuelType(inventory[0].fuelType);
    }
  }, [inventory]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!vehicleNo || !unit || !driverName || !fuelType || !volume || !purpose) {
      setError('กรุณากรอกข้อมูลที่จำเป็นให้ครบถ้วน');
      return;
    }

    if (Number(volume) <= 0) {
      setError('จำนวนลิตรต้องมากกว่า 0');
      return;
    }

    setLoading(true);

    try {
      await addFuelRequest({
        date,
        vehicleNo,
        vehicleType,
        unit,
        driverName,
        fuelType,
        volume: Number(volume),
        odometer: 0,
        orderNo: orderNo || 'ไม่มี (ยื่นผ่านแอป)',
        purpose,
        requestedBy: currentUser.uid,
        requestedByName: `${currentUser.rank} ${currentUser.name}`
      });

      setSuccess('ส่งคำขอเบิกน้ำมันสำเร็จ! กรุณารอเจ้าหน้าที่คลังตรวจสอบและอนุมัติ');
      
      // Reset form but keep default user details
      setVehicleNo('');
      setVolume('');
      setOdometer('');
      setOrderNo('');
      setPurpose('');

      onRequestSubmitted();
    } catch (err: any) {
      setError('ส่งคำขอล้มเหลว: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

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
    <div id="request_form_container" className="max-w-xl mx-auto bg-slate-800 p-5 sm:p-6 rounded-2xl border border-slate-700/60 shadow-xl">
      <div className="flex items-center gap-3 border-b border-slate-700/50 pb-4 mb-5">
        <div className="p-2 bg-blue-600/10 text-blue-400 rounded-lg">
          <Clipboard className="h-5 w-5" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-white">ยื่นใบคำขอเบิกน้ำมันเชื้อเพลิง</h2>
          <p className="text-xs text-slate-400">สำหรับผู้ใช้บริการ ส่งใบเบิกออนไลน์เพื่อรับบริการเติมน้ำมันที่สถานี</p>
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
        
        {/* Date representation */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
            วันที่ยื่นขอเบิก
          </label>
          <input
            type="date"
            readOnly
            value={date}
            className="w-full px-3.5 py-2 bg-slate-900/60 border border-slate-700 rounded-xl text-slate-400 text-sm outline-none cursor-not-allowed"
          />
        </div>

        {/* Vehicle Info */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
              หมายเลขกงจักร / ทะเบียนรถทหาร <span className="text-red-400">*</span>
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-500">
                <Truck className="h-4 w-4" />
              </span>
              <input
                type="text"
                required
                placeholder="เช่น ทบ-12345 หรือ กงจักร-9942"
                value={vehicleNo}
                onChange={(e) => setVehicleNo(e.target.value.toUpperCase())}
                className="w-full pl-10 pr-4 py-2.5 bg-slate-900 border border-slate-700 rounded-xl focus:border-blue-500 outline-none text-white text-sm"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
              ประเภทรถยนต์ทหาร <span className="text-red-400">*</span>
            </label>
            <select
              value={vehicleType}
              onChange={(e) => setVehicleType(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl focus:border-blue-500 outline-none text-white text-sm"
            >
              {VEHICLE_TYPES.map(type => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
          </div>
        </div>

        {/* User profile details prefilled */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
              สังกัดหน่วยงานเบิก <span className="text-red-400">*</span>
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-500">
                <Compass className="h-4 w-4" />
              </span>
              <input
                type="text"
                required
                placeholder="เช่น ร.25 พัน.1"
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-slate-900 border border-slate-700 rounded-xl focus:border-blue-500 outline-none text-white text-sm"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
              ชื่อผู้รับ/ผู้ใช้ <span className="text-red-400">*</span>
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-500">
                <User className="h-4 w-4" />
              </span>
              <input
                type="text"
                required
                placeholder="ยศ ชื่อ นามสกุล"
                value={driverName}
                onChange={(e) => setDriverName(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-slate-900 border border-slate-700 rounded-xl focus:border-blue-500 outline-none text-white text-sm"
              />
            </div>
          </div>
        </div>

        {/* Fuel and Volume Group */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
              ประเภทน้ำมันที่ขอเบิก <span className="text-red-400">*</span>
            </label>
            <select
              value={fuelType}
              onChange={(e) => setFuelType(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl focus:border-blue-500 outline-none text-white text-sm"
            >
              {inventory.map(inv => (
                <option key={inv.fuelType} value={inv.fuelType}>
                  {inv.fuelType}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
              ปริมาณน้ำมัน (ลิตร) <span className="text-red-400">*</span>
            </label>
            <input
              type="number"
              required
              min="1"
              placeholder="จำนวนลิตร"
              value={volume}
              onChange={(e) => setVolume(e.target.value !== '' ? Number(e.target.value) : '')}
              className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl focus:border-blue-500 outline-none text-white text-sm"
            />
          </div>
        </div>

        {/* Optional Document Ref */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
            เลขที่ใบสั่งจ่าย/ใบขอเบิกน้ำมันทหาร (ถ้ามี)
          </label>
          <input
            type="text"
            placeholder="เว้นว่างได้ หรือระบุหากมีใบ บด.4 หรือใบอนุมัติจากหน่วยคุม"
            value={orderNo}
            onChange={(e) => setOrderNo(e.target.value)}
            className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl focus:border-blue-500 outline-none text-white text-sm"
          />
        </div>

        {/* Purpose / Mission */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
            ภารกิจ / วัตถุประสงค์ในการขอเติมน้ำมัน <span className="text-red-400">*</span>
          </label>
          <div className="relative">
            <span className="absolute top-3 left-3 text-slate-500">
              <PenTool className="h-4 w-4" />
            </span>
            <textarea
              required
              placeholder="กรุณาระบุวัตถุประสงค์การใช้รถทหาร เช่น เพื่อลาดตระเวน เพื่อรับส่งสิ่งของ..."
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
              rows={2}
              className="w-full pl-10 pr-4 py-2.5 bg-slate-900 border border-slate-700 rounded-xl focus:border-blue-500 outline-none text-white text-sm"
            />
          </div>
        </div>

        {/* Submitter details footer */}
        <div className="bg-slate-900/40 p-3 rounded-xl border border-slate-700/50 flex items-center justify-between text-xs text-slate-400">
          <span>ผู้ยื่นคำขอ: <strong className="text-white">{currentUser.rank} {currentUser.name}</strong></span>
          <span>สังกัด: {currentUser.department}</span>
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={loading}
          className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-xl shadow-lg shadow-blue-950/20 active:scale-[0.98] transition duration-150 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 text-sm font-sans"
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            'ส่งใบคำขอเติมน้ำมันเชื้อเพลิง'
          )}
        </button>

      </form>
    </div>
  );
}
