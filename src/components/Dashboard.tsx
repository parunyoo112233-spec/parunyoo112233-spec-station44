/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo, useState, useEffect } from 'react';
import { 
  FuelInventory, 
  FuelRecord, 
  FuelRequest,
  UserProfile,
  UnitCredit
} from '../types';
import { onSnapshot, query } from 'firebase/firestore';
import { 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  Legend, 
  PieChart, 
  Pie, 
  Cell 
} from 'recharts';
import { 
  Flame, 
  Database, 
  Activity, 
  Clock, 
  AlertTriangle, 
  TrendingUp, 
  Gauge, 
  ArrowRight,
  PlusCircle,
  Shield,
  Truck,
  Layers,
  LineChart,
  Zap,
  Check,
  CheckCircle,
  Loader2,
  XCircle,
  User,
  FileCheck,
  ArrowDownCircle,
  ArrowUpCircle,
  Building,
  CreditCard
} from 'lucide-react';
import { unitCreditsCol, approveFuelRequest } from '../lib/db-helpers';

interface DashboardProps {
  inventory: FuelInventory[];
  records: FuelRecord[];
  requests: FuelRequest[];
  onNavigateToTab: (tab: string) => void;
  currentUser?: UserProfile | null;
}

export default function Dashboard({ 
  inventory, 
  records, 
  requests,
  onNavigateToTab,
  currentUser
}: DashboardProps) {
  const [isApproving, setIsApproving] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  const userRole = currentUser?.role || 'user';
  const [activeTab, setActiveTab] = useState<'my' | 'all'>(userRole === 'user' ? 'my' : 'all');

  const [unitCredits, setUnitCredits] = useState<UnitCredit[]>([]);
  const [selectedUnitId, setSelectedUnitId] = useState<string>('');

  // Subscribe to Unit Credits
  useEffect(() => {
    const q = query(unitCreditsCol);
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const credits: UnitCredit[] = [];
      snapshot.forEach((doc) => {
        credits.push({ id: doc.id, ...doc.data() } as UnitCredit);
      });
      setUnitCredits(credits);
    }, (error) => {
      console.error("Error subscribing to unit credits: ", error);
    });
    return () => unsubscribe();
  }, []);

  // Sync selectedUnitId with user's unit or default to first
  useEffect(() => {
    if (currentUser?.department) {
      setSelectedUnitId(currentUser.department);
    } else if (unitCredits.length > 0 && !selectedUnitId) {
      setSelectedUnitId(unitCredits[0].id);
    }
  }, [currentUser, unitCredits, selectedUnitId]);

  // Selected Unit Data matching selectedUnitId
  const selectedUnitData = useMemo(() => {
    if (!selectedUnitId) return null;
    return unitCredits.find(uc => uc.id === selectedUnitId) || null;
  }, [unitCredits, selectedUnitId]);

  const latestPendingRequest = useMemo(() => {
    return requests
      .filter(r => r.status === 'pending')
      .sort((a, b) => b.createdAt - a.createdAt)[0] || null;
  }, [requests]);

  const myRecentTransactions = useMemo(() => {
    if (!currentUser) return [];

    const nameQuery = (currentUser.name || '').trim().toLowerCase();
    
    // Filter records (completed)
    const myRecords = records.filter(rec => {
      const driver = (rec.driverName || '').trim().toLowerCase();
      return nameQuery ? driver.includes(nameQuery) : false;
    }).map(rec => ({
      id: rec.id,
      type: 'record' as const,
      date: rec.date,
      time: rec.time || '',
      vehicleNo: rec.vehicleNo,
      fuelType: rec.fuelType,
      volume: rec.volume,
      odometer: rec.odometer || 0,
      status: 'approved' as const,
      purpose: rec.purpose || '',
      rejectedReason: '',
      officerOrApprover: rec.officerName || 'เจ้าหน้าที่คลัง',
      createdAt: rec.createdAt
    }));

    // Filter requests (pending or rejected)
    const myRequests = requests.filter(req => {
      const isRequestedByMe = req.requestedBy === currentUser.uid;
      const driver = (req.driverName || '').trim().toLowerCase();
      const isDriverMe = nameQuery ? driver.includes(nameQuery) : false;
      return (isRequestedByMe || isDriverMe) && req.status !== 'approved';
    }).map(req => ({
      id: req.id,
      type: 'request' as const,
      date: req.date,
      time: '',
      vehicleNo: req.vehicleNo,
      fuelType: req.fuelType,
      volume: req.volume,
      odometer: req.odometer || 0,
      status: req.status,
      purpose: req.purpose || '',
      rejectedReason: req.rejectedReason || '',
      officerOrApprover: req.status === 'rejected' ? (req.approvedByName || 'เจ้าหน้าที่คลัง') : '',
      createdAt: req.createdAt
    }));

    // Combine and sort by createdAt descending
    return [...myRecords, ...myRequests].sort((a, b) => b.createdAt - a.createdAt);
  }, [records, requests, currentUser]);

  const handleQuickApprove = async (request: FuelRequest) => {
    if (!currentUser) return;
    setIsApproving(request.id);
    setActionError(null);
    setActionSuccess(null);

    // Stock level pre-check
    const fuelStock = inventory.find(inv => inv.fuelType === request.fuelType);
    if (fuelStock && request.volume > fuelStock.currentStock) {
      setActionError(`ยอดเบิก (${request.volume} ลิตร) สูงกว่ายอดคงเหลือ (${(fuelStock.currentStock ?? 0).toLocaleString()} ลิตร)`);
      setIsApproving(null);
      return;
    }

    try {
      await approveFuelRequest(
        request.id,
        currentUser.uid,
        `${currentUser.rank} ${currentUser.name}`
      );
      setActionSuccess(`อนุมัติคำขอของ ${request.unit} (${request.volume} ล.) สำเร็จ!`);
      setTimeout(() => {
        setActionSuccess(null);
      }, 4000);
    } catch (err: any) {
      setActionError('อนุมัติล้มเหลว: ' + err.message);
    } finally {
      setIsApproving(null);
    }
  };
  
  // 1. Calculate Key Metrics
  const totalDispensed = useMemo(() => {
    return records.reduce((sum, r) => sum + r.volume, 0);
  }, [records]);

  const totalTransactions = records.length;

  const avgDispensed = useMemo(() => {
    if (totalTransactions === 0) return 0;
    return Math.round((totalDispensed / totalTransactions) * 10) / 10;
  }, [records, totalDispensed, totalTransactions]);

  const pendingCount = useMemo(() => {
    return requests.filter(r => r.status === 'pending').length;
  }, [requests]);

  // Today's summary calculations
  const todayStr = useMemo(() => {
    const local = new Date();
    const offset = local.getTimezoneOffset();
    const d = new Date(local.getTime() - (offset * 60 * 1000));
    return d.toISOString().split('T')[0];
  }, []);

  const todayRecords = useMemo(() => {
    return records.filter(r => r.date === todayStr);
  }, [records, todayStr]);

  const todayTotalDispensed = useMemo(() => {
    return todayRecords.reduce((sum, r) => sum + r.volume, 0);
  }, [todayRecords]);

  const todayBreakdown = useMemo(() => {
    const counts: Record<string, number> = {};
    todayRecords.forEach(r => {
      counts[r.fuelType] = (counts[r.fuelType] || 0) + r.volume;
    });
    return counts;
  }, [todayRecords]);

  // Thai Date Formatter Helper
  const formatThaiDate = (dateStr: string) => {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    if (parts.length !== 3) return dateStr;
    const thaiMonthsShort = [
      'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 
      'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'
    ];
    const dayNum = parseInt(parts[2], 10);
    const monthNum = parseInt(parts[1], 10) - 1;
    const yearNum = (parseInt(parts[0], 10) + 543) % 100; // e.g. 2569 -> 69
    return `${dayNum} ${thaiMonthsShort[monthNum]} ${yearNum}`;
  };

  // 2. Format Data for Recharts Daily Trend (Last 7 Days)
  const dailyTrendData = useMemo(() => {
    const datesMap: Record<string, Record<string, number>> = {};
    
    // Initialize last 7 days including today
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0]; // YYYY-MM-DD
      datesMap[dateStr] = {};
    }

    // Populate with records
    records.forEach(r => {
      if (datesMap[r.date] !== undefined) {
        if (!datesMap[r.date][r.fuelType]) {
          datesMap[r.date][r.fuelType] = 0;
        }
        datesMap[r.date][r.fuelType] += r.volume;
      }
    });

    // Format for Recharts
    return Object.entries(datesMap).map(([date, fuelTypes]) => {
      const dParts = date.split('-');
      let label = date;
      if (dParts.length === 3) {
        const thaiMonthsShort = [
          'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 
          'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'
        ];
        const dayNum = parseInt(dParts[2], 10);
        const monthNum = parseInt(dParts[1], 10) - 1;
        label = `${dayNum} ${thaiMonthsShort[monthNum]}`;
      }

      const row: any = { dateLabel: label };
      inventory.forEach(inv => {
        row[inv.fuelType] = Math.round(fuelTypes[inv.fuelType] || 0);
      });
      return row;
    });
  }, [records, inventory]);

  // 3. Format Data for Fuel Type Breakdown (Pie Chart)
  const fuelTypePieData = useMemo(() => {
    const totals: Record<string, number> = {};
    inventory.forEach(inv => {
      totals[inv.fuelType] = 0;
    });

    records.forEach(r => {
      if (totals[r.fuelType] !== undefined) {
        totals[r.fuelType] += r.volume;
      }
    });

    return Object.entries(totals).map(([name, value]) => ({
      name,
      value: Math.round(value)
    })).filter(item => item.value > 0);
  }, [records, inventory]);

  // 4. Format Data for Unit Breakdown (Bar Chart)
  const unitBarData = useMemo(() => {
    const totals: Record<string, number> = {};
    records.forEach(r => {
      totals[r.unit] = (totals[r.unit] || 0) + r.volume;
    });

    return Object.entries(totals)
      .map(([name, value]) => ({
        name,
        value: Math.round(value)
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5); // top 5 units
  }, [records]);

  // Colors for fuel types in charts matching mock exactly
  const FUEL_COLORS: Record<string, string> = {
    'น้ำมันดีเซล': '#10B981',       // Emerald
    'น้ำมันแก๊สโซฮอล์ 95': '#3B82F6', // Blue
    'น้ำมันแก๊สโซฮอล์ 91': '#F59E0B', // Amber
    'ดีเซล B7': '#10B981',       // Emerald
    'ดีเซล': '#059669',          // Dark Emerald
    'แก๊สโซฮอล์ 95': '#3B82F6',   // Blue
    'แก๊สโซฮอล์ 91': '#F59E0B',   // Amber
  };

  const PIE_COLORS = ['#10B981', '#059669', '#3B82F6', '#F59E0B', '#8B5CF6', '#EC4899'];

  return (
    <div id="dashboard_view" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-4">
      
      {/* 1. Daily Summary Card (Primary) [Grid Span: 4 Cols] */}
      <section id="bento_daily_summary" className="lg:col-span-4 bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl border border-slate-700/80 p-6 flex flex-col justify-between min-h-[220px] shadow-lg">
        <div className="flex justify-between items-start">
          <span className="px-2 py-1 bg-emerald-500/10 text-emerald-400 text-[10px] font-bold rounded border border-emerald-500/20 uppercase tracking-wider">
            สรุปยอดวันนี้
          </span>
          <TrendingUp className="w-5 h-5 text-emerald-400" />
        </div>
        <div className="my-3">
          <div className="text-3xl sm:text-4xl font-black mb-1 italic text-white font-display">
            {(todayTotalDispensed ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}{' '}
            <span className="text-sm font-normal text-slate-400 not-italic">ลิตร</span>
          </div>
          <p className="text-slate-400 text-xs italic">ยอดจ่ายรวมประจำวันที่ {formatThaiDate(todayStr)}</p>
        </div>
        <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-700/50">
          <div>
            <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">ดีเซล</p>
            <p className="font-bold text-base text-slate-200">
              {((todayBreakdown['น้ำมันดีเซล'] || 0) + (todayBreakdown['ดีเซล B7'] || 0) + (todayBreakdown['ดีเซล'] || 0)).toLocaleString()}{' '}
              <span className="text-[10px] font-normal text-slate-400">L</span>
            </p>
          </div>
          <div>
            <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">เบนซิน/แก๊สโซฮอล์</p>
            <p className="font-bold text-base text-amber-500">
              {((todayBreakdown['น้ำมันแก๊สโซฮอล์ 95'] || 0) + (todayBreakdown['แก๊สโซฮอล์ 95'] || 0) + (todayBreakdown['น้ำมันแก๊สโซฮอล์ 91'] || 0) + (todayBreakdown['แก๊สโซฮอล์ 91'] || 0)).toLocaleString()}{' '}
              <span className="text-[10px] font-normal text-slate-400">L</span>
            </p>
          </div>
        </div>
      </section>

      {/* 2. Monthly Target Chart / 7-Day Trend [Grid Span: 5 Cols] */}
      <section id="bento_weekly_trend" className="lg:col-span-5 bg-slate-800/40 rounded-2xl border border-slate-700/80 p-6 flex flex-col justify-between shadow-lg">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-sm font-bold uppercase tracking-wider text-slate-200 flex items-center gap-2">
            <LineChart className="h-4 w-4 text-emerald-400" />
            สถิติการจ่ายรายวัน (7 วันล่าสุด)
          </h3>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
            <span className="text-[10px] text-slate-400 uppercase tracking-wider">จ่ายจริง</span>
          </div>
        </div>
        <div className="w-full h-32">
          {records.length === 0 ? (
            <div className="h-full flex items-center justify-center text-slate-500 text-xs italic">
              ไม่มีข้อมูลการจ่ายน้ำมันในระบบ
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dailyTrendData} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
                <XAxis dataKey="dateLabel" tick={{ fill: '#94a3b8', fontSize: 9 }} />
                <YAxis tick={{ fill: '#94a3b8', fontSize: 9 }} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569', borderRadius: '8px', fontSize: '11px', color: '#fff' }}
                />
                {inventory.map((inv) => (
                  <Bar 
                    key={inv.fuelType} 
                    dataKey={inv.fuelType} 
                    stackId="a" 
                    fill={FUEL_COLORS[inv.fuelType] || '#10B981'} 
                    radius={[2, 2, 0, 0]}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
        <div className="flex justify-between mt-2 pt-2 border-t border-slate-800 text-[10px] text-slate-400 font-mono">
          <span>แนวโน้มยอดการเบิกจ่ายสอดคล้องกับแผนที่กำหนดไว้</span>
        </div>
      </section>

      {/* 3. Unit Fuel Quotas / Received-Disbursed Summary [Grid Span: 3 Cols] */}
      <section id="bento_unit_quota_summary" className="lg:col-span-3 bg-slate-800/40 rounded-2xl border border-slate-700/80 p-5 flex flex-col justify-between shadow-lg">
        <div className="space-y-3 w-full">
          <div className="flex items-center justify-between border-b border-slate-800/60 pb-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200 flex items-center gap-1.5">
              <CreditCard className="h-4 w-4 text-emerald-400" />
              โควตา & ยอดรับ-จ่ายหน่วย
            </h3>
            <span className="text-[8px] bg-emerald-500/10 text-emerald-400 px-1.5 py-0.5 rounded border border-emerald-500/20 uppercase font-mono font-bold">
              Unit Quotas
            </span>
          </div>

          <div>
            <span className="text-[9px] text-slate-500 uppercase tracking-widest font-bold">หน่วยงานเบิกจ่าย</span>
            {unitCredits.length > 0 && (userRole === 'admin' || userRole === 'officer') ? (
              <select
                value={selectedUnitId}
                onChange={(e) => setSelectedUnitId(e.target.value)}
                className="mt-1 w-full bg-slate-900 border border-slate-700 rounded-lg py-1 px-2 text-[11px] text-slate-200 focus:outline-none focus:border-emerald-500 transition cursor-pointer"
              >
                {unitCredits.map((uc) => (
                  <option key={uc.id} value={uc.id}>{uc.unit}</option>
                ))}
              </select>
            ) : (
              <div className="mt-1 flex items-center gap-1.5 text-[11px] text-emerald-400 font-bold bg-emerald-500/10 border border-emerald-500/20 px-2 py-1 rounded-lg w-fit">
                <Building className="h-3 w-3 shrink-0" />
                <span className="truncate max-w-[150px]">{selectedUnitId || 'ไม่ระบุหน่วย'}</span>
              </div>
            )}
          </div>

          {selectedUnitData ? (
            <div className="space-y-2.5 pt-1">
              {/* ยอดรับเข้าโควตา (Allocated / Incoming) */}
              <div className="flex items-center gap-2 bg-slate-900/40 p-2 rounded-xl border border-slate-800/60">
                <div className="p-1.5 bg-emerald-500/10 text-emerald-400 rounded-full shrink-0">
                  <ArrowDownCircle className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-[9px] text-slate-400 uppercase tracking-wider block font-bold">ยอดโควตารับเข้า (ทั้งหมด)</span>
                  <span className="text-sm font-black text-slate-100 font-mono">
                    {(selectedUnitData.allocatedLimit || 0).toLocaleString()} <span className="text-[9px] text-slate-400 font-normal">ลิตร</span>
                  </span>
                </div>
              </div>

              {/* ยอดจ่ายออกสะสม (Dispatched / Used) */}
              <div className="flex items-center gap-2 bg-slate-900/40 p-2 rounded-xl border border-slate-800/60">
                <div className="p-1.5 bg-blue-500/10 text-blue-400 rounded-full shrink-0">
                  <ArrowUpCircle className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-[9px] text-slate-400 uppercase tracking-wider block font-bold">ยอดเบิกจ่ายสะสม (ใช้ไป)</span>
                  <span className="text-sm font-black text-slate-100 font-mono">
                    {(selectedUnitData.usedCredit || 0).toLocaleString()} <span className="text-[9px] text-slate-400 font-normal">ลิตร</span>
                  </span>
                </div>
              </div>

              {/* โควตาคงเหลือ (Remaining Limit) */}
              {(() => {
                const limit = selectedUnitData.allocatedLimit || 0;
                const used = selectedUnitData.usedCredit || 0;
                const remaining = Math.max(0, limit - used);
                const pctUsed = limit > 0 ? (used / limit) * 100 : 0;

                return (
                  <div className="border-t border-slate-800/80 pt-2.5 mt-1.5">
                    <div className="flex justify-between items-center text-[10px] mb-1">
                      <span className="text-slate-400 font-semibold">โควตาคงเหลือ</span>
                      <span className="text-emerald-400 font-bold font-mono">
                        {remaining.toLocaleString()} ลิตร
                      </span>
                    </div>
                    
                    {/* Progress Bar */}
                    <div className="w-full h-1.5 bg-slate-950 rounded-full overflow-hidden border border-slate-800/60">
                      <div 
                        className={`h-full rounded-full transition-all duration-500 ${
                          pctUsed > 85 ? 'bg-red-500' : pctUsed > 60 ? 'bg-amber-500' : 'bg-emerald-500'
                        }`}
                        style={{ width: `${Math.min(100, pctUsed)}%` }}
                      ></div>
                    </div>
                    
                    <div className="flex justify-between text-[8px] text-slate-500 mt-1 font-mono">
                      <span>ใช้ {pctUsed.toFixed(1)}%</span>
                      <span>เหลือ {(100 - pctUsed).toFixed(1)}%</span>
                    </div>

                    {/* Fuel Types Breakdown in Quota */}
                    {selectedUnitData.quotas && Object.keys(selectedUnitData.quotas).length > 0 && (
                      <div className="border-t border-slate-800/60 pt-2 mt-2 space-y-1 text-[9px]">
                        {Object.entries(selectedUnitData.quotas).map(([fuelType, q]) => {
                          const quotaItem = q as { allocatedLimit?: number; usedCredit?: number };
                          const fUsed = quotaItem.usedCredit || 0;
                          const fLimit = quotaItem.allocatedLimit || 0;
                          if (fLimit === 0) return null; // skip if no allocation
                          const isDiesel = fuelType.includes('ดีเซล');
                          const colorClass = isDiesel ? 'text-blue-400' : 'text-amber-500';

                          return (
                            <div key={fuelType} className="flex justify-between items-center text-slate-400">
                              <span className="truncate max-w-[110px] text-slate-400">{fuelType}</span>
                              <span className="font-mono text-slate-300">
                                <span className={`${colorClass} font-bold`}>{fUsed.toLocaleString()}</span>
                                <span className="text-slate-600"> / {fLimit.toLocaleString()} ล.</span>
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          ) : (
            <div className="text-center py-5 text-slate-500 italic text-[10px] flex flex-col items-center justify-center gap-1.5 bg-slate-900/30 rounded-xl border border-dashed border-slate-800 p-3 mt-1">
              <AlertTriangle className="h-5 w-5 text-amber-500/80 shrink-0" />
              <span>ยังไม่มีข้อมูลสิทธิ์/โควตา</span>
              <span className="text-[8px] text-slate-600 not-italic">กรุณาติดต่อเจ้าหน้าที่เพื่ออนุมัติสิทธิ์เบิก</span>
            </div>
          )}
        </div>
      </section>

      {/* 4. Quick Actions Widget (Enhanced) [Grid Span: 3 Cols] */}
      <section 
        id="bento_quick_actions"
        className="lg:col-span-3 bg-slate-800/40 rounded-2xl border border-slate-700/80 p-5 flex flex-col justify-between shadow-lg"
      >
        <div className="space-y-3.5 w-full">
          {/* Section Header */}
          <div className="flex items-center justify-between border-b border-slate-800/60 pb-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200 flex items-center gap-1.5">
              <Zap className="h-4 w-4 text-amber-400" />
              การดำเนินการด่วน
            </h3>
            <span className="text-[9px] bg-slate-800/60 text-slate-400 px-1.5 py-0.5 rounded border border-slate-700/50 uppercase font-mono font-bold">
              Quick Actions
            </span>
          </div>

          {/* Error and Success Notifications */}
          {actionError && (
            <div className="flex items-start gap-1.5 p-2 bg-red-950/40 border border-red-500/20 rounded-xl text-[10px] text-red-300 animate-fadeIn">
              <XCircle className="h-3.5 w-3.5 text-red-400 shrink-0 mt-0.5" />
              <p className="leading-tight">{actionError}</p>
            </div>
          )}
          {actionSuccess && (
            <div className="flex items-start gap-1.5 p-2 bg-emerald-950/40 border border-emerald-500/20 rounded-xl text-[10px] text-emerald-300 animate-fadeIn">
              <CheckCircle className="h-3.5 w-3.5 text-emerald-400 shrink-0 mt-0.5" />
              <p className="leading-tight">{actionSuccess}</p>
            </div>
          )}

          {/* Action Button Grid */}
          <div className="grid grid-cols-2 gap-2">
            {(userRole === 'admin' || userRole === 'officer') ? (
              <>
                {/* 1. Dispatch Fuel */}
                <button
                  onClick={() => onNavigateToTab('record')}
                  className="flex flex-col items-center justify-center p-2.5 bg-slate-900/60 hover:bg-slate-900 border border-emerald-500/10 hover:border-emerald-500/40 hover:shadow-emerald-950/20 hover:shadow-md rounded-xl transition-all duration-200 group text-center cursor-pointer"
                >
                  <PlusCircle className="h-4.5 w-4.5 text-emerald-400 group-hover:scale-110 transition mb-1" />
                  <span className="text-[10px] font-bold text-white truncate w-full">
                    บันทึกจ่ายน้ำมัน
                  </span>
                </button>

                {/* 2. Fuel Delivery / Inventory */}
                <button
                  onClick={() => onNavigateToTab('inventory')}
                  className="flex flex-col items-center justify-center p-2.5 bg-slate-900/60 hover:bg-slate-900 border border-blue-500/10 hover:border-blue-500/40 hover:shadow-blue-950/20 hover:shadow-md rounded-xl transition-all duration-200 group text-center cursor-pointer"
                >
                  <Database className="h-4.5 w-4.5 text-blue-400 group-hover:scale-110 transition mb-1" />
                  <span className="text-[10px] font-bold text-white truncate w-full">
                    รับน้ำมันเข้าคลัง
                  </span>
                </button>
              </>
            ) : (
              <>
                {/* Driver Actions */}
                <button
                  onClick={() => onNavigateToTab('request')}
                  className="flex flex-col items-center justify-center p-2.5 bg-slate-900/60 hover:bg-slate-900 border border-blue-500/10 hover:border-blue-500/40 rounded-xl transition-all duration-200 group text-center cursor-pointer"
                >
                  <PlusCircle className="h-4.5 w-4.5 text-blue-400 group-hover:scale-110 transition mb-1" />
                  <span className="text-[10px] font-bold text-white truncate w-full">
                    เขียนคำขอใหม่
                  </span>
                </button>

                <button
                  onClick={() => onNavigateToTab('requests')}
                  className="flex flex-col items-center justify-center p-2.5 bg-slate-900/60 hover:bg-slate-900 border border-amber-500/10 hover:border-amber-500/40 rounded-xl transition-all duration-200 group text-center cursor-pointer"
                >
                  <Clock className="h-4.5 w-4.5 text-amber-400 group-hover:scale-110 transition mb-1" />
                  <span className="text-[10px] font-bold text-white truncate w-full">
                    ติดตามคิวคำขอ
                  </span>
                </button>
              </>
            )}
          </div>

          {/* Quick Approval Widget for Admin / Officer */}
          {(userRole === 'admin' || userRole === 'officer') && (
            <div className="border-t border-slate-800/80 pt-3 mt-1">
              {latestPendingRequest ? (
                <div className="bg-slate-900/80 rounded-xl p-2.5 border border-amber-500/20 hover:border-amber-500/35 transition-all duration-200 shadow-inner">
                  <div className="flex justify-between items-start mb-1.5">
                    <span className="text-[8px] bg-amber-500/10 text-amber-400 px-1 py-0.5 rounded border border-amber-500/20 font-bold uppercase tracking-wider font-mono">
                      คำขอเบิกล่าสุด
                    </span>
                    <span className="text-[9px] text-slate-500 font-mono">
                      {latestPendingRequest.date}
                    </span>
                  </div>
                  
                  <div className="space-y-1 text-[11px] mb-2.5">
                    <p className="text-slate-300 font-bold flex items-center gap-1.5 truncate">
                      <Shield className="h-3 w-3 text-emerald-400 shrink-0" />
                      หน่วย: <span className="text-white font-sans">{latestPendingRequest.unit}</span>
                    </p>
                    <p className="text-slate-300 flex items-center gap-1.5 truncate">
                      <Truck className="h-3 w-3 text-slate-400 shrink-0" />
                      ผู้เบิก: <span className="text-slate-200 font-sans">{latestPendingRequest.driverName}</span>
                    </p>
                    <div className="flex justify-between items-center text-[10px] bg-slate-950/60 px-2 py-1 rounded border border-slate-800">
                      <span className="text-slate-400 truncate max-w-[100px]">{latestPendingRequest.fuelType}</span>
                      <span className="font-extrabold text-amber-500 font-mono text-[11px]">{(latestPendingRequest.volume ?? 0).toLocaleString()} ลิตร</span>
                    </div>
                  </div>

                  <div className="flex gap-1.5">
                    <button
                      onClick={() => handleQuickApprove(latestPendingRequest)}
                      disabled={isApproving !== null}
                      className="flex-1 py-1.5 px-2 bg-emerald-500 hover:bg-emerald-400 disabled:bg-emerald-800/60 text-slate-950 font-bold text-[10.5px] rounded-lg transition-all duration-150 flex items-center justify-center gap-1 cursor-pointer shadow shadow-emerald-500/15"
                    >
                      {isApproving === latestPendingRequest.id ? (
                        <Loader2 className="h-3 w-3 animate-spin text-slate-950" />
                      ) : (
                        <Check className="h-3 w-3" />
                      )}
                      อนุมัติทันที
                    </button>
                    <button
                      onClick={() => onNavigateToTab('requests')}
                      className="py-1.5 px-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-[10px] rounded-lg transition-all duration-150 flex items-center justify-center gap-1 cursor-pointer border border-slate-700/60"
                    >
                      ดูทั้งหมด
                    </button>
                  </div>
                </div>
              ) : (
                <div className="bg-slate-900/40 rounded-xl p-3 border border-slate-800 text-center flex flex-col items-center justify-center py-5">
                  <CheckCircle className="h-6 w-6 text-slate-500 mb-1.5" />
                  <p className="text-[10px] font-bold text-slate-400">เรียบร้อยทั้งหมด</p>
                  <p className="text-[9px] text-slate-500 mt-0.5">ไม่มีคำขอค้างอนุมัติในระบบ</p>
                </div>
              )}
            </div>
          )}

          {/* Simple Informative Tips for Drivers */}
          {userRole === 'user' && (
            <div className="border-t border-slate-800/80 pt-3 mt-1 text-[10px] text-slate-400 space-y-1.5 bg-slate-900/20 p-2.5 rounded-xl border border-slate-800/40">
              <p className="font-bold text-slate-300 flex items-center gap-1">
                <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                คำแนะนำสำหรับผู้ใช้
              </p>
              <p className="leading-relaxed">
                กรุณาระบุยอดเลขไมล์ตามจริงเพื่อความถูกต้องในการติดตามอัตราบริโภคน้ำมันของกองทัพ
              </p>
            </div>
          )}
        </div>
      </section>

      {/* 5. Accumulative Fuel Proportion Chart (Pie Chart) [Grid Span: 4 Cols] */}
      <section id="bento_fuel_pie" className="lg:col-span-4 bg-slate-800/30 rounded-2xl border border-slate-700/80 p-5 flex flex-col justify-between shadow-lg">
        <div className="flex items-center gap-2 mb-2">
          <Flame className="h-4 w-4 text-emerald-400" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
            สัดส่วนปริมาณการจ่ายน้ำมันสะสม
          </h3>
        </div>
        
        <div className="w-full h-36 flex items-center justify-center relative">
          {fuelTypePieData.length === 0 ? (
            <div className="text-slate-500 text-xs italic">ไม่มีข้อมูลสะสม</div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={fuelTypePieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={38}
                  outerRadius={54}
                  paddingAngle={3}
                  dataKey="value"
                >
                  {fuelTypePieData.map((entry, index) => (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={FUEL_COLORS[entry.name] || PIE_COLORS[index % PIE_COLORS.length]} 
                    />
                  ))}
                </Pie>
                <Tooltip 
                  formatter={(value) => [`${value} ลิตร`, 'ยอดเติมสะสม']}
                  contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569', borderRadius: '8px', fontSize: '11px', color: '#fff' }}
                />
              </PieChart>
            </ResponsiveContainer>
          )}
          {fuelTypePieData.length > 0 && (
            <div className="absolute flex flex-col items-center">
              <span className="text-lg font-black text-white font-display leading-none">
                {(totalDispensed ?? 0).toLocaleString()}
              </span>
              <span className="text-[8px] text-slate-400 uppercase tracking-widest mt-1">LITERS TOTAL</span>
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-1.5 mt-2 text-[10px] border-t border-slate-800/50 pt-2">
          {fuelTypePieData.map((entry, idx) => {
            const color = FUEL_COLORS[entry.name] || PIE_COLORS[idx % PIE_COLORS.length];
            const pct = totalDispensed > 0 ? Math.round((entry.value / totalDispensed) * 100) : 0;
            return (
              <div key={entry.name} className="flex items-center gap-1.5 text-slate-300">
                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: color }}></span>
                <span className="truncate">{entry.name}: <span className="font-bold text-white font-mono">{pct}%</span></span>
              </div>
            );
          })}
        </div>
      </section>

      {/* 6. High-Consumption Units Chart (Bar Chart) [Grid Span: 5 Cols] */}
      <section id="bento_top_units" className="lg:col-span-5 bg-slate-800/30 rounded-2xl border border-slate-700/80 p-5 flex flex-col justify-between shadow-lg">
        <div className="flex items-center gap-2 mb-2">
          <Layers className="h-4 w-4 text-blue-400" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
            ยอดหน่วยเบิกจ่ายสูงสุด (Top 5 Units)
          </h3>
        </div>
        
        <div className="w-full h-36">
          {unitBarData.length === 0 ? (
            <div className="h-full flex items-center justify-center text-slate-500 text-xs italic">
              ไม่มีข้อมูลการเบิกจากหน่วย
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={unitBarData} layout="vertical" margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                <XAxis type="number" tick={{ fill: '#94a3b8', fontSize: 8 }} />
                <YAxis dataKey="name" type="category" tick={{ fill: '#94a3b8', fontSize: 9 }} width={75} />
                <Tooltip 
                  formatter={(value) => [`${value} ลิตร`, 'ยอดรวม']}
                  contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569', borderRadius: '8px', fontSize: '11px', color: '#fff' }}
                />
                <Bar dataKey="value" fill="#3B82F6" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </section>

      {/* 7. Key Operational Metrics Summary [Grid Span: 3 Cols] */}
      <section id="bento_stats_metrics" className="lg:col-span-3 grid grid-cols-2 gap-2 shadow-lg">
        {/* Metric A */}
        <div className="bg-slate-800/40 border border-slate-700/60 p-3 rounded-2xl flex flex-col justify-between">
          <div className="p-1.5 bg-blue-600/10 text-blue-400 rounded-lg w-fit">
            <Activity className="h-4 w-4" />
          </div>
          <div className="mt-2">
            <span className="text-[9px] text-slate-400 uppercase tracking-widest block font-bold">บันทึกรวม</span>
            <span className="text-xl font-black text-white font-mono">{(totalTransactions ?? 0).toLocaleString()}</span>
            <span className="text-[9px] text-slate-500 block">ครั้ง</span>
          </div>
        </div>

        {/* Metric B */}
        <div className="bg-slate-800/40 border border-slate-700/60 p-3 rounded-2xl flex flex-col justify-between">
          <div className="p-1.5 bg-purple-600/10 text-purple-400 rounded-lg w-fit">
            <Gauge className="h-4 w-4" />
          </div>
          <div className="mt-2">
            <span className="text-[9px] text-slate-400 uppercase tracking-widest block font-bold">เฉลี่ยต่อคัน</span>
            <span className="text-xl font-black text-white font-mono">{(avgDispensed ?? 0).toLocaleString()}</span>
            <span className="text-[9px] text-slate-500 block">ลิตร</span>
          </div>
        </div>
      </section>

      {/* 8. Recent Transaction Table [Grid Span: 9 Cols] */}
      <section id="bento_transaction_table" className="lg:col-span-9 bg-[#111827]/40 rounded-2xl border border-slate-700/80 flex flex-col overflow-hidden shadow-xl">
        <div className="p-4 border-b border-slate-800/80 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-slate-800/40">
          <div className="flex items-center gap-3">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-200 flex items-center gap-2">
              <span className="w-1.5 h-4 bg-emerald-500 rounded-full"></span>
              ประวัติรายการเบิกจ่ายน้ำมัน
            </h3>
            
            {/* Tab Controls */}
            <div className="flex bg-slate-900/60 p-0.5 rounded-lg border border-slate-700/40">
              <button
                onClick={() => setActiveTab('my')}
                className={`px-2.5 py-1 text-[10px] font-bold rounded-md transition-all flex items-center gap-1 cursor-pointer ${
                  activeTab === 'my'
                    ? 'bg-emerald-500 text-slate-950 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <User className="h-3 w-3" />
                ของฉัน ({myRecentTransactions.length})
              </button>
              <button
                onClick={() => setActiveTab('all')}
                className={`px-2.5 py-1 text-[10px] font-bold rounded-md transition-all flex items-center gap-1 cursor-pointer ${
                  activeTab === 'all'
                    ? 'bg-emerald-500 text-slate-950 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Layers className="h-3 w-3" />
                ทั้งหมด ({records.length})
              </button>
            </div>
          </div>

          <button 
            onClick={() => onNavigateToTab('records')}
            className="text-[10px] bg-slate-800 hover:bg-slate-700 border border-slate-700/60 text-slate-300 px-3 py-1.5 rounded-lg transition-all cursor-pointer font-medium"
          >
            ดูรายงานทั้งหมด
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="text-[10px] text-slate-400 uppercase border-b border-slate-800/80 bg-slate-900/60">
              <tr>
                <th className="px-6 py-3 font-semibold tracking-wider">วัน-เวลา</th>
                <th className="px-6 py-3 font-semibold tracking-wider">ยานพาหนะ/ภารกิจ</th>
                <th className="px-6 py-3 font-semibold tracking-wider">ประเภทน้ำมัน/เลขไมล์</th>
                <th className="px-6 py-3 font-semibold tracking-wider">จำนวนเบิก (ลิตร)</th>
                <th className="px-6 py-3 font-semibold tracking-wider">
                  {activeTab === 'my' ? 'สถานะ / ผู้จ่าย' : 'เจ้าหน้าที่ผู้จ่าย'}
                </th>
              </tr>
            </thead>
            <tbody className="text-xs divide-y divide-slate-800/50">
              {activeTab === 'my' ? (
                <>
                  {myRecentTransactions.slice(0, 5).map((item) => {
                    const isDiesel = item.fuelType.includes('ดีเซล');
                    const badgeClass = isDiesel 
                      ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' 
                      : 'bg-amber-500/10 text-amber-400 border border-amber-500/20';

                    let statusBadge = null;
                    if (item.type === 'request') {
                      if (item.status === 'pending') {
                        statusBadge = (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                            <Loader2 className="h-2.5 w-2.5 animate-spin" />
                            รออนุมัติ
                          </span>
                        );
                      } else if (item.status === 'rejected') {
                        statusBadge = (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold bg-red-500/10 text-red-400 border border-red-500/20">
                            ปฏิเสธ
                          </span>
                        );
                      }
                    } else {
                      statusBadge = (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/25">
                          จ่ายน้ำมันแล้ว
                        </span>
                      );
                    }

                    return (
                      <tr key={item.id} className="hover:bg-slate-800/30 transition-colors">
                        <td className="px-6 py-3 text-slate-400 font-mono text-xs">
                          <div>{item.date}</div>
                          <div className="text-[10px] text-slate-500 mt-0.5">{item.time || '--:--'}</div>
                        </td>
                        <td className="px-6 py-3">
                          <div className="font-bold text-slate-200">{item.vehicleNo}</div>
                          <div className="text-[10px] text-slate-400 font-medium truncate max-w-[200px]" title={item.purpose}>
                            {item.purpose || 'ไม่ระบุวัตถุประสงค์'}
                          </div>
                        </td>
                        <td className="px-6 py-3">
                          <div className="mb-1">
                            <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${badgeClass}`}>
                              {item.fuelType}
                            </span>
                          </div>
                          <div className="text-[10px] text-slate-500">
                            เลขไมล์: {item.odometer > 0 ? `${item.odometer.toLocaleString()} กม.` : 'ไม่ได้ระบุ'}
                          </div>
                        </td>
                        <td className="px-6 py-3">
                          <div className="font-extrabold text-slate-100 font-mono text-sm">
                            {(item.volume ?? 0).toLocaleString(undefined, { minimumFractionDigits: 1 })}
                          </div>
                          <div className="mt-1">{statusBadge}</div>
                        </td>
                        <td className="px-6 py-3 text-slate-400 font-medium">
                          {item.type === 'request' && item.status === 'rejected' ? (
                            <div>
                              <div className="text-slate-300">ปฏิเสธโดย: {item.officerOrApprover}</div>
                              {item.rejectedReason && (
                                <div className="text-[10px] text-red-400 mt-0.5 max-w-[150px] truncate" title={item.rejectedReason}>
                                  สาเหตุ: {item.rejectedReason}
                                </div>
                              )}
                            </div>
                          ) : item.type === 'request' && item.status === 'pending' ? (
                            <span className="text-slate-500 italic text-[10px]">รอตรวจสอบคิว</span>
                          ) : (
                            item.officerOrApprover || 'เจ้าหน้าที่'
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {myRecentTransactions.length === 0 && (
                    <tr>
                      <td colSpan={5} className="text-center py-10 text-slate-500 italic">
                        ไม่พบบันทึกการเบิกจ่ายน้ำมันส่วนตัวของท่านในระบบ
                      </td>
                    </tr>
                  )}
                </>
              ) : (
                <>
                  {records.slice(0, 5).map((rec) => {
                    const isDiesel = rec.fuelType.includes('ดีเซล');
                    const badgeClass = isDiesel 
                      ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' 
                      : 'bg-amber-500/10 text-amber-400 border border-amber-500/20';

                    return (
                      <tr key={rec.id} className="hover:bg-slate-800/30 transition-colors">
                        <td className="px-6 py-3 text-slate-400 font-mono text-xs">
                          {rec.date} {rec.time || ''}
                        </td>
                        <td className="px-6 py-3">
                          <div className="font-bold text-slate-200">{rec.vehicleNo}</div>
                          <div className="text-[10px] text-slate-400 font-medium">{rec.unit}</div>
                        </td>
                        <td className="px-6 py-3">
                          <div className="mb-1">
                            <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${badgeClass}`}>
                              {rec.fuelType}
                            </span>
                          </div>
                          {rec.odometer > 0 && (
                            <div className="text-[10px] text-slate-500">
                              เลขไมล์: {rec.odometer.toLocaleString()} กม.
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-3 font-extrabold text-slate-100 font-mono text-sm">
                          {(rec.volume ?? 0).toLocaleString(undefined, { minimumFractionDigits: 1 })}
                        </td>
                        <td className="px-6 py-3 text-slate-400 font-medium">
                          {rec.officerName || 'เจ้าหน้าที่'}
                        </td>
                      </tr>
                    );
                  })}
                  {records.length === 0 && (
                    <tr>
                      <td colSpan={5} className="text-center py-10 text-slate-500 italic">
                        ไม่มีประวัติการจ่ายน้ำมันในระบบ
                      </td>
                    </tr>
                  )}
                </>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* 9. Tank Levels (Narrow) [Grid Span: 3 Cols] */}
      <section id="bento_tanks_sidebar" className="lg:col-span-3 flex flex-col gap-4 shadow-xl">
        {inventory.map((inv, idx) => {
          const currentStock = inv?.currentStock ?? 0;
          const capacity = inv?.capacity ?? 1;
          const pct = capacity > 0 ? Math.round((currentStock / capacity) * 100) : 0;
          const fuelType = inv?.fuelType ?? 'ไม่ระบุชนิด';
          const isDiesel = fuelType.includes('ดีเซล');
          const isLow = pct < 25;
          const barColor = isLow ? 'bg-red-500' : isDiesel ? 'bg-blue-500' : 'bg-amber-500';
          const labelColor = isLow ? 'text-red-400 font-black animate-pulse' : isDiesel ? 'text-blue-400' : 'text-amber-400';

          return (
            <div 
              key={inv?.id || idx} 
              className="bg-slate-850 bg-slate-800/40 rounded-2xl border border-slate-700/80 p-5 flex flex-col justify-between"
            >
              <div className="flex items-center justify-between mb-3">
                <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">
                  คงเหลือ: {fuelType} (ถัง {idx + 1})
                </p>
                {isLow && (
                  <span className="flex h-2 w-2 relative">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                  </span>
                )}
              </div>
              <div className="flex flex-col justify-end gap-2">
                <div className="flex justify-between items-end text-white">
                  <span className="text-2xl font-black font-display tracking-tight">
                    {currentStock.toLocaleString()}
                  </span>
                  <span className="text-xs text-slate-400 pb-1 italic font-mono">
                    / {capacity.toLocaleString()} L
                  </span>
                </div>
                <div className="h-4 bg-slate-900 rounded-full overflow-hidden border border-slate-800 p-0.5">
                  <div 
                    className={`h-full rounded-full transition-all duration-700 ${barColor}`} 
                    style={{ width: `${pct}%` }}
                  ></div>
                </div>
                <p className={`text-right text-[10px] font-bold ${labelColor}`}>
                  {pct}% ของความจุ
                </p>
              </div>
            </div>
          );
        })}
      </section>

    </div>
  );
}
