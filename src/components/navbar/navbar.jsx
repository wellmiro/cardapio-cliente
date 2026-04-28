import "./navbar.css";
import logo from "../../assets/logo.png";
import bag from "../../assets/bag.png";
import Cart from "../cart/cart";
import BarraPesquisa from "./BarraPesquisa";
import { NavLink, useNavigate } from "react-router-dom";

function Navbar(props) {
    const navigate = useNavigate();

    function openSidebar() {
        const event = new CustomEvent('openSidebar');
        window.dispatchEvent(event);
    }

    const handleLogoClick = (e) => {
        e.preventDefault();
        navigate(-1);
    }

    return (
        <div className="navbar">
            <div className="navbar-logo-section" onClick={handleLogoClick}>
                <img src={logo} className="logotipo" alt="Logotipo 99Burger" style={{ cursor: "pointer" }} />
            </div>

            {/* Barra de pesquisa aparece apenas se showMenu for true */}
            {props.showMenu && (
                <BarraPesquisa valor={props.valorBusca} onChange={props.onPesquisar} />
            )}

            {
                props.showMenu &&
                <div className="menu">
                    <NavLink 
                        to="/historico" 
                        className={({ isActive }) => isActive ? "active" : ""}
                    >
                        Histórico
                    </NavLink>
                    
                    <button onClick={openSidebar} className="btn-red">
                        <img src={bag} className="icon" alt="Ícone Sacola" />
                        <span>Sacola</span>
                    </button>
                </div>
            }

            <Cart />
        </div>
    );
}

export default Navbar;