# Vatic Trading 
The most efficient trading terminal for prediction market trading 


# Development Notes

## Authentication 
For authentication we will use privy auth and supabase. What this means is that we want users to authenticate using privy, and once they have been assigned a wallet we will save them on supabase. Easy. 


### Privy auth
Privy auth is pretty straightforward. All we have to do is wrap our root layout children with the providers (src/app/providers/providers.tsx) which contains the PrivyProvider component that takes in the app id and the rest of the configuration from the actual privy app that we setup. 


So the src/app/page.tsx is going to be available to everyone. So we don't really care to hide it or put it behind an authentication wall. 


let's do that for a new route we will create right now called /alphascope 
I create src/app/alphascope/page.stx and src/app/alphascope/layout.tsx

In order to authorize users to visit this page what we will do is use the custom hook provided by privy called **usePrivy()** which gives us access to various variable such as authenticated, ready, login, logout, etc (but we will use another hook for the login in a little bit)

Let's analyze a lil bit the values exposed by this hook
ready: indicates if privy provider is ready to be used. We need ready to be true first in order to call authenticated. 
authenticated: check if the user has authenticated with **privy**. we always need to call ready first 
this hook exposes a ton of other methods for linking various social accounts etc. but for now we will ignore that. 

so the logic is easy. what we will do is this: 
if not ready: loading screen 
if ready and not authenticated: authentication modal 
if ready and authenticated: watch the dashboard 

the logic isn't that sound because besides the privy authentication, we have our own custom "authentication" which involved the processes we need to go through the supabase tables. we will talk about it in the future. 

we will do that now tbh. let's finish with that. 

#### Custom Authentication flow 
**What's the custom authentication all about?**
So privy authentication isn't enough for what we are trying to build. Privy authentication is just the first step, it essentially confirms that the user has a twitter account and it assigns to him a wallet address. 

So here's the thing: in order to be able to trade on polymarket we need to have access to a users private key. However, this is kinda dangerous to do using privy. Privy has this functionality called "session signers" which allow us to perform actions on behalf of a user's wallet on the server, without exposing the private key to the client. That way we will be able to perform polymarket transactions on behalf of the user. 

At the same time, in order to perform polymarket transactions for a specific wallet, we need to have enabled some allowances such as spending usdc on the ctf exchange or sth like that. 

Finally we need to generate something called CLOB credentials, which are something like unique credentials for users to be able to trade on the centralized limit order book of polymarket. 

So if we take a step back, we understand that the authentication process is comprised of 4 steps: 

1. privy auth 
2. adding session signers to allow us to perform actions on behalf of the user's walelt 
3. sign allowances on the user wallet
4. generate clob credentials for each user. 

This is the full authentication process, and we need to make sure that all these actions are completed before we proceed further. 

In order to track that I have created the users table on the database. So let's see the structure of the users table. 
actually we won't cause it will take a ton of space. the main point is to understand the following process: 

user authenticates using privy => we use the callback provided by privy to save the returend user instance to our database profile table based on the user id => add session signers => we sign the allowances for the specific wallet => we get the CLOB credentials for the specific wallet. 

so yeah. The process seems kinda complex right? and it has a ton of failure choke points. So in order to make sure that everything runs smoothly we will create an authentication process that ensures the user has completed all the necessary steps before proceeding to trade. 

As I hinted before, what we will do is use another hook provided by privy. This hook is called useLogin and it returns a login method. However, we can specify a callback called onComplete which essentially allows us to perform a custom process after the user has signed up using privy. 

also we will create a separate component for users to sign up 


so let me collect all the necessary information for this process.

- first of all we have to create a profile for the user in the supabase table 
- then we have to add the session signers 
- then we have to sign the allowances 
- finally we have to create the clob credentials 

now this process is already working perfectly. HOWEVER, polymarket recently released a builder's program which allows us to use their relayer in order to aviod paying gas fees for the allowance signing, and it also tracks the volume we move to polymarket and shit like that. so since right now I am sponsoring the gas fee for signing transactions, I will probably try to integrate the relayer client as well. 