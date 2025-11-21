
import React, { useMemo, useState, useEffect } from 'react';
import { Quote, Sunrise, Sun, Moon, Sparkles } from 'lucide-react';

interface WelcomeBannerProps {
  userName: string;
  isCompact?: boolean;
}

const MOTIVATIONAL_QUOTES = [
  // Tech & Business
  { text: "Stay hungry, stay foolish.", author: "Steve Jobs" },
  { text: "The only way to do great work is to love what you do.", author: "Steve Jobs" },
  { text: "Move fast and break things.", author: "Mark Zuckerberg" },
  { text: "When something is important enough, you do it even if the odds are not in your favor.", author: "Elon Musk" },
  { text: "Persistence is very important. You should not give up unless you are forced to give up.", author: "Elon Musk" },
  { text: "It’s fine to celebrate success but it is more important to heed the lessons of failure.", author: "Bill Gates" },
  { text: "If you double the number of experiments you do per year you’re going to double your inventiveness.", author: "Jeff Bezos" },
  { text: "Done is better than perfect.", author: "Sheryl Sandberg" },
  { text: "Innovation distinguishes between a leader and a follower.", author: "Steve Jobs" },
  { text: "Your time is limited, so don't waste it living someone else's life.", author: "Steve Jobs" },

  // Sports & Peak Performance
  { text: "I fear not the man who has practiced 10,000 kicks once, but I fear the man who has practiced one kick 10,000 times.", author: "Bruce Lee" },
  { text: "You miss 100% of the shots you don't take.", author: "Wayne Gretzky" },
  { text: "I've failed over and over and over again in my life. And that is why I succeed.", author: "Michael Jordan" },
  { text: "It’s not whether you get knocked down, it’s whether you get up.", author: "Vince Lombardi" },
  { text: "Don’t count the days, make the days count.", author: "Muhammad Ali" },
  { text: "Hard work beats talent when talent doesn't work hard.", author: "Tim Notke" },
  { text: "Champions keep playing until they get it right.", author: "Billie Jean King" },
  { text: "The more difficult the victory, the greater the happiness in winning.", author: "Pele" },

  // Philosophy & Wisdom
  { text: "The journey of a thousand miles begins with one step.", author: "Lao Tzu" },
  { text: "It does not matter how slowly you go as long as you do not stop.", author: "Confucius" },
  { text: "What we think, we become.", author: "Buddha" },
  { text: "Simplicity is the ultimate sophistication.", author: "Leonardo da Vinci" },
  { text: "Happiness depends upon ourselves.", author: "Aristotle" },
  { text: "Act as if what you do makes a difference. It does.", author: "William James" },
  { text: "Knowing yourself is the beginning of all wisdom.", author: "Aristotle" },
  { text: "We are what we repeatedly do. Excellence, then, is not an act, but a habit.", author: "Aristotle" },

  // History & Leadership
  { text: "Success is not final, failure is not fatal: it is the courage to continue that counts.", author: "Winston Churchill" },
  { text: "It always seems impossible until it's done.", author: "Nelson Mandela" },
  { text: "Be the change that you wish to see in the world.", author: "Mahatma Gandhi" },
  { text: "In the middle of difficulty lies opportunity.", author: "Albert Einstein" },
  { text: "Believe you can and you're halfway there.", author: "Theodore Roosevelt" },
  { text: "I have not failed. I've just found 10,000 ways that won't work.", author: "Thomas Edison" },

  // Movies & Pop Culture
  { text: "Do or do not. There is no try.", author: "Yoda" },
  { text: "Great men are not born great, they grow great.", author: "The Godfather" },
  { text: "Just keep swimming.", author: "Dory" },
  { text: "Life moves pretty fast. If you don't stop and look around once in a while, you could miss it.", author: "Ferris Bueller" },
  { text: "With great power comes great responsibility.", author: "Uncle Ben" },

  // Short & Punchy
  { text: "Dream big. Work hard. Stay humble.", author: "Unknown" },
  { text: "Do it with passion or not at all.", author: "Unknown" },
  { text: "Focus on the solution, not the problem.", author: "Unknown" },
  { text: "One day or day one. You decide.", author: "Unknown" },
  { text: "Discipline is doing what needs to be done, even if you don't want to do it.", author: "Unknown" },
  { text: "Action is the foundational key to all success.", author: "Pablo Picasso" },
  { text: "Everything you can imagine is real.", author: "Pablo Picasso" },
  { text: "Creativity is intelligence having fun.", author: "Albert Einstein" },
  { text: "Start where you are. Use what you have. Do what you can.", author: "Arthur Ashe" },
  { text: "Don't wait for opportunity. Create it.", author: "Unknown" }
];

const WelcomeBanner: React.FC<WelcomeBannerProps> = ({ userName, isCompact = false }) => {
  const [mounted, setMounted] = useState(false);
  
  // Store quote in state to persist across re-renders but randomize on full refresh/mount
  const [quote] = useState(() => {
    const randomIndex = Math.floor(Math.random() * MOTIVATIONAL_QUOTES.length);
    return MOTIVATIONAL_QUOTES[randomIndex];
  });

  useEffect(() => {
    setMounted(true);
  }, []);

  // Logic: Time-based Greeting with Emojis
  const { greeting, Icon } = useMemo(() => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) return { greeting: 'Good Morning ☀️', Icon: Sunrise };
    if (hour >= 12 && hour < 18) return { greeting: 'Good Afternoon 🚀', Icon: Sun };
    return { greeting: 'Good Evening 🌙', Icon: Moon };
  }, []);

  if (!mounted) return null;

  const firstName = userName.split(' ')[0] || 'Builder';

  return (
    <div 
        className={`
            relative w-full bg-gradient-to-r from-indigo-600 via-purple-600 to-orange-500 
            rounded-2xl shadow-xl overflow-hidden text-white transition-all duration-500 animate-fade-in group
            ${isCompact ? 'p-5 mb-6' : 'p-8 mb-8'}
        `}
    >
      
      {/* Abstract Background Shapes (Fiery Texture) */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
         {/* Large Circle Top Right */}
         <div className="absolute -top-24 -right-24 w-64 h-64 bg-white opacity-10 rounded-full blur-3xl group-hover:opacity-20 transition-opacity duration-700"></div>
         
         {/* Small Circle Bottom Left */}
         <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-orange-300 opacity-10 rounded-full blur-2xl"></div>
         
         {/* Extra shape for fiery look */}
         <div className="absolute top-10 left-1/3 w-32 h-32 bg-fuchsia-400 opacity-10 rounded-full blur-2xl mix-blend-overlay"></div>

         {/* Floating Dots Pattern */}
         <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.4) 1px, transparent 1px)', backgroundSize: '24px 24px' }}></div>
      </div>

      <div className={`relative z-10 flex ${isCompact ? 'flex-row items-center justify-between' : 'flex-col md:flex-row md:items-end justify-between gap-6'}`}>
        
        {/* Greeting Section */}
        <div className="space-y-1 md:space-y-2">
          <div className="flex items-center gap-2 text-indigo-100 text-xs md:text-sm font-bold uppercase tracking-wider">
            <Icon size={isCompact ? 16 : 18} className="text-yellow-300" />
            <span className="drop-shadow-sm">{greeting}</span>
          </div>
          
          <h1 className={`${isCompact ? 'text-2xl' : 'text-3xl md:text-4xl'} font-extrabold tracking-tight text-white drop-shadow-md`}>
            Hello, {firstName}!
          </h1>
          
          {!isCompact && (
              <div className="flex items-center gap-2 text-indigo-100 font-medium text-sm md:text-base opacity-90">
                 <Sparkles size={16} className="text-yellow-300" />
                 Ready to build something amazing today?
              </div>
          )}
        </div>

        {/* Quote Section */}
        <div className={`${isCompact ? 'hidden md:block text-right max-w-md' : 'md:text-right max-w-lg relative mt-4 md:mt-0'}`}>
          {!isCompact && <Quote size={80} className="absolute -top-6 -left-8 text-white opacity-5 transform -rotate-12" />}
          
          <div className={`inline-flex flex-col ${isCompact ? 'items-end' : 'md:items-end'} relative`}>
            <p className={`${isCompact ? 'text-sm font-medium opacity-90 italic' : 'text-lg md:text-xl font-serif italic leading-relaxed text-white/95 drop-shadow-sm'}`}>
              "{quote.text}"
            </p>
            
            {!isCompact && (
                <div className="mt-3 flex items-center gap-3 md:justify-end">
                  <div className="h-px w-12 bg-indigo-300/60"></div>
                  <span className="text-sm font-bold text-indigo-100 tracking-wide">{quote.author}</span>
                </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default WelcomeBanner;
