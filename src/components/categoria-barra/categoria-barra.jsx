import { useRef, useState } from "react";
import "./categoria-barra.css";

function CategoriaBarra({ dados }) {
    const barraRef = useRef(null);
    const [isDown, setIsDown] = useState(false);
    const [startX, setStartX] = useState(0);
    const [scrollLeft, setScrollLeft] = useState(0);
    const [moved, setMoved] = useState(false);

    // 🔥 Imagem padrão mais estável
    const imagemPadrao = "https://placehold.co/100x100?text=Food";

    const handleMouseDown = (e) => {
        setIsDown(true);
        setMoved(false);
        setStartX(e.pageX - barraRef.current.offsetLeft);
        setScrollLeft(barraRef.current.scrollLeft);
    };

    const handleMouseLeave = () => setIsDown(false);
    const handleMouseUp = () => setIsDown(false);

    const handleMouseMove = (e) => {
        if (!isDown) return;
        e.preventDefault();
        const x = e.pageX - barraRef.current.offsetLeft;
        const walk = (x - startX) * 2; 
        if (Math.abs(walk) > 3) setMoved(true);
        barraRef.current.scrollLeft = scrollLeft - walk;
    };

    const scrollParaCategoria = (nomeCategoria) => {
        if (!moved) {
            const elemento = document.getElementById(nomeCategoria);
            if (elemento) {
                const offset = 140;
                const bodyRect = document.body.getBoundingClientRect().top;
                const elementRect = elemento.getBoundingClientRect().top;
                const elementPosition = elementRect - bodyRect;
                const offsetPosition = elementPosition - offset;

                window.scrollTo({
                    top: offsetPosition,
                    behavior: "smooth"
                });
            }
        }
    };

    return (
        <div className="categoria-wrapper">
            <div 
                className="categoria-barra"
                ref={barraRef}
                onMouseDown={handleMouseDown}
                onMouseLeave={handleMouseLeave}
                onMouseUp={handleMouseUp}
                onMouseMove={handleMouseMove}
            >
                {dados && dados.map((cat) => (
                    <div key={cat.id_categoria} 
                         className="categoria-item"
                         onClick={() => scrollParaCategoria(cat.categoria)}>
                        <img 
                            // 🔥 Usa url_foto (do novo endpoint) ou url_icone (antigo) ou a padrão
                            src={cat.url_foto || cat.url_icone || imagemPadrao} 
                            alt={cat.categoria} 
                            draggable="false" 
                            onError={(e) => { 
                                e.target.onerror = null; // Previne loop infinito
                                e.target.src = imagemPadrao; 
                            }}
                        />
                        <span>{cat.categoria}</span>
                    </div>
                ))}
            </div>
        </div>
    );
}

export default CategoriaBarra;