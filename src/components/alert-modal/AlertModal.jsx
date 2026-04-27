import { useEffect } from "react";
import "./alert-modal.css";

function AlertModal({ mensagem, onClose, tipo }) { // Adicionei 'tipo'
    useEffect(() => {
        const timer = setTimeout(onClose, 4000);
        return () => clearTimeout(timer);
    }, [onClose]);

    // Define o ícone com base no tipo
    const icone = tipo === "sucesso" ? "✅" : "⚠️";

    return (
        <div className="alert-overlay" onClick={onClose}>
            <div className="alert-box" onClick={e => e.stopPropagation()}>
                <div className="alert-icon">{icone}</div>
                <p className="alert-msg">{mensagem}</p>
                <button className="alert-btn" onClick={onClose}>OK, entendi</button>
            </div>
        </div>
    );
}

export default AlertModal;