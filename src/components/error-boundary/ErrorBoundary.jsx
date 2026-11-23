import { Component } from "react";

// Impede a "tela branca": se qualquer componente filho lançar erro ao renderizar,
// mostra uma mensagem clara com opções de recuperação.
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { erro: null };
    this.tentarNovamente = this.tentarNovamente.bind(this);
    this.voltar = this.voltar.bind(this);
  }

  static getDerivedStateFromError(erro) {
    return { erro };
  }

  componentDidCatch(erro, info) {
    console.error("ErrorBoundary capturou um erro:", erro, info);
  }

  tentarNovamente() {
    this.setState({ erro: null });
  }

  voltar() {
    let destino = "/";
    try {
      const slug = (window.localStorage.getItem("slug") || "").trim();
      if (slug) destino = "/" + slug;
    } catch (e) { /* ignora */ }
    window.location.href = destino;
  }

  render() {
    if (!this.state.erro) return this.props.children;

    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, background: "#f8fafc", fontFamily: "sans-serif" }}>
        <div style={{ background: "#fff", borderRadius: 16, padding: 24, maxWidth: 380, width: "100%", textAlign: "center", boxShadow: "0 4px 15px rgba(0,0,0,0.08)" }}>
          <div style={{ fontSize: "2.4rem", marginBottom: 8 }}>😕</div>
          <h3 style={{ margin: "0 0 8px", color: "#1a202c" }}>Algo deu errado nesta tela</h3>
          <p style={{ margin: "0 0 18px", color: "#4a5568", fontSize: "0.95rem" }}>
            {this.props.mensagem || "Seus dados continuam salvos. Tente novamente ou volte ao cardápio."}
          </p>
          <button
            type="button"
            onClick={this.tentarNovamente}
            style={{ width: "100%", padding: 14, border: "none", borderRadius: 12, background: "#E84F3D", color: "#fff", fontWeight: 800, fontSize: "1rem", cursor: "pointer", marginBottom: 10 }}
          >
            Tentar novamente
          </button>
          <button
            type="button"
            onClick={this.voltar}
            style={{ width: "100%", padding: 14, border: "2px solid #E84F3D", borderRadius: 12, background: "#fff", color: "#E84F3D", fontWeight: 800, fontSize: "1rem", cursor: "pointer" }}
          >
            Voltar ao cardápio
          </button>
        </div>
      </div>
    );
  }
}