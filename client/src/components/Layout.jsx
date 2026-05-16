import React from 'react';
import Navbar from './Navbar';
import Footer from './Footer';

const Layout = ({ children }) => {
  return (
    <div className="layout-wrapper" style={{ fontFamily: 'Arial, sans-serif' }}>
      <div style={{ position: 'relative', zIndex: 10, display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
        <Navbar />
        <main className="main-flex-grow">
          {children}
        </main>
        <Footer />
      </div>
    </div>
  );
};

export default Layout;
