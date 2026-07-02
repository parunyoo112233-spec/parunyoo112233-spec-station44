/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { FuelRequest, UserProfile, FuelInventory } from '../types';
import { 
  approveFuelRequest, 
  rejectFuelRequest 
} from '../lib/db-helpers';
import { 
  Clock, 
  Check, 
  X, 
  Truck, 
  Calendar, 
  User, 
  AlertCircle, 
  CheckCircle, 
  XCircle, 
  Eye, 
  CornerDownRight,
  ShieldAlert,
  Loader2
} from 'lucide-react';

interface RequestQueueProps {
  currentUser: UserProfile;
  requests: FuelRequest[];
  inventory: FuelInventory[];
  onQueueUpdated: () => void;
}

export default function RequestQueue({ 
  currentUser, 
  requests, 
  inventory,
  onQueueUpdated 
}: RequestQueueProps) {
  const [activeTab, setActiveTab] = useState<'pending' | 'history'>('pending');
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState('');

  // 1. Separate requests by status and user permission
  const visibleRequests = useMemo(() => {
    // If user is a regular driver, they only see their OWN requests
    let list = requests;
    if (currentUser.role === 'user') {
      list = requests.filter(r => r.requestedBy === currentUser.uid);
    }

    // Filter by tab
    if (activeTab === 'pending') {
      return list.filter(r => r.status === 'pending');
    } else {
      return list.filter(r => r.status !== 'pending');
    }
  }, [requests, currentUser, activeTab]);

  // Sort visible requests
  const sortedRequests = useMemo(() => {
    return [...visibleRequests].sort((a, b) => b.createdAt - a.createdAt);
  }, [visibleRequests]);

  // Handle Approval
  const handleApprove = async (request: FuelRequest) => {
    setError('');
    setActionLoading(request.id);

    // Stock level pre-check
    const fuelStock = inventory.find(inv => inv.fuelType === request.fuelType);
    if (fuelStock && request.volume > fuelStock.currentStock) {
      setError(`ไม่สามารถอนุมัติได้: ยอดขอเบิก (${request.volume} ลิตร) สูงกว่าระดับคงเหลือในคลัง (${(fuelStock.currentStock ?? 0).toLocaleString()} ลิตร)`);
      setActionLoading(null);
      return;
    }

    try {
      await approveFuelRequest(
        request.id, 
        currentUser.uid, 
        `${currentUser.rank} ${currentUser.name}`
      );
      onQueueUpdated();
    } catch (err: any) {
      setError('อนุมัติล้มเหลว: ' + err.message);
    } finally {
      setActionLoading(null);
    }
  };

  // Start Reject dialog
  const startReject = (id: string) => {
    setRejectId(id);
    setRejectReason('');
    setError('');
  };

  // Submit Rejection
  const handleReject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rejectId || !rejectReason.trim()) return;

    setError('');
    setActionLoading(rejectId);

    try {
      await rejectFuelRequest(
        rejectId, 
        rejectReason, 
        currentUser.uid, 
        `${currentUser.rank} ${currentUser.name}`
      );
      setRejectId(null);
      onQueueUpdated();
    } catch (err: any) {
      setError('ปฏิเสธคำขอล้มเหลว: ' + err.message);
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div id="request_queue_view" className="space-y-6 max-w-3xl mx-auto">
      
      {/* 1. View Toggles */}
      <div className="bg-slate-800 p-3 rounded-2xl border border-slate-700/60 shadow-xl flex items-center justify-between">
        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab('pending')}
            className={`py-2 px-4 rounded-xl text-sm font-semibold transition cursor-pointer flex items-center gap-2 ${
              activeTab === 'pending'
                ? 'bg-blue-600 text-white'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Clock className="h-4 w-4" />
            คำขอค้างอนุมัติ
            {visibleRequests.filter(r => r.status === 'pending').length > 0 && activeTab !== 'pending' && (
              <span className="bg-amber-500 text-slate-900 rounded-full w-2 h-2 animate-ping"></span>
            )}
          </button>
          
          <button
            onClick={() => setActiveTab('history')}
            className={`py-2 px-4 rounded-xl text-sm font-semibold transition cursor-pointer flex items-center gap-2 ${
              activeTab === 'history'
                ? 'bg-blue-600 text-white'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <CheckCircle className="h-4 w-4" />
            ประวัติคำขอ
          </button>
        </div>

        <span className="text-xs text-slate-400 hidden sm:inline">
          {currentUser.role === 'admin' ? 'สิทธิ์ผู้ดูแลระบบ (Admin)' : currentUser.role === 'officer' ? 'สิทธิ์ผู้ควบคุมคลัง' : 'สิทธิ์ผู้รับบริการ'}
        </span>
      </div>

      {error && (
        <div className="bg-red-950/40 border border-red-500/30 text-red-400 p-4 rounded-xl text-sm flex items-start gap-2.5">
          <AlertCircle className="h-5 w-5 flex-shrink-0 text-red-400" />
          <span>{error}</span>
        </div>
      )}

      {/* 2. Rejection overlay dialog */}
      {rejectId && (
        <div className="bg-slate-900/90 border border-amber-500/30 p-5 rounded-xl space-y-4 animate-fadeIn">
          <div className="flex items-center gap-2 text-amber-400">
            <ShieldAlert className="h-5 w-5" />
            <h4 className="font-bold text-sm">ระบุเหตุผลในการปฏิเสธการจ่ายน้ำมัน</h4>
          </div>
          
          <form onSubmit={handleReject} className="space-y-3">
            <input
              type="text"
              required
              placeholder="เช่น ยอดเบิกไม่สอดคล้องกับใบสั่งเบิก หรือกรอกทะเบียนรถผิด"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-800 border border-slate-700 rounded-xl focus:border-amber-500 outline-none text-white text-sm"
            />
            
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setRejectId(null)}
                className="px-3.5 py-1.5 border border-slate-700 text-slate-300 rounded-lg text-xs hover:bg-slate-800 cursor-pointer"
              >
                ยกเลิก
              </button>
              <button
                type="submit"
                className="px-3.5 py-1.5 bg-red-600 hover:bg-red-500 text-white rounded-lg text-xs font-semibold cursor-pointer"
              >
                บันทึกปฏิเสธคำขอ
              </button>
            </div>
          </form>
        </div>
      )}

      {/* 3. List of requests */}
      <div className="space-y-4">
        {sortedRequests.map((req) => (
          <div 
            key={req.id}
            className={`bg-slate-800 p-4 sm:p-5 rounded-2xl border transition shadow-md ${
              req.status === 'pending'
                ? 'border-blue-500/30 hover:border-blue-500/50'
                : req.status === 'approved'
                ? 'border-slate-700/60'
                : 'border-red-500/20'
            }`}
          >
            {/* Header info */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-slate-700/40 pb-3 mb-3.5">
              
              <div className="flex items-center gap-2.5">
                <div className={`p-2 rounded-xl ${
                  req.status === 'pending' 
                    ? 'bg-blue-600/10 text-blue-400' 
                    : req.status === 'approved'
                    ? 'bg-emerald-600/10 text-emerald-400'
                    : 'bg-red-600/10 text-red-400'
                }`}>
                  <Truck className="h-5 w-5" />
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-base text-white">{req.vehicleNo}</span>
                    <span className="text-xs bg-slate-900 text-slate-400 px-2 py-0.5 rounded border border-slate-700/80">
                      {req.unit}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-0.5">{req.vehicleType}</p>
                </div>
              </div>

              {/* Status and Time */}
              <div className="text-right flex items-center sm:flex-col items-end gap-2 sm:gap-0 flex-row-reverse w-full sm:w-auto justify-between border-t border-slate-700/30 sm:border-t-0 pt-2 sm:pt-0">
                
                {/* Status Badges */}
                {req.status === 'pending' && (
                  <span className="px-2.5 py-1 text-xs bg-blue-600/10 border border-blue-500/30 text-blue-400 rounded-full font-semibold flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5 animate-spin" /> รอเจ้าหน้าที่อนุมัติ
                  </span>
                )}
                {req.status === 'approved' && (
                  <span className="px-2.5 py-1 text-xs bg-emerald-600/10 border border-emerald-500/30 text-emerald-400 rounded-full font-semibold flex items-center gap-1">
                    <CheckCircle className="h-3.5 w-3.5" /> อนุมัติจ่ายน้ำมันแล้ว
                  </span>
                )}
                {req.status === 'rejected' && (
                  <span className="px-2.5 py-1 text-xs bg-red-600/10 border border-red-500/30 text-red-400 rounded-full font-semibold flex items-center gap-1">
                    <XCircle className="h-3.5 w-3.5" /> ปฏิเสธการจ่าย
                  </span>
                )}

                <span className="text-[10px] text-slate-400 mt-1 font-mono">
                  ยื่นเมื่อ {new Date(req.createdAt).toLocaleString('th-TH', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short' })}
                </span>
              </div>

            </div>

            {/* Request Core Details */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 bg-slate-900/40 p-3.5 rounded-xl border border-slate-700/30 text-xs">
              
              <div>
                <p className="text-slate-400 font-medium">ประเภทน้ำมัน</p>
                <p className="text-sm font-bold text-white mt-1">{req.fuelType}</p>
              </div>

              <div>
                <p className="text-slate-400 font-medium">ปริมาณที่ขอเบิก</p>
                <p className="text-sm font-black text-emerald-400 mt-1">{req.volume} ลิตร</p>
              </div>

              {req.odometer > 0 ? (
                <>
                  <div>
                    <p className="text-slate-400 font-medium">เลขไมล์รถล่าสุด</p>
                    <p className="text-sm font-mono font-bold text-white mt-1">{(req.odometer ?? 0).toLocaleString()} กม.</p>
                  </div>

                  <div>
                    <p className="text-slate-400 font-medium">ชื่อผู้ขอ / ผู้ใช้</p>
                    <p className="text-sm font-bold text-white mt-1 truncate" title={req.driverName}>{req.driverName}</p>
                  </div>
                </>
              ) : (
                <div className="col-span-2">
                  <p className="text-slate-400 font-medium">ชื่อผู้ขอ / ผู้ใช้</p>
                  <p className="text-sm font-bold text-white mt-1 truncate" title={req.driverName}>{req.driverName}</p>
                </div>
              )}

              <div className="col-span-2 pt-2 border-t border-slate-700/20">
                <p className="text-slate-400 font-medium">ภารกิจ / วัตถุประสงค์</p>
                <p className="text-slate-200 mt-1 leading-relaxed text-xs">{req.purpose}</p>
              </div>

              <div className="col-span-2 pt-2 border-t border-slate-700/20">
                <p className="text-slate-400 font-medium">เลขที่ใบสั่งเบิกราชการ</p>
                <p className="text-slate-200 mt-1 font-mono font-semibold">{req.orderNo}</p>
              </div>

            </div>

            {/* Submitter audit log / Rejection log */}
            {req.status === 'rejected' && req.rejectedReason && (
              <div className="mt-3 bg-red-950/20 border border-red-500/20 p-3 rounded-xl flex items-start gap-2 text-xs text-red-400 animate-fadeIn">
                <AlertCircle className="h-4 w-4 flex-shrink-0 text-red-400 mt-0.5" />
                <div>
                  <strong className="block font-semibold">เหตุผลที่ไม่ได้รับการอนุมัติ:</strong>
                  <span className="mt-1 block text-slate-300">{req.rejectedReason}</span>
                  {req.approvedByName && (
                    <span className="text-[10px] text-slate-400 mt-1 block">ตรวจสอบโดย: {req.approvedByName}</span>
                  )}
                </div>
              </div>
            )}

            {req.status === 'approved' && req.approvedByName && (
              <div className="mt-3 bg-emerald-950/20 border border-emerald-500/10 p-2.5 rounded-xl text-[10px] text-emerald-400/80 flex items-center justify-between">
                <span>อนุมัติจ่ายโดย: <strong>{req.approvedByName}</strong></span>
                <span>คลัง มทบ.44</span>
              </div>
            )}

            {/* Officer/Admin Action CTAs */}
            {(currentUser.role === 'admin' || currentUser.role === 'officer') && req.status === 'pending' && (
              <div className="mt-4 flex gap-3 border-t border-slate-700/30 pt-3.5">
                <button
                  onClick={() => startReject(req.id)}
                  disabled={actionLoading !== null}
                  className="flex-1 py-2 px-3 border border-red-500/30 hover:border-red-500/60 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-xl text-xs font-semibold transition flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <X className="h-4 w-4" /> ปฏิเสธคำขอ
                </button>
                <button
                  onClick={() => handleApprove(req)}
                  disabled={actionLoading !== null}
                  className="flex-1 py-2 px-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold transition flex items-center justify-center gap-1.5 cursor-pointer shadow shadow-emerald-900/10 disabled:opacity-50"
                >
                  {actionLoading === req.id ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <>
                      <Check className="h-4 w-4" /> อนุมัติและบันทึกจ่าย
                    </>
                  )}
                </button>
              </div>
            )}

          </div>
        ))}

        {sortedRequests.length === 0 && (
          <div className="bg-slate-800 p-12 text-center rounded-2xl border border-slate-700/50 text-slate-500">
            <Clock className="h-10 w-10 mx-auto text-slate-600 mb-3" />
            <p className="text-sm font-semibold text-slate-400">ไม่มีรายการคำขอเบิกน้ำมันในขณะนี้</p>
            <p className="text-xs text-slate-500 mt-1">
              {currentUser.role === 'user' 
                ? 'คำขอที่คุณส่งทั้งหมดจะถูกแสดงขึ้นที่นี่' 
                : 'เมื่อผู้ใช้เบิกออนไลน์ ใบคำขอเติมน้ำมันจะแสดงขึ้นที่นี่เพื่อตรวจสอบและอนุมัติ'}
            </p>
          </div>
        )}
      </div>

    </div>
  );
}
