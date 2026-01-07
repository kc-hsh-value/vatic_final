import React from 'react'
import UnifiedNavbar from '@/components/unified-navbar';

interface Props {
    children: React.ReactNode;
}

const Layout = ({ children }: Props) => {

  return (
    <div>
        <UnifiedNavbar/>
        {children}
    </div>
  )
}

export default Layout