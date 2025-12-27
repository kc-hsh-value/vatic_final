import React from 'react'
import WrappedNavbar from './components/navbar';

interface Props {
    children: React.ReactNode;
}

const Layout = ({ children }: Props) => {

  return (
    <div>
        <WrappedNavbar/>
        {children}
    </div>
  )
}

export default Layout