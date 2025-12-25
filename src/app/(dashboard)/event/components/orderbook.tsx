import React from 'react'

interface OrderBookProps {
  // Define any props needed for the OrderBook here
  activeTokenId?: string;
}

const OrderBook: React.FC<OrderBookProps> = ({ activeTokenId }) => {
  return (
    <div>
        <h3 className="text-lg font-semibold p-4 border-b border-gray-800">Order Book</h3>
        <div className="overflow-y-auto h-full p-4">
            {activeTokenId ? (
                <p className="text-sm text-gray-300">Order book data for token ID: {activeTokenId}</p>
            ) : (
                <p className="text-sm text-gray-500">Select a market to view the order book.</p>
            )}
        </div>
    </div>
  )
}

export default OrderBook