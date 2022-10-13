# Getting Started with Create React App

This project was bootstrapped with [Create React App](https://github.com/facebook/create-react-app).

## Available Scripts

In the project directory, you can run:

### `npm start`

Runs the app in the development mode.\
Open [http://localhost:3000](http://localhost:3000) to view it in the browser.

The page will reload if you make edits.\
You will also see any lint errors in the console.

### `npm test`

Launches the test runner in the interactive watch mode.\
See the section about [running tests](https://facebook.github.io/create-react-app/docs/running-tests) for more information.

### `npm run build`

Builds the app for production to the `build` folder.\
It correctly bundles React in production mode and optimizes the build for the best performance.

The build is minified and the filenames include the hashes.\
Your app is ready to be deployed!

See the section about [deployment](https://facebook.github.io/create-react-app/docs/deployment) for more information.

### `npm run eject`

**Note: this is a one-way operation. Once you `eject`, you can’t go back!**

If you aren’t satisfied with the build tool and configuration choices, you can `eject` at any time. This command will remove the single build dependency from your project.

Instead, it will copy all the configuration files and the transitive dependencies (webpack, Babel, ESLint, etc) right into your project so you have full control over them. All of the commands except `eject` will still work, but they will point to the copied scripts so you can tweak them. At this point you’re on your own.

You don’t have to ever use `eject`. The curated feature set is suitable for small and middle deployments, and you shouldn’t feel obligated to use this feature. However we understand that this tool wouldn’t be useful if you couldn’t customize it when you are ready for it.

## Learn More

You can learn more in the [Create React App documentation](https://facebook.github.io/create-react-app/docs/getting-started).

To learn React, check out the [React documentation](https://reactjs.org/).


## Usage

> The MassaPlugin context for React is **compatible with hooks! and class-based Components**.

This skeleton project has a demo dApp inside which is a subject of having the massa wallet browser extension installed from here [Massa Wallet](https://github.com/massalabs/massa-wallet.git).

and the `create-react-wallet` npm package as a dependency from [Create React Wallet](https://github.com/massalabs/create-react-wallet.git).


The following sections describe the usage of Massa's ReactJS skeleton for dApps.

### Example

Create a file `context.ts` with the instantiation of Massa's Plugin Context:

```js
// context.ts
import { createMassaContext } from "@massalabs/massa-react-wallet";

const MassaContext = createMassaContext(null);

export default MassaContext;
```

Then make sure to render the `Provider` on the top entry file of your app:

```js
// App.js (_app.js if using Next.js)
import React from "react";
import { IContext } from '@massalabs/massa-react-wallet';
import MassaContext from "./context";

export default function App() {
  return (
    <div>
      <MassaContext.Provider value={{} as IContext}>
        ...
      </MassaContext.Provider>
    </div>
  )
}
```

### React Hooks

When React Hooks are present, one could import the already created massa context which will resolve to a set of properties, one of which is the `web3` instance containing all major functionalities to interact with the Massa blockchain.

```js
// MyFunctionalComponent.js
import React, { useContext } from "react";

import useAsyncEffect from "./utils/asyncEffect";
import MassaContext from "./context";

export default function MyFunctionalComponent() {
  const { web3, error, awaiting, openMassa } = useContext(
    MassaContext,
  );

  useEffect(() => {
    await web3.massaProvider.subspace
  }, [web3]);

```

### HOC for React classes

In case you are not using React Hooks and you need access to `web3` and the other params, you can use a High-Order-Component like this:

```js
// MyClassComponent.tsx
import React, { Component } from "react";
import { withMassaPlugin, PropTypesMassaObject } from "@massalabs/massa-react-wallet";

import MassaContext from "./context";

class MyClassComponent extends Component {
  static propTypes = {
    massa: PropTypesMassaObject.isRequired,
  };

  componentDidMount() {
    const { web3, accounts, error, awaiting, openMassa } = this.props.massa;
    if (web3) {
      // ...
    }
  }

  render() {
    const { web3, accounts, error, awaiting, openMassa } = this.props.massa;
    // ...
  }
}

export default withMassaPlugin(MassaContext)(MyClassComponent);
```

### Injected Massa Web3

The injected over the provider value Massa Web3 has the following properties shown below:

```js
export interface MassaProvider {
    enable: (toggle: boolean) => void;
    version: string;
    enabled: boolean;
    contractWrapper: IContractWrapper;
    walletWrapper: IWalletWrapper;
    publicWrapper: IPublicWrapper;
}
```

The subspaces represent grouped functionalities related to smartContracts, wallet and public json-rpc points. Please note that some of the injected methods will call the wallet extension to open and wait for a user input.

If a dApp is developed whereby one is not tempted to use the Massa browser extension wallet, the React project integrates well with the [Massa Web3](https://github.com/massalabs/massa-web3) npm package that is already included as a dependency.
 

