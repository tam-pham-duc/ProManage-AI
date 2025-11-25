
import React, { useState } from 'react';
import { Lock, Mail, User as UserIcon, ArrowRight, Loader2, LayoutDashboard, KanbanSquare, Briefcase as BriefcaseIcon, CheckSquare, Key, ShieldAlert, X, Cpu, Activity, BarChart3, Zap, Globe } from 'lucide-react';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, updateProfile, setPersistence, browserLocalPersistence, browserSessionPersistence, GoogleAuthProvider, signInWithPopup, sendEmailVerification } from 'firebase/auth';
import { doc, setDoc, getDoc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { generateDemoData, clearDevData } from '../services/demoDataService';
import { useNotification } from '../context/NotificationContext';

interface AuthScreenProps {
  onLoginSuccess: () => void;
  onSeedingStart?: () => void;
  onSeedingEnd?: () => void;
}

const AuthScreen: React.FC<AuthScreenProps> = ({ onLoginSuccess, onSeedingStart, onSeedingEnd }) => {
  const { notify } = useNotification();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [jobTitle, setJobTitle] = useState('Project Manager');
  
  // Remember Me State
  const [isRememberMe, setIsRememberMe] = useState(false);
  const [rememberDays, setRememberDays] = useState(7);

  const [isLoading, setIsLoading] = useState(false);
  const [loadingText, setLoadingText] = useState('');

  // --- Admin Backdoor State ---
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [adminPasscode, setAdminPasscode] = useState('');

  // --- 3D Parallax State ---
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const [activeFeature, setActiveFeature] = useState<{ id: string, title: string, desc: string, icon: React.ElementType, detail: string } | null>(null);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
      const { width, height, left, top } = e.currentTarget.getBoundingClientRect();
      const x = (e.clientX - left) / width - 0.5;
      const y = (e.clientY - top) / height - 0.5;
      setTilt({ x, y });
  };

  const handleMouseLeave = () => {
      setTilt({ x: 0, y: 0 });
  };

  const features = [
      { 
          id: 'ai', 
          icon: Cpu, 
          title: "AI Core", 
          desc: "Bộ não số kiến tạo tương lai.", 
          detail: "Hệ thống AI của chúng tôi không chỉ quản lý, mà còn dự đoán. Từ việc tối ưu hóa lịch trình đến phân bổ ngân sách thông minh, AI Core là trợ lý đắc lực giúp bạn đi trước mọi rủi ro." 
      },
      { 
          id: 'realtime', 
          icon: Activity, 
          title: "Real-time Sync", 
          desc: "Đồng bộ nhịp đập dự án.", 
          detail: "Mọi thay đổi, dù là nhỏ nhất, đều được cập nhật tức thì trên toàn hệ thống. Đội ngũ của bạn sẽ luôn hoạt động như một thể thống nhất, không còn độ trễ thông tin." 
      },
      { 
          id: 'analytics', 
          icon: BarChart3, 
          title: "Deep Analytics", 
          desc: "Thấu suốt từng con số.", 
          detail: "Biến dữ liệu thô thành chiến lược hành động. Các biểu đồ trực quan và báo cáo chuyên sâu giúp bạn nắm bắt sức khỏe dự án chỉ trong một cái liếc nhìn." 
      }
  ];

  const handleGoogleLogin = async () => {
    setIsLoading(true);
    setLoadingText('Connecting to Google...');

    try {
        const provider = new GoogleAuthProvider();
        const result = await signInWithPopup(auth, provider);
        const user = result.user;

        const userRef = doc(db, 'users', user.uid);
        const userSnap = await getDoc(userRef);

        if (!userSnap.exists()) {
            setLoadingText('Setting up your profile...');
            await setDoc(userRef, {
                username: user.displayName || 'Google User',
                email: user.email,
                jobTitle: 'Project Manager',
                avatar: user.photoURL || '',
                createdAt: new Date().toISOString(),
                authProvider: 'google'
            });
            // Only generate demo data for brand new Google users
            await generateDemoData(user.uid);
        } else {
            await updateDoc(userRef, {
                lastLogin: serverTimestamp()
            });
        }

        onLoginSuccess();
    } catch (err: any) {
        console.error("Google Sign-In Error:", err);
        let msg = "Failed to sign in with Google.";
        if (err.code === 'auth/unauthorized-domain') msg = "Domain unauthorized.";
        else if (err.code === 'auth/popup-closed-by-user') msg = "Sign-in cancelled.";
        else if (err.message) msg = err.message;
        notify('error', msg);
        setIsLoading(false);
    }
  };

  const handleAdminSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      
      if (adminPasscode === 'tam123456') {
          setShowAdminModal(false);
          setAdminPasscode('');
          
          const targetEmail = 'admin@dev.com';
          const targetPass = 'admin123456';
          
          setIsLoading(true);
          setLoadingText('Accessing Admin Console...');

          try {
                await signInWithEmailAndPassword(auth, targetEmail, targetPass);
                
                // FIX: Removed auto-wipe logic. 
                // Data persistence is now default. Reset is moved to Settings.
                
                notify('success', 'Welcome back Admin. Your data is preserved.');
                onLoginSuccess();

           } catch (err: any) {
                // If admin account doesn't exist, we create it AND seed data once.
                if (err.code === 'auth/user-not-found' || err.code === 'auth/invalid-credential' || err.code === 'auth/invalid-login-credentials') {
                    try {
                        if (onSeedingStart) onSeedingStart();
                        setLoadingText('Provisioning Admin Account...');
                        const userCredential = await createUserWithEmailAndPassword(auth, targetEmail, targetPass);
                        const user = userCredential.user;

                        await updateProfile(user, { displayName: 'Dev Admin' });
                        await setDoc(doc(db, 'users', user.uid), {
                            username: 'Dev Admin',
                            email: targetEmail,
                            jobTitle: 'System Administrator',
                            avatar: 'D',
                            createdAt: new Date().toISOString()
                        });

                        setLoadingText('Generating Initial Dataset...');
                        await generateDemoData(user.uid);
                        
                        notify('success', 'Admin account initialized.');
                        if (onSeedingEnd) onSeedingEnd();
                        onLoginSuccess();
                    } catch (createErr: any) {
                        console.error("Dev account creation failed:", createErr);
                        notify('error', "Failed to provision dev account.");
                        if (onSeedingEnd) onSeedingEnd();
                        setIsLoading(false);
                    }
                } else {
                    console.error("Dev login failed:", err);
                    notify('error', "Dev login failed.");
                    setIsLoading(false);
                }
           }

      } else {
          notify('error', "Tính năng này không dành cho bạn, vui lòng đăng ký hoặc đăng nhập để bắt đầu sử dụng.");
          setShowAdminModal(false);
          setAdminPasscode('');
      }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setLoadingText('');

    const cleanEmail = email.trim();
    
    try {
      if (isLogin) {
        setLoadingText('Signing in...');
        
        if (isRememberMe) {
            await setPersistence(auth, browserLocalPersistence);
            const expiryTime = Date.now() + (rememberDays * 24 * 60 * 60 * 1000);
            localStorage.setItem('session_expiry', expiryTime.toString());
        } else {
            await setPersistence(auth, browserSessionPersistence);
            localStorage.removeItem('session_expiry');
        }

        await signInWithEmailAndPassword(auth, cleanEmail, password);
        onLoginSuccess();
      } else {
        if (!username || !cleanEmail || !password) {
          throw new Error('Please fill in all fields');
        }
        setLoadingText('Creating account...');
        const userCredential = await createUserWithEmailAndPassword(auth, cleanEmail, password);
        const user = userCredential.user;

        await updateProfile(user, {
          displayName: username,
          photoURL: username.charAt(0).toUpperCase()
        });

        await setDoc(doc(db, 'users', user.uid), {
          username,
          email: cleanEmail,
          jobTitle,
          avatar: username.charAt(0).toUpperCase(),
          createdAt: new Date().toISOString(),
          authProvider: 'email'
        });

        try {
            await sendEmailVerification(user);
            notify('success', `Verification email sent to ${cleanEmail}`, 5000);
        } catch (emailErr) {
            console.error("Failed to send verification email:", emailErr);
        }

        onLoginSuccess();
      }
    } catch (err: any) {
      console.error(err);
      let msg = 'An unexpected error occurred';
      if (err.code === 'auth/invalid-email') msg = 'Invalid email address format.';
      if (err.code === 'auth/user-disabled') msg = 'This account has been disabled.';
      if (err.code === 'auth/user-not-found') msg = 'No account found with this email.';
      if (err.code === 'auth/wrong-password') msg = 'Incorrect password.';
      if (err.code === 'auth/invalid-login-credentials') msg = 'Invalid email or password.';
      if (err.code === 'auth/invalid-credential') msg = 'Invalid credentials.';
      if (err.code === 'auth/email-already-in-use') msg = 'Email is already registered.';
      if (err.code === 'auth/weak-password') msg = 'Password should be at least 6 characters.';
      
      notify('error', msg);
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-white dark:bg-slate-950 font-sans">
      
      {/* LEFT SIDE - INTERACTIVE 3D STAGE */}
      <div 
         className="hidden lg:flex lg:w-[60%] relative bg-slate-900 overflow-hidden flex-col justify-between cursor-none"
         onMouseMove={handleMouseMove}
         onMouseLeave={handleMouseLeave}
      >
         {/* Background Gradient & Particles */}
         <div className="absolute inset-0 bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900"></div>
         <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.1) 1px, transparent 1px)', backgroundSize: '30px 30px' }}></div>
         
         {/* Brand Top Left */}
         <div className="relative z-20 p-12 flex items-center gap-3 text-white/90">
            <div className="w-10 h-10 bg-white/10 backdrop-blur-md rounded-xl flex items-center justify-center border border-white/20 shadow-inner">
               <span className="font-bold text-lg">P</span>
            </div>
            <span className="font-bold tracking-widest text-sm uppercase opacity-80">ProManage AI</span>
         </div>

         {/* 3D Content Stage */}
         <div className="flex-1 relative flex items-center justify-center perspective-[1500px] z-10">
            <div 
               className="relative w-[600px] h-[400px] transition-transform duration-100 ease-out preserve-3d"
               style={{ transform: `rotateY(${tilt.x * 15}deg) rotateX(${-tilt.y * 15}deg)` }}
            >
                {/* Main Hero Card (Floating Dashboard) */}
                <div className="absolute inset-0 bg-slate-800/80 backdrop-blur-xl rounded-2xl shadow-[0_0_50px_rgba(0,0,0,0.5)] border border-white/10 p-6 overflow-hidden transform translate-z-20">
                    <div className="flex items-center gap-4 mb-8 border-b border-white/5 pb-4">
                        <div className="w-10 h-10 bg-indigo-500 rounded-lg flex items-center justify-center shadow-lg text-white"><LayoutDashboard size={20} /></div>
                        <div className="h-2 w-32 bg-white/10 rounded-full"></div>
                        <div className="ml-auto flex gap-2">
                            <div className="w-3 h-3 rounded-full bg-red-500/50"></div>
                            <div className="w-3 h-3 rounded-full bg-yellow-500/50"></div>
                            <div className="w-3 h-3 rounded-full bg-green-500/50"></div>
                        </div>
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                        <div className="col-span-2 h-32 bg-white/5 rounded-xl border border-white/5"></div>
                        <div className="h-32 bg-indigo-500/10 rounded-xl border border-indigo-500/20"></div>
                        <div className="h-24 bg-white/5 rounded-xl border border-white/5"></div>
                        <div className="col-span-2 h-24 bg-white/5 rounded-xl border border-white/5"></div>
                    </div>
                </div>

                {/* Floating Feature Orbs */}
                {features.map((f, i) => {
                    // Calculate positions for orbs
                    const positions = [
                        { top: '-10%', left: '-15%', delay: '0s' }, // Top Left
                        { top: '40%', right: '-20%', delay: '1s' }, // Mid Right
                        { bottom: '-15%', left: '20%', delay: '2s' }  // Bottom Left
                    ];
                    const pos = positions[i];

                    return (
                        <button 
                            key={f.id}
                            onClick={(e) => { e.stopPropagation(); setActiveFeature(f); }}
                            className="absolute group cursor-pointer outline-none"
                            style={{ 
                                ...pos, 
                                transform: 'translateZ(60px)',
                            }}
                        >
                            <div className="relative flex items-center gap-3 bg-white/10 backdrop-blur-md border border-white/20 px-4 py-3 rounded-2xl shadow-xl hover:bg-white/20 transition-all hover:scale-105 active:scale-95">
                                <div className="w-10 h-10 rounded-full bg-indigo-600 flex items-center justify-center text-white shadow-lg group-hover:animate-pulse">
                                    <f.icon size={20} />
                                </div>
                                <div className="text-left">
                                    <p className="text-xs font-bold text-indigo-300 uppercase tracking-wider">{f.title}</p>
                                    <p className="text-sm font-medium text-white whitespace-nowrap">{f.desc}</p>
                                </div>
                            </div>
                        </button>
                    );
                })}
            </div>
         </div>

         {/* Text Block */}
         <div className="relative z-20 p-12">
             <h1 className="text-5xl font-bold text-white mb-4 leading-tight">
                The Future of <br/>
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-cyan-400">Project Intelligence</span>
             </h1>
             <p className="text-slate-400 max-w-lg text-lg">Experience the synergy of AI-driven management and real-time collaboration.</p>
         </div>

         {/* Custom Cursor Follower (Optional Polish) */}
         <div 
            className="absolute w-8 h-8 border border-white/30 rounded-full pointer-events-none z-50 transition-transform duration-100 ease-out hidden lg:block mix-blend-difference"
            style={{ 
                left: 0, top: 0,
                transform: `translate(${tilt.x * window.innerWidth * 0.6 + window.innerWidth * 0.3}px, ${tilt.y * window.innerHeight + window.innerHeight * 0.5}px)` 
            }}
         />
      </div>

      {/* RIGHT SIDE - LOGIN FORM */}
      <div className="w-full lg:w-[40%] bg-white dark:bg-slate-950 flex flex-col justify-center items-center p-6 md:p-12 relative">
         
         <div className="w-full max-w-[400px] animate-fade-in relative z-10">
            {/* Header */}
            <div className="mb-10">
               <div className="w-12 h-12 bg-indigo-600 rounded-xl flex items-center justify-center text-white font-bold text-2xl shadow-lg shadow-indigo-600/30 mb-6">P</div>
               <h2 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">{isLogin ? 'Welcome Back' : 'Join the Future'}</h2>
               <p className="text-slate-500 dark:text-slate-400">{isLogin ? 'Sign in to continue your journey.' : 'Start your 14-day free trial today.'}</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
                 {!isLogin && (
                   <>
                     <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Full Name</label>
                        <div className="relative group">
                           <UserIcon size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
                           <input 
                             type="text" 
                             value={username}
                             onChange={(e) => setUsername(e.target.value)}
                             className="w-full pl-11 pr-4 py-3.5 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:bg-white dark:focus:bg-slate-900 outline-none transition-all text-slate-900 dark:text-white placeholder-slate-400"
                             placeholder="John Doe"
                             required
                           />
                        </div>
                     </div>
                     <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Job Title</label>
                        <div className="relative group">
                           <BriefcaseIcon size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
                           <input 
                             type="text" 
                             value={jobTitle}
                             onChange={(e) => setJobTitle(e.target.value)}
                             className="w-full pl-11 pr-4 py-3.5 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:bg-white dark:focus:bg-slate-900 outline-none transition-all text-slate-900 dark:text-white placeholder-slate-400"
                             placeholder="Product Manager"
                           />
                        </div>
                     </div>
                   </>
                 )}

                 <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Email Address</label>
                    <div className="relative group">
                       <Mail size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
                       <input 
                         type="email" 
                         value={email}
                         onChange={(e) => setEmail(e.target.value)}
                         className="w-full pl-11 pr-4 py-3.5 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:bg-white dark:focus:bg-slate-900 outline-none transition-all text-slate-900 dark:text-white placeholder-slate-400"
                         placeholder="name@company.com"
                         required
                       />
                    </div>
                 </div>

                 <div className="space-y-1.5">
                    <div className="flex justify-between items-center">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Password</label>
                        {isLogin && <a href="#" className="text-xs font-bold text-indigo-600 hover:underline">Forgot Password?</a>}
                    </div>
                    <div className="relative group">
                       <Lock size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
                       <input 
                         type="password" 
                         value={password}
                         onChange={(e) => setPassword(e.target.value)}
                         className="w-full pl-11 pr-4 py-3.5 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:bg-white dark:focus:bg-slate-900 outline-none transition-all text-slate-900 dark:text-white placeholder-slate-400"
                         placeholder="••••••••"
                         required
                       />
                    </div>
                 </div>

                 {isLogin && (
                     <div className="flex items-center justify-between py-1">
                        <div className="flex items-center gap-2 group cursor-pointer" onClick={() => setIsRememberMe(!isRememberMe)}>
                            <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${isRememberMe ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-slate-300 dark:border-slate-700 bg-transparent'}`}>
                                {isRememberMe && <CheckSquare size={14} />}
                            </div>
                            <span className="text-sm text-slate-600 dark:text-slate-400 select-none">Remember me</span>
                        </div>
                        {isRememberMe && (
                            <select value={rememberDays} onChange={(e) => setRememberDays(parseInt(e.target.value))} className="text-xs font-bold bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 outline-none text-slate-600 dark:text-slate-300">
                                <option value={7}>7 Days</option>
                                <option value={14}>14 Days</option>
                                <option value={30}>30 Days</option>
                            </select>
                        )}
                     </div>
                 )}

                 <button 
                   type="submit"
                   disabled={isLoading}
                   className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold shadow-lg shadow-indigo-600/30 transition-all flex items-center justify-center gap-2 active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed"
                 >
                   {isLoading ? <Loader2 className="animate-spin" size={20} /> : <>{isLogin ? 'Sign In' : 'Create Account'} <ArrowRight size={20} /></>}
                 </button>
            </form>

            <div className="relative my-8">
                <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-200 dark:border-slate-800"></div></div>
                <div className="relative flex justify-center text-sm">
                    <span className="px-4 bg-white dark:bg-slate-950 text-slate-400 text-xs uppercase font-bold tracking-wider">Or continue with</span>
                </div>
            </div>

            <button 
              onClick={handleGoogleLogin}
              className="w-full flex items-center justify-center gap-3 py-3 border border-slate-200 dark:border-slate-800 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors font-bold text-slate-700 dark:text-slate-300"
            >
                <svg className="w-5 h-5" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
                Google
            </button>

            <div className="mt-8 text-center">
                 <p className="text-sm text-slate-600 dark:text-slate-400">
                   {isLogin ? "Don't have an account?" : "Already have an account?"}
                   <button onClick={() => setIsLogin(!isLogin)} className="ml-1.5 text-indigo-600 dark:text-indigo-400 font-bold hover:underline">
                     {isLogin ? 'Sign up' : 'Log in'}
                   </button>
                 </p>
            </div>
         </div>

         {/* Footer & Admin Trigger */}
         <div className="absolute bottom-6 w-full px-12 flex justify-between items-center text-[10px] text-slate-400 uppercase tracking-wider font-bold">
             <div className="flex gap-4">
                <a href="#" className="hover:text-indigo-500">Privacy Policy</a>
                <a href="#" className="hover:text-indigo-500">Terms of Service</a>
             </div>
             <button 
                onClick={() => setShowAdminModal(true)}
                className="flex items-center gap-1 hover:text-indigo-500 transition-colors opacity-50 hover:opacity-100"
             >
                <Key size={10} />
                <span>Admin Access</span>
             </button>
         </div>
      </div>

      {/* FEATURE SPOTLIGHT MODAL */}
      {activeFeature && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/90 backdrop-blur-lg animate-fade-in p-6">
              <div className="relative w-full max-w-4xl bg-gradient-to-br from-slate-900 to-indigo-950 border border-white/10 rounded-3xl shadow-2xl overflow-hidden flex flex-col md:flex-row">
                  <button 
                    onClick={() => setActiveFeature(null)}
                    className="absolute top-4 right-4 p-2 rounded-full bg-white/5 hover:bg-white/10 text-white/70 hover:text-white transition-colors z-50"
                  >
                      <X size={24} />
                  </button>
                  
                  {/* Visual Side */}
                  <div className="w-full md:w-1/2 p-12 flex items-center justify-center bg-black/20 relative overflow-hidden">
                      <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1558591710-4b4a1ae0f04d?auto=format&fit=crop&q=80&w=1000')] bg-cover bg-center opacity-20 mix-blend-overlay"></div>
                      <div className="relative z-10 w-48 h-48 rounded-full bg-indigo-500/20 animate-pulse flex items-center justify-center border border-indigo-500/50">
                          <activeFeature.icon size={80} className="text-indigo-400 drop-shadow-[0_0_15px_rgba(129,140,248,0.5)]" />
                      </div>
                  </div>

                  {/* Content Side */}
                  <div className="w-full md:w-1/2 p-12 flex flex-col justify-center">
                      <div className="w-12 h-12 bg-indigo-500 rounded-xl flex items-center justify-center text-white mb-6 shadow-lg shadow-indigo-500/30">
                          <activeFeature.icon size={24} />
                      </div>
                      <h3 className="text-3xl font-bold text-white mb-4">{activeFeature.title}</h3>
                      <p className="text-xl text-indigo-200 mb-6 font-light italic">"{activeFeature.desc}"</p>
                      <p className="text-slate-400 leading-relaxed">{activeFeature.detail}</p>
                      
                      <button 
                        onClick={() => setActiveFeature(null)}
                        className="mt-8 w-fit px-6 py-3 bg-white text-slate-900 rounded-xl font-bold hover:bg-indigo-50 transition-colors flex items-center gap-2"
                      >
                          Explore Feature <ArrowRight size={18} />
                      </button>
                  </div>
              </div>
          </div>
      )}

      {/* ADMIN SECURITY CHECK MODAL */}
      {showAdminModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/80 backdrop-blur-md animate-fade-in p-4">
              <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl w-full max-w-xs border border-red-100 dark:border-red-900/30 overflow-hidden">
                  <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-red-50 dark:bg-red-900/10">
                      <div className="flex items-center gap-2 text-red-600 dark:text-red-400 font-bold text-sm">
                          <ShieldAlert size={16} />
                          Security Check
                      </div>
                      <button onClick={() => setShowAdminModal(false)} className="text-slate-400 hover:text-red-500">
                          <X size={16} />
                      </button>
                  </div>
                  <form onSubmit={handleAdminSubmit} className="p-5 space-y-4">
                      <div>
                          <label className="block text-xs font-bold text-slate-500 mb-2 uppercase tracking-wider">Enter Admin Passcode</label>
                          <input 
                              autoFocus
                              type="password"
                              value={adminPasscode}
                              onChange={(e) => setAdminPasscode(e.target.value)}
                              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-red-500 outline-none text-slate-900 dark:text-white text-center font-mono tracking-widest"
                              placeholder="••••••••"
                          />
                      </div>
                      <button 
                          type="submit" 
                          disabled={!adminPasscode}
                          className="w-full py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-bold text-sm shadow-md shadow-red-200 dark:shadow-red-900/20 transition-all disabled:opacity-50 active:scale-95"
                      >
                          Access
                      </button>
                  </form>
              </div>
          </div>
      )}
    </div>
  );
};

export default AuthScreen;
