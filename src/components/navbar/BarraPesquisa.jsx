import React from 'react'; // Adicione isso por segurança
import "./barra-pesquisa.css";

function BarraPesquisa({ valor, onChange }) {
    return (
        <div className="busca-wrapper">
            <input 
                type="text" 
                className="busca-input"
                placeholder="O que você quer comer hoje?" 
                value={valor || ""} 
                onChange={(e) => onChange(e.target.value)}
            />
        </div>
    );
}

export default BarraPesquisa; // Verifique se esta linha é a ÚNICA de export