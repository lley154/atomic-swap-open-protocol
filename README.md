# Atomic Swap Open Protocol
### Light Paper Located [here](https://github.com/lley154/atomic-swap-open-protocol/blob/main/docs/Atomic-Swap-Open-Protocol-1.0.pdf)
### Video demo located [here](https://youtu.be/qy1gFzZeE3o)
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
export NEXT_PUBLIC_PORT=":3000"
export NEXT_PUBLIC_PROTOCOL="http"
export NEXT_PUBLIC_ENV="dev"

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
```

#### Now run a dev instance
```
source ~/.bashrc
npm run dev
```
#### By default, the application runs on port 3000, so open your browser and go to http://localhost:3000

#### Install a browser wallet
Currently only [Nami](https://chrome.google.com/webstore/detail/nami/lpfcbjknijpeeillifnkikgncikgfhdo) and [Eternl](https://chrome.google.com/webstore/detail/eternl/kmhcihpebfmpgmihbkipmjlmmioameka)* are the browser extension wallets supported.  You will need to create 2 accounts, one for the seller and the other for the buyer.  By default, the preprod network is used but this a global variable in the [index.tsx](https://github.com/lley154/atomic-swap-open-protocol/blob/main/pages/index.tsx) file that can be changed.

```*``` You must enable single address mode in the Eternl account settings


### Please Note: This is a reference client and not intended for production use
#

### Legal Notice
```
MIT License

Copyright (c) 2023 Context Solutions Inc

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

