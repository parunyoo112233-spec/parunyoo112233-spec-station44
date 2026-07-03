/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { FuelRecord, FuelInventory, UserProfile } from '../types';
import { Calendar, Search, Filter, Printer, Download, FileText, ChevronDown, CheckCircle, Trash2, RefreshCw } from 'lucide-react';
import { deleteFuelRecord } from '../lib/db-helpers';

interface RecordHistoryProps {
  records: FuelRecord[];
  inventory: FuelInventory[];
  currentUser?: UserProfile | null;
}

export default function RecordHistory({ records, inventory, currentUser }: RecordHistoryProps) {
  // Deleting State
  const [isDeleting, setIsDeleting] = useState<string | null>(null);

  const handleDeleteRecord = async (recordId: string) => {
    if (!window.confirm('คุณแน่ใจหรือไม่ที่จะลบรายการประวัติการเติมน้ำมันนี้?\nการลบจะย้อนคืนยอดโควตาเครดิตของหน่วยงาน และคืนยอดน้ำมันเข้าคลังใหญ่โดยอัตโนมัติ')) {
      return;
    }

    setIsDeleting(recordId);
    try {
      await deleteFuelRecord(recordId);
      alert('ลบรายการประวัติการเติมน้ำมันและคืนค่าเรียบร้อยแล้ว');
    } catch (error: any) {
      console.error('Error deleting record:', error);
      alert('เกิดข้อผิดพลาดในการลบรายการ: ' + error.message);
    } finally {
      setIsDeleting(null);
    }
  };

  // Filters state
  const [filterType, setFilterType] = useState<'all' | 'daily' | 'monthly'>('all');
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [selectedMonth, setSelectedMonth] = useState(() => new Date().toISOString().substring(0, 7)); // YYYY-MM
  const [selectedFuel, setSelectedFuel] = useState('all');
  const [selectedUnit, setSelectedUnit] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  
  // View mode
  const [isPrintMode, setIsPrintMode] = useState(false);

  // Filter records by department if user is regular user
  const visibleRecords = useMemo(() => {
    if (currentUser && currentUser.role === 'user') {
      return records.filter(r => r.unit === currentUser.department);
    }
    return records;
  }, [records, currentUser]);

  // Extract unique Units/Departments from records for filters
  const uniqueUnits = useMemo(() => {
    const units = visibleRecords.map(r => r.unit);
    return ['all', ...Array.from(new Set(units))];
  }, [visibleRecords]);

  // Thai months for dropdown/labels
  const thaiMonths = [
    'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
    'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
  ];

  const formatThaiDate = (dateStr: string) => {
    const dParts = dateStr.split('-');
    if (dParts.length !== 3) return dateStr;
    const year = parseInt(dParts[0], 10) + 543; // Buddhist Era
    const month = thaiMonths[parseInt(dParts[1], 10) - 1];
    const day = parseInt(dParts[2], 10);
    return `${day} ${month} ${year}`;
  };

  const formatThaiMonth = (monthStr: string) => {
    const dParts = monthStr.split('-');
    if (dParts.length !== 2) return monthStr;
    const year = parseInt(dParts[0], 10) + 543;
    const month = thaiMonths[parseInt(dParts[1], 10) - 1];
    return `${month} ${year}`;
  };

  // Filtered records
  const filteredRecords = useMemo(() => {
    return visibleRecords.filter(rec => {
      // 1. Time Filter
      if (filterType === 'daily') {
        if (rec.date !== selectedDate) return false;
      } else if (filterType === 'monthly') {
        if (!rec.date.startsWith(selectedMonth)) return false;
      }

      // 2. Fuel Type Filter
      if (selectedFuel !== 'all' && rec.fuelType !== selectedFuel) return false;

      // 3. Unit Filter
      if (selectedUnit !== 'all' && rec.unit !== selectedUnit) return false;

      // 4. Search Query (Vehicle, Driver, OrderNo, Officer)
      if (searchQuery.trim() !== '') {
        const query = searchQuery.toLowerCase();
        const matchVehicle = (rec.vehicleNo || '').toLowerCase().includes(query);
        const matchDriver = (rec.driverName || '').toLowerCase().includes(query);
        const matchOrder = (rec.orderNo || '').toLowerCase().includes(query);
        const matchOfficer = (rec.officerName || '').toLowerCase().includes(query);
        const matchPurpose = (rec.purpose || '').toLowerCase().includes(query);

        if (!matchVehicle && !matchDriver && !matchOrder && !matchOfficer && !matchPurpose) return false;
      }

      return true;
    });
  }, [visibleRecords, filterType, selectedDate, selectedMonth, selectedFuel, selectedUnit, searchQuery]);

  // Calculations for filtered data
  const summaryStats = useMemo(() => {
    let totalLiters = 0;
    const fuelBreakdown: Record<string, number> = {};
    const unitBreakdown: Record<string, number> = {};

    inventory.forEach(inv => {
      fuelBreakdown[inv.fuelType] = 0;
    });

    filteredRecords.forEach(rec => {
      totalLiters += rec.volume;
      if (fuelBreakdown[rec.fuelType] !== undefined) {
        fuelBreakdown[rec.fuelType] += rec.volume;
      } else {
        fuelBreakdown[rec.fuelType] = rec.volume;
      }
      unitBreakdown[rec.unit] = (unitBreakdown[rec.unit] || 0) + rec.volume;
    });

    return {
      totalLiters,
      fuelBreakdown,
      unitBreakdown,
      totalCount: filteredRecords.length
    };
  }, [filteredRecords, inventory]);

  const handlePrint = () => {
    window.print();
  };

  const handleExportCSV = () => {
    // 1. Define the headers for Thai/English military reporting
    const headers = [
      'วันที่สั่งจ่าย',
      'เวลา',
      'เลขที่ใบสั่งจ่าย/ใบเบิก',
      'หน่วยสังกัดผู้เบิก',
      'ประเภทรถ',
      'หมายเลขทะเบียนรถ/กงจักร',
      'ชื่อคนขับ/ผู้รับน้ำมัน',
      'ประเภทน้ำมัน',
      'ปริมาณที่เติม (ลิตร)',
      'ประเภทภารกิจ/หมายเหตุ',
      'เลขระยะทางขับขี่ (กิโลเมตร)',
      'เจ้าหน้าที่คลังผู้บันทึก'
    ];

    // 2. Map records to rows with clean escaping for CSV
    const rows = filteredRecords.map(rec => [
      rec.date,
      rec.time,
      `"${rec.orderNo.replace(/"/g, '""')}"`,
      `"${rec.unit.replace(/"/g, '""')}"`,
      `"${(rec.vehicleType || '').replace(/"/g, '""')}"`,
      `"${rec.vehicleNo.replace(/"/g, '""')}"`,
      `"${rec.driverName.replace(/"/g, '""')}"`,
      `"${rec.fuelType.replace(/"/g, '""')}"`,
      rec.volume,
      `"${(rec.purpose || '').replace(/"/g, '""')}"`,
      rec.odometer || 0,
      `"${rec.officerName.replace(/"/g, '""')}"`
    ]);

    // 3. Combine headers and rows, adding a BOM so Excel reads Thai characters correctly
    const csvContent = [
      headers.join(','),
      ...rows.map(e => e.join(','))
    ].join('\n');

    // Excel needs UTF-8 BOM (\uFEFF) to properly recognize Thai characters
    const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    
    // Create hidden download link and click it
    const link = document.createElement('a');
    link.href = url;
    const dateStamp = new Date().toISOString().split('T')[0];
    link.setAttribute('download', `รายงานเบิกจ่ายน้ำมัน_มทบ44_${dateStamp}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // If formal print view is active
  if (isPrintMode) {
    return (
      <div className="bg-white text-black p-8 max-w-4xl mx-auto min-h-screen font-serif" id="printable_report">
        {/* Print controls overlay (hidden on actual print via CSS) */}
        <div className="mb-6 flex justify-between items-center bg-slate-100 p-4 rounded-xl border border-slate-300 print:hidden">
          <div className="text-sm text-slate-700">
            <strong>โหมดพิมพ์รายงานราชการ (Official Print Mode)</strong><br />
            กดปุ่มสั่งพิมพ์เพื่อเปิดหน้าตั้งค่าการจัดพิมพ์หรือเซฟเป็นไฟล์ PDF
          </div>
          <div className="flex gap-2">
            <button 
              onClick={() => setIsPrintMode(false)}
              className="px-4 py-2 border border-slate-400 text-slate-700 rounded-lg text-sm font-sans font-medium hover:bg-slate-200 transition cursor-pointer"
            >
              ย้อนกลับ
            </button>
            <button 
              onClick={handlePrint}
              className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-sans font-medium hover:bg-emerald-500 transition flex items-center gap-1.5 cursor-pointer"
            >
              <Printer className="h-4 w-4" /> สั่งพิมพ์ (Print)
            </button>
          </div>
        </div>

        {/* Header Official Military Style */}
        <div className="text-center space-y-2 border-b-2 border-double border-black pb-4 mb-6">
          <h2 className="text-xl font-bold font-serif uppercase">รายงานสรุปการจ่ายน้ำมันเชื้อเพลิง</h2>
          <h3 className="text-lg font-bold font-serif">สถานีบริการน้ำมัน คลัง มทบ.44</h3>
          <p className="text-sm">
            {filterType === 'daily' && `ประจำวันที่: ${formatThaiDate(selectedDate)}`}
            {filterType === 'monthly' && `ประจำเดือน: ${formatThaiMonth(selectedMonth)}`}
            {filterType === 'all' && 'รายงานประวัติการเบิกจ่ายทั้งหมด'}
          </p>
          <div className="flex justify-between text-xs pt-2">
            <span>พิมพ์โดย: ระบบบันทึกการจ่ายน้ำมันคลัง มทบ.44</span>
            <span>วันที่พิมพ์รายงาน: {formatThaiDate(new Date().toISOString().split('T')[0])} เวลา: {new Date().toLocaleTimeString('th-TH').substring(0, 5)} น.</span>
          </div>
        </div>

        {/* Stats Table inside print */}
        <div className="mb-6">
          <h4 className="text-sm font-bold border-b border-black pb-1 mb-2">สรุปปริมาณการจ่ายน้ำมันเชื้อเพลิงแยกประเภท</h4>
          <table className="w-full text-sm text-left border-collapse border border-black">
            <thead>
              <tr className="bg-slate-100 border-b border-black">
                <th className="p-2 border-r border-black font-bold">ประเภทน้ำมัน</th>
                <th className="p-2 text-right font-bold">ปริมาณการจ่ายรวม (ลิตร)</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(summaryStats.fuelBreakdown).map(([fuel, vol]) => (
                <tr key={fuel} className="border-b border-black">
                  <td className="p-2 border-r border-black">{fuel}</td>
                  <td className="p-2 text-right font-mono">{(vol ?? 0).toLocaleString()} ลิตร</td>
                </tr>
              ))}
              <tr className="bg-slate-100 font-bold border-t border-black">
                <td className="p-2 border-r border-black text-right">ยอดรวมน้ำมันเชื้อเพลิงทั้งสิ้น</td>
                <td className="p-2 text-right font-mono">{(summaryStats.totalLiters ?? 0).toLocaleString()} ลิตร</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Detail Records Table */}
        <div className="mb-10">
          <h4 className="text-sm font-bold border-b border-black pb-1 mb-2">รายละเอียดผู้เบิกและประวัติการจ่าย</h4>
          <table className="w-full text-xs border-collapse border border-black">
            <thead>
              <tr className="bg-slate-100 border-b border-black text-center">
                <th className="p-1.5 border-r border-black font-bold w-12">ว/ด/ป</th>
                <th className="p-1.5 border-r border-black font-bold w-12">เลขที่ใบสั่ง</th>
                <th className="p-1.5 border-r border-black font-bold w-20">หมายเลขรถ</th>
                <th className="p-1.5 border-r border-black font-bold w-24">สังกัด/หน่วย</th>
                <th className="p-1.5 border-r border-black font-bold">ชื่อคนขับ/ผู้รับ</th>
                <th className="p-1.5 border-r border-black font-bold w-24">ประเภทน้ำมัน</th>
                <th className="p-1.5 border-r border-black font-bold w-16">จำนวน (ลิตร)</th>
                <th className="p-1.5 border-r border-black font-bold w-24">ผู้จ่าย</th>
              </tr>
            </thead>
            <tbody>
              {filteredRecords.map((rec) => (
                <tr key={rec.id} className="border-b border-black text-center">
                  <td className="p-1.5 border-r border-black">{rec.date.split('-').reverse().join('/')}</td>
                  <td className="p-1.5 border-r border-black truncate max-w-[60px]">{rec.orderNo}</td>
                  <td className="p-1.5 border-r border-black font-semibold">{rec.vehicleNo}</td>
                  <td className="p-1.5 border-r border-black">{rec.unit}</td>
                  <td className="p-1.5 border-r border-black text-left">{rec.driverName}</td>
                  <td className="p-1.5 border-r border-black">{rec.fuelType}</td>
                  <td className="p-1.5 border-r border-black font-bold text-right font-mono">{rec.volume}</td>
                  <td className="p-1.5 border-r border-black truncate max-w-[80px]">{rec.officerName}</td>
                </tr>
              ))}
              {filteredRecords.length === 0 && (
                <tr>
                  <td colSpan={8} className="p-4 text-center text-slate-500">ไม่มีข้อมูลในช่วงเวลาที่กำหนด</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Official Signature Lines for thai military */}
        <div className="grid grid-cols-2 gap-12 text-sm pt-8">
          <div className="text-center space-y-12">
            <p>ตรวจแล้วถูกต้อง</p>
            <div className="space-y-1">
              <p className="border-b border-black border-dashed w-48 mx-auto"></p>
              <p>( ............................................................ )</p>
              <p>ตำแหน่ง เจ้าหน้าที่ประจำคลัง มทบ.44</p>
            </div>
          </div>

          <div className="text-center space-y-12">
            <p>เสนอผู้บังคับบัญชาเพื่อทราบและอนุมัติ</p>
            <div className="space-y-1">
              <p className="border-b border-black border-dashed w-48 mx-auto"></p>
              <p>( ............................................................ )</p>
              <p>ตำแหน่ง นายทหารส่งกำลังเชื้อเพลิง คลัง มทบ.44</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div id="record_history_view" className="space-y-6">
      
      {/* 1. Header and quick switch */}
      <div className="bg-slate-800 p-4 sm:p-5 rounded-2xl border border-slate-700/60 shadow-xl">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <FileText className="h-5 w-5 text-emerald-400" />
              รายงานและประวัติการจ่ายน้ำมันเชื้อเพลิง
            </h2>
            <p className="text-xs text-slate-400 mt-1">สรุปข้อมูลเบิกจ่ายรายวัน/รายเดือน และพิมพ์ใบรายงานผลการเบิกจ่ายทางราชการ</p>
          </div>

          {/* Actions button group */}
          <div className="flex flex-col sm:flex-row gap-2.5 w-full sm:w-auto">
            <button
              onClick={handleExportCSV}
              title="ส่งออกรายการที่กรองเป็นไฟล์ Excel (CSV)"
              className="w-full sm:w-auto px-4 py-2 bg-slate-700 hover:bg-slate-650 border border-slate-600 hover:border-slate-500 text-white rounded-xl text-sm font-semibold transition flex items-center justify-center gap-2 cursor-pointer shadow-md active:scale-[0.98]"
            >
              <Download className="h-4 w-4 text-emerald-400" />
              <span>ส่งออกไฟล์ Excel (CSV)</span>
            </button>
            <button
              onClick={() => setIsPrintMode(true)}
              className="w-full sm:w-auto px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-sm font-semibold transition flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-emerald-950/20 active:scale-[0.98]"
            >
              <Printer className="h-4 w-4" /> พิมพ์รายงานทางการ
            </button>
          </div>
        </div>

        {/* Date Filter Selection Tabs */}
        <div className="grid grid-cols-3 gap-2 mt-5 bg-slate-900/60 p-1.5 rounded-xl border border-slate-700/50 text-sm">
          <button
            onClick={() => setFilterType('all')}
            className={`py-2 px-3 rounded-lg font-semibold transition cursor-pointer text-center ${
              filterType === 'all'
                ? 'bg-slate-800 text-white shadow'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            ทั้งหมด
          </button>
          <button
            onClick={() => setFilterType('daily')}
            className={`py-2 px-3 rounded-lg font-semibold transition cursor-pointer text-center ${
              filterType === 'daily'
                ? 'bg-slate-800 text-white shadow'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            รายวัน
          </button>
          <button
            onClick={() => setFilterType('monthly')}
            className={`py-2 px-3 rounded-lg font-semibold transition cursor-pointer text-center ${
              filterType === 'monthly'
                ? 'bg-slate-800 text-white shadow'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            รายเดือน
          </button>
        </div>

        {/* Dynamic Filter Controls based on selection */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-4 pt-4 border-t border-slate-700/50">
          
          {/* Time Picker */}
          {filterType === 'daily' && (
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">เลือกวันที่</label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-500">
                  <Calendar className="h-4 w-4" />
                </span>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="w-full pl-10 pr-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-sm text-white focus:border-emerald-500 outline-none"
                />
              </div>
            </div>
          )}

          {filterType === 'monthly' && (
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">เลือกเดือน</label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-500">
                  <Calendar className="h-4 w-4" />
                </span>
                <input
                  type="month"
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="w-full pl-10 pr-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-sm text-white focus:border-emerald-500 outline-none"
                />
              </div>
            </div>
          )}

          {/* Fuel Type Filter */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">ประเภทน้ำมัน</label>
            <select
              value={selectedFuel}
              onChange={(e) => setSelectedFuel(e.target.value)}
              className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-sm text-white focus:border-emerald-500 outline-none"
            >
              <option value="all">ทั้งหมด (ทุกประเภท)</option>
              {inventory.map(inv => (
                <option key={inv.fuelType} value={inv.fuelType}>{inv.fuelType}</option>
              ))}
            </select>
          </div>

          {/* Unit Filter */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">สังกัด/หน่วยงาน</label>
            <select
              value={selectedUnit}
              onChange={(e) => setSelectedUnit(e.target.value)}
              className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-sm text-white focus:border-emerald-500 outline-none"
            >
              <option value="all">ทั้งหมด (ทุกหน่วย)</option>
              {uniqueUnits.filter(u => u !== 'all').map(unit => (
                <option key={unit} value={unit}>{unit}</option>
              ))}
            </select>
          </div>

          {/* Text Search */}
          <div className="space-y-1 sm:col-span-2 lg:col-span-2">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">คำค้นหาด่วน</label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-500">
                <Search className="h-4 w-4" />
              </span>
              <input
                type="text"
                placeholder="ค้นหา: เลขกงจักร, ทะเบียนรถ, ชื่อผู้รับ, ภารกิจ, เลขที่ใบจ่าย..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-sm text-white focus:border-emerald-500 outline-none"
              />
            </div>
          </div>

        </div>

      </div>

      {/* 2. Stat summary boxes for current selection */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        
        {/* Total Liters */}
        <div className="bg-slate-800 p-4 rounded-xl border border-slate-700/50">
          <p className="text-[10px] text-slate-400 uppercase font-semibold">ปริมาณจ่ายรวมช่วงเวลา</p>
          <p className="text-xl sm:text-2xl font-extrabold text-white mt-1">
            {(summaryStats.totalLiters ?? 0).toLocaleString()} <span className="text-xs text-slate-400 font-normal">ลิตร</span>
          </p>
        </div>

        {/* Count of Dispatches */}
        <div className="bg-slate-800 p-4 rounded-xl border border-slate-700/50">
          <p className="text-[10px] text-slate-400 uppercase font-semibold">จำนวนคันรถเบิกจ่าย</p>
          <p className="text-xl sm:text-2xl font-extrabold text-blue-400 mt-1">
            {summaryStats.totalCount} <span className="text-xs text-slate-400 font-normal">เที่ยว</span>
          </p>
        </div>

        {/* Diesel Breakdown */}
        <div className="bg-slate-800 p-4 rounded-xl border border-slate-700/50">
          <p className="text-[10px] text-slate-400 uppercase font-semibold">ยอดจ่าย ดีเซล (รวม)</p>
          <p className="text-xl font-extrabold text-emerald-400 mt-1">
            {((summaryStats.fuelBreakdown['น้ำมันดีเซล'] || 0) + (summaryStats.fuelBreakdown['ดีเซล B7'] || 0) + (summaryStats.fuelBreakdown['ดีเซล'] || 0)).toLocaleString()}{' '}
            <span className="text-xs text-slate-400 font-normal">ลิตร</span>
          </p>
        </div>

        {/* Gasohol Breakdown */}
        <div className="bg-slate-800 p-4 rounded-xl border border-slate-700/50">
          <p className="text-[10px] text-slate-400 uppercase font-semibold">ยอดจ่าย แก๊สโซฮอล์ (รวม)</p>
          <p className="text-xl font-extrabold text-amber-400 mt-1">
            {((summaryStats.fuelBreakdown['น้ำมันแก๊สโซฮอล์ 95'] || 0) + (summaryStats.fuelBreakdown['แก๊สโซฮอล์ 95'] || 0) + (summaryStats.fuelBreakdown['น้ำมันแก๊สโซฮอล์ 91'] || 0) + (summaryStats.fuelBreakdown['แก๊สโซฮอล์ 91'] || 0)).toLocaleString()}{' '}
            <span className="text-xs text-slate-400 font-normal">ลิตร</span>
          </p>
        </div>

      </div>

      {/* 3. Main Data Table with Mobile Friendly Accordion Card option */}
      <div className="bg-slate-800 rounded-2xl border border-slate-700/60 shadow-xl overflow-hidden">
        
        {/* Table Title */}
        <div className="px-5 py-4 border-b border-slate-700/50 flex justify-between items-center bg-slate-800/80">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider">บัญชีประวัติการจ่ายน้ำมัน</h3>
          <span className="text-xs text-slate-400">พบ {filteredRecords.length} แถว</span>
        </div>

        {/* Table view for Desktop (md+) */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-sm text-left text-slate-300">
            <thead className="text-xs text-slate-400 uppercase bg-slate-900/60 border-b border-slate-700/50">
              <tr>
                <th scope="col" className="px-5 py-3.5">วันที่-เวลา</th>
                <th scope="col" className="px-4 py-3.5">เลขใบเบิก</th>
                <th scope="col" className="px-4 py-3.5">ทะเบียนรถ / สังกัด</th>
                <th scope="col" className="px-4 py-3.5">ผู้รับ / ผู้ใช้</th>
                <th scope="col" className="px-4 py-3.5">ประเภทน้ำมัน</th>
                <th scope="col" className="px-4 py-3.5 text-right">จำนวนลิตร</th>
                <th scope="col" className="px-5 py-3.5 text-right">ผู้บันทึกจ่าย</th>
                {currentUser?.role === 'admin' && <th scope="col" className="px-4 py-3.5 text-center">จัดการ</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/40">
              {filteredRecords.map((rec) => (
                <tr key={rec.id} className="hover:bg-slate-700/20 transition">
                  <td className="px-5 py-4 whitespace-nowrap text-xs text-slate-400">
                    {rec.date.split('-').reverse().join('/')}<br />
                    {rec.time} น.
                  </td>
                  <td className="px-4 py-4 font-mono text-xs">{rec.orderNo}</td>
                  <td className="px-4 py-4">
                    <span className="font-bold text-white block">{rec.vehicleNo}</span>
                    <span className="text-xs text-slate-400 block">{rec.unit} • {rec.vehicleType}</span>
                  </td>
                  <td className="px-4 py-4">
                    <p className="text-white font-medium">{rec.driverName}</p>
                    <p className="text-xs text-slate-400 truncate max-w-[150px]" title={rec.purpose}>{rec.purpose}</p>
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap text-xs">
                    <span className="inline-flex items-center gap-1.5 font-medium text-white bg-slate-900/40 px-2 py-1 rounded-md border border-slate-700/40">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                      {rec.fuelType}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-right font-bold text-white text-base whitespace-nowrap">
                    {(rec.volume ?? 0).toLocaleString()} L
                    {(rec.odometer ?? 0) > 0 && (
                      <span className="text-[10px] text-slate-400 font-normal block font-mono">ไมล์ {(rec.odometer ?? 0).toLocaleString()} กม.</span>
                    )}
                  </td>
                  <td className="px-5 py-4 text-right text-xs text-slate-400">
                    {rec.officerName}
                  </td>
                  {currentUser?.role === 'admin' && (
                    <td className="px-4 py-4 text-center whitespace-nowrap">
                      <button
                        onClick={() => handleDeleteRecord(rec.id)}
                        disabled={isDeleting === rec.id}
                        className="p-1.5 hover:bg-red-500/10 text-slate-500 hover:text-red-400 rounded-lg transition-all cursor-pointer disabled:opacity-50"
                        title="ลบรายการบันทึกนี้และย้อนคืนสต็อก/โควตา"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  )}
                </tr>
              ))}

              {filteredRecords.length === 0 && (
                <tr>
                  <td colSpan={currentUser?.role === 'admin' ? 8 : 7} className="px-6 py-12 text-center text-slate-500">
                    ไม่พบรายการเบิกน้ำมันตามตัวกรองที่เลือก
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile View (Touch-friendly card list) */}
        <div className="block md:hidden divide-y divide-slate-700/40">
          {filteredRecords.map((rec) => (
            <div key={rec.id} className="p-4 space-y-3 hover:bg-slate-700/10 transition">
              <div className="flex justify-between items-start">
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-base text-white">{rec.vehicleNo}</span>
                    <span className="text-[10px] bg-slate-900 text-slate-400 px-1.5 py-0.5 rounded border border-slate-700/60">
                      {rec.unit}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">{rec.vehicleType}</p>
                </div>
                <div className="text-right">
                  <span className="font-bold text-lg text-emerald-400 block">{rec.volume} ลิตร</span>
                  <span className="text-[10px] text-slate-400 block">{rec.fuelType}</span>
                </div>
              </div>

              <div className="bg-slate-900/30 p-2.5 rounded-xl border border-slate-700/40 space-y-1.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-400">ผู้รับ/ผู้ใช้:</span>
                  <span className="text-slate-200 font-medium">{rec.driverName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">ภารกิจ:</span>
                  <span className="text-slate-200 font-medium text-right max-w-[200px] truncate">{rec.purpose}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">เลขที่สั่งเบิก:</span>
                  <span className="text-slate-200 font-mono">{rec.orderNo}</span>
                </div>
                {(rec.odometer ?? 0) > 0 && (
                  <div className="flex justify-between">
                    <span className="text-slate-400">เลขไมล์รถ:</span>
                    <span className="text-slate-200 font-mono">{(rec.odometer ?? 0).toLocaleString()} กม.</span>
                  </div>
                )}
                <div className="flex justify-between pt-1 border-t border-slate-700/30">
                  <span className="text-slate-400">ผู้จ่าย / เวลา:</span>
                  <span className="text-slate-300 font-medium">
                    {rec.officerName} • {rec.date.split('-').reverse().join('/')} ({rec.time} น.)
                  </span>
                </div>
                {currentUser?.role === 'admin' && (
                  <div className="flex justify-end pt-2 border-t border-slate-700/30">
                    <button
                      onClick={() => handleDeleteRecord(rec.id)}
                      disabled={isDeleting === rec.id}
                      className="flex items-center gap-1 px-2 py-1 bg-red-500/15 hover:bg-red-500/25 text-red-400 rounded-lg text-[10px] font-bold transition cursor-pointer disabled:opacity-50"
                    >
                      <Trash2 className="h-3 w-3" />
                      <span>ลบประวัติ</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}

          {filteredRecords.length === 0 && (
            <div className="p-8 text-center text-slate-500 text-sm">
              ไม่พบรายการเบิกน้ำมันตามตัวกรองที่เลือก
            </div>
          )}
        </div>

      </div>

    </div>
  );
}
