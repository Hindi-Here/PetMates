import { AnimatePresence, motion } from 'framer-motion';

interface MenuItem {
  id: string;
  label: string;
}

interface DropdownProps {
  items: MenuItem[];
  isOpen: boolean;
  onSelect?: (item: MenuItem) => void;
}

export default function Dropdown({ items, isOpen, onSelect }: DropdownProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className='dropdown-container'
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.25 }}>
          {items.map((item) => {
            return (
              <div
                key={item.id}
                className='dropdown-item'
                onClick={(e) => {
                  e.stopPropagation();
                  onSelect?.(item);
                }}
              >
                <p className='dropdown-item-text'>{item.label}</p>
              </div>
            );
          })}
        </motion.div>
      )}
    </AnimatePresence>
  );
}