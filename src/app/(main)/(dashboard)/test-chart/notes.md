# notes on page.tsx and thinkin about ways to decouple it. 


## description

### header and reange selector

- First we render the header and the range selector. It contains information coming from eventData and selectedRange
I don't see any direct reason to decouple that

### Main top chart area

This is the area of the main chart. 

we have 2 modes. the first one is compare and the other one is the top 5 comparisson. 

#### compare mode
for the "compare" mode we use the pinnedLabels in order to determine the name the makret(s) that are currently selected. We also have a button to switch mode from compare to top 5. 

Then we render the main chart and we use the compareRender state variable to map through all the subsequent markets the user has selected. and we also render a tooltip with it. 

really good implementation 

#### top 5 panel

we just render the equivalent component. 


OK I have htis idea for this. Maybe we need to unify both renders into a single component that is gonna take as props the markets it should return (either the top 5 or the compareRender) and based on that return the chart component. I guess we could do that and it would reduce the lines of code significantly. 

# TODO 1: unify the main top chart area chart renders 

### split view markets and news 

on the left we have the markets of the specific event and on the right we have the news which are the correlations relevant to the specific market. 

#### left col - markets 

ok in order to render the markets we are using the eventData state variable, which contains the markets array. This is really good, but tbh doesn't help with real time price updates. we could potentially implement some kind of polling probably. 


then we render the tabs and based on the activeTab we render the corresponding component. for now we have only implemented the price chart. Which is perfect cause it's a price chart with the lineseries, the tooltip and the markers. 

#### right col - news

we define the newsHeaderLabel state variable to track what we are looking at right now (if we have opened up an expanded market, or if we have chosen various markets or if we are at the default top 5) and below that we iterate over the newsItems 