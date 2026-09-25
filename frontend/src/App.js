import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Home from "./pages/Home";
import Simulations from "./features/simulations/Simulations";
import ToastContainer from "./components/ToastContainer";
import ConfirmDialog from "./components/ConfirmDialog";
import "./index.css";

function App() {
  return (
    <Router>
      <ToastContainer />
      <ConfirmDialog />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/simulations" element={<Simulations />} />
      </Routes>
    </Router>
  );
}

export default App;
