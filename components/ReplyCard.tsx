import { motion, AnimatePresence } from 'framer-motion';
import { 
  Check, 
  Copy, 
  Zap, 
  MessageSquare,
  Sparkles,
  ChevronRight
} from 'lucide-react';
import { useState } from 'react';
import clsx from 'clsx';

interface Reply {
  option_number: number;
  category: string;
  content: string;
  explanation: string;
}

interface ReplyCardProps {
  reply: Reply;
  index: number;
  isSelected: boolean;
  onSelect: () => void;
  onRefine: (text: string) => void;
  onChoose: (reply: Reply) => void;
}

export const ReplyCard = ({ 
  reply, 
  index, 
  isSelected, 
  onSelect, 
  onRefine,
  onChoose 
}: ReplyCardProps) => {
  const [copied, setCopied] = useState(false);

  const getCategoryColor = (cat: string) => {
    switch (cat) {
      case 'Playful/Witty': return 'text-purple-400 bg-purple-400/10 border-purple-400/20';
      case 'Bold/Direct': return 'text-pink-400 bg-pink-400/10 border-pink-400/20';
      case 'Soft/Warm': return 'text-blue-400 bg-blue-400/10 border-blue-400/20';
      case 'Intriguing/Mysterious': return 'text-amber-400 bg-amber-400/10 border-amber-400/20';
      case 'Ghost-Busting': return 'text-green-400 bg-green-400/10 border-green-400/20';
      default: return 'text-white/40 bg-white/5 border-white/10';
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(reply.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.1 }}
      className={clsx(
        "group relative flex flex-col gap-3 p-4 rounded-2xl border transition-all cursor-pointer overflow-hidden",
        isSelected 
          ? "bg-white/10 border-pink-500/50 shadow-[0_0_20px_rgba(236,72,153,0.1)] ring-1 ring-pink-500/30" 
          : "bg-white/5 border-white/5 hover:border-white/10 hover:bg-white/[0.07]"
      )}
      onClick={onSelect}
    >
      {/* Category Badge & Sparkle */}
      <div className="flex items-center justify-between">
        <span className={clsx(
          "px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-widest border",
          getCategoryColor(reply.category)
        )}>
          {reply.category}
        </span>
        {isSelected && (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="text-pink-500"
          >
            <Sparkles size={14} />
          </motion.div>
        )}
      </div>

      {/* Content */}
      <p className="text-white text-base leading-relaxed font-medium">
        "{reply.content}"
      </p>

      {/* Explanation (Expanded on select) */}
      <AnimatePresence>
        {isSelected && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <p className="text-xs text-white/50 italic border-l-2 border-white/10 pl-3 py-1">
              {reply.explanation}
            </p>
            
            {/* Action Buttons */}
            <div className="flex items-center gap-2 mt-4">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onChoose(reply);
                }}
                className="flex-1 flex items-center justify-center gap-2 bg-pink-600 hover:bg-pink-500 text-white font-bold py-2.5 rounded-xl text-xs transition-all shadow-lg shadow-pink-600/20 active:scale-95"
              >
                <Check size={14} />
                Choose
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onRefine(reply.content);
                }}
                className="flex-none px-4 py-2.5 bg-white/5 hover:bg-white/10 text-white font-bold rounded-xl text-xs transition-all border border-white/10 flex items-center gap-2"
              >
                <Zap size={14} className="text-purple-400" />
                Refine
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};
