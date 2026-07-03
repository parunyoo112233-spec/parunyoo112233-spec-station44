/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { 
  Database, 
  X, 
  Play, 
  CheckCircle2, 
  XCircle, 
  Loader2, 
  Terminal, 
  AlertTriangle, 
  RefreshCw, 
  ArrowRight,
  ShieldCheck,
  Server
} from 'lucide-react';
import { runDatabaseMigration, MigrationProgress, MigrationStepProgress } from '../lib/migrate';

interface DatabaseMigrationModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function DatabaseMigrationModal({ isOpen, onClose }: DatabaseMigrationModalProps) {
  const [migrationState, setMigrationState] = useState<MigrationProgress>({
    steps: {
      users: { collection: 'users', status: 'pending', current: 0, total: 0, message: 'รอดำเนินการ...' },
      fuel_inventory: { collection: 'fuel_inventory', status: 'pending', current: 0, total: 0, message: 'รอดำเนินการ...' },
      fuel_records: { collection: 'fuel_records', status: 'pending', current: 0, total: 0, message: 'รอดำเนินการ...' },
      fuel_requests: { collection: 'fuel_requests', status: 'pending', current: 0, total: 0, message: 'รอดำเนินการ...' },
      unit_credits: { collection: 'unit_credits', status: 'pending', current: 0, total: 0, message: 'รอดำเนินการ...' },
      unit_receipts: { collection: 'unit_receipts', status: 'pending', current: 0, total: 0, message: 'รอดำเนินการ...' },
    },
    logs: [],
    isCompleted: false,
    isFailed: false,
  });

  const [isRunning, setIsRunning] = useState(false);
  const logTerminalRef = useRef<HTMLDivElement>(null);

  // Auto-scroll logs to bottom as they arrive
  useEffect(() => {
    if (logTerminalRef.current) {
      logTerminalRef.current.scrollTop = logTerminalRef.current.scrollHeight;
    }
  }, [migrationState.logs]);

  if (!isOpen) return null;

  const handleStartMigration = async () => {
    const confirmMigration = window.confirm(
      'คุณต้องการเริ่มย้ายข้อมูลทั้งหมดจาก Firestore ไปยัง Supabase หรือไม่?\n' +
      'กระบวนการนี้จะทำการอัปเดตข้อมูลบน Supabase PostgreSQL และเขียนทับเรคคอร์ดที่มี ID ซ้ำกัน (Upsert Mode)'
    );
    if (!confirmMigration) return;

    setIsRunning(true);
    setMigrationState(prev => ({
      ...prev,
      isCompleted: false,
      isFailed: false,
      logs: ['[System] เริ่มจัดเตรียมโครงสร้างข้อมูล...'],
    }));

    try {
      await runDatabaseMigration((progress) => {
        setMigrationState(progress);
      });
    } catch (err: any) {
      setMigrationState(prev => ({
        ...prev,
        isFailed: true,
        logs: [...prev.logs, `[Critical Error] ${err?.message || err}`]
      }));
    } finally {
      setIsRunning(false);
    }
  };

  const getStatusIcon = (status: 'pending' | 'running' | 'completed' | 'failed') => {
    switch (status) {
      case 'running':
        return <Loader2 className="h-5 w-5 text-amber-400 animate-spin" />;
      case 'completed':
        return <CheckCircle2 className="h-5 w-5 text-emerald-400 font-bold" />;
      case 'failed':
        return <XCircle className="h-5 w-5 text-red-500 font-bold" />;
      default:
        return <div className="h-5 w-5 rounded-full border-2 border-slate-700 bg-slate-900" />;
    }
  };

  const getStatusClass = (status: 'pending' | 'running' | 'completed' | 'failed') => {
    switch (status) {
      case 'running':
        return 'border-amber-500/30 bg-amber-500/5 text-amber-200';
      case 'completed':
        return 'border-emerald-500/30 bg-emerald-500/5 text-emerald-200';
      case 'failed':
        return 'border-red-500/30 bg-red-500/5 text-red-200';
      default:
        return 'border-slate-800 bg-slate-900/40 text-slate-400';
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div 
        id="migration_modal_container" 
        className="w-full max-w-3xl bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl flex flex-col overflow-hidden max-h-[90vh] my-8 animate-scaleIn"
      >
        {/* Header */}
        <div className="p-6 bg-slate-900/60 border-b border-slate-800/80 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-2xl flex items-center justify-center">
              <Database className="h-5 w-5 animate-pulse" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">เครื่องมือย้ายฐานข้อมูลระบบ</h3>
              <p className="text-xs text-slate-400">ย้ายข้อมูลจาก Google Firestore ไปยัง Supabase PostgreSQL</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            disabled={isRunning}
            className="p-1.5 hover:bg-slate-800 rounded-xl text-slate-400 hover:text-white transition disabled:opacity-50 cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {/* Top Banner Notice */}
          <div className="bg-amber-500/5 border border-amber-500/20 rounded-2xl p-4 flex gap-3 text-xs leading-relaxed">
            <AlertTriangle className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
            <div className="space-y-1 text-slate-300">
              <p className="font-bold text-amber-300">ข้อควรทราบก่อนการเริ่มดำเนินการ:</p>
              <p>1. ระบบจะทำการดึงข้อมูลจากโครงสร้างคลังเดิม (Firestore) และนำส่งเข้าสู่ตารางฐานข้อมูลใหม่ (PostgreSQL) ผ่าน API ที่มีการรักษาความปลอดภัยอย่างเข้มงวด</p>
              <p>2. การทำงานนี้ใช้ระบบ <strong className="text-white">Upsert</strong> (หากมี ID เดิมอยู่แล้ว จะอัปเดตข้อมูลทับของเดิมโดยไม่ลบส่วนอื่นๆ)</p>
              <p>3. ข้อมูลบนระบบเดิมจะไม่สูญหายหรือถูกดัดแปลงใดๆ ปลอดภัย 100%</p>
            </div>
          </div>

          {/* Table list progress checklist */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Server className="h-4 w-4 text-slate-500" />
              ตารางข้อมูลที่ย้ายระบบ
            </h4>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {(Object.values(migrationState.steps) as MigrationStepProgress[]).map((step) => (
                <div 
                  key={step.collection}
                  className={`border rounded-2xl p-3.5 flex items-center justify-between gap-3 transition-colors ${getStatusClass(step.status)}`}
                >
                  <div className="flex items-center gap-3 overflow-hidden">
                    {getStatusIcon(step.status)}
                    <div className="overflow-hidden">
                      <p className="font-semibold text-sm text-slate-200 font-mono truncate">{step.collection}</p>
                      <p className="text-xs text-slate-400 mt-0.5 truncate">{step.message}</p>
                    </div>
                  </div>
                  {step.total > 0 && (
                    <div className="text-right shrink-0">
                      <div className="text-xs font-bold font-mono text-white">
                        {step.current} / {step.total}
                      </div>
                      <div className="text-[10px] text-slate-500 font-medium">ย้ายสำเร็จ</div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Live Terminal Log Console */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Terminal className="h-4 w-4 text-slate-500" />
                คอนโซลรายงานการย้ายระบบ (Live Output)
              </h4>
              <span className="text-[10px] bg-slate-800 text-slate-500 px-2 py-0.5 rounded font-mono">
                Log Lines: {migrationState.logs.length}
              </span>
            </div>
            
            <div 
              ref={logTerminalRef}
              className="h-48 bg-slate-950 border border-slate-800 rounded-2xl p-4 overflow-y-auto font-mono text-xs text-slate-300 space-y-1.5 scrollbar-thin scrollbar-thumb-slate-800"
            >
              {migrationState.logs.length === 0 ? (
                <div className="text-slate-600 italic flex items-center justify-center h-full">
                  รอกดปุ่มเริ่มทำงานเพื่อแสดงการอัปเดตแบบสด...
                </div>
              ) : (
                migrationState.logs.map((log, index) => {
                  let colorClass = 'text-slate-300';
                  if (log.includes('[Error]') || log.includes('[Critical Error]')) {
                    colorClass = 'text-red-400 font-medium';
                  } else if (log.includes('สำเร็จ') || log.includes('เสร็จสิ้น') || log.includes('🎉')) {
                    colorClass = 'text-emerald-400 font-semibold';
                  } else if (log.includes('กำลัง') || log.includes('ดึงข้อมูล')) {
                    colorClass = 'text-amber-300';
                  }
                  return (
                    <div key={index} className={`leading-relaxed break-all ${colorClass}`}>
                      {log}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Footer actions */}
        <div className="p-6 bg-slate-900/60 border-t border-slate-800/80 flex flex-col sm:flex-row gap-3 items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <ShieldCheck className="h-4 w-4 text-emerald-500" />
            เชื่อมต่ออย่างปลอดภัยผ่านสัญญาระหว่าง Firebase และ Supabase
          </div>

          <div className="flex gap-2 w-full sm:w-auto shrink-0 justify-end">
            <button
              onClick={onClose}
              disabled={isRunning}
              className="w-full sm:w-auto px-5 py-2.5 bg-slate-800 text-slate-300 hover:text-white rounded-xl text-sm font-semibold hover:bg-slate-700 transition disabled:opacity-50 cursor-pointer"
            >
              ปิดหน้าต่าง
            </button>
            
            <button
              onClick={handleStartMigration}
              disabled={isRunning}
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 rounded-xl text-sm font-bold shadow-lg shadow-amber-500/10 hover:shadow-amber-500/20 transition cursor-pointer disabled:opacity-50"
            >
              {isRunning ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  กำลังย้ายข้อมูลระบบ...
                </>
              ) : (
                <>
                  <Play className="h-4 w-4 fill-slate-950" />
                  เริ่มต้นการย้ายข้อมูลระบบ
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
