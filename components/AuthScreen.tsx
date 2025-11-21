
import React, { useState } from 'react';
import { Lock, Mail, User as UserIcon, ArrowRight, AlertCircle, Loader2, LayoutDashboard, KanbanSquare, BarChart3 } from 'lucide-react';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { generateDemoData, clearDevData } from '../services/demoDataService';

interface AuthScreenProps {
  onLoginSuccess: () => void;
  onSeedingStart?: () => void;
  onSeedingEnd?: () => void;
}

const AuthScreen: React.FC<AuthScreenProps> = ({ onLoginSuccess, onSeedingStart, onSeedingEnd }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [jobTitle, setJobTitle] = useState('Project Manager');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [loadingText, setLoadingText] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    setLoadingText('');

    const cleanEmail = email.trim();
    let loginEmail = cleanEmail;
    let loginPass = password;
    
    const isAdminShortcut = isLogin && cleanEmail === 'Admin' && password === 'admin';

    if (isAdminShortcut) {
       loginEmail = 'admin@dev.com';
       loginPass = 'admin123456';
       if (onSeedingStart) onSeedingStart();
    }

    try {
      if (isLogin) {
        try {
            if (isAdminShortcut) setLoadingText('Authenticating Admin...');
            const userCred = await signInWithEmailAndPassword(auth, loginEmail, loginPass);
            
            if (isAdminShortcut) {
                setLoadingText('Setting up Demo Environment...');
                await clearDevData(userCred.user.uid);
                await generateDemoData(userCred.user.uid);
                if (onSeedingEnd) onSeedingEnd();
            }

        } catch (loginErr: any) {
            if (loginEmail === 'admin@dev.com' && 
               (loginErr.code === 'auth/user-not-found' || 
                loginErr.code === 'auth/invalid-login-credentials' || 
                loginErr.code === 'auth/invalid-credential')) {
                
                setLoadingText('Provisioning Admin Account...');
                const userCredential = await createUserWithEmailAndPassword(auth, loginEmail, loginPass);
                const user = userCredential.user;
                
                await updateProfile(user, { displayName: 'Dev Admin' });
                await setDoc(doc(db, 'users', user.uid), {
                    username: 'Dev Admin',
                    email: loginEmail,
                    jobTitle: 'System Administrator',
                    avatar: 'D',
                    createdAt: new Date().toISOString()
                });

                setLoadingText('Generating Demo Data...');
                await generateDemoData(user.uid);
                if (onSeedingEnd) onSeedingEnd();
            } else {
                if (isAdminShortcut && onSeedingEnd) onSeedingEnd();
                throw loginErr;
            }
        }
      } else {
        if (!username || !cleanEmail || !password) {
          throw new Error('Please fill in all fields');
        }

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
          createdAt: new Date().toISOString()
        });
      }
      onLoginSuccess();
    } catch (err: any) {
      if (err.code !== 'auth/invalid-email' && err.code !== 'auth/wrong-password') {
          console.error(err);
      }
      
      if (isAdminShortcut && onSeedingEnd) onSeedingEnd();
      
      let msg = 'An unexpected error occurred';
      if (err.code === 'auth/invalid-email') msg = 'Invalid email address format.';
      if (err.code === 'auth/user-disabled') msg = 'This account has been disabled.';
      if (err.code === 'auth/user-not-found') msg = 'No account found with this email.';
      if (err.code === 'auth/wrong-password') msg = 'Incorrect password.';
      if (err.code === 'auth/invalid-login-credentials') msg = 'Invalid email or password.';
      if (err.code === 'auth/invalid-credential') msg = 'Invalid credentials.';
      if (err.code === 'auth/email-already-in-use') msg = 'Email is already registered.';
      if (err.code === 'auth/weak-password') msg = 'Password should be at least 6 characters.';
      
      setError(msg);
    } finally {
      setIsLoading(false);
      setLoadingText('');
    }
  };

  return (
    <div className="min-h-screen flex bg-white dark:bg-slate-950">
      
      {/* LEFT SIDE - BRAND SHOWCASE */}
      <div className="hidden lg:flex lg:w-[60%] relative bg-slate-900 overflow-hidden flex-col justify-between">
         {/* Background Image */}
         <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: "url('https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?ixlib=rb-4.0.3&auto=format&fit=crop&w=2070&q=80')" }}></div>
         
         {/* Gradient Overlay */}
         <div className="absolute inset-0 bg-gradient-to-br from-indigo-950/95 via-purple-950/80 to-slate-900/70 backdrop-blur-[1px]"></div>

         {/* Content */}
         <div className="relative z-10 p-12 h-full flex flex-col">
            {/* Brand Logo Top Left */}
            <div className="flex items-center gap-3 text-white/90 mb-8">
               <div className="w-8 h-8 bg-white/10 backdrop-blur-md rounded-lg flex items-center justify-center border border-white/20 shadow-inner">
                 <span className="font-bold text-sm">P</span>
               </div>
               <span className="font-semibold tracking-wide text-sm uppercase opacity-80">ProManage AI</span>
            </div>

            {/* CSS Composition: Floating App Screens */}
            <div className="flex-1 relative flex items-center justify-center perspective-[2000px]">
               
               {/* Screen 1: Dashboard (Back/Left) */}
               <div className="absolute w-[500px] h-[340px] bg-slate-50 rounded-xl shadow-2xl border border-white/10 transform -rotate-6 -translate-x-16 translate-y-8 overflow-hidden p-4 opacity-90 transition-transform hover:-translate-y-2 duration-700">
                   {/* Mock Header */}
                   <div className="flex items-center gap-4 mb-6">
                      <div className="w-8 h-8 bg-indigo-100 rounded-lg flex items-center justify-center text-indigo-600"><LayoutDashboard size={16} /></div>
                      <div className="h-2 w-32 bg-slate-200 rounded"></div>
                      <div className="ml-auto h-8 w-8 bg-slate-200 rounded-full"></div>
                   </div>
                   {/* Mock Stats Row */}
                   <div className="flex gap-4 mb-6">
                       <div className="flex-1 h-24 bg-white rounded-lg shadow-sm border border-slate-100 p-3">
                          <div className="w-8 h-8 bg-blue-50 rounded-full mb-2"></div>
                          <div className="w-12 h-2 bg-slate-200 rounded mb-1"></div>
                          <div className="w-8 h-4 bg-slate-300 rounded"></div>
                       </div>
                       <div className="flex-1 h-24 bg-white rounded-lg shadow-sm border border-slate-100 p-3">
                          <div className="w-8 h-8 bg-purple-50 rounded-full mb-2"></div>
                          <div className="w-12 h-2 bg-slate-200 rounded mb-1"></div>
                          <div className="w-8 h-4 bg-slate-300 rounded"></div>
                       </div>
                       <div className="flex-1 h-24 bg-white rounded-lg shadow-sm border border-slate-100 p-3">
                          <div className="w-8 h-8 bg-emerald-50 rounded-full mb-2"></div>
                          <div className="w-12 h-2 bg-slate-200 rounded mb-1"></div>
                          <div className="w-8 h-4 bg-slate-300 rounded"></div>
                       </div>
                   </div>
                   {/* Mock Chart Area */}
                   <div className="flex gap-4 h-full">
                       <div className="w-2/3 h-32 bg-slate-100 rounded-lg relative overflow-hidden">
                          <div className="absolute bottom-0 left-0 w-full h-16 bg-indigo-100/50 rounded-t-lg"></div>
                          <div className="absolute bottom-0 left-4 w-8 h-12 bg-indigo-300 rounded-t"></div>
                          <div className="absolute bottom-0 left-16 w-8 h-20 bg-indigo-400 rounded-t"></div>
                          <div className="absolute bottom-0 left-28 w-8 h-16 bg-indigo-300 rounded-t"></div>
                       </div>
                       <div className="w-1/3 h-32 bg-slate-100 rounded-lg flex items-center justify-center">
                          <div className="w-16 h-16 rounded-full border-4 border-purple-200 border-t-purple-500"></div>
                       </div>
                   </div>
               </div>

               {/* Screen 2: Kanban/Dark Mode (Front/Right) */}
               <div className="absolute w-[500px] h-[340px] bg-slate-900 rounded-xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] border border-slate-700 transform rotate-3 translate-x-12 -translate-y-4 overflow-hidden p-5 transition-transform hover:-translate-y-2 duration-700">
                   {/* Mock Header */}
                   <div className="flex justify-between items-center mb-6 border-b border-slate-800 pb-4">
                       <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white"><KanbanSquare size={16} /></div>
                          <div className="w-24 h-3 bg-slate-700 rounded"></div>
                       </div>
                       <div className="flex gap-2">
                          <div className="w-20 h-8 bg-indigo-600 rounded-lg"></div>
                       </div>
                   </div>
                   {/* Mock Columns */}
                   <div className="flex gap-4 h-full">
                       {/* Column 1 */}
                       <div className="w-1/3 bg-slate-800/50 rounded-lg p-3 border border-slate-700/50">
                           <div className="w-16 h-2 bg-slate-600 rounded mb-4"></div>
                           <div className="w-full h-20 bg-slate-800 rounded border border-slate-700 mb-3 p-2">
                              <div className="w-3/4 h-2 bg-slate-600 rounded mb-2"></div>
                              <div className="w-8 h-2 bg-rose-900/50 rounded"></div>
                           </div>
                           <div className="w-full h-20 bg-slate-800 rounded border border-slate-700 p-2">
                              <div className="w-1/2 h-2 bg-slate-600 rounded mb-2"></div>
                              <div className="w-8 h-2 bg-amber-900/50 rounded"></div>
                           </div>
                       </div>
                       {/* Column 2 */}
                       <div className="w-1/3 bg-slate-800/50 rounded-lg p-3 border border-slate-700/50">
                           <div className="w-20 h-2 bg-slate-600 rounded mb-4"></div>
                           <div className="w-full h-24 bg-slate-800 rounded border-l-2 border-indigo-500 p-2">
                              <div className="w-3/4 h-2 bg-slate-600 rounded mb-2"></div>
                              <div className="w-full h-10 bg-slate-700/30 rounded mb-2"></div>
                              <div className="flex justify-between">
                                 <div className="w-4 h-4 rounded-full bg-slate-600"></div>
                                 <div className="w-10 h-2 bg-slate-700 rounded"></div>
                              </div>
                           </div>
                       </div>
                       {/* Column 3 */}
                       <div className="w-1/3 bg-slate-800/50 rounded-lg p-3 border border-slate-700/50 opacity-50">
                           <div className="w-12 h-2 bg-slate-600 rounded mb-4"></div>
                           <div className="w-full h-20 bg-slate-800 rounded border border-slate-700"></div>
                       </div>
                   </div>
                   {/* Highlight overlay */}
                   <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/20 rounded-full blur-3xl -mr-10 -mt-10"></div>
               </div>

            </div>

            {/* Text Block */}
            <div className="mt-8 text-white max-w-2xl z-20">
                <h1 className="text-4xl lg:text-5xl font-bold leading-tight mb-6 tracking-tight">
                   Build Smarter.<br/>
                   <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-200 to-purple-200">Manage Precisely.</span>
                </h1>
                <p className="text-lg text-slate-300 leading-relaxed max-w-lg font-light">
                   The AI-integrated project management platform that optimizes your schedule, budget, and team collaboration in real-time.
                </p>
                
                <div className="flex items-center gap-6 mt-8 text-sm font-medium text-slate-400">
                   <div className="flex items-center gap-2">
                      <div className="w-1 h-1 rounded-full bg-emerald-400"></div>
                      AI Forecasting
                   </div>
                   <div className="flex items-center gap-2">
                      <div className="w-1 h-1 rounded-full bg-blue-400"></div>
                      Resource Tracking
                   </div>
                   <div className="flex items-center gap-2">
                      <div className="w-1 h-1 rounded-full bg-purple-400"></div>
                      Generative Assets
                   </div>
                </div>
            </div>
         </div>
      </div>

      {/* RIGHT SIDE - LOGIN FORM */}
      <div className="w-full lg:w-[40%] bg-white dark:bg-slate-950 flex flex-col justify-center items-center p-6 md:p-12 overflow-y-auto relative">
         
         <div className="w-full max-w-[400px] animate-fade-in">
            {/* Mobile Logo */}
            <div className="lg:hidden mb-8 flex items-center gap-3 justify-center">
               <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white font-bold text-xl shadow-lg shadow-indigo-200">P</div>
               <span className="font-bold text-slate-900 dark:text-white text-xl tracking-tight">ProManage AI</span>
            </div>

            {/* Header */}
            <div className="text-center lg:text-left mb-8">
               <div className="hidden lg:flex w-12 h-12 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-xl items-center justify-center text-white font-bold text-2xl shadow-xl shadow-indigo-200 dark:shadow-indigo-900/20 mb-6 transform transition-transform hover:scale-105 duration-300">
                  P
               </div>
               <h2 className="text-3xl font-bold text-slate-900 dark:text-white mb-3 tracking-tight">
                  {isLogin ? 'Welcome Back!' : 'Get Started'}
               </h2>
               <p className="text-slate-500 dark:text-slate-400 text-sm leading-relaxed">
                  {isLogin ? 'Enter your credentials to access your personalized workspace.' : 'Create your account today to start managing projects efficiently.'}
               </p>
            </div>

            {error && (
                <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800 rounded-xl text-red-600 dark:text-red-400 text-sm font-medium flex items-start gap-3 animate-fade-in">
                  <AlertCircle size={18} className="shrink-0 mt-0.5" />
                  <span className="leading-snug">{error}</span>
                </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
                 {!isLogin && (
                   <>
                     <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider ml-1">Full Name</label>
                        <div className="relative">
                           <UserIcon size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                           <input 
                             type="text" 
                             value={username}
                             onChange={(e) => setUsername(e.target.value)}
                             className="w-full pl-11 pr-4 py-3.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:bg-white dark:focus:bg-slate-950 outline-none transition-all text-slate-900 dark:text-white placeholder-slate-400 font-medium"
                             placeholder="John Doe"
                             required
                           />
                        </div>
                     </div>
                     <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider ml-1">Job Title</label>
                        <div className="relative">
                           <BriefcaseIcon size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                           <input 
                             type="text" 
                             value={jobTitle}
                             onChange={(e) => setJobTitle(e.target.value)}
                             className="w-full pl-11 pr-4 py-3.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:bg-white dark:focus:bg-slate-950 outline-none transition-all text-slate-900 dark:text-white placeholder-slate-400 font-medium"
                             placeholder="Product Manager"
                           />
                        </div>
                     </div>
                   </>
                 )}

                 <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider ml-1">Email</label>
                    <div className="relative">
                       <Mail size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                       <input 
                         type="email" 
                         value={email}
                         onChange={(e) => setEmail(e.target.value)}
                         className="w-full pl-11 pr-4 py-3.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:bg-white dark:focus:bg-slate-950 outline-none transition-all text-slate-900 dark:text-white placeholder-slate-400 font-medium"
                         placeholder="name@company.com"
                         required
                       />
                    </div>
                 </div>

                 <div className="space-y-1.5">
                    <div className="flex justify-between items-center ml-1">
                        <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">Password</label>
                        {isLogin && <a href="#" className="text-xs font-bold text-indigo-600 hover:underline">Forgot?</a>}
                    </div>
                    <div className="relative">
                       <Lock size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                       <input 
                         type="password" 
                         value={password}
                         onChange={(e) => setPassword(e.target.value)}
                         className="w-full pl-11 pr-4 py-3.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:bg-white dark:focus:bg-slate-950 outline-none transition-all text-slate-900 dark:text-white placeholder-slate-400 font-medium"
                         placeholder="••••••••"
                         required
                       />
                    </div>
                 </div>

                 <button 
                   type="submit"
                   disabled={isLoading}
                   className="w-full py-3.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white rounded-xl font-bold shadow-lg shadow-indigo-200 dark:shadow-indigo-900/40 transition-all flex items-center justify-center gap-2 active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed mt-2"
                 >
                   {isLoading ? (
                     <>
                        <Loader2 className="animate-spin" size={18} />
                        {loadingText || 'Processing...'}
                     </>
                   ) : (
                     <>
                        {isLogin ? 'Sign In' : 'Create Account'} <ArrowRight size={18} />
                     </>
                   )}
                 </button>
            </form>

            {/* Divider */}
            <div className="relative my-8">
                <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-200 dark:border-slate-800"></div></div>
                <div className="relative flex justify-center text-sm">
                    <span className="px-4 bg-white dark:bg-slate-950 text-slate-400 font-medium text-xs uppercase">Or continue with</span>
                </div>
            </div>

            {/* Social Buttons Placeholder */}
            <div className="grid grid-cols-2 gap-4 mb-8">
                <button type="button" className="flex items-center justify-center gap-2 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors font-bold text-sm text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-900">
                    <svg className="w-5 h-5" viewBox="0 0 24 24">
                        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                    </svg>
                    Google
                </button>
                <button type="button" className="flex items-center justify-center gap-2 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors font-bold text-sm text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-900">
                   <svg className="w-5 h-5" viewBox="0 0 23 23">
                        <path fill="#f35325" d="M1 1h10v10H1z"/>
                        <path fill="#81bc06" d="M12 1h10v10H12z"/>
                        <path fill="#05a6f0" d="M1 12h10v10H1z"/>
                        <path fill="#ffba08" d="M12 12h10v10H12z"/>
                   </svg>
                   Microsoft
                </button>
            </div>

            {/* Toggle Register/Login */}
            <div className="text-center">
                 <p className="text-sm text-slate-600 dark:text-slate-400">
                   {isLogin ? "Don't have an account?" : "Already have an account?"}
                   <button 
                     onClick={() => {
                        setIsLogin(!isLogin);
                        setError('');
                     }}
                     className="ml-1.5 text-indigo-600 dark:text-indigo-400 font-bold hover:underline focus:outline-none"
                   >
                     {isLogin ? 'Sign up now' : 'Log in'}
                   </button>
                 </p>
                 
                 {isLogin && (
                    <div className="mt-6 inline-block text-xs text-slate-500 dark:text-slate-500 bg-slate-50 dark:bg-slate-900 py-2 px-4 rounded-full border border-slate-100 dark:border-slate-800">
                        <span className="font-bold text-slate-700 dark:text-slate-400">Dev Hint:</span> User: <code className="text-indigo-500 font-mono">Admin</code> / Pass: <code className="text-indigo-500 font-mono">admin</code>
                    </div>
                 )}
            </div>
         </div>

         {/* Footer Links */}
         <div className="absolute bottom-4 flex gap-6 text-[11px] text-slate-400 font-medium uppercase tracking-wider">
             <a href="#" className="hover:text-indigo-500 transition-colors">Privacy Policy</a>
             <a href="#" className="hover:text-indigo-500 transition-colors">Terms of Service</a>
             <a href="#" className="hover:text-indigo-500 transition-colors">Help Center</a>
         </div>
      </div>
    </div>
  );
};

// Simple Icon Component
const BriefcaseIcon = ({ size, className }: { size: number, className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <rect width="20" height="14" x="2" y="7" rx="2" ry="2" />
        <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
    </svg>
);

export default AuthScreen;
