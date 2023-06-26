# Atomic Swap Open Protocol
### Light Paper Located [here](http://)
### Video demo located [here](http://)
##
## Getting Started
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
export NEXT_PUBLIC_ROOT_KEY=e8756841...0d1a254e6cb6754b3866a0ba
export NEXT_PUBLIC_OWNER_PKH=3a0c3d...d2d766aa
export NEXT_PUBLIC_BLOCKFROST_API_KEY=get-your-key-at-blockfrost.io
```
To generated a root key and public key hash (PKH) you can do the following:
```
cd init
export ENTROPY="put in a 24 word seed phase in this quote"
node ./generate-private-key.mjs
```
This will output the following information that you can use for the environment variables above.
```
atomic-swap-open-protocol/init$ node ./generate-private-key.mjs 
ROOT_KEY=e875684...a254e6cb6754b3866a0ba
OWNER_PKH=3a0c3...1bd2d766aa
ADDRESS=addr_test1vq...ttkd2swwues
```

#### Now run a dev instance
```
cd ..
source ~/.bashrc
npm run dev
```
#### By default, the application runs on port 3000, so open your browser and go to http://localhost:3000

