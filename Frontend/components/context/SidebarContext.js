import React, { createContext, useContext, useState } from 'react';

// Create context for sidebar visibility
export const SidebarContext = createContext({
  sidebarVisible: false,
  toggleSidebar: () => {},
});

export const SidebarProvider = ({ children }) => {
  const [sidebarVisible, setSidebarVisible] = useState(false);
  
  const toggleSidebar = () => {
    setSidebarVisible(!sidebarVisible);
  };

  return (
    <SidebarContext.Provider value={{ sidebarVisible, toggleSidebar }}>
      {children}
    </SidebarContext.Provider>
  );
};

export const useSidebar = () => useContext(SidebarContext);