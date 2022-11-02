import React from 'react';
import './App.css';
import massa from '../massa-logo.png'
import WasmDappGame from './WasmDappGame';
import RegisterPlayer from './RegisterPlayer';
import {
  BrowserRouter as Router,
  Routes,
  Route,
} from "react-router-dom";

const App: React.FC = () => {
  return (
    <Router>
      <div className="App">
          <header className="App-header">
            <img src={massa} className="App-logo" alt="logo"/>
            <Routes>
              <Route path="/" element={<RegisterPlayer />} />
              <Route path="/play" element={<WasmDappGame key={null} type={undefined} props={undefined} />} />
            </Routes>
          </header>
      </div>
    </Router>
  );
}

export default App;
