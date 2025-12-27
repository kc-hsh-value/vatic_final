import { Button } from '@/components/ui/button'
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { Spinner } from '@/components/ui/spinner'
import React from 'react'



const ReadyLoader = () => {
  return (
    <div className="flex h-screen w-full items-center justify-center">
        <Empty className="w-full">
        <EmptyHeader>
            <EmptyMedia variant="icon">
            <Spinner />
            </EmptyMedia>
            <EmptyTitle>Loading...</EmptyTitle>
            <EmptyDescription>
                Please wait while we process your request. Do not refresh the page.
            </EmptyDescription>
        </EmptyHeader>
        </Empty>
    </div>
  )
}

export default ReadyLoader