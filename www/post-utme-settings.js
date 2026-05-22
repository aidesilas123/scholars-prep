// --- AUTH GUARD ---
(function protectPage() {
    const putmeUser = localStorage.getItem('post_utme_logged_in_user');
    if (!putmeUser) window.location.replace('post-utme-login.html'); 
})();

document.addEventListener('DOMContentLoaded', () => {
    // Theme Inheritance
    const isDark = localStorage.getItem('post_utme_theme') === 'dark' || localStorage.getItem('theme') === 'dark' || document.documentElement.classList.contains('dark');
    if (isDark) {
        document.body.classList.add('dark');
        document.body.classList.add('dark-mode');
    }
    
    // Initialize Navigation Stack
    history.replaceState({ view: 'view-list' }, '', '');
});

// --- LINEAR NAVIGATION ENGINE ---
function switchView(viewId, pushToHistory = true) {
    document.querySelectorAll('.view-layer').forEach(v => v.classList.remove('active'));
    document.getElementById(viewId).classList.add('active');
    if (pushToHistory) history.pushState({ view: viewId }, '', '');
}

window.addEventListener('popstate', (e) => {
    if (e.state && e.state.view) {
        switchView(e.state.view, false);
    } else {
        window.location.replace('post-utme-dashboard.html');
    }
});

// --- STATIC CONTENT DATA ---
const settingsData = {
    about: {
        title: "About Us",
        html: `<h2>Welcome to Scholars Prep</h2>
               <p>Scholars Prep is the premier digital learning environment specifically tailored for Ahmadu Bello University (ABU) aspirants.</p>
               <p>Our platform bridges the gap between preparation and success, offering an ultra-realistic CBT environment, an integrated AI Tutor (Nexus), and comprehensive track records of your performance.</p>`
    },
    contact: {
        title: "Contact Support",
        html: `<h2>We're Here to Help</h2>
               <p>Having issues with your account, payments, or just need academic guidance? Reach out to our dedicated support team.</p>
               <br>
               <a href="tel:07081567555" class="contact-btn btn-phone">
                   <ion-icon name="call"></ion-icon> Call Us: 07081567555
               </a>
               <a href="mailto:abuscholarsprep@gmail.com" class="contact-btn btn-email">
                   <ion-icon name="mail"></ion-icon> Email Support
               </a>`
    },
    privacy: {
        title: "Privacy Policy",
        html: `<h2>Your Privacy Matters</h2>
               <p>At Scholars Prep, we collect essential data such as your name, email, and exam scores strictly to provide you with personalized learning analytics and progress tracking.</p>
               <p>We do not share, sell, or distribute your personal data to any third-party advertisers. All passwords and session tokens are securely encrypted via Supabase.</p>`
    },
    terms: {
        title: "Terms & Conditions",
        html: `<h2>Usage Terms</h2>
               <p>By using Scholars Prep, you agree to engage with our educational materials for personal study and preparation only.</p>
               <p>Our mock exams and question banks are compiled from historical data to simulate the POST UTME experience, but we do not guarantee specific questions will appear in your actual examination.</p>`
    },
    refund: {
        title: "Refund Policy",
        html: `<h2>Subscription Refunds</h2>
               <p>Because Scholars Prep provides immediate access to digital goods and premium AI processing, all subscription purchases are generally final.</p>
               <p>However, if you experience severe technical issues preventing access within 24 hours of your payment, please contact support via the Contact Us page for a manual review.</p>`
    }
};

// --- DYNAMIC INJECTION & SKELETON UX ---
window.openDetail = function(pageKey) {
    const data = settingsData[pageKey];
    
    document.getElementById('detailTitle').innerText = data.title;
    document.getElementById('contentSkeleton').style.display = 'block';
    document.getElementById('detailContent').style.display = 'none';
    
    // Slide into the view immediately
    switchView('view-details');

    // Simulate network delay for the UX Skeleton feel
    setTimeout(() => {
        document.getElementById('contentSkeleton').style.display = 'none';
        document.getElementById('detailContent').innerHTML = data.html;
        document.getElementById('detailContent').style.display = 'block';
    }, 400); // 400ms feels fast but noticeable
};