## polymarket api 

### POSITIONS > ACTIVE 

I am now trying to understand how to use polymarket api in order to calculate pnl, and by going through the docs I realized how polymarket shows the default page for an account. for example if we go here 
https://polymarket.com/@DaOnepiece

and we click on positions and active and sort by "value" it's essentially this request 
```
const options = {method: 'GET'};

fetch('https://data-api.polymarket.com/positions?sizeThreshold=0&limit=500&sortBy=INITIAL&sortDirection=DESC&user=0x6ca3bbd21ece8efe616738d04c5664f746be590f&offset=0', options)
  .then(res => res.json())
  .then(res => console.log(res))
  .catch(err => console.error(err));
```

whereas if I sort by "pnl $" we have this query 
```
const options = {method: 'GET'};

fetch('https://data-api.polymarket.com/positions?sizeThreshold=0&limit=500&sortBy=CASHPNL&sortDirection=DESC&user=0x6ca3bbd21ece8efe616738d04c5664f746be590f&offset=0', options)
  .then(res => res.json())
  .then(res => console.log(res))
  .catch(err => console.error(err));
  ```

if I sort by "pnl %" then we have this query: 
```
const options = {method: 'GET'};

fetch('https://data-api.polymarket.com/positions?sizeThreshold=0&limit=500&sortBy=PERCENTPNL&sortDirection=DESC&user=0x6ca3bbd21ece8efe616738d04c5664f746be590f&offset=0', options)
  .then(res => res.json())
  .then(res => console.log(res))
  .catch(err => console.error(err));
```

if I sort by "bet" we have this query: 

```
const options = {method: 'GET'};

fetch('https://data-api.polymarket.com/positions?sizeThreshold=0&limit=500&sortBy=TOKENS&sortDirection=DESC&user=0x6ca3bbd21ece8efe616738d04c5664f746be590f&offset=0', options)
  .then(res => res.json())
  .then(res => console.log(res))
  .catch(err => console.error(err));
```

if i sort by "alphabetically" we have this 
```
const options = {method: 'GET'};

fetch('https://data-api.polymarket.com/positions?sizeThreshold=0&limit=500&sortBy=TITLE&sortDirection=DESC&user=0x6ca3bbd21ece8efe616738d04c5664f746be590f&offset=0', options)
  .then(res => res.json())
  .then(res => console.log(res))
  .catch(err => console.error(err));
```

if I sort by "average price" 
```
const options = {method: 'GET'};

fetch('https://data-api.polymarket.com/positions?sizeThreshold=0&limit=500&sortBy=AVGPRICE&sortDirection=DESC&user=0x6ca3bbd21ece8efe616738d04c5664f746be590f&offset=0', options)
  .then(res => res.json())
  .then(res => console.log(res))
  .catch(err => console.error(err));
```

if I sort by current price? it doesn't even work 



### Positions Value
```
const options = {method: 'GET'};

fetch('https://data-api.polymarket.com/value?user=0x6ca3bbd21ece8efe616738d04c5664f746be590f', options)
  .then(res => res.json())
  .then(res => console.log(res))
  .catch(err => console.error(err));
```


### POSITIONS > CLOSED

"pnl"
```
const options = {method: 'GET'};

fetch('https://data-api.polymarket.com/closed-positions?limit=50&sortBy=REALIZEDPNL&sortDirection=DESC&user=0x6ca3bbd21ece8efe616738d04c5664f746be590f', options)
  .then(res => res.json())
  .then(res => console.log(res))
  .catch(err => console.error(err));
```

"average price" 
```
const options = {method: 'GET'};

fetch('https://data-api.polymarket.com/closed-positions?limit=50&sortBy=AVGPRICE&sortDirection=DESC&user=0x6ca3bbd21ece8efe616738d04c5664f746be590f', options)
  .then(res => res.json())
  .then(res => console.log(res))
  .catch(err => console.error(err));
```

"alphabetically" 
```
const options = {method: 'GET'};

fetch('https://data-api.polymarket.com/closed-positions?limit=50&sortBy=TITLE&sortDirection=DESC&user=0x6ca3bbd21ece8efe616738d04c5664f746be590f', options)
  .then(res => res.json())
  .then(res => console.log(res))
  .catch(err => console.error(err));
```

"date" 
```
const options = {method: 'GET'};

fetch('https://data-api.polymarket.com/closed-positions?limit=50&sortBy=TIMESTAMP&sortDirection=DESC&user=0x6ca3bbd21ece8efe616738d04c5664f746be590f', options)
  .then(res => res.json())
  .then(res => console.log(res))
  .catch(err => console.error(err));
```


### Activity
```
const options = {method: 'GET'};

fetch('https://data-api.polymarket.com/activity?limit=20&sortBy=TIMESTAMP&sortDirection=DESC&user=0x6ca3bbd21ece8efe616738d04c5664f746be590f', options)
  .then(res => res.json())
  .then(res => console.log(res))
  .catch(err => console.error(err));
```

can also sort it by tokens and cash which isn't available on the polymarket UI 



## pnl number 
https://data-api.polymarket.com/v1/leaderboard?timePeriod=all&user=0xe25b9180f5687aa85bd94ee309bb72a464320f1b&category=overall

## pnl over time 
```
https://user-pnl-api.polymarket.com/user-pnl?user_address=0x46bdb2025015fd8d467db9a4a73a264051d851ca&interval=1m&fidelity=1d
```