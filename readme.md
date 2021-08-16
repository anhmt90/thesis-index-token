# Index Token for Passive Asset Management

### System Architecture

![System Overview](./docs/system-architecture.png)

### Purchasing workflow of DFAM Token

![Purchase Workflow](./docs/seq_investment.png)

### Portfolio update workflow

![Update Workflow](./docs/seq_update.png)


## Steps to run the system

### 0. Setup

Install the required packages and dependencies:

```console
npm install -g ganache-cli

npm install -g truffle

npm install  # please make sure you're standing in the repo's folder when running this command
```

Compile the contracts:

```console
truffle compile
```

### 1. Run all unit tests
```console
npm run test
```
