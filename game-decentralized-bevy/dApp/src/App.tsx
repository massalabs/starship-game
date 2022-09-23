import React from 'react';
import './App.css';
import massa from './massa-logo.png'
import WasmDappGame from './WasmDappGame';

const App: React.FC = () => {
  return (
    <div className="App">
        <header className="App-header">
          <img src={massa} className="App-logo" alt="logo"/>
          <WasmDappGame />
        </header>
    </div>
  );
}

export default App;
