// TSX scripts

import type { ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useLocation } from "react-router-dom";

// every route move - scroll top
export const ScrollToTop = () => {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return null;
};

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

// block scroll when modal is open
export function useBlockScroll(isVisible: boolean) {
  useEffect(() => {
    if (isVisible) {
      const originalStyle = window.getComputedStyle(document.body).overflow;
      document.body.style.overflow = 'hidden';
      
      return () => {
        document.body.style.overflow = originalStyle;
      };
    }
  }, [isVisible]);
}

// tag box autosize
export function useTagInput() {
  
  const handleInput = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const target = e.currentTarget;

    // autosize in dipendency content
    target.style.height = 'auto';
    target.style.height = `${target.scrollHeight}px`;  
  }, []);

  // ban enter
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
    }
  }, []);

  return { handleInput, handleKeyDown };
}

// validator input field config
export const ValidatorCfg = {
  // length checker
  required: (value: string) => value.trim().length > 0,
  minLength: (value: string, min: number) => value.length >= min,
  maxLength: (value: string, max: number) => value.length <= max,

  // format checker
  email: (value: string) => /^[^\s@]+@([^\s@.,]+\.)+[^\s@.,]{2,}$/.test(value),
  
  password: (value: string) => {
    const hasLetter = /[A-Za-zА-Яа-я]/.test(value);
    const hasNumber = /[0-9]/.test(value);
    const hasSpecial = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(value);
    return value.length >= 8 && hasLetter && hasNumber && hasSpecial;
  },

  hasTag: (value: string) => {
    if (!value || typeof value !== 'string')
      return false;

      const tags = value.trim().split(/\s+/);
      return tags.every(tag => /^#[\wА-Яа-я]+$/.test(tag));
    }
};

// validator rules for dynamic change user input
export const ValidatorRegexCleanerCfg = {
  username: (value: string) => {
    return value.replace(/[^a-zA-Zа-яА-Я0-9_-]/g, '');
  },

  email: (value: string) => {
    return value.replace(/[^a-zA-Zа-яА-Я0-9@.-]/g, '');
  },

  password: (value: string) => {
    return value.replace(/[^a-zA-Zа-яА-Я0-9!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/g, '');
  },

  role: (value: string) => {
    return value
      .replace(/[^a-zA-Zа-яА-Я0-9\/[\]\-\s]/g, '')
      .replace(/^\s+/, '')
      .replace(/\s\s+/g, ' ');  
  },

  message: (value: string) => value,

  tags: (value: string) => {
    let val = value.replace(/\n/g, '');
    val = val.replace(/-/g, '_');
    val = val.replace(/[^\w\sа-яА-ЯёЁ#]/g, '');
    val = val.replace(/__+/g, '_');
    val = val.replace(/\s\s+/g, ' ');
    return val;
  },
};

// template input change events for input box
export function useChangeInput<T>(initialState: T, rules: Partial<Record<keyof T, (value: string) => string>>) {

  // state for content
  const [data, setData] = useState<T>(initialState);

  // event launch on every symbol input
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target as HTMLInputElement;
    let val = type === 'checkbox' ? (e.target as HTMLInputElement).checked : value;

    // regex rules for input field
    if (typeof val === 'string' && rules[name as keyof T]) {
      val = rules[name as keyof T]!(val);
    }
  
    setData(prev => ({ ...prev, [name]: val }));
  };

  // reset content on new screen in form
  const resetForm = () => setData(initialState);

  return { data, handleChange, resetForm };
}