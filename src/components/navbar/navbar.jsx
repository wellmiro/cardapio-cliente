import "./navbar.css";
import logo from "../../assets/logo.png";
import bag from "../../assets/bag.png";
import Cart from "../cart/cart";
import { Link, useNavigate } from "react-router-dom";

function Navbar(props) {
    const navigate = useNavigate();

    function openSidebar() {
        const event = new CustomEvent('openSidebar');
        window.dispatchEvent(event);
    }

    const handleLogoClick = (e) => {
        e.preventDefault();
        // Se estiver na home, não faz nada ou vai para o topo
        if (window.location.pathname.includes('cardapio_digital')) {
            // Se quiser que a logo na home não volte (para não sair do app), comente a linha abaixo
            navigate(-1);
        } else {
            navigate(-1);
        }
    }

    return (
        <div className="navbar">
            <div style={{ display: "inline-block" }} onClick={handleLogoClick}>
                <img src={logo} className="logotipo" alt="Logotipo 99Burger" style={{ cursor: "pointer" }} />
            </div>

            {
                props.showMenu &&
                <div className="menu">
                    <Link to="/historico">Histórico</Link>
                    <button onClick={openSidebar} className="btn btn-red">
                        <img src={bag} className="icon" alt="Ícone Sacola" />
                        Sacola
                    </button>
                </div>
            }

            <Cart />
        </div>
    );
}

export default Navbar;