/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect } from 'react';
import { 
  FuelRecord, 
  UnitCredit, 
  UserProfile, 
  FuelInventory 
} from '../types';
import { 
  getUnitCredits, 
  updateUnitCreditLimit, 
  resetUnitCredit, 
  unitCreditsCol 
} from '../lib/db-helpers';
import { onSnapshot, query, orderBy } from 'firebase/firestore';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  Legend, 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell 
} from 'recharts';
import { 
  CreditCard, 
  TrendingUp, 
  Calendar, 
  Filter, 
  FileText, 
  Plus, 
  RefreshCw, 
  BarChart3, 
  AlertTriangle, 
  Printer, 
  Edit2, 
  ShieldAlert, 
  Building,
  CheckCircle2,
  ChevronRight,
  Info
} from 'lucide-react';

interface UnitCreditsAndReportsProps {
  records: FuelRecord[];
  inventory: FuelInventory[];
  currentUser: UserProfile;
}

const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ec4899', '#8b5cf6', '#6366f1'];

export default function UnitCreditsAndReports({ 
  records, 
  inventory, 
  currentUser 
}: UnitCreditsAndReportsProps) {
  
  const [unitCredits, setUnitCredits] = useState<UnitCredit[]>([]);
  const [activeSubTab, setActiveSubTab] = useState<'credits' | 'reports'>('credits');
  const [isLoading, setIsLoading] = useState(true);

  // Form State for Adding / Modifying Credits
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingCredit, setEditingCredit] = useState<UnitCredit | null>(null);
  const [formUnitName, setFormUnitName] = useState('');
  const [formLimit, setFormLimit] = useState<number>(5000);
  const [formQuotas, setFormQuotas] = useState<Record<string, string | number>>({
    'น้ำมันดีเซล': 0,
    'น้ำมันแก๊สโซฮอล์ 95': 0,
    'น้ำมันแก๊สโซฮอล์ 91': 0
  });
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');

  // Report Filter State
  const [filterUnit, setFilterUnit] = useState<string>(() => {
    return (currentUser.role === 'admin' || currentUser.role === 'officer') ? 'all' : currentUser.department;
  });
  const [filterFuelType, setFilterFuelType] = useState<string>('all');
  const [filterDateRange, setFilterDateRange] = useState<'all' | 'today' | '7days' | 'month' | 'custom'>('month');
  const [filterStartDate, setFilterStartDate] = useState<string>('');
  const [filterEndDate, setFilterEndDate] = useState<string>('');

  // Filter unitCredits according to user's unit if they are general users
  const displayedCredits = useMemo(() => {
    if (currentUser.role === 'admin' || currentUser.role === 'officer') {
      return unitCredits;
    }
    return unitCredits.filter(uc => uc.unit === currentUser.department);
  }, [unitCredits, currentUser]);

  // Print Preview state
  const [showPrintModal, setShowPrintModal] = useState(false);

  // Subscribe to Unit Credits Real-Time Update
  useEffect(() => {
    setIsLoading(true);
    const q = query(unitCreditsCol);
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const credits: UnitCredit[] = [];
      snapshot.forEach((doc) => {
        credits.push({ id: doc.id, ...doc.data() } as UnitCredit);
      });
      // Sort by allocated limit descending
      credits.sort((a, b) => b.allocatedLimit - a.allocatedLimit);
      setUnitCredits(credits);
      setIsLoading(false);
    }, (error) => {
      console.error("Error subscribing to unit credits: ", error);
      setIsLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Set default custom dates if not selected
  useEffect(() => {
    if (!filterStartDate || !filterEndDate) {
      const today = new Date();
      const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
      
      const formatStr = (d: Date) => {
        const offset = d.getTimezoneOffset();
        const localD = new Date(d.getTime() - (offset * 60 * 1000));
        return localD.toISOString().split('T')[0];
      };

      setFilterStartDate(formatStr(firstDay));
      setFilterEndDate(formatStr(today));
    }
  }, [filterStartDate, filterEndDate]);

  // Handle saving new/edited unit credit quota
  const handleSaveCredit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    setFormSuccess('');

    if (!formUnitName.trim()) {
      setFormError('กรุณากรอกชื่อหน่วยงาน');
      return;
    }

    const parsedQuotas: Record<string, number> = {};
    Object.entries(formQuotas).forEach(([fuel, val]) => {
      parsedQuotas[fuel] = parseInt(String(val), 10) || 0;
    });

    try {
      const targetId = editingCredit ? editingCredit.id : formUnitName.trim();
      await updateUnitCreditLimit(targetId, parsedQuotas);
      setFormSuccess('บันทึกข้อมูลวงเงินโควตาสำเร็จ!');
      
      setTimeout(() => {
        setShowAddModal(false);
        setEditingCredit(null);
        setFormUnitName('');
        setFormLimit(5000);
        setFormQuotas({
          'น้ำมันดีเซล': 0,
          'น้ำมันแก๊สโซฮอล์ 95': 0,
          'น้ำมันแก๊สโซฮอล์ 91': 0
        });
        setFormSuccess('');
      }, 1000);
    } catch (err: any) {
      setFormError('เกิดข้อผิดพลาด: ' + err.message);
    }
  };

  // Trigger editing unit credit modal
  const openEditModal = (credit: UnitCredit) => {
    setEditingCredit(credit);
    setFormUnitName(credit.unit);
    setFormLimit(credit.allocatedLimit);
    
    // Initialize quotas dictionary
    const initialQuotas = {
      'น้ำมันดีเซล': credit.quotas?.['น้ำมันดีเซล']?.allocatedLimit ?? 0,
      'น้ำมันแก๊สโซฮอล์ 95': credit.quotas?.['น้ำมันแก๊สโซฮอล์ 95']?.allocatedLimit ?? 0,
      'น้ำมันแก๊สโซฮอล์ 91': credit.quotas?.['น้ำมันแก๊สโซฮอล์ 91']?.allocatedLimit ?? 0,
    };
    // Fallback if quotas don't exist
    if (!credit.quotas || Object.keys(credit.quotas).length === 0) {
      initialQuotas['น้ำมันดีเซล'] = credit.allocatedLimit;
    }
    setFormQuotas(initialQuotas);
    setShowAddModal(true);
  };

  // Reset unit monthly usage to 0
  const handleResetUsage = async (unitId: string) => {
    if (window.confirm(`คุณแน่ใจหรือไม่ที่จะ "รีเซ็ตยอดเบิกใช้สะสม" ของหน่วย ${unitId} กลับเป็น 0?`)) {
      try {
        await resetUnitCredit(unitId, true);
        alert('รีเซ็ตยอดเบิกใช้เรียบร้อยแล้ว');
      } catch (err: any) {
        alert('เกิดข้อผิดพลาด: ' + err.message);
      }
    }
  };

  // Filtering Records for Report tab
  const filteredRecordsForReport = useMemo(() => {
    return records.filter(r => {
      // For general users, strictly enforce they only see their own department's records
      if (currentUser.role === 'user' && r.unit !== currentUser.department) return false;

      // 1. Unit filter
      if (currentUser.role !== 'user' && filterUnit !== 'all' && r.unit !== filterUnit) return false;

      // 2. Fuel Type filter
      if (filterFuelType !== 'all' && r.fuelType !== filterFuelType) return false;

      // 3. Date range filter
      const rDate = new Date(r.date);
      const today = new Date();
      today.setHours(0,0,0,0);

      if (filterDateRange === 'today') {
        const todayStr = today.toISOString().split('T')[0];
        if (r.date !== todayStr) return false;
      } else if (filterDateRange === '7days') {
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        sevenDaysAgo.setHours(0,0,0,0);
        if (rDate < sevenDaysAgo) return false;
      } else if (filterDateRange === 'month') {
        const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
        if (rDate < firstDayOfMonth) return false;
      } else if (filterDateRange === 'custom') {
        if (filterStartDate) {
          const start = new Date(filterStartDate);
          start.setHours(0,0,0,0);
          if (rDate < start) return false;
        }
        if (filterEndDate) {
          const end = new Date(filterEndDate);
          end.setHours(23,59,59,999);
          if (rDate > end) return false;
        }
      }
      return true;
    });
  }, [records, filterUnit, filterFuelType, filterDateRange, filterStartDate, filterEndDate, currentUser]);

  // Aggregate stats from filtered records
  const totalReportDispensed = useMemo(() => {
    return filteredRecordsForReport.reduce((sum, r) => sum + r.volume, 0);
  }, [filteredRecordsForReport]);

  const reportCount = filteredRecordsForReport.length;

  const fuelTypeBreakdown = useMemo(() => {
    const counts: Record<string, number> = {};
    filteredRecordsForReport.forEach(r => {
      counts[r.fuelType] = (counts[r.fuelType] || 0) + r.volume;
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [filteredRecordsForReport]);

  // Prepare chart data comparing credit allocation and consumption for all active units
  const chartUnitCreditData = useMemo(() => {
    return displayedCredits.map(uc => {
      // Find actual records for this unit within current filters
      const actualDispensedInFilteredRange = records
        .filter(r => r.unit === uc.unit && r.date.startsWith(new Date().toISOString().substring(0, 7))) // This month's actual
        .reduce((sum, r) => sum + r.volume, 0);

      return {
        unit: uc.unit,
        'วงเงินโควตา (ลิตร)': uc.allocatedLimit,
        'ยอดเบิกสะสมในระบบ (ลิตร)': uc.usedCredit,
        'ยอดเบิกช่วงที่เลือก (ลิตร)': records
          .filter(r => r.unit === uc.unit && filteredRecordsForReport.some(fr => fr.id === r.id))
          .reduce((sum, r) => sum + r.volume, 0)
      };
    });
  }, [displayedCredits, records, filteredRecordsForReport]);

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
    const yearNum = (parseInt(parts[0], 10) + 543);
    return `${dayNum} ${thaiMonthsShort[monthNum]} ${yearNum}`;
  };

  const currentMonthYearThai = useMemo(() => {
    const months = [
      'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
      'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
    ];
    const today = new Date();
    return `${months[today.getMonth()]} พ.ศ. ${today.getFullYear() + 543}`;
  }, []);

  return (
    <div id="credits_and_reports_view" className="space-y-6 pb-20">
      
      {/* View Header with Sub-tabs */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl relative overflow-hidden">
        {/* Background ambient accents */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none -z-10"></div>
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl pointer-events-none -z-10"></div>

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-emerald-400 font-mono text-xs tracking-wider uppercase mb-1">
              <CreditCard className="h-4 w-4" />
              <span>Credit Allocation & Reports</span>
            </div>
            <h1 className="text-2xl font-black text-white tracking-tight">
              ระบบวงเงินเครดิต และ รายงานยอดการใช้น้ำมัน
            </h1>
            <p className="text-slate-400 text-xs mt-1">
              ควบคุมโควตาการเบิกจ่ายรายหน่วยงานของ มทบ.44 และออกเอกสารรายงานผลสะสมอย่างมืออาชีพ
            </p>
          </div>

          {/* Sub Tab Buttons */}
          <div className="flex bg-slate-950 p-1.5 rounded-2xl border border-slate-800 self-start md:self-center">
            <button
              onClick={() => setActiveSubTab('credits')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                activeSubTab === 'credits' 
                  ? 'bg-emerald-500 text-slate-950 shadow-md' 
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <CreditCard className="h-3.5 w-3.5" />
              <span>วงเงินเครดิตหน่วย</span>
            </button>
            <button
              onClick={() => setActiveSubTab('reports')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                activeSubTab === 'reports' 
                  ? 'bg-emerald-500 text-slate-950 shadow-md' 
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <BarChart3 className="h-3.5 w-3.5" />
              <span>สรุปรายงานยอด</span>
            </button>
          </div>
        </div>
      </div>

      {/* SUB-TAB 1: CREDITS SYSTEM */}
      {activeSubTab === 'credits' && (
        <div className="space-y-6">
          {/* Quick Informational Notice */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-4 flex gap-3 text-xs text-slate-300">
            <Info className="h-5 w-5 text-emerald-400 shrink-0" />
            <div>
              <p className="font-semibold text-slate-200">หลักการทำงานของระบบโควตาเครดิตน้ำมัน</p>
              <p className="mt-0.5 text-slate-400">
                แต่ละหน่วยงานทหารในสังกัดจะได้รับโควตากลาง (จำนวนลิตร) รายเดือน เมื่อมีการจ่ายน้ำมันจริงในระบบ ยอดเครดิตที่ใช้จะถูกหักออกโดยอัตโนมัติ ระบบจะมีการแจ้งเตือนระดับวิกฤตหากอัตราเบิกสูงกว่า 85% เพื่อป้องกันการใช้เชื้อเพลิงเกินเกณฑ์ที่กำหนด
              </p>
            </div>
          </div>

          {/* Credits Summary Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Units list and Progresses */}
            <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-lg space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base font-bold text-white flex items-center gap-2">
                    <Building className="h-4 w-4 text-emerald-400" />
                    โควตาแยกรายหน่วยงาน
                  </h2>
                  <p className="text-xs text-slate-400">ยอดอัปเดตแบบเรียลไทม์ตามเอกสารสั่งจ่าย</p>
                </div>

                {(currentUser.role === 'admin' || currentUser.role === 'officer') && (
                  <button
                    onClick={() => {
                      setEditingCredit(null);
                      setFormUnitName('');
                      setFormLimit(5000);
                      setFormQuotas({
                        'น้ำมันดีเซล': 5000,
                        'น้ำมันแก๊สโซฮอล์ 95': 0,
                        'น้ำมันแก๊สโซฮอล์ 91': 0
                      });
                      setShowAddModal(true);
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold rounded-xl transition cursor-pointer"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>เพิ่มโควตาหน่วย</span>
                  </button>
                )}
              </div>

              {isLoading ? (
                <div className="flex flex-col items-center justify-center py-12 text-slate-400 text-xs">
                  <RefreshCw className="h-6 w-6 animate-spin text-emerald-400 mb-2" />
                  <span>กำลังดึงข้อมูลเครดิตโควตาหน่วยงาน...</span>
                </div>
              ) : displayedCredits.length === 0 ? (
                <div className="text-center py-12 text-slate-400 text-xs bg-slate-950 rounded-2xl border border-slate-800">
                  <AlertTriangle className="h-8 w-8 mx-auto text-amber-500 mb-2" />
                  <p className="font-semibold text-slate-300">ยังไม่มีข้อมูลเครดิตโควตา</p>
                  <p className="mt-1">กดปุ่ม "เพิ่มโควตาหน่วย" ด้านบนเพื่อเพิ่มข้อมูลแรกในระบบ</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {displayedCredits.map((uc) => {
                    const allocatedLimit = uc.allocatedLimit ?? 0;
                    const usedCredit = uc.usedCredit ?? 0;
                    const pct = allocatedLimit > 0 ? Math.round((usedCredit / allocatedLimit) * 100) : 0;
                    const remaining = allocatedLimit - usedCredit;
                    const isOver = usedCredit > allocatedLimit || allocatedLimit < 0;
                    const isWarning = pct >= 85 && !isOver;

                    return (
                      <div 
                        key={uc.id} 
                        className="bg-slate-950/80 rounded-2xl border border-slate-800 p-4 hover:border-slate-700 transition"
                      >
                        <div className="flex justify-between items-start gap-2 mb-2">
                          <div>
                            <span className="font-bold text-white text-sm block">{uc.unit}</span>
                            <span className="text-[10px] text-slate-400">อัปเดตล่าสุด: {formatThaiDate(uc.lastResetDate)}</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            {isOver && (
                              <span className="bg-red-500/10 text-red-400 border border-red-500/20 text-[10px] px-2 py-0.5 rounded-full font-bold flex items-center gap-1">
                                <ShieldAlert className="h-3 w-3" />
                                <span>เกินโควตา!</span>
                              </span>
                            )}
                            {isWarning && (
                              <span className="bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[10px] px-2 py-0.5 rounded-full font-semibold flex items-center gap-1">
                                <AlertTriangle className="h-3 w-3" />
                                <span>วงเงินใกล้หมด</span>
                              </span>
                            )}
                            {!isOver && !isWarning && (
                              <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] px-2 py-0.5 rounded-full font-medium flex items-center gap-1">
                                <CheckCircle2 className="h-3 w-3" />
                                <span>ปกติ</span>
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Progress Bar Container */}
                        <div className="space-y-1.5">
                          <div className="w-full bg-slate-800 rounded-full h-2.5 overflow-hidden">
                            <div 
                              className={`h-full rounded-full transition-all duration-500 ${
                                isOver ? 'bg-red-500' : isWarning ? 'bg-amber-500' : 'bg-emerald-500'
                              }`}
                              style={{ width: `${Math.min(100, pct)}%` }}
                            ></div>
                          </div>
                          
                          <div className="flex justify-between text-xs font-mono">
                            <span className="text-slate-400">
                              ใช้สะสม: <strong className="text-white font-bold">{usedCredit.toLocaleString()}</strong> / {allocatedLimit.toLocaleString()} ลิตร ({pct}%)
                            </span>
                            <span className={isOver ? "text-red-400" : isWarning ? "text-amber-400" : "text-emerald-400"}>
                              คงเหลือ: <strong className="font-extrabold">{remaining.toLocaleString()}</strong> ลิตร
                            </span>
                          </div>
                        </div>

                        {/* Sub-quotas per fuel type */}
                        <div className="mt-3 pt-3 border-t border-slate-800/40 grid grid-cols-1 sm:grid-cols-3 gap-2 text-[10px]">
                          {['น้ำมันดีเซล', 'น้ำมันแก๊สโซฮอล์ 95', 'น้ำมันแก๊สโซฮอล์ 91'].map(fuel => {
                            const quotaInfo = uc.quotas?.[fuel] || (fuel === 'น้ำมันดีเซล' ? { allocatedLimit: allocatedLimit, usedCredit: usedCredit } : { allocatedLimit: 0, usedCredit: 0 });
                            const qAllocated = quotaInfo.allocatedLimit ?? 0;
                            const qUsed = quotaInfo.usedCredit ?? 0;
                            const fPct = qAllocated > 0 ? Math.round((qUsed / qAllocated) * 100) : 0;
                            const fRemaining = qAllocated - qUsed;
                            if (qAllocated === 0) return null;

                            return (
                              <div key={fuel} className="bg-slate-900/40 p-2 rounded-xl border border-slate-800/60 flex flex-col justify-between">
                                <div className="flex justify-between font-bold text-slate-300 mb-1 gap-1">
                                  <span className="truncate" title={fuel}>{fuel}</span>
                                  <span className={fRemaining < qAllocated * 0.15 ? "text-amber-400" : "text-emerald-400"}>
                                    {fRemaining.toLocaleString()} ล.
                                  </span>
                                </div>
                                <div className="w-full bg-slate-800 rounded-full h-1 overflow-hidden mb-1">
                                  <div 
                                    className={`h-full rounded-full ${
                                      qUsed > qAllocated ? 'bg-red-500' : fRemaining < qAllocated * 0.15 ? 'bg-amber-500' : 'bg-emerald-500'
                                    }`}
                                    style={{ width: `${Math.min(100, fPct)}%` }}
                                  ></div>
                                </div>
                                <div className="text-[9px] text-slate-500 flex justify-between font-mono">
                                  <span>ใช้: {qUsed.toLocaleString()}</span>
                                  <span>โควตา: {qAllocated.toLocaleString()}</span>
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        {/* Action buttons (Visible to Officers and Admins only) */}
                        {(currentUser.role === 'admin' || currentUser.role === 'officer') && (
                          <div className="flex justify-end gap-2 border-t border-slate-800/60 mt-3 pt-2.5">
                            <button
                              onClick={() => openEditModal(uc)}
                              className="flex items-center gap-1 px-2.5 py-1 text-[10px] font-semibold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg transition cursor-pointer"
                            >
                              <Edit2 className="h-2.5 w-2.5" />
                              <span>แก้ไขโควตา</span>
                            </button>
                            <button
                              onClick={() => handleResetUsage(uc.id)}
                              className="flex items-center gap-1 px-2.5 py-1 text-[10px] font-semibold text-amber-400 hover:text-amber-300 bg-slate-800 hover:bg-slate-700 rounded-lg transition cursor-pointer"
                            >
                              <RefreshCw className="h-2.5 w-2.5 animate-pulse" />
                              <span>รีเซ็ตยอดเบิกใช้</span>
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Quick Credit Allocation Charts */}
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-lg flex flex-col justify-between space-y-6">
              <div>
                <h2 className="text-base font-bold text-white flex items-center gap-2 mb-1">
                  <TrendingUp className="h-4 w-4 text-emerald-400" />
                  สัดส่วนการจัดสรรโควตา
                </h2>
                <p className="text-xs text-slate-400">เปรียบเทียบโควตากระแสรวมของ มทบ.44 แยกตามหน่วยงาน</p>
              </div>

              {displayedCredits.length > 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center min-h-[220px]">
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie
                        data={displayedCredits.map(uc => ({ name: uc.unit, value: uc.allocatedLimit }))}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={4}
                        dataKey="value"
                      >
                        {displayedCredits.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', borderRadius: '12px' }}
                        itemStyle={{ color: '#ffffff', fontSize: '12px' }}
                      />
                    </PieChart>
                  </ResponsiveContainer>

                  {/* Legend Grid */}
                  <div className="grid grid-cols-2 gap-2 mt-4 w-full">
                    {displayedCredits.map((uc, idx) => (
                      <div key={uc.id} className="flex items-center gap-1.5 text-[10px] text-slate-300">
                        <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: COLORS[idx % COLORS.length] }}></span>
                        <span className="truncate">{uc.unit} ({((uc.allocatedLimit) ?? 0).toLocaleString()} ลิตร)</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-center py-12 text-slate-400 text-xs">
                  <span>ไม่มีข้อมูลสำหรับแสดงแผนภูมิสัดส่วน</span>
                </div>
              )}
            </div>

          </div>
        </div>
      )}

      {/* SUB-TAB 2: SUMMARY REPORTS */}
      {activeSubTab === 'reports' && (
        <div className="space-y-6">
          
          {/* Controls & Filter Panel */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-lg">
            <h2 className="text-base font-bold text-white flex items-center gap-2 mb-4">
              <Filter className="h-4 w-4 text-emerald-400" />
              กรองรายงานสรุปข้อมูล
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* 1. Filter Unit */}
              <div className="space-y-1">
                <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">หน่วยงานเบิกน้ำมัน</label>
                <select
                  value={filterUnit}
                  onChange={(e) => setFilterUnit(e.target.value)}
                  disabled={currentUser.role === 'user'}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-emerald-500 disabled:opacity-60"
                >
                  {(currentUser.role === 'admin' || currentUser.role === 'officer') ? (
                    <>
                      <option value="all">ทั้งหมด ทุกหน่วยงาน</option>
                      {unitCredits.map(uc => (
                        <option key={uc.id} value={uc.unit}>{uc.unit}</option>
                      ))}
                    </>
                  ) : (
                    <option value={currentUser.department}>{currentUser.department}</option>
                  )}
                </select>
              </div>

              {/* 2. Filter Fuel Type */}
              <div className="space-y-1">
                <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">ประเภทน้ำมัน</label>
                <select
                  value={filterFuelType}
                  onChange={(e) => setFilterFuelType(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                >
                  <option value="all">ทั้งหมด ทุกประเภท</option>
                  {inventory.map(inv => (
                    <option key={inv.id} value={inv.fuelType}>{inv.fuelType}</option>
                  ))}
                </select>
              </div>

              {/* 3. Filter Date Range Preset */}
              <div className="space-y-1">
                <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">ช่วงเวลา</label>
                <select
                  value={filterDateRange}
                  onChange={(e) => setFilterDateRange(e.target.value as any)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                >
                  <option value="month">เดือนนี้ ({currentMonthYearThai})</option>
                  <option value="today">เฉพาะวันนี้</option>
                  <option value="7days">ย้อนหลัง 7 วันล่าสุด</option>
                  <option value="all">ทั้งหมดในระบบ</option>
                  <option value="custom">กำหนดช่วงวันที่เอง...</option>
                </select>
              </div>

              {/* 4. Action Button for Printable Doc */}
              <div className="flex items-end">
                <button
                  onClick={() => setShowPrintModal(true)}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs rounded-xl transition shadow-md cursor-pointer h-[38px]"
                >
                  <Printer className="h-4 w-4" />
                  <span>พิมพ์รายงานกองทัพบก</span>
                </button>
              </div>
            </div>

            {/* Custom Date Inputs (Visible only when 'custom' is selected) */}
            {filterDateRange === 'custom' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4 pt-4 border-t border-slate-800/50">
                <div className="space-y-1">
                  <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">เริ่มจากวันที่</label>
                  <input
                    type="date"
                    value={filterStartDate}
                    onChange={(e) => setFilterStartDate(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">ถึงวันที่</label>
                  <input
                    type="date"
                    value={filterEndDate}
                    onChange={(e) => setFilterEndDate(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Quick Metrics & Reports Visualization Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            {/* Metric 1 */}
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-md flex items-center gap-4 relative overflow-hidden">
              <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-2xl shrink-0">
                <FileText className="h-6 w-6" />
              </div>
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-mono tracking-wider">รายการที่กรอง</span>
                <h3 className="text-2xl font-black text-white mt-0.5">{(reportCount ?? 0).toLocaleString()} <span className="text-xs font-normal text-slate-400">ครั้ง</span></h3>
                <p className="text-[10px] text-slate-400">สอดคล้องตามเกณฑ์เงื่อนไขการค้นหา</p>
              </div>
            </div>

            {/* Metric 2 */}
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-md flex items-center gap-4 relative overflow-hidden">
              <div className="p-3.5 bg-blue-500/10 border border-blue-500/20 text-blue-400 rounded-2xl shrink-0">
                <TrendingUp className="h-6 w-6" />
              </div>
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-mono tracking-wider">ปริมาณจ่ายน้ำมันรวม</span>
                <h3 className="text-2xl font-black text-white mt-0.5">{(totalReportDispensed ?? 0).toLocaleString()} <span className="text-xs font-normal text-slate-400">ลิตร</span></h3>
                <p className="text-[10px] text-slate-400">ยอดความต้องการใช้น้ำมันในช่วงเวลานี้</p>
              </div>
            </div>

            {/* Metric 3 */}
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-md flex items-center gap-4 relative overflow-hidden">
              <div className="p-3.5 bg-purple-500/10 border border-purple-500/20 text-purple-400 rounded-2xl shrink-0">
                <CreditCard className="h-6 w-6" />
              </div>
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-mono tracking-wider">วงเงินโควตาจัดสรรรวม</span>
                <h3 className="text-2xl font-black text-white mt-0.5">
                  {displayedCredits.reduce((sum, c) => sum + (c.allocatedLimit ?? 0), 0).toLocaleString()} <span className="text-xs font-normal text-slate-400">ลิตร</span>
                </h3>
                <p className="text-[10px] text-slate-400">วงเงินทั้งหมดของกองทัพหน่วยงาน</p>
              </div>
            </div>

          </div>

          {/* Visual Charts section */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Chart 1: Limits vs Spent per Unit */}
            <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-lg flex flex-col justify-between">
              <div>
                <h2 className="text-base font-bold text-white flex items-center gap-2 mb-1">
                  <BarChart3 className="h-4 w-4 text-emerald-400" />
                  สัดส่วนโควตาจำกัด เปรียบเทียบ การใช้จริง
                </h2>
                <p className="text-xs text-slate-400">วิเคราะห์เพื่อจำกัดสิทธิ์วงเงินและเฝ้าระวังอัตราเบิกจ่าย</p>
              </div>

              {chartUnitCreditData.length > 0 ? (
                <div className="h-64 mt-6">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartUnitCreditData}>
                      <XAxis dataKey="unit" stroke="#64748b" fontSize={10} />
                      <YAxis stroke="#64748b" fontSize={10} />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', borderRadius: '12px' }}
                        labelStyle={{ fontWeight: 'bold', color: '#ffffff', fontSize: '11px' }}
                      />
                      <Legend wrapperStyle={{ fontSize: '10px' }} />
                      <Bar dataKey="วงเงินโควตา (ลิตร)" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="ยอดเบิกสะสมในระบบ (ลิตร)" fill="#10b981" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="text-center py-12 text-slate-400 text-xs">
                  <span>ไม่มีข้อมูลโควตาในการทำกราฟเปรียบเทียบ</span>
                </div>
              )}
            </div>

            {/* Chart 2: Fuel Type breakdown */}
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-lg flex flex-col justify-between">
              <div>
                <h2 className="text-base font-bold text-white flex items-center gap-2 mb-1">
                  <TrendingUp className="h-4 w-4 text-emerald-400" />
                  การแบ่งสัดส่วนชนิดน้ำมัน
                </h2>
                <p className="text-xs text-slate-400">สัดส่วนชนิดน้ำมันที่เบิกใช้ในช่วงที่กำหนด</p>
              </div>

              {fuelTypeBreakdown.length > 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center min-h-[200px]">
                  <ResponsiveContainer width="100%" height={160}>
                    <PieChart>
                      <Pie
                        data={fuelTypeBreakdown}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={70}
                        paddingAngle={3}
                        dataKey="value"
                      >
                        {fuelTypeBreakdown.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', borderRadius: '12px' }}
                        itemStyle={{ color: '#ffffff', fontSize: '11px' }}
                      />
                    </PieChart>
                  </ResponsiveContainer>

                  {/* Custom legend */}
                  <div className="grid grid-cols-2 gap-2 mt-4 w-full text-[10px]">
                    {fuelTypeBreakdown.map((ft, idx) => (
                      <div key={ft.name} className="flex items-center gap-1.5 text-slate-300">
                        <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: COLORS[idx % COLORS.length] }}></span>
                        <span className="truncate">{ft.name} ({(ft.value ?? 0).toLocaleString()} ล.)</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-center py-12 text-slate-400 text-xs">
                  <span>ไม่มีรายงานสถิติการใช้น้ำมันในช่วงนี้</span>
                </div>
              )}
            </div>

          </div>

          {/* Table list of transactions within filter */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-lg">
            <h2 className="text-base font-bold text-white mb-4">รายการจ่ายน้ำมันในช่วงเวลาเบิกรับ</h2>
            
            {filteredRecordsForReport.length === 0 ? (
              <div className="text-center py-8 text-slate-500 text-xs bg-slate-950 rounded-2xl border border-slate-850">
                ไม่มีประวัติใบสั่งจ่ายใดๆ ที่ตรงกับการกรองข้อมูล
              </div>
            ) : (
              <div className="overflow-x-auto rounded-2xl border border-slate-800">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-950 text-slate-400 border-b border-slate-800 font-bold">
                      <th className="p-3">วันที่ / เวลา</th>
                      <th className="p-3">หน่วยงาน</th>
                      <th className="p-3">ทะเบียนรถ</th>
                      <th className="p-3">ประเภทน้ำมัน</th>
                      <th className="p-3 text-right">ปริมาณ (ลิตร)</th>
                      <th className="p-3">เลขที่ใบสั่ง</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-850 bg-slate-900/50">
                    {filteredRecordsForReport.map((record) => (
                      <tr key={record.id} className="hover:bg-slate-950/40 text-slate-300 transition">
                        <td className="p-3">{formatThaiDate(record.date)} {record.time}</td>
                        <td className="p-3 font-semibold text-white">{record.unit}</td>
                        <td className="p-3 font-mono text-slate-400">{record.vehicleNo}</td>
                        <td className="p-3">
                          <span className="inline-flex px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700 text-[10px]">
                            {record.fuelType}
                          </span>
                        </td>
                        <td className="p-3 text-right font-extrabold text-emerald-400 font-mono">{(record.volume ?? 0).toLocaleString()}</td>
                        <td className="p-3 text-slate-400 font-mono">{record.orderNo}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL: ADD / EDIT UNIT LIMIT QUOTA */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-6 shadow-2xl relative overflow-hidden">
            <h3 className="text-base font-bold text-white mb-2">
              {editingCredit ? '📝 แก้ไขวงเงินโควตาของหน่วยงาน' : '🏢 เพิ่มโควตาเครดิตหน่วยงานใหม่'}
            </h3>
            <p className="text-xs text-slate-400 mb-4">
              กำหนดปริมาณน้ำมัน (ลิตร) สูงสุดที่หน่วยนี้ได้รับสิทธิ์เบิกจ่ายในรอบบิลปัจจุบัน
            </p>

            <form onSubmit={handleSaveCredit} className="space-y-4">
              
              {/* Unit Name Input */}
              <div className="space-y-1">
                <label className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">ชื่อสังกัด/หน่วยงาน</label>
                <input
                  type="text"
                  placeholder="ตัวอย่าง: พัน.ส.มทบ.44"
                  value={formUnitName}
                  onChange={(e) => setFormUnitName(e.target.value)}
                  disabled={!!editingCredit}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-emerald-500 disabled:opacity-50"
                  required
                />
              </div>

              {/* Quota inputs split by fuel types */}
              <div className="space-y-3 bg-slate-950 p-4 rounded-2xl border border-slate-800">
                <div className="text-[10px] text-slate-400 uppercase font-bold tracking-wider mb-1">
                  กำหนดโควตาแยกตามประเภทชนิดน้ำมัน (ลิตร)
                </div>

                <div className="grid grid-cols-1 gap-2.5">
                  <div>
                    <label className="text-[10px] text-slate-500 font-bold block mb-1">น้ำมันดีเซล</label>
                    <input
                      type="number"
                      placeholder="เช่น 5000"
                      value={formQuotas['น้ำมันดีเซล'] ?? ''}
                      onChange={(e) => {
                        const val = e.target.value;
                        setFormQuotas(prev => ({ ...prev, 'น้ำมันดีเซล': val }));
                      }}
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-500 font-bold block mb-1">น้ำมันแก๊สโซฮอล์ 95</label>
                    <input
                      type="number"
                      placeholder="เช่น 1000"
                      value={formQuotas['น้ำมันแก๊สโซฮอล์ 95'] ?? ''}
                      onChange={(e) => {
                        const val = e.target.value;
                        setFormQuotas(prev => ({ ...prev, 'น้ำมันแก๊สโซฮอล์ 95': val }));
                      }}
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-500 font-bold block mb-1">น้ำมันแก๊สโซฮอล์ 91</label>
                    <input
                      type="number"
                      placeholder="เช่น 1000"
                      value={formQuotas['น้ำมันแก๊สโซฮอล์ 91'] ?? ''}
                      onChange={(e) => {
                        const val = e.target.value;
                        setFormQuotas(prev => ({ ...prev, 'น้ำมันแก๊สโซฮอล์ 91': val }));
                      }}
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white font-mono"
                    />
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-800 flex justify-between items-center text-xs font-mono text-slate-400">
                  <span>ยอดโควตารวมทั้งสิ้น:</span>
                  <span className="font-extrabold text-white text-sm">
                    {((Object.values(formQuotas) as (string | number)[]).reduce<number>((sum, v) => sum + (parseInt(String(v), 10) || 0), 0)).toLocaleString()} ลิตร
                  </span>
                </div>
              </div>

              {/* Status Indicator */}
              {formError && (
                <div className="p-3 bg-red-500/10 text-red-400 border border-red-500/20 text-xs rounded-xl flex items-center gap-1.5">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              {formSuccess && (
                <div className="p-3 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs rounded-xl flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                  <span>{formSuccess}</span>
                </div>
              )}

              {/* Actions */}
              <div className="flex justify-end gap-2 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddModal(false);
                    setEditingCredit(null);
                  }}
                  className="px-4 py-2 text-slate-400 hover:text-white text-xs font-semibold cursor-pointer"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold rounded-xl transition cursor-pointer"
                >
                  บันทึกข้อมูล
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* PRINT PREVIEW REPORT MODAL (ROYAL THAI ARMY STYLE DOC) */}
      {showPrintModal && (
        <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-4xl w-full p-6 shadow-2xl space-y-6 my-8">
            
            {/* Modal Actions */}
            <div className="flex justify-between items-center border-b border-slate-800 pb-4">
              <div>
                <h3 className="text-base font-bold text-white">เอกสารรายงานราชการกองทัพบก</h3>
                <p className="text-xs text-slate-400">พรีวิวรูปแบบเอกสารพิมพ์รายงานโควตาเครดิตน้ำมัน</p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => window.print()}
                  className="flex items-center gap-1.5 px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs rounded-xl transition cursor-pointer"
                >
                  <Printer className="h-3.5 w-3.5" />
                  <span>ส่งพิมพ์ (Print)</span>
                </button>
                <button
                  onClick={() => setShowPrintModal(false)}
                  className="px-4 py-2 text-slate-400 hover:text-white text-xs font-semibold cursor-pointer border border-slate-800 hover:border-slate-700 rounded-xl"
                >
                  ปิดหน้าต่าง
                </button>
              </div>
            </div>

            {/* PAPER LAYOUT WITH PRINT CSS COMPATIBILITY */}
            <div id="thai-army-report-sheet" className="bg-white text-black p-8 md:p-12 rounded-2xl shadow-xl font-sans text-xs space-y-6 max-h-[70vh] overflow-y-auto border border-slate-200">
              
              {/* Garuda Logo Placeholder */}
              <div className="text-center space-y-2">
                <div className="text-3xl font-extrabold text-slate-900">ครุฑ</div>
                <h2 className="text-lg font-black tracking-tight text-slate-900">รายงานสรุปวงเงินโควตาเครดิตและการจ่ายเชื้อเพลิง</h2>
                <p className="text-slate-600 font-medium">กองทัพบก - มณฑลทหารบกที่ 44 (มทบ.44)</p>
                <div className="h-[2px] bg-slate-300 w-1/4 mx-auto my-3"></div>
              </div>

              {/* Metadata Details */}
              <div className="grid grid-cols-2 gap-4 text-[11px] border border-slate-200 p-4 rounded-xl bg-slate-50 text-slate-800">
                <div>
                  <p><strong>ประเภทรายงาน:</strong> สรุปยอดเบิกจ่ายสะสมจำแนกรายหน่วยงาน</p>
                  <p><strong>ข้อมูลระหว่างวันที่:</strong> {filterDateRange === 'month' ? `ประจำเดือน ${currentMonthYearThai}` : filterDateRange === 'today' ? 'เฉพาะวันนี้' : 'ช่วงเวลาที่เลือกกรองพิเศษ'}</p>
                  <p><strong>พิมพ์รายงานโดย:</strong> {currentUser.rank} {currentUser.name}</p>
                </div>
                <div className="text-right">
                  <p><strong>คลังต้นทาง:</strong> คลังเชื้อเพลิง มทบ.44</p>
                  <p><strong>วันที่ออกเอกสาร:</strong> {new Date().toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
                  <p><strong>จำนวนรายการรวม:</strong> {reportCount} ใบสั่งจ่าย</p>
                </div>
              </div>

              {/* Table section inside paper */}
              <div className="space-y-4">
                <h3 className="font-bold text-slate-900 border-b border-slate-300 pb-1">1. สรุปโควตาเครดิตจำลอง</h3>
                
                <table className="w-full border-collapse border border-slate-300 text-[11px]">
                  <thead>
                    <tr className="bg-slate-100 text-slate-700 font-bold">
                      <th className="border border-slate-300 p-2 text-left">ที่</th>
                      <th className="border border-slate-300 p-2 text-left">หน่วยสังกัด</th>
                      <th className="border border-slate-300 p-2 text-right">โควตาจัดสรร (ลิตร)</th>
                      <th className="border border-slate-300 p-2 text-right">ยอดใช้สะสม (ลิตร)</th>
                      <th className="border border-slate-300 p-2 text-right">โควตาคงเหลือ (ลิตร)</th>
                      <th className="border border-slate-300 p-2 text-center">ร้อยละที่ใช้</th>
                    </tr>
                  </thead>
                  <tbody>
                    {displayedCredits.map((uc, idx) => {
                      const allocatedLimit = uc.allocatedLimit ?? 0;
                      const usedCredit = uc.usedCredit ?? 0;
                      const remaining = Math.max(0, allocatedLimit - usedCredit);
                      const pct = allocatedLimit > 0 ? Math.round((usedCredit / allocatedLimit) * 100) : 0;
                      return (
                        <tr key={uc.id} className="text-slate-800">
                          <td className="border border-slate-300 p-2 text-center">{idx + 1}</td>
                          <td className="border border-slate-300 p-2 font-bold">{uc.unit}</td>
                          <td className="border border-slate-300 p-2 text-right">{allocatedLimit.toLocaleString()}</td>
                          <td className="border border-slate-300 p-2 text-right text-emerald-700 font-semibold">{usedCredit.toLocaleString()}</td>
                          <td className="border border-slate-300 p-2 text-right font-bold text-slate-900">{remaining.toLocaleString()}</td>
                          <td className="border border-slate-300 p-2 text-center">{pct}%</td>
                        </tr>
                      );
                    })}
                    <tr className="bg-slate-50 font-bold text-slate-900">
                      <td colSpan={2} className="border border-slate-300 p-2 text-right">ยอดรวมทั้งหมด</td>
                      <td className="border border-slate-300 p-2 text-right">
                        {displayedCredits.reduce((sum, c) => sum + (c.allocatedLimit ?? 0), 0).toLocaleString()}
                      </td>
                      <td className="border border-slate-300 p-2 text-right text-emerald-700">
                        {displayedCredits.reduce((sum, c) => sum + (c.usedCredit ?? 0), 0).toLocaleString()}
                      </td>
                      <td className="border border-slate-300 p-2 text-right">
                        {displayedCredits.reduce((sum, c) => sum + Math.max(0, (c.allocatedLimit ?? 0) - (c.usedCredit ?? 0)), 0).toLocaleString()}
                      </td>
                      <td className="border border-slate-300 p-2 text-center">-</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Detailed items list inside paper */}
              <div className="space-y-4 pt-4">
                <h3 className="font-bold text-slate-900 border-b border-slate-300 pb-1">2. รายละเอียดใบบันทึกสั่งจ่ายน้ำมัน (เรียงลำดับเวลา)</h3>
                
                <table className="w-full border-collapse border border-slate-300 text-[10px]">
                  <thead>
                    <tr className="bg-slate-100 text-slate-700 font-bold">
                      <th className="border border-slate-300 p-1.5 text-center">วันที่</th>
                      <th className="border border-slate-300 p-1.5 text-left">ใบสั่งจ่ายเลขที่</th>
                      <th className="border border-slate-300 p-1.5 text-left">หน่วยรับการเบิก</th>
                      <th className="border border-slate-300 p-1.5 text-left">ประเภทน้ำมัน</th>
                      <th className="border border-slate-300 p-1.5 text-right">ปริมาณ (ลิตร)</th>
                      <th className="border border-slate-300 p-1.5 text-left">ผู้รับน้ำมัน / คนขับ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRecordsForReport.slice(0, 30).map((r, idx) => (
                      <tr key={r.id} className="text-slate-800">
                        <td className="border border-slate-300 p-1.5 text-center">{formatThaiDate(r.date)}</td>
                        <td className="border border-slate-300 p-1.5 font-mono">{r.orderNo}</td>
                        <td className="border border-slate-300 p-1.5">{r.unit}</td>
                        <td className="border border-slate-300 p-1.5">{r.fuelType}</td>
                        <td className="border border-slate-300 p-1.5 text-right font-bold">{(r.volume ?? 0).toLocaleString()}</td>
                        <td className="border border-slate-300 p-1.5">{r.driverName}</td>
                      </tr>
                    ))}
                    {filteredRecordsForReport.length > 30 && (
                      <tr>
                        <td colSpan={6} className="text-center p-2 text-slate-500 bg-slate-50">
                          ...และอีก {filteredRecordsForReport.length - 30} รายการที่สอดคล้องตามตัวกรอง...
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Official Military Signature Lines */}
              <div className="grid grid-cols-2 gap-12 pt-16 text-center text-[11px] text-slate-800">
                <div className="space-y-12">
                  <p>ลงชื่อ .............................................................. ผู้จัดทำรายงาน<br/>
                  ( {currentUser.rank} {currentUser.name} )<br/>
                  ตำแหน่ง เจ้าหน้าที่จ่ายน้ำมัน คลังเชื้อเพลิง มทบ.44</p>
                </div>
                <div className="space-y-12">
                  <p>ลงชื่อ .............................................................. ผู้อนุมัติรับรอง<br/>
                  ( พล.ต. สุรศักดิ์ รักสงบ )<br/>
                  ตำแหน่ง ผู้บัญชาการมณฑลทหารบกที่ 44</p>
                </div>
              </div>

            </div>

          </div>
        </div>
      )}

    </div>
  );
}
