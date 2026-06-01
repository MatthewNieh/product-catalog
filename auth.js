const AUTH_KEY = "nistech-catalog-authenticated";
const CATALOG_PASSWORD = "nistech888";

if (window.location.pathname.endsWith("/login.html") || window.location.pathname === "/login.html") {
  initLoginPage();
} else {
  guardCataloguePage();
}

function initLoginPage() {
  if (sessionStorage.getItem(AUTH_KEY) === "true") {
    window.location.href = "index.html";
    return;
  }

  const form = document.getElementById("login-form");
  const passwordInput = document.getElementById("password-input");
  const errorMessage = document.getElementById("login-error");

  if (!form || !passwordInput || !errorMessage) {
    return;
  }

  form.addEventListener("submit", (event) => {
    event.preventDefault();

    if (passwordInput.value === CATALOG_PASSWORD) {
      sessionStorage.setItem(AUTH_KEY, "true");
      window.location.href = "index.html";
      return;
    }

    errorMessage.classList.remove("hidden");
    passwordInput.select();
  });
}

function guardCataloguePage() {
  if (sessionStorage.getItem(AUTH_KEY) !== "true") {
    window.location.href = "login.html";
  }
}
