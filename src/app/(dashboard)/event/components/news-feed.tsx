import React from 'react'

interface NewsFeedProps {
  // Define any props needed for the NewsFeed here
    initialTweets: any[]; // Replace 'any' with the appropriate type
}

const NewsFeed: React.FC<NewsFeedProps> = ({ initialTweets }) => {
  return (
    <div>
        <h3 className="text-lg font-semibold p-4 border-b border-gray-800">News Feed</h3>
        <div className="overflow-y-auto h-full">
            {initialTweets.map((tweet) => (
                <div key={tweet.id} className="p-4 border-b border-gray-800 hover:bg-gray-800/50 cursor-pointer">
                    <p className="text-sm text-gray-300">{tweet.content}</p>
                    <p className="text-xs text-gray-500 mt-2">{new Date(tweet.timestamp).toLocaleString()}</p>
                </div>
            ))}
        </div>
    </div>
  )
}

export default NewsFeed