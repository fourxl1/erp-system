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
  const [showPassword, setShowPassword] = useState(false);

  function handleChange(event) {
    const { name, value } = event.target;
    if (error) {
      setError("");
    }
    setFormData({ ...formData, [name]: value });
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (!formData.email.trim() || !formData.password) {
      setError("Username and password are required");
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
      <section className="login-card" aria-labelledby="login-title">
        <BrandMark centered minimal />

        <div className="login-card__header">
          <h1 id="login-title">Sign in</h1>
          <p>Use your account credentials to access the ERP system.</p>
        </div>

        <form className="login-card__form" onSubmit={handleSubmit} noValidate>
          <label className="field">
            <span>Username</span>
            <input
              type="text"
              name="email"
              placeholder="Enter your email"
              value={formData.email}
              onChange={handleChange}
              autoComplete="username"
              inputMode="email"
              aria-invalid={Boolean(error)}
              aria-describedby={error ? "login-error" : undefined}
            />
          </label>

          <label className="field">
            <span>Password</span>
            <div className="login-card__password-field">
              <input
                type={showPassword ? "text" : "password"}
                name="password"
                placeholder="Enter your password"
                value={formData.password}
                onChange={handleChange}
                autoComplete="current-password"
                aria-invalid={Boolean(error)}
                aria-describedby={error ? "login-error" : undefined}
              />

              <button
                type="button"
                className="login-card__password-toggle"
                onClick={() => setShowPassword((current) => !current)}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>
          </label>

          {error ? (
            <p className="form-error" id="login-error" role="alert">
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            className="login-card__submit"
            disabled={isSubmitting}
            aria-busy={isSubmitting}
          >
            <span
              className={`login-card__submit-spinner${
                isSubmitting ? " login-card__submit-spinner--visible" : ""
              }`}
              aria-hidden="true"
            />
            <span>{isSubmitting ? "Signing in..." : "Log in"}</span>
          </button>
        </form>
      </section>
    </div>
  );
}

export default Login;
