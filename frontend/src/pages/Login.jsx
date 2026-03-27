import { useState } from "react";
import { useNavigate } from "react-router-dom";
import BrandMark from "../components/BrandMark";
import { loginUser } from "../services/api";

function Login() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    email: "",
    password: ""
  });
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  function handleChange(event) {
    const { name, value } = event.target;
    setFormData({ ...formData, [name]: value });
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (!formData.email.trim() || !formData.password) {
      setError("Email and password are required");
      return;
    }

    setError("");
    setIsSubmitting(true);

    try {
      const response = await loginUser(formData);

      localStorage.setItem("token", response.token);
      localStorage.setItem(
        "inventory-user",
        response.user?.full_name || response.user?.email || formData.email
      );
      localStorage.setItem("inventory-user-data", JSON.stringify(response.user || {}));

      navigate("/dashboard");
    } catch (requestError) {
      setError(requestError.message || "Login failed");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="login-screen">
      <div className="login-screen__backdrop" />

      <section className="login-screen__brand-panel">
        <div className="login-screen__badge">LATEX FOAM STORE</div>
        <BrandMark centered />

        <p className="login-screen__summary">
          Production inventory, stock movement, and warehouse visibility for the
          LATEX FOAM Store.
        </p>

        <div className="login-screen__highlights">
          <div className="login-screen__highlight">
            <strong>Stock Management Ready</strong>
            <span>Track stock levels, movement history, and low-stock risk.</span>
          </div>

          <div className="login-screen__highlight">
            <strong>Operations Focused</strong>
            <span>Designed for procurement, storekeeping, and production flow.</span>
          </div>
        </div>
      </section>

      <section className="login-card">
        <div className="login-card__header">
          <span className="login-card__eyebrow">Secure Access</span>
          <h1>Sign in to your account</h1>
          <p>Enter your login details.</p>
        </div>

        <form className="login-card__form" onSubmit={handleSubmit}>
          <label className="field">
            <span>Email</span>
            <input
              type="email"
              name="email"
              placeholder="storekeeper@latexfoam.com"
              value={formData.email}
              onChange={handleChange}
            />
          </label>

          <label className="field">
            <span>Password</span>
            <input
              type="password"
              name="password"
              placeholder="Enter your password"
              value={formData.password}
              onChange={handleChange}
            />
          </label>

          <button
            type="submit"
            className="primary-button"
            disabled={isSubmitting}
          >
            {isSubmitting ? "Signing In..." : "Enter Dashboard"}
          </button>

          {error ? <p className="form-error">{error}</p> : null}
        </form>

        <div className="login-card__footer">
          <span>Copyright 2026 Four XL. All rights reserved.</span>
          <span>Inventory and maintenance operations</span>
        </div>
      </section>
    </div>
  );
}

export default Login;
