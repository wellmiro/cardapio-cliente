import { BrowserRouter, Route, Routes } from "react-router-dom";
import Home from "./pages/home/home.jsx";
import Checkout from "./pages/checkout/checkout.jsx";
import Historico from "./pages/historico/historico.jsx";

function Rotas() {
    return (
        <BrowserRouter>
            <Routes>
                <Route path="/cardapio_digital/:id" element={<Home />} />
                <Route path="/checkout" element={<Checkout />} />

                {/* ✅ CORRETO */}
                <Route path="/cardapio_digital/:id/historico" element={<Historico />} />

                <Route path="/historico" element={<Historico />} />
            </Routes>
        </BrowserRouter>
    );
}

export default Rotas;