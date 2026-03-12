// js/auth.js

// 1. CREDENCIALES (Cámbialas a tu gusto)
const USER_AUTH = "admin";
const PASS_AUTH = "morales2026";

// 2. LÓGICA DE LOGIN (Solo para index.html)
const loginForm = document.getElementById('loginForm');
if (loginForm) {
    loginForm.addEventListener('submit', (e) => {
        e.preventDefault();
        
        const user = document.getElementById('userInput').value;
        const pass = document.getElementById('passInput').value;
        const errorMsg = document.getElementById('errorMsg');

        if (user === USER_AUTH && pass === PASS_AUTH) {
            // Guardamos la sesión (expira al cerrar el navegador o limpiar caché)
            localStorage.setItem('isLoggedIn', 'true');
            window.location.href = 'dashboard.html';
        } else {
            errorMsg.style.display = 'block';
            setTimeout(() => { errorMsg.style.display = 'none'; }, 3000);
        }
    });
}

// 3. PROTECCIÓN DE RUTA (Para dashboard.html, history.html, etc.)
// Si el archivo actual NO es index.html y no hay sesión, expulsar.
if (!window.location.pathname.includes('index.html') && window.location.pathname !== '/') {
    if (localStorage.getItem('isLoggedIn') !== 'true') {
        window.location.href = 'index.html';
    }
}

// 4. FUNCIÓN DE CERRAR SESIÓN (Para usar en el sidebar luego)
window.logout = () => {
    localStorage.removeItem('isLoggedIn');
    window.location.href = 'index.html';
};