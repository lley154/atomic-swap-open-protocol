# Atomic Swap Open Protocol
### Light Paper Located [here](http://)
### Video demo located [here](http://)
##
## Getting Started
#### Make sure you are using a recent version of node
```
node --version
v18.16.1
```
#### Checkout the code repository
```
git clone https://github.com/lley154/atomic-swap-open-protocol.git
```

#### Go into the project folder and install the npm libraries
```
cd atomic-swap-open-protocol
npm install
```
#### Set required environment variables
The following envrionment variables need to be set in your ~/.bashrc file
```
export NEXT_PUBLIC_ROOT_KEY=e875684...a254e6cb6754b3866a0ba
export NEXT_PUBLIC_OWNER_PKH=3a0c3...1bd2d766aa
export NEXT_PUBLIC_BLOCKFROST_API_KEY=get-your-key-at-blockfrost.io
export NEXT_PUBLIC_HOST="localhost"
export NEXT_PUBLIC_PORT="3000"
export NEXT_PUBLIC_PROTOCOL="http"

```
To generated a root key and public key hash (PKH) you can do the following:
```
cd init
export ENTROPY="put in a 24 word seed phase in this quote"
node ./generate-private-key.mjs
cd ..
```
This will output the following information that you can use for the environment variables above.
```
ROOT_KEY=e875684...a254e6cb6754b3866a0ba
OWNER_PKH=3a0c3...1bd2d766aa
ADDRESS=addr_test1vq...ttkd2swwues
```

#### Now run a dev instance
```
source ~/.bashrc
npm run dev
```
#### By default, the application runs on port 3000, so open your browser and go to http://localhost:3000

#### Install a browser wallet
Currently only [Nami](https://chrome.google.com/webstore/detail/nami/lpfcbjknijpeeillifnkikgncikgfhdo) and [Eternl](https://chrome.google.com/webstore/detail/eternl/kmhcihpebfmpgmihbkipmjlmmioameka) are the browser extension wallets supported.  You will need to create 2 accounts, one for the seller and the other for the buyer.  By default, the preprod network is used but this a global variable in the main index.tsx file that can be changed.

### Please Note: This is a reference client and not intended for production use

