/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { FuelInventory, UserProfile } from '../types';
import { replenishStock } from '../lib/db-helpers';
import { Database, Plus, RefreshCw, AlertTriangle, ArrowUpRight, CheckCircle, Info, Loader2 } from 'lucide-react';

interface InventoryMgmtProps {
  currentUser: UserProfile;
  inventory: FuelInventory[];
  onReplenished: () => void;
}

export default function InventoryMgmt({ currentUser, inventory, onReplenished }: InventoryMgmtProps) {
  const [selectedFuel, setSelectedFuel] = useState('น้ำมันดีเซล');
  const [amount, setAmount] = useState<number | ''>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!amount || Number(amount) <= 0) {
      setError('กรุณาระบุจำนวนลิตรที่ต้องการเติมให้ถูกต้อง');
      return;
    }

    const selectedInv = inventory.find(inv => inv.fuelType === selectedFuel);
    if (selectedInv) {
      if (selectedInv.currentStock + Number(amount) > selectedInv.capacity) {
        setError(`ไม่สามารถเติมน้ำมันได้เกินความจุของถังเก็บ (${(selectedInv.capacity ?? 0).toLocaleString()} ลิตร) ยอดที่จะเติมรวมกันจะกลายเป็น ${((selectedInv.currentStock ?? 0) + Number(amount)).toLocaleString()} ลิตร`);
        return;
      }
    }

    setLoading(true);

    try {
      await replenishStock(selectedFuel, Number(amount));
      setSuccess(`เติมน้ำมัน ${selectedFuel} เข้าคลังเชื้อเพลิงสำรองจำนวน ${Number(amount).toLocaleString()} ลิตร เรียบร้อยแล้ว!`);
      setAmount('');
      onReplenished();
    } catch (err: any) {
      setError('การเติมเสบียงเข้าคลังล้มเหลว: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Determine color for different fuel types
  const getFuelColor = (fuelType: string) => {
    switch (fuelType) {
      case 'น้ำมันดีเซล':
      case 'ดีเซล B7':
      case 'ดีเซล':
        return '#10B981'; // green
      case 'น้ำมันแก๊สโซฮอล์ 95':
      case 'แก๊สโซฮอล์ 95':
        return '#3B82F6'; // blue
      case 'น้ำมันแก๊สโซฮอล์ 91':
      case 'แก๊สโซฮอล์ 91':
        return '#F59E0B'; // orange
      default:
        return '#10B981';
    }
  };

  return (
    <div id="inventory_management_view" className="space-y-6 max-w-3xl mx-auto">
      
      {/* 1. Header Information */}
      <div className="bg-slate-800/40 backdrop-blur p-5 rounded-2xl border border-slate-700/80 shadow-xl">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-emerald-600/10 text-emerald-400 rounded-xl">
            <Database className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white font-display">จัดการคลังและรับปริมาณน้ำมันเข้าคลัง</h2>
            <p className="text-xs text-slate-400 mt-0.5">ควบคุมระดับปริมาณน้ำมันสำรองคงเหลือ บรรจุถังพักน้ำมัน และเติมเสบียงน้ำมันเชื้อเพลิง</p>
          </div>
        </div>
      </div>

      {/* 2. Fuel Tanks Status Detail */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {inventory.map((inv) => {
          const pct = Math.round((inv.currentStock / inv.capacity) * 100);
          const isLow = pct < 25;
          const color = getFuelColor(inv.fuelType);

          return (
            <div 
              key={inv.fuelType}
              className="bg-slate-800/40 backdrop-blur p-5 rounded-2xl border border-slate-700/80 shadow-lg flex flex-col justify-between"
            >
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-bold text-base text-white flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full" style={{ backgroundColor: color }}></span>
                    {inv.fuelType}
                  </h3>
                  <p className="text-[10px] text-slate-400 mt-0.5 font-mono">CAPACITY: {(inv.capacity ?? 0).toLocaleString()} L</p>
                </div>
                {isLow ? (
                  <span className="bg-red-500/10 text-red-400 border border-red-500/20 px-2 py-1 rounded text-[10px] font-bold flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3 animate-pulse" /> ควรเติมเสบียง
                  </span>
                ) : (
                  <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-1 rounded text-[10px] font-bold">
                    ระดับปกติ
                  </span>
                )}
              </div>

              {/* Progress and Visual Tank level */}
              <div className="mt-5 space-y-2">
                <div className="flex justify-between items-baseline">
                  <span className="text-2xl font-black text-white font-display">{(inv.currentStock ?? 0).toLocaleString()} ลิตร</span>
                  <span className="text-sm font-bold text-slate-400 font-mono">{pct}%</span>
                </div>
                
                {/* Visual Tank representation */}
                <div className="w-full bg-slate-900 rounded-xl p-1 border border-slate-700/50">
                  <div className="w-full bg-slate-950 rounded-lg h-8 overflow-hidden relative flex items-center justify-center">
                    {/* Fuel Level animation color */}
                    <div 
                      className="absolute bottom-0 left-0 right-0 transition-all duration-500 rounded-b"
                      style={{ 
                        height: `${pct}%`, 
                        backgroundColor: `${color}22`, // Subtle alpha
                        borderTop: `2px solid ${color}` 
                      }}
                    />
                    
                    {/* Readout label centered inside tank */}
                    <span className="relative text-[11px] font-mono text-slate-300 font-bold z-10">
                      คงเหลือ {(inv.currentStock ?? 0).toLocaleString()} ลิตร
                    </span>
                  </div>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-800 text-[10px] text-slate-500 flex justify-between font-mono">
                <span>LAST UPDATE</span>
                <span>{new Date(inv.updatedAt).toLocaleString('th-TH', { hour: '2-digit', minute: '2-digit', second: '2-digit', day: '2-digit', month: 'short' })}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* 3. Replenishment Form (Only for Officer/Admin roles) */}
      {(currentUser.role === 'admin' || currentUser.role === 'officer') ? (
        <div className="bg-slate-800/40 backdrop-blur p-5 rounded-2xl border border-slate-700/80 shadow-xl">
          <div className="flex items-center gap-2 border-b border-slate-800 pb-3 mb-4">
            <Plus className="h-5 w-5 text-emerald-400" />
            <h3 className="font-bold text-sm text-white uppercase tracking-wider font-display">บันทึกรับน้ำมันดิบ/เสบียงเติมเข้าถัง</h3>
          </div>

          {error && (
            <div className="mb-4 bg-red-950/40 border border-red-500/30 text-red-400 p-3 rounded-xl text-xs flex items-center gap-1.5 animate-fadeIn">
              <AlertTriangle className="h-4 w-4" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="mb-4 bg-emerald-950/40 border border-emerald-500/30 text-emerald-400 p-3 rounded-xl text-xs flex items-center gap-1.5 animate-fadeIn">
              <CheckCircle className="h-4 w-4" />
              <span>{success}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              
              {/* Select Fuel Tank */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">เลือกชนิดน้ำมัน</label>
                <select
                  value={selectedFuel}
                  onChange={(e) => setSelectedFuel(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white text-sm focus:border-emerald-500 outline-none"
                >
                  {inventory.map(inv => (
                    <option key={inv.fuelType} value={inv.fuelType}>
                      {inv.fuelType} (จุถังได้อีก {((inv.capacity ?? 0) - (inv.currentStock ?? 0)).toLocaleString()} ลิตร)
                    </option>
                  ))}
                </select>
              </div>

              {/* Amount input */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">จำนวนปริมาณที่รับเข้า (ลิตร)</label>
                <div className="relative">
                  <input
                    type="number"
                    required
                    min="1"
                    placeholder="เช่น 5000"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value !== '' ? Number(e.target.value) : '')}
                    className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white text-sm focus:border-emerald-500 outline-none"
                  />
                  <span className="absolute inset-y-0 right-4 flex items-center text-xs text-slate-500 font-bold uppercase">ลิตร</span>
                </div>
              </div>

            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-xl transition flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-emerald-950/25 disabled:opacity-50"
            >
              {loading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <>
                  <RefreshCw className="h-3.5 w-3.5" /> ทำรายการรับน้ำมันเข้าคลังสำรอง
                </>
              )}
            </button>
          </form>
        </div>
      ) : (
        <div className="bg-slate-800/40 p-5 rounded-2xl border border-slate-700/40 text-center text-slate-400">
          <Info className="h-5 w-5 mx-auto text-slate-500 mb-2" />
          <p className="text-xs">ผู้ใช้บริการทั่วไปสามารถดูปริมาณน้ำมันคงเหลือได้ แต่สงวนสิทธิ์การปรับแก้คลังให้กับเจ้าหน้าที่และผู้ดูแลระบบ</p>
        </div>
      )}

    </div>
  );
}
