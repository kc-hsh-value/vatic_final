import React from 'react'

interface EventHeaderProps {
  // Define any props needed for the EventHeader here
  title?: string;
  activeMarketName?: string;
}

const EventHeader: React.FC<EventHeaderProps> = ({ title, activeMarketName }) => {
  return (
    <div>
        <h1 className="text-2xl font-bold">{title || 'Event Title'}</h1>
        <h2 className="text-lg text-gray-400">{activeMarketName || 'Select a Market'}</h2>
    </div>
  )
}

export default EventHeader