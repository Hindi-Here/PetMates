// TSX scripts

import type { ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useState, useEffect, useRef } from 'react';

// animated dropdown
interface AnimatedDropdownProps {
  isOpen: boolean;
  children: ReactNode;
  className?: string;
}

export const AnimatedDropdown = ({ isOpen, children, className }: AnimatedDropdownProps) => (
  <AnimatePresence>
    {isOpen && (
      <motion.div
        className={className}
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.25 }}
      >
        {children}
      </motion.div>
    )}
  </AnimatePresence>
);

// check mobile/small screen
export function useIsShort(smallPoint = 965) {
  const [flag, setFlag] = useState(window.innerWidth < smallPoint);

  useEffect(() => {
    const resize = () => {
      setFlag(window.innerWidth < smallPoint);
    };

    window.addEventListener('resize', resize);
    
    return () => window.removeEventListener('resize', resize);
  }, [smallPoint]); 

  return flag;
}

// check open/close header dropdown menu
export function useIsOpen(){
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [isOpen]);

  return { isOpen, setIsOpen, menuRef };
}