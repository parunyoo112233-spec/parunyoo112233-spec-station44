/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { onSnapshot, collection, query, orderBy } from 'firebase/firestore';
import { auth, db } from './firebase';
import { initializeDatabase, getUserProfile, isMockMode, getMockCollection } from './lib/db-helpers';
import { UserProfile, FuelInventory, FuelRecord, FuelRequest } from './types';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import RecordForm from './components/RecordForm';
import RequestForm from './components/RequestForm';
import RecordHistory from './components/RecordHistory';
import RequestQueue from './components/RequestQueue';
import InventoryMgmt from './components/InventoryMgmt';
import UnitCreditsAndReports from './components/UnitCreditsAndReports';
import UserMgmt from './components/UserMgmt';
import UserProfileModal from './components/UserProfileModal';
import { 
  Fuel, 
  LayoutDashboard, 
  PlusCircle, 
  History, 
  ClipboardList, 
  Warehouse, 
  LogOut, 
  User, 
  Menu, 
  X,
  Bell,
  CreditCard,
  UserCheck,
  Clock,
  AlertTriangle,
  RefreshCw,
  Settings
} from 'lucide-react';

export default function App() {
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [authChecking, setAuthChecking] = useState(true);
  const [activeTab, setActiveTab] = useState('credits');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);

  // Core Real-Time states
  const [inventory, setInventory] = useState<FuelInventory[]>([]);
  const [records, setRecords] = useState<FuelRecord[]>([]);
  const [requests, setRequests] = useState<FuelRequest[]>([]);
  const [usersList, setUsersList] = useState<UserProfile[]>([]);

  // 1. Initialize DB and Observe Auth State
  useEffect(() => {
    const initApp = async () => {
      // Seeds default tables/docs on first-ever run
      try {
        await initializeDatabase();
      } catch (err) {
        console.error('Database initialization error: ', err);
      }
    };
    initApp();

    // Setup initial cache profile for instant rendering, then let auth listener take over
    const savedLocalSession = localStorage.getItem('demo_user_profile') || sessionStorage.getItem('demo_user_profile');
    if (savedLocalSession) {
      try {
        const localProfile = JSON.parse(savedLocalSession);
        if (localProfile && localProfile.uid) {
          setCurrentUser(localProfile);
        }
      } catch (e) {
        console.error('Failed parsing local fallback session', e);
      }
    }

    const unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      setAuthChecking(true);
      if (firebaseUser) {
        // Fetch Firestore profile
        const profile = await getUserProfile(firebaseUser.uid);
        if (profile) {
          setCurrentUser(profile);
          // Keep cache in sync
          localStorage.setItem('demo_user_profile', JSON.stringify(profile));
        } else {
          // If no profile (extremely rare), set a driver fallback profile
          const fallbackProfile: UserProfile = {
            uid: firebaseUser.uid,
            email: firebaseUser.email || '',
            role: 'user',
            name: firebaseUser.email?.split('@')[0] || 'ผู้ใช้งาน',
            rank: 'ส.ต.',
            department: 'มทบ.44',
          };
          setCurrentUser(fallbackProfile);
          localStorage.setItem('demo_user_profile', JSON.stringify(fallbackProfile));
        }
      } else {
        const localSession = localStorage.getItem('demo_user_profile') || sessionStorage.getItem('demo_user_profile');
        if (localSession) {
          try {
            setCurrentUser(JSON.parse(localSession));
          } catch {
            setCurrentUser(null);
          }
        } else {
          setCurrentUser(null);
        }
      }
      setAuthChecking(false);
    });

    return () => unsubscribeAuth();
  }, []);

  // 2. Real-Time Subscriptions when user is Authenticated
  useEffect(() => {
    if (!currentUser) return;

    if (isMockMode()) {
      const loadMockData = () => {
        setInventory(getMockCollection<FuelInventory>('fuel_inventory'));
        setRecords(getMockCollection<FuelRecord>('fuel_records'));
        setRequests(getMockCollection<FuelRequest>('fuel_requests'));
        setUsersList(getMockCollection<UserProfile>('users'));
      };

      loadMockData();

      window.addEventListener('mock-db-update', loadMockData);
      return () => {
        window.removeEventListener('mock-db-update', loadMockData);
      };
    }

    // Subscribe to Inventory
    const unsubInv = onSnapshot(collection(db, 'fuel_inventory'), (snapshot) => {
      const items: FuelInventory[] = [];
      snapshot.forEach((doc) => {
        items.push({ id: doc.id, ...doc.data() } as FuelInventory);
      });
      setInventory(items);
    });

    // Subscribe to Fuel Dispatch Records
    const recordsQuery = query(collection(db, 'fuel_records'), orderBy('createdAt', 'desc'));
    const unsubRecords = onSnapshot(recordsQuery, (snapshot) => {
      const items: FuelRecord[] = [];
      snapshot.forEach((doc) => {
        items.push({ id: doc.id, ...doc.data() } as FuelRecord);
      });
      setRecords(items);
    });

    // Subscribe to Requests
    const requestsQuery = query(collection(db, 'fuel_requests'), orderBy('createdAt', 'desc'));
    const unsubRequests = onSnapshot(requestsQuery, (snapshot) => {
      const items: FuelRequest[] = [];
      snapshot.forEach((doc) => {
        items.push({ id: doc.id, ...doc.data() } as FuelRequest);
      });
      setRequests(items);
    });

    // Subscribe to Users (Admin only)
    let unsubUsers = () => {};
    if (currentUser.role === 'admin') {
      unsubUsers = onSnapshot(collection(db, 'users'), (snapshot) => {
        const items: UserProfile[] = [];
        snapshot.forEach((doc) => {
          items.push({ uid: doc.id, ...doc.data() } as UserProfile);
        });
        setUsersList(items);
      });
    }

    return () => {
      unsubInv();
      unsubRecords();
      unsubRequests();
      unsubUsers();
    };
  }, [currentUser]);

  // Redirect general users (role === 'user') away from admin/officer only views
  useEffect(() => {
    if (currentUser && currentUser.role === 'user') {
      if (activeTab === 'dashboard' || activeTab === 'inventory') {
        setActiveTab('request');
      }
    }
  }, [currentUser, activeTab]);

  // Handle Sign Out
  const handleSignOut = async () => {
    try {
      localStorage.removeItem('demo_user_profile');
      sessionStorage.removeItem('demo_user_profile');
      await signOut(auth);
      setCurrentUser(null);
      setActiveTab('credits');
    } catch (err) {
      console.error('Logout error: ', err);
      setCurrentUser(null);
      setActiveTab('credits');
    }
  };

  // Login callback
  const handleLoginSuccess = (profile: UserProfile) => {
    setCurrentUser(profile);
  };

  if (authChecking) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col justify-center items-center text-slate-100 font-sans">
        <Fuel className="h-12 w-12 text-emerald-400 animate-pulse mb-3" />
        <p className="text-sm font-semibold tracking-wide text-slate-400">กำลังเชื่อมต่อฐานข้อมูลคลังน้ำมัน มทบ.44...</p>
      </div>
    );
  }

  // If not logged in, display the gorgeous Login view
  if (!currentUser) {
    return <Login onLoginSuccess={handleLoginSuccess} />;
  }

  const handleCheckStatusAgain = async () => {
    if (!auth.currentUser) {
      if (currentUser && currentUser.uid.startsWith('mock-')) {
        const freshProfile = await getUserProfile(currentUser.uid);
        if (freshProfile) {
          setCurrentUser(freshProfile);
          if (localStorage.getItem('demo_user_profile')) {
            localStorage.setItem('demo_user_profile', JSON.stringify(freshProfile));
          } else {
            sessionStorage.setItem('demo_user_profile', JSON.stringify(freshProfile));
          }
        }
      }
      return;
    }
    
    setAuthChecking(true);
    const freshProfile = await getUserProfile(auth.currentUser.uid);
    if (freshProfile) {
      setCurrentUser(freshProfile);
      if (localStorage.getItem('demo_user_profile')) {
        localStorage.setItem('demo_user_profile', JSON.stringify(freshProfile));
      } else if (sessionStorage.getItem('demo_user_profile')) {
        sessionStorage.setItem('demo_user_profile', JSON.stringify(freshProfile));
      }
    }
    setAuthChecking(false);
  };

  // Intercept if account status is pending or disabled
  if (currentUser.status === 'pending' || currentUser.status === 'disabled') {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col justify-center items-center p-4 text-slate-100 font-sans">
        <div className="w-full max-w-md bg-slate-950 border border-slate-800 p-6 sm:p-8 rounded-3xl shadow-2xl text-center space-y-6 relative overflow-hidden animate-fadeIn">
          
          <div className="absolute -top-24 -left-24 w-48 h-48 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

          {currentUser.status === 'pending' ? (
            <>
              <div className="w-16 h-16 bg-amber-500/10 border border-amber-500/30 text-amber-400 rounded-2xl flex items-center justify-center mx-auto shadow-lg">
                <Clock className="h-8 w-8 animate-pulse" />
              </div>

              <div className="space-y-2">
                <h2 className="text-xl font-bold text-white tracking-tight">
                  รอการอนุมัติเปิดใช้งานไอดี
                </h2>
                <p className="text-xs text-slate-400 leading-relaxed px-4">
                  บัญชีผู้ใช้งานของคุณถูกสร้างสำเร็จแล้ว ขณะนี้อยู่ระหว่างผู้ดูแลระบบ (Admin) ตรวจสอบและกดเปิดใช้งานไอดี
                </p>
              </div>
            </>
          ) : (
            <>
              <div className="w-16 h-16 bg-red-500/10 border border-red-500/30 text-red-400 rounded-2xl flex items-center justify-center mx-auto shadow-lg">
                <AlertTriangle className="h-8 w-8 text-red-400" />
              </div>

              <div className="space-y-2">
                <h2 className="text-xl font-bold text-red-400 tracking-tight">
                  บัญชีของคุณถูกระงับการใช้งาน
                </h2>
                <p className="text-xs text-slate-400 leading-relaxed px-4">
                  ไอดีนี้ถูกระงับสิทธิ์การเข้าใช้งานระบบชั่วคราว กรุณาติดต่อผู้ดูแลระบบคลังน้ำมัน มทบ.44 เพื่อเปิดการใช้งานใหม่อีกครั้ง
                </p>
              </div>
            </>
          )}

          <div className="bg-slate-900 border border-slate-800/80 rounded-2xl p-4 text-left space-y-2.5 text-xs font-mono text-slate-300">
            <div className="text-[10px] text-slate-500 uppercase font-sans tracking-wider border-b border-slate-800 pb-1.5 font-bold flex justify-between items-center">
              <span>ข้อมูลบัญชีผู้ใช้งาน</span>
              <button 
                onClick={() => setIsProfileModalOpen(true)}
                className="text-emerald-400 hover:text-emerald-300 font-sans font-bold flex items-center gap-1 cursor-pointer transition uppercase"
              >
                <Settings className="h-3 w-3" /> แก้ไขข้อมูล
              </button>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">ชื่อ-ยศ:</span>
              <span className="text-white font-sans font-bold">{currentUser.rank} {currentUser.name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">สังกัดหน่วย:</span>
              <span className="text-slate-200 font-sans">{currentUser.department}</span>
            </div>
            {currentUser.position && (
              <div className="flex justify-between">
                <span className="text-slate-500">ตำแหน่งหน้าที่:</span>
                <span className="text-slate-200 font-sans">{currentUser.position}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-slate-500">อีเมลไอดี:</span>
              <span className="text-slate-200">{currentUser.email}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">สิทธิ์ที่ขอ:</span>
              <span className="px-1.5 py-0.5 bg-slate-800 text-[10px] text-emerald-400 rounded font-sans uppercase font-bold">
                {currentUser.role === 'admin' ? 'แอดมิน' : currentUser.role === 'officer' ? 'เจ้าหน้าที่' : 'ผู้ใช้บริการ (ผู้ใช้)'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">สถานะไอดี:</span>
              <span className={`px-1.5 py-0.5 rounded text-[10px] font-sans font-bold ${
                currentUser.status === 'pending' ? 'bg-amber-500/10 text-amber-400' : 'bg-red-500/10 text-red-400'
              }`}>
                {currentUser.status === 'pending' ? 'รออนุมัติเปิดใช้งาน' : 'ระงับการใช้งาน'}
              </span>
            </div>
          </div>

          <div className="pt-2 flex flex-col gap-2.5">
            {currentUser.status === 'pending' && (
              <button
                onClick={handleCheckStatusAgain}
                className="w-full py-2.5 px-4 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-sm rounded-xl transition duration-150 flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-amber-500/15"
              >
                <RefreshCw className="h-4 w-4" />
                ตรวจสอบสถานะเปิดใช้งานอีกครั้ง
              </button>
            )}

            <button
              onClick={handleSignOut}
              className="w-full py-2.5 px-4 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 font-bold text-sm rounded-xl transition duration-150 flex items-center justify-center gap-2 cursor-pointer"
            >
              <LogOut className="h-4 w-4" />
              ออกจากระบบ / ใช้บัญชีอื่น
            </button>
          </div>

        </div>
      </div>
    );
  }

  // Pending requests count for badges
  const pendingRequestsCount = requests.filter(
    r => r.status === 'pending' && (currentUser.role === 'admin' || currentUser.role === 'officer' || r.requestedBy === currentUser.uid)
  ).length;

  // Pending users count for admin badge (Users awaiting approval)
  const pendingUsersCount = currentUser.role === 'admin'
    ? usersList.filter(u => u.status === 'pending').length
    : 0;

  return (
    <div id="app_root" className="min-h-screen bg-slate-900 text-slate-100 font-sans pb-24 md:pb-6">
      
      {/* 1. Header Navbar */}
      <nav className="border-b border-slate-800 bg-[#0f172a]/80 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            
            {/* App title */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-emerald-500 rounded-lg flex items-center justify-center text-slate-900 font-extrabold shadow-lg shadow-emerald-500/20 font-display">
                44
              </div>
              <div>
                <h1 className="text-sm sm:text-base font-bold tracking-tight text-white leading-tight uppercase">
                  ระบบจัดการน้ำมัน คลัง มทบ.44
                </h1>
                <p className="text-[10px] text-slate-400 uppercase tracking-wider font-mono">
                  Fuel Management System | Project: carbide-smoke-58kj5
                </p>
              </div>
            </div>

            {/* Desktop Navigation Profiles & Logs */}
            <div className="hidden md:flex items-center gap-4 text-sm">
              
              {/* Profile card summary */}
              <button 
                onClick={() => setIsProfileModalOpen(true)}
                className="bg-slate-800/60 hover:bg-slate-800 px-3 py-1.5 rounded-xl border border-slate-700/60 hover:border-slate-600 flex items-center gap-2.5 transition text-left cursor-pointer group"
                title="คลิกเพื่อตั้งค่าบัญชี & แก้ไขข้อมูล"
              >
                <div className="w-8 h-8 rounded-full bg-slate-700 group-hover:bg-slate-600 border-2 border-slate-600 group-hover:border-slate-500 flex items-center justify-center text-emerald-400 font-bold transition">
                  <User className="h-4 w-4" />
                </div>
                <div className="text-left text-xs">
                  <p className="font-bold text-slate-200 flex items-center gap-1">
                    {currentUser.rank} {currentUser.name}
                    <Settings className="h-3 w-3 text-slate-400 group-hover:text-white transition" />
                  </p>
                  <p className="text-[10px] text-emerald-400 uppercase font-mono tracking-wider truncate max-w-[180px]" title={currentUser.position}>
                    สถานะ: {currentUser.role === 'admin' ? 'ผู้ดูแลระบบ' : currentUser.role === 'officer' ? 'เจ้าหน้าที่พัสดุ' : 'ผู้ใช้'}{currentUser.position ? ` (${currentUser.position})` : ''}
                  </p>
                </div>
              </button>

              {/* Log out */}
              <button
                onClick={handleSignOut}
                className="p-2 bg-slate-800 hover:bg-red-950/40 text-slate-400 hover:text-red-400 rounded-xl border border-slate-700/60 transition cursor-pointer"
                title="ออกจากระบบ"
              >
                <LogOut className="h-4.5 w-4.5" />
              </button>

            </div>

            {/* Mobile Header elements */}
            <div className="flex md:hidden items-center gap-2">
              
              {/* Notification bell for pending */}
              {pendingRequestsCount > 0 && (
                <button 
                  onClick={() => setActiveTab('requests')}
                  className="p-2 relative bg-slate-800 text-amber-400 rounded-xl border border-slate-700/60"
                >
                  <Bell className="h-4 w-4 animate-bounce" />
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full text-[9px] font-bold px-1 min-w-4 h-4 flex items-center justify-center border border-slate-800">
                    {pendingRequestsCount}
                  </span>
                </button>
              )}

              {/* Small profile readout */}
              <button
                onClick={() => setIsProfileModalOpen(true)}
                className="text-right text-xs pr-1 hover:opacity-85 flex flex-col items-end cursor-pointer group"
                title="คลิกเพื่อแก้ไขข้อมูลส่วนตัว"
              >
                <p className="font-semibold text-slate-200 truncate max-w-[90px] flex items-center gap-0.5">
                  {currentUser.name} <Settings className="h-2.5 w-2.5 text-slate-400 group-hover:text-white" />
                </p>
                <p className="text-[9px] text-emerald-400 font-semibold uppercase">
                  {currentUser.role === 'admin' ? 'ADMIN' : currentUser.role === 'officer' ? 'OFFICER' : 'DRIVER'}
                </p>
              </button>

              {/* Sign out for mobile */}
              <button
                onClick={handleSignOut}
                className="p-2 bg-slate-800 text-slate-400 rounded-xl border border-slate-700"
              >
                <LogOut className="h-4 w-4" />
              </button>

            </div>

          </div>
        </div>
      </nav>

      {/* 2. Main content container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        
        {/* Render Tab Contents */}
        {activeTab === 'dashboard' && (
          <Dashboard 
            inventory={inventory} 
            records={records} 
            requests={requests}
            onNavigateToTab={(tab) => setActiveTab(tab)}
            currentUser={currentUser}
          />
        )}

        {activeTab === 'record' && (
          <RecordForm 
            currentUser={currentUser} 
            inventory={inventory} 
            onRecordAdded={() => setActiveTab('records')}
          />
        )}

        {activeTab === 'request' && (
          <RequestForm 
            currentUser={currentUser} 
            inventory={inventory} 
            onRequestSubmitted={() => setActiveTab('requests')}
          />
        )}

        {activeTab === 'requests' && (
          <RequestQueue 
            currentUser={currentUser} 
            requests={requests} 
            inventory={inventory}
            onQueueUpdated={() => {}}
          />
        )}

        {activeTab === 'records' && (
          <RecordHistory 
            records={records} 
            inventory={inventory} 
            currentUser={currentUser}
          />
        )}

        {activeTab === 'inventory' && (
          <InventoryMgmt 
            currentUser={currentUser} 
            inventory={inventory} 
            onReplenished={() => {}}
          />
        )}

        {activeTab === 'credits' && (
          <UnitCreditsAndReports 
            records={records} 
            inventory={inventory} 
            currentUser={currentUser}
          />
        )}

        {activeTab === 'users' && currentUser.role === 'admin' && (
          <UserMgmt 
            currentUser={currentUser}
          />
        )}

      </main>

      {/* 3. Bottom thumb-friendly bar navigation (Visible everywhere, optimised for mobile) */}
      <div className="fixed bottom-0 left-0 right-0 bg-slate-900/95 backdrop-blur border-t border-slate-800 py-2.5 z-40 px-4 shadow-xl">
        <div className="max-w-xl mx-auto grid grid-flow-col auto-cols-max justify-around items-center gap-2">
          
          {/* 1. Credits & Reports Tab */}
          <button
            onClick={() => setActiveTab('credits')}
            className={`flex flex-col items-center justify-center w-14 py-1 rounded-xl transition cursor-pointer ${
              activeTab === 'credits'
                ? 'text-emerald-400 font-bold bg-slate-800/60'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <CreditCard className="h-5 w-5" />
            <span className="text-[10px] mt-1 font-medium">โควตา/ยอด</span>
          </button>

          {/* 2. Dashboard Tab */}
          {currentUser.role !== 'user' && (
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`flex flex-col items-center justify-center w-14 py-1 rounded-xl transition cursor-pointer ${
                activeTab === 'dashboard'
                  ? 'text-emerald-400 font-bold bg-slate-800/60'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <LayoutDashboard className="h-5 w-5" />
              <span className="text-[10px] mt-1 font-medium">ภาพรวม</span>
            </button>
          )}

          {/* 3. Record/Request Tab (Role based dynamic action) */}
          {(currentUser.role === 'admin' || currentUser.role === 'officer') ? (
            <button
              onClick={() => setActiveTab('record')}
              className={`flex flex-col items-center justify-center w-14 py-1 rounded-xl transition cursor-pointer ${
                activeTab === 'record'
                  ? 'text-emerald-400 font-bold bg-slate-800/60'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <PlusCircle className="h-5 w-5" />
              <span className="text-[10px] mt-1 font-medium">จ่ายน้ำมัน</span>
            </button>
          ) : (
            <button
              onClick={() => setActiveTab('request')}
              className={`flex flex-col items-center justify-center w-14 py-1 rounded-xl transition cursor-pointer ${
                activeTab === 'request'
                  ? 'text-blue-400 font-bold bg-slate-800/60'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <PlusCircle className="h-5 w-5" />
              <span className="text-[10px] mt-1 font-medium">ขอเติม</span>
            </button>
          )}

          {/* 4. Requests Queue Tab with Badge */}
          <button
            onClick={() => setActiveTab('requests')}
            className={`flex flex-col items-center justify-center w-14 py-1 rounded-xl transition relative cursor-pointer ${
              activeTab === 'requests'
                ? 'text-blue-400 font-bold bg-slate-800/60'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <ClipboardList className="h-5 w-5" />
            <span className="text-[10px] mt-1 font-medium">คิวคำขอ</span>
            {pendingRequestsCount > 0 && (
              <span className="absolute top-0 right-1 bg-amber-500 text-slate-950 font-black text-[9px] rounded-full px-1.5 py-0.5 transform scale-90 border border-slate-900">
                {pendingRequestsCount}
              </span>
            )}
          </button>

          {/* 5. History Logs Tab */}
          <button
            onClick={() => setActiveTab('records')}
            className={`flex flex-col items-center justify-center w-14 py-1 rounded-xl transition cursor-pointer ${
              activeTab === 'records'
                ? 'text-emerald-400 font-bold bg-slate-800/60'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <History className="h-5 w-5" />
            <span className="text-[10px] mt-1 font-medium">ประวัติ</span>
          </button>

          {/* 6. Inventory Stock Tab */}
          {currentUser.role !== 'user' && (
            <button
              onClick={() => setActiveTab('inventory')}
              className={`flex flex-col items-center justify-center w-14 py-1 rounded-xl transition cursor-pointer ${
                activeTab === 'inventory'
                  ? 'text-emerald-400 font-bold bg-slate-800/60'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Warehouse className="h-5 w-5" />
              <span className="text-[10px] mt-1 font-medium">คลังน้ำมัน</span>
            </button>
          )}

          {/* 7. User Management Tab (Admin only) */}
          {currentUser.role === 'admin' && (
            <button
              onClick={() => setActiveTab('users')}
              className={`flex flex-col items-center justify-center w-14 py-1 rounded-xl transition relative cursor-pointer ${
                activeTab === 'users'
                  ? 'text-amber-400 font-bold bg-slate-800/60'
                  : 'text-slate-400 hover:text-amber-400'
              }`}
            >
              <UserCheck className="h-5 w-5" />
              <span className="text-[10px] mt-1 font-medium">สิทธิ์/ผู้ใช้</span>
              {pendingUsersCount > 0 && (
                <span className="absolute top-0 right-1 bg-amber-500 text-slate-950 font-black text-[9px] rounded-full px-1.5 py-0.5 transform scale-90 border border-slate-900 animate-pulse">
                  {pendingUsersCount}
                </span>
              )}
            </button>
          )}

        </div>
      </div>

      {currentUser && (
        <UserProfileModal
          isOpen={isProfileModalOpen}
          onClose={() => setIsProfileModalOpen(false)}
          currentUser={currentUser}
          onProfileUpdated={(updatedProfile) => {
            setCurrentUser(updatedProfile);
            // Sync with local session cache
            if (localStorage.getItem('demo_user_profile')) {
              localStorage.setItem('demo_user_profile', JSON.stringify(updatedProfile));
            } else if (sessionStorage.getItem('demo_user_profile')) {
              sessionStorage.setItem('demo_user_profile', JSON.stringify(updatedProfile));
            } else {
              localStorage.setItem('demo_user_profile', JSON.stringify(updatedProfile));
            }
          }}
        />
      )}

    </div>
  );
}
