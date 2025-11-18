## what's the authentication process?

1. the user authenticates using privy and is assigned a unique EOA delegated wallet both on evm and solana
2. we deploy a safe wallet for the specific EOA. This is a gnosis Safe contract on polygon, owned by the user's EOA. 
3. The user needs to deposit funds to the safe wallet 
4. The approvals should be signed by the EOA for the safe wallet. So essentially, we need approvals for the safe wallet only, not for the EOA. 


- Who owns the funds? The safe wallet
- Who authorizes actions? The privy wallet EOA
- Who executes the onchain transaction and pays the gas? the polymarket relayer client 
- who submits orders to the clob? clob client 